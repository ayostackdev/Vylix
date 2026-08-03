"""add pgvector material_chunks for semantic search

The vector search pipeline previously stored chunk embeddings in a local ChromaDB
directory (``tmp/chromadb``), which is ephemeral and wiped on every redeploy. This
migration introduces a Postgres-backed collection using the ``pgvector`` extension:

* ``material_chunks`` -- one row per text chunk. ``document_id`` mirrors the ChromaDB
  collection's ``document_id`` metadata: the material UUID when processed via Celery,
  or the file stem for ad-hoc document ingests. Embeddings use cosine distance with a
  fixed dimension (default ``text-embedding-004`` outputs 768).
* an HNSW index with ``vector_cosine_ops`` for approximate nearest-neighbour search.
* ``match_material_chunks(...)`` -- a stable SQL function returning the top-k chunks,
  optionally restricted to a single ``document_id``.

Revision ID: 017
Revises: 016
Create Date: 2026-08-03
"""
from typing import Sequence, Union

from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DIMENSIONS = 768


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute(
        f"""
        CREATE TABLE IF NOT EXISTS material_chunks (
            id BIGSERIAL PRIMARY KEY,
            document_id TEXT NOT NULL,
            source_name TEXT NOT NULL DEFAULT '',
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding VECTOR({DIMENSIONS}),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (document_id, chunk_index)
        )
        """
    )

    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS material_chunks_embedding_hnsw
        ON material_chunks USING hnsw (embedding vector_cosine_ops)
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_material_chunks_document_id "
        "ON material_chunks (document_id)"
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION match_material_chunks(
            query_embedding VECTOR(%(dim)s),
            match_document_id TEXT DEFAULT NULL,
            match_count INTEGER DEFAULT 5
        )
        RETURNS TABLE (
            id BIGINT,
            document_id TEXT,
            source_name TEXT,
            chunk_index INTEGER,
            content TEXT,
            similarity DOUBLE PRECISION
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RETURN QUERY
            SELECT
                mc.id,
                mc.document_id,
                mc.source_name,
                mc.chunk_index,
                mc.content,
                1 - (mc.embedding <=> query_embedding) AS similarity
            FROM material_chunks mc
            WHERE mc.embedding IS NOT NULL
              AND (match_document_id IS NULL OR mc.document_id = match_document_id)
            ORDER BY mc.embedding <=> query_embedding
            LIMIT match_count;
        END;
        $$
        """ % {"dim": DIMENSIONS}
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS match_material_chunks(VECTOR, TEXT, INTEGER)")
    op.execute("DROP INDEX IF EXISTS ix_material_chunks_document_id")
    op.execute("DROP INDEX IF EXISTS material_chunks_embedding_hnsw")
    op.execute("DROP TABLE IF EXISTS material_chunks")
