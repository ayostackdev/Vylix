"""semantic query cache for the academic agent (question-level dedup)

Adds a pgvector-backed semantic cache so repeated/similar student questions
short-circuit before material retrieval and the LLM call:

* ``semantic_cache`` -- one row per cached question/answer pair, scoped by
  ``course_id`` + ``tier``. ``question_embedding`` is ``VECTOR(1024)`` to match
  ``material_chunks.embedding`` (migration 035). Lookups use cosine distance
  (``<=>``) with a threshold from ``SEMANTIC_CACHE_THRESHOLD``; a hit returns
  the stored answer at zero token cost.
* Row-level security: service-table policy (``USING (true)``) consistent with
  ``material_chunks``/``uploaded_files`` -- only backend service paths read or
  write the cache; users never touch it directly. The RLS baseline in
  ``app.db_rls_baseline`` covers the new table via ``EXTRA_BASELINE_TABLES``
  because it is created outside SQLAlchemy metadata (raw SQL migration).

Revision ID: 037
Revises: 036
Create Date: 2026-09-07
"""
from __future__ import annotations

from typing import Union

from alembic import op

revision: str = "037"
down_revision: Union[str, None] = "036"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None

DIMENSIONS = 1024


def upgrade() -> None:
    op.execute(
        f"""
        CREATE TABLE IF NOT EXISTS semantic_cache (
            id BIGSERIAL PRIMARY KEY,
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            tier TEXT NOT NULL DEFAULT 'standard',
            question_embedding VECTOR({DIMENSIONS}) NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            hit_count INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS semantic_cache_embedding_hnsw "
        f"ON semantic_cache USING hnsw (question_embedding vector_cosine_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_semantic_cache_course_tier "
        "ON semantic_cache (course_id, tier)"
    )
    # Service-table RLS, matching the generated statements in
    # app/db_rls_baseline for a "service" TableSpec.
    op.execute("ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE semantic_cache FORCE ROW LEVEL SECURITY")
    for cmd, clause in (
        ("SELECT", "USING (true)"),
        ("INSERT", "WITH CHECK (true)"),
        ("UPDATE", "USING (true) WITH CHECK (true)"),
        ("DELETE", "USING (true)"),
    ):
        op.execute(
            f"CREATE POLICY semantic_cache_rls_{cmd.lower()} "
            f"ON semantic_cache FOR {cmd} {clause}"
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS semantic_cache")