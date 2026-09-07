from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import get_settings
from app.core.postgres import get_connection
from app.services.bge_m3 import colbert_maxsim, sparse_cosine
from app.services.embeddings import (
    HashingEmbeddingFunction,
    get_embedding_function,
)

try:
    import chromadb
except ImportError:  # pragma: no cover - optional dependency
    chromadb = None

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass(slots=True)
class SearchResult:
    id: str
    document_id: str
    source_name: str
    chunk_index: int
    text: str
    score: float


def _vector_literal(vector: list[float]) -> str:
    """Render a float list in pgvector's bracket-literal syntax (``[0.1, 0.2, ...]``)."""
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


_SCOPE_SYNC = """
UPDATE material_chunks mc
SET course_id = c.id,
    university_id = col.university_id
FROM materials m
JOIN topics t ON t.id = m.topic_id
JOIN courses c ON c.id = t.course_id
LEFT JOIN departments d ON d.id = c.department_id
LEFT JOIN colleges col ON col.id = d.college_id
WHERE mc.document_id = m.id::text AND mc.document_id = %s
"""


class PgVectorBackend:
    """pgvector-backed chunk store used for real semantic search.

    When the configured embedding provider supports sparse weights (BGE-M3),
    retrieval is hybrid: a scoped dense candidate pass feeds a Python
    dense+sparse re-rank so exact keyword matches (``MTH101``) and conceptual
    matches are fused without requiring ``pgvectorscale`` sparsevec indexing.
    """

    def __init__(self, embedding_function: Any | None = None) -> None:
        self.embedding_function = embedding_function or get_embedding_function()

    def _supports_sparse(self) -> bool:
        return bool(getattr(self.embedding_function, "supports_sparse", False))

    def _supports_colbert(self) -> bool:
        return bool(getattr(self.embedding_function, "supports_colbert", False))

    def _run_scope_sync(self, document_id: str, cursor: Any) -> None:
        cursor.execute(_SCOPE_SYNC, (document_id,))
        if cursor.rowcount == 0:
            logger.warning(
                "Chunks for document %s have no course scope (no matching "
                "material row); they will be invisible to institution-scoped "
                "retrieval.",
                document_id,
            )

    def upsert_document(
        self,
        document_id: str,
        source_name: str,
        chunks: list[str],
        metadata: dict[str, Any] | None = None,
    ) -> int:
        del metadata
        vectors = self.embedding_function.embed_documents(chunks)
        sparse_weights: list[str] | None = None
        if self._supports_sparse():
            lexical = self.embedding_function.embed_sparse(chunks)
            sparse_weights = [
                json.dumps({str(token): float(weight) for token, weight in weights.items()})
                for weights in lexical
            ]
        rows = [
            (
                document_id,
                source_name,
                index,
                chunk,
                _vector_literal(vector),
                sparse_weights[index] if sparse_weights else "{}",
            )
            for index, (chunk, vector) in enumerate(zip(chunks, vectors))
        ]
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("DELETE FROM material_chunks WHERE document_id = %s", (document_id,))
            cursor.executemany(
                """
                INSERT INTO material_chunks
                    (document_id, source_name, chunk_index, content, embedding, sparse_weights)
                VALUES (%s, %s, %s, %s, %s::vector, %s::jsonb)
                """,
                rows,
            )
            if document_id:
                self._run_scope_sync(document_id, cursor)
            conn.commit()
        return len(rows)

    def upsert_hierarchical_document(
        self,
        document_id: str,
        source_name: str,
        parents: list[str],
        children_by_parent: list[list[str]],
        metadata: dict[str, Any] | None = None,
    ) -> int:
        """Store parent windows (raw, unembedded) plus embedded child windows.

        Children are embedded and linked to their parent row via ``parent_id``
        so retrieval can match the small child but answer with the full parent
        context.
        """
        del metadata
        if len(parents) != len(children_by_parent):
            raise ValueError("parents and children_by_parent must align")
        child_texts = [child for group in children_by_parent for child in group]

        vectors = self.embedding_function.embed_documents(child_texts)
        sparse_weights: list[str] | None = None
        if self._supports_sparse():
            lexical = self.embedding_function.embed_sparse(child_texts)
            sparse_weights = [
                json.dumps({str(token): float(weight) for token, weight in weights.items()})
                for weights in lexical
            ]

        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("DELETE FROM material_chunks WHERE document_id = %s", (document_id,))
            cursor.execute("DELETE FROM material_parents WHERE document_id = %s", (document_id,))

            parent_ids: list[Any] = []
            for parent_index, parent_text in enumerate(parents):
                cursor.execute(
                    """
                    INSERT INTO material_parents (document_id, source_name, parent_index, content)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (document_id, source_name, parent_index, parent_text),
                )
                row = cursor.fetchone()
                parent_ids.append(row["id"] if row else None)

            rows = []
            global_index = 0
            for group_index, group in enumerate(children_by_parent):
                for chunk in group:
                    rows.append(
                        (
                            document_id,
                            source_name,
                            global_index,
                            chunk,
                            _vector_literal(vectors[global_index]),
                            sparse_weights[global_index] if sparse_weights else "{}",
                            parent_ids[group_index],
                        )
                    )
                    global_index += 1
            cursor.executemany(
                """
                INSERT INTO material_chunks
                    (document_id, source_name, chunk_index, content, embedding,
                     sparse_weights, parent_id)
                VALUES (%s, %s, %s, %s, %s::vector, %s::jsonb, %s)
                """,
                rows,
            )
            if document_id:
                self._run_scope_sync(document_id, cursor)
            conn.commit()
        return len(child_texts)

    def query(
        self,
        text: str,
        top_k: int = 5,
        course_id: str | None = None,
        document_id: str | None = None,
    ) -> list[SearchResult]:
        vector = self.embedding_function.embed_query(text)
        sparse: dict[int, float] | None = None
        if self._supports_sparse():
            sparse = self.embedding_function.embed_sparse([text])[0]

        candidate_count = max(top_k, settings.embedding_candidate_count)
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT mc.id, mc.document_id, mc.source_name, mc.chunk_index,
                       mc.content, mc.sparse_weights, mp.content AS parent_content,
                       1 - (mc.embedding <=> %s::vector) AS similarity
                FROM material_chunks mc
                LEFT JOIN material_parents mp ON mp.id = mc.parent_id
                WHERE mc.embedding IS NOT NULL
                  AND (%s::text IS NULL OR mc.document_id = %s)
                  AND (%s::uuid IS NULL OR mc.course_id = %s)
                ORDER BY mc.embedding <=> %s::vector
                LIMIT %s
                """,
                (
                    _vector_literal(vector),
                    document_id,
                    document_id,
                    course_id,
                    course_id,
                    _vector_literal(vector),
                    candidate_count,
                ),
            )
            rows = cursor.fetchall()

        dense_weight = float(settings.embedding_dense_weight)
        sparse_weight = 1.0 - dense_weight
        scored = []
        for row in rows:
            similarity = float(row["similarity"])
            if sparse is not None and row.get("sparse_weights"):
                document_sparse = {
                    int(token): float(weight)
                    for token, weight in row["sparse_weights"].items()
                }
                score = dense_weight * similarity + sparse_weight * sparse_cosine(
                    sparse, document_sparse
                )
            else:
                score = similarity
            scored.append((score, row))

        scored.sort(key=lambda item: item[0], reverse=True)

        # Optional ColBERT late-interaction rerank: re-encode the top candidates
        # (child chunks, not parents) plus the query in one batched forward pass
        # and blend the token-level MaxSim score with the hybrid score. This adds
        # no storage because only the handful of candidate texts are encoded at
        # query time.
        if float(settings.embedding_colbert_weight) > 0.0 and self._supports_colbert():
            scored = self._colbert_rerank(text, scored, top_k)

        results: list[SearchResult] = []
        for score, row in scored[:top_k]:
            context = row.get("parent_content") or row["content"]
            results.append(
                SearchResult(
                    id=str(row["id"]),
                    document_id=str(row["document_id"]),
                    source_name=str(row["source_name"]),
                    chunk_index=int(row["chunk_index"]),
                    text=str(context),
                    score=score,
                )
            )
        return results

    def _colbert_rerank(
        self,
        text: str,
        scored: list[tuple[float, dict[str, Any]]],
        top_k: int,
    ) -> list[tuple[float, dict[str, Any]]]:
        """Blend ColBERT MaxSim into the top candidates' hybrid scores.

        ``scored`` is ``[(hybrid_score, row), ...]`` already sorted descending.
        The ``row`` entries come from the candidate SQL and must carry a
        ``content`` key (the embedded child text). Vectors are computed on the
        fly for the query plus the top ``embedding_rerank_candidates`` rows only,
        so nothing is stored in the database.
        """
        colbert_weight = float(settings.embedding_colbert_weight)
        rerank_count = max(top_k, int(settings.embedding_rerank_candidates))
        pool = scored[:rerank_count]
        if not pool:
            return scored

        query_vecs, *document_vecs = self.embedding_function.embed_colbert(
            [text] + [item[1]["content"] for item in pool]
        )
        reranked = []
        for (hybrid_score, row), document_vec in zip(pool, document_vecs):
            maxsim = colbert_maxsim(query_vecs, document_vec)
            reranked.append(
                (colbert_weight * maxsim + (1.0 - colbert_weight) * hybrid_score, row)
            )
        reranked.sort(key=lambda item: item[0], reverse=True)
        return reranked

    def delete_document(self, document_id: str) -> None:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("DELETE FROM material_chunks WHERE document_id = %s", (document_id,))
            cursor.execute("DELETE FROM material_parents WHERE document_id = %s", (document_id,))
            conn.commit()


def _chroma_where(
    course_id: str | None, document_id: str | None
) -> dict[str, Any] | None:
    clauses: list[dict[str, Any]] = []
    if course_id:
        clauses.append({"course_id": course_id})
    if document_id:
        clauses.append({"document_id": document_id})
    if not clauses:
        return None
    return clauses[0] if len(clauses) == 1 else {"$and": clauses}


class VectorStore:
    """Chunk vector store with a pgvector primary backend and ChromaDB fallback.

    Backend selection follows ``VECTOR_STORE_BACKEND``:

    * ``pgvector`` (or ``auto`` with ``GEMINI_API_KEY`` set) stores embeddings in the
      ``material_chunks`` Postgres table via HNSW search.
    * ``chromadb`` (or ``auto`` without a Gemini key) keeps the legacy local ChromaDB
      collection, using hashing embeddings.
    * If the pgvector migration hasn't been applied, any pgvector call fails cleanly and
      queries/upserts fall back to ChromaDB so nothing breaks.
    """

    def __init__(
        self,
        persist_directory: str | Path = "./tmp/chromadb",
        collection_name: str = "vylix_documents",
        backend: str | None = None,
    ) -> None:
        self.embedding_function = HashingEmbeddingFunction()
        self.persist_directory = Path(persist_directory)
        self.collection_name = collection_name
        self._fallback_records: list[dict[str, Any]] = []
        self._client = None
        self._collection = None
        self._pg_backend: PgVectorBackend | None = None

        selected = (backend or settings.vector_store_backend or "auto").lower()
        if selected not in ("auto", "pgvector", "chromadb"):
            logger.warning("Unknown VECTOR_STORE_BACKEND %r; using 'auto'.", selected)
            selected = "auto"

        provider_embedding = get_embedding_function()
        provider_dims = int(
            getattr(provider_embedding, "dimensions", None) or settings.embedding_dimensions
        )
        use_pgvector = not isinstance(provider_embedding, HashingEmbeddingFunction)
        if use_pgvector and provider_dims != settings.embedding_dimensions:
            logger.warning(
                "Embedding provider %s emits %d-dim vectors but pgvector expects %d "
                "(EMBEDDING_DIMENSIONS); falling back to ChromaDB.",
                provider_embedding.name(),
                provider_dims,
                settings.embedding_dimensions,
            )
            use_pgvector = False
        if selected == "pgvector":
            if use_pgvector:
                self._pg_backend = PgVectorBackend(embedding_function=provider_embedding)
                logger.info(
                    "Vector store: pgvector (%s)",
                    self._pg_backend.embedding_function.name(),
                )
            else:
                logger.warning(
                    "pgvector backend requested but no real embedding provider is "
                    "available (no GEMINI_API_KEY and no FlagEmbedding); using ChromaDB.",
                )
        elif selected == "auto" and use_pgvector:
            self._pg_backend = PgVectorBackend(embedding_function=provider_embedding)
            logger.info(
                "Vector store: pgvector (%s)",
                self._pg_backend.embedding_function.name(),
            )

        if self._pg_backend is None:
            logger.info("Vector store: ChromaDB (%s)", self.embedding_function.name())
        self._init_chroma()

    def _init_chroma(self) -> None:
        if chromadb is None:
            return
        self.persist_directory.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(self.persist_directory))
        self._collection = self._client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_function,
        )

    def upsert_document(
        self,
        document_id: str,
        source_name: str,
        chunks: list[str],
        metadata: dict[str, Any] | None = None,
    ) -> int:
        if self._pg_backend is not None:
            try:
                return self._pg_backend.upsert_document(
                    document_id, source_name, chunks, metadata or {}
                )
            except Exception:
                logger.exception(
                    "pgvector upsert failed for %s; falling back to ChromaDB", document_id
                )
        return self._chroma_upsert(document_id, source_name, chunks, metadata or {})

    def upsert_hierarchical_document(
        self,
        document_id: str,
        source_name: str,
        parents: list[str],
        children_by_parent: list[list[str]],
        metadata: dict[str, Any] | None = None,
    ) -> int:
        """Prefer pgvector parent/child storage; flatten to plain chunks for ChromaDB."""
        if self._pg_backend is not None:
            try:
                return self._pg_backend.upsert_hierarchical_document(
                    document_id,
                    source_name,
                    parents,
                    children_by_parent,
                    metadata or {},
                )
            except Exception:
                logger.exception(
                    "pgvector hierarchical upsert failed for %s; falling back to ChromaDB",
                    document_id,
                )
        child_texts = [child for group in children_by_parent for child in group]
        return self._chroma_upsert(document_id, source_name, child_texts, metadata or {})

    def _chroma_upsert(
        self,
        document_id: str,
        source_name: str,
        chunks: list[str],
        metadata: dict[str, Any],
    ) -> int:
        chunk_ids = [f"{document_id}-{index}" for index in range(len(chunks))]
        if self._collection is not None:
            self._collection.upsert(
                ids=chunk_ids,
                documents=chunks,
                metadatas=[
                    {
                        "document_id": document_id,
                        "source_name": source_name,
                        "chunk_index": index,
                        **metadata,
                    }
                    for index in range(len(chunks))
                ],
            )
        else:
            self._fallback_records.extend(
                {
                    "id": chunk_ids[index],
                    "document_id": document_id,
                    "source_name": source_name,
                    "chunk_index": index,
                    "text": chunk,
                    "metadata": metadata,
                }
                for index, chunk in enumerate(chunks)
            )
        return len(chunks)

    def query(
        self,
        text: str,
        top_k: int = 5,
        course_id: str | None = None,
        document_id: str | None = None,
    ) -> list[SearchResult]:
        if self._pg_backend is not None:
            try:
                return self._pg_backend.query(
                    text, top_k=top_k, course_id=course_id, document_id=document_id
                )
            except Exception:
                logger.exception("pgvector query failed; falling back to ChromaDB")
        return self._chroma_query(text, top_k, course_id=course_id, document_id=document_id)

    def _chroma_query(
        self,
        text: str,
        top_k: int,
        course_id: str | None = None,
        document_id: str | None = None,
    ) -> list[SearchResult]:
        if self._collection is not None:
            result = self._collection.query(
                query_texts=[text],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
                where=_chroma_where(course_id, document_id),
            )
            documents = result.get("documents", [[]])[0]
            metadatas = result.get("metadatas", [[]])[0]
            distances = result.get("distances", [[]])[0]
            search_results: list[SearchResult] = []
            for index, document in enumerate(documents):
                metadata = metadatas[index] or {}
                search_results.append(
                    SearchResult(
                        id=str(result.get("ids", [[]])[0][index]),
                        document_id=str(metadata.get("document_id", "")),
                        source_name=str(metadata.get("source_name", "")),
                        chunk_index=int(metadata.get("chunk_index", index)),
                        text=document,
                        score=float(1.0 - distances[index]) if distances else 0.0,
                    )
                )
            return search_results

        return self._fallback_query(text, top_k)

    def delete_document(self, document_id: str) -> None:
        """Remove all chunks for a document from every active backend."""
        if self._pg_backend is not None:
            try:
                self._pg_backend.delete_document(document_id)
            except Exception:
                logger.exception("pgvector delete failed for %s", document_id)
        if self._collection is not None:
            try:
                self._collection.delete(where={"document_id": document_id})
            except Exception:
                logger.warning("ChromaDB delete failed for %s", document_id)
        else:
            self._fallback_records = [
                record
                for record in self._fallback_records
                if record["document_id"] != document_id
            ]

    def _fallback_query(self, text: str, top_k: int) -> list[SearchResult]:
        if not self._fallback_records:
            return []

        texts = [record["text"] for record in self._fallback_records]
        matrix = self.embedding_function([text] + texts)
        query_vector = np.asarray(matrix[0], dtype=float)
        document_vectors = np.asarray(matrix[1:], dtype=float)
        similarities = document_vectors @ query_vector
        ranking = np.argsort(-similarities)[:top_k]

        results: list[SearchResult] = []
        for index in ranking:
            record = self._fallback_records[int(index)]
            results.append(
                SearchResult(
                    id=record["id"],
                    document_id=record["document_id"],
                    source_name=record["source_name"],
                    chunk_index=record["chunk_index"],
                    text=record["text"],
                    score=float(similarities[int(index)]),
                )
            )
        return results
