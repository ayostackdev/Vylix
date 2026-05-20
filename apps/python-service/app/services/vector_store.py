from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.preprocessing import normalize

try:
    import chromadb
except ImportError:  # pragma: no cover - optional dependency
    chromadb = None


@dataclass(slots=True)
class SearchResult:
    id: str
    document_id: str
    source_name: str
    chunk_index: int
    text: str
    score: float


class HashingEmbeddingFunction:
    def __init__(self, n_features: int = 256) -> None:
        self.vectorizer = HashingVectorizer(
            n_features=n_features,
            alternate_sign=False,
            norm=None,
            stop_words="english",
        )

    def __call__(self, input: list[str]) -> list[list[float]]:
        matrix = self.vectorizer.transform(input)
        normalized = normalize(matrix, norm="l2")
        return normalized.toarray().tolist()


class VectorStore:
    def __init__(self, persist_directory: str | Path = "./tmp/chromadb", collection_name: str = "campulse_documents") -> None:
        self.embedding_function = HashingEmbeddingFunction()
        self.persist_directory = Path(persist_directory)
        self.collection_name = collection_name
        self._fallback_records: list[dict[str, Any]] = []
        self._client = None
        self._collection = None

        if chromadb is not None:
            self.persist_directory.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(path=str(self.persist_directory))
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=self.embedding_function,
            )

    def upsert_document(self, document_id: str, source_name: str, chunks: list[str], metadata: dict[str, Any] | None = None) -> int:
        metadata = metadata or {}
        chunk_ids = [f"{document_id}-{index}" for index in range(len(chunks))]
        records = [
            {
                "id": chunk_ids[index],
                "document_id": document_id,
                "source_name": source_name,
                "chunk_index": index,
                "text": chunk,
                "metadata": metadata,
            }
            for index, chunk in enumerate(chunks)
        ]

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
            self._fallback_records.extend(records)

        return len(chunks)

    def query(self, text: str, top_k: int = 5) -> list[SearchResult]:
        if self._collection is not None:
            result = self._collection.query(
                query_texts=[text],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
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