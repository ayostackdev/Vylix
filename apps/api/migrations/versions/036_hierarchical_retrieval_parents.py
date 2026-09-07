"""hierarchical retrieval: material_parents + parent_id link

Implements parent/child chunking so retrieval can match a small embedded child
chunk but hand the LLM the full parent context:

* ``material_parents`` -- one row per ~1000-token parent window: raw text kept
  unembedded (not candidates for the vector pass).
* ``material_chunks.parent_id`` -- FK to the child's parent; the vector query
  LEFT JOINs it so ``SearchResult.text`` is already the parent context.
* ``delete_document`` removes both tables.

Revision ID: 036
Revises: 035
Create Date: 2026-09-07
"""
from typing import Union

from alembic import op

revision: str = "036"
down_revision: Union[str, None] = "035"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS material_parents (
            id BIGSERIAL PRIMARY KEY,
            document_id TEXT NOT NULL,
            source_name TEXT NOT NULL DEFAULT '',
            parent_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (document_id, parent_index)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_material_parents_document_id "
        "ON material_parents (document_id)"
    )
    op.execute(
        """
        ALTER TABLE material_chunks
        ADD COLUMN IF NOT EXISTS parent_id BIGINT
        REFERENCES material_parents(id) ON DELETE SET NULL
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_material_chunks_parent_id "
        "ON material_chunks (parent_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_material_chunks_parent_id")
    op.execute("ALTER TABLE material_chunks DROP COLUMN IF EXISTS parent_id")
    op.execute("DROP INDEX IF EXISTS ix_material_parents_document_id")
    op.execute("DROP TABLE IF EXISTS material_parents")