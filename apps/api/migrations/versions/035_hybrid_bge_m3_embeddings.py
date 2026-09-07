"""hybrid bge-m3 embeddings: sparse weights + 1024-dim vectors

Moves the semantic-search backend from Gemini's 768-dim embeddings to the
self-hosted BGE-M3 provider (1024-dim dense + learned sparse lexical weights):

* ``material_chunks.sparse_weights`` -- JSONB map of ``token_id -> weight``
  used by the hybrid rerank for exact keyword matches (``MTH101``/``STA401``).
* ``material_chunks.embedding`` resized ``VECTOR(768) -> VECTOR(1024)``. Old
  Gemini rows keep their 768-dim values and become ``NULL`` here (pgvector
  columns are fixed-dimension); mark those documents for re-ingestion. The
  HNSW index is dropped and rebuilt at the new dimension.
* ``match_material_chunks`` recreated for the 1024-dim signature so legacy
  callers (and tests) keep working.

Revision ID: 035
Revises: 034
Create Date: 2026-09-07
"""
from typing import Union

from alembic import op

revision: str = "035"
down_revision: Union[str, None] = "034"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None

OLD_DIMENSIONS = 768
DIMENSIONS = 1024


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute(
        """
        ALTER TABLE material_chunks
        ADD COLUMN IF NOT EXISTS sparse_weights JSONB NOT NULL DEFAULT '{}'::jsonb
        """
    )

    op.execute("DROP INDEX IF EXISTS material_chunks_embedding_hnsw")

    op.execute(
        f"""
        ALTER TABLE material_chunks
        ALTER COLUMN embedding TYPE VECTOR({DIMENSIONS})
        USING CASE
            WHEN array_length(embedding::real[], 1) = {DIMENSIONS}
                THEN embedding::VECTOR({DIMENSIONS})
            ELSE NULL
        END
        """
    )

    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS material_chunks_embedding_hnsw
        ON material_chunks USING hnsw (embedding vector_cosine_ops)
        """
    )

    op.execute(
        f"DROP FUNCTION IF EXISTS match_material_chunks(VECTOR({OLD_DIMENSIONS}), TEXT, INTEGER)"
    )
    op.execute(
        f"DROP FUNCTION IF EXISTS match_material_chunks(VECTOR({OLD_DIMENSIONS}), TEXT, INTEGER, UUID)"
    )
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION match_material_chunks(
            query_embedding VECTOR({DIMENSIONS}),
            match_document_id TEXT DEFAULT NULL,
            match_count INTEGER DEFAULT 5,
            match_course_id UUID DEFAULT NULL
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
              AND (match_course_id IS NULL OR mc.course_id = match_course_id)
            ORDER BY mc.embedding <=> query_embedding
            LIMIT match_count;
        END;
        $$
        """
    )


def downgrade() -> None:
    op.execute(
        f"DROP FUNCTION IF EXISTS match_material_chunks(VECTOR({DIMENSIONS}), TEXT, INTEGER, UUID)"
    )
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION match_material_chunks(
            query_embedding VECTOR({OLD_DIMENSIONS}),
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
        """
    )

    op.execute("DROP INDEX IF EXISTS material_chunks_embedding_hnsw")
    op.execute(
        f"""
        ALTER TABLE material_chunks
        ALTER COLUMN embedding TYPE VECTOR({OLD_DIMENSIONS})
        USING CASE
            WHEN array_length(embedding::real[], 1) = {OLD_DIMENSIONS}
                THEN embedding::VECTOR({OLD_DIMENSIONS})
            ELSE NULL
        END
        """
    )
    op.execute(
        f"""
        CREATE INDEX IF NOT EXISTS material_chunks_embedding_hnsw
        ON material_chunks USING hnsw (embedding vector_cosine_ops)
        """
    )
    op.execute(
        """
        ALTER TABLE material_chunks
        DROP COLUMN IF EXISTS sparse_weights
        """
    )