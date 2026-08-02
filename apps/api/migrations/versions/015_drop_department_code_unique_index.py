"""drop leftover unique index on departments.code so codes can be reused across universities

Revision 009 attempted to drop the unique constraint on departments.code, but it only
looked for the constraint name ``departments_code_key``. In some environments the object
is a standalone unique INDEX named ``Department_code_key`` (created by metadata.create_all),
which does not appear in pg_constraint and was never dropped. That index blocks seeding the
same department codes (e.g. CSC) under multiple universities.

Revision ID: 015
Revises: 014
Create Date: 2026-08-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _unique_code_indexes(conn) -> list[str]:
    """Names of single-column unique indexes on departments.code (excluding the PK)."""
    rows = conn.execute(
        sa.text(
            """
            SELECT i.relname
            FROM pg_class i
            JOIN pg_index x ON x.indexrelid = i.oid
            WHERE i.relkind = 'i'
              AND x.indrelid = 'departments'::regclass
              AND x.indisunique
              AND NOT x.indisprimary
              AND x.indnkeyatts = 1
              AND x.indkey[0] = (
                  SELECT attnum FROM pg_attribute
                  WHERE attrelid = 'departments'::regclass AND attname = 'code'
              )
            """
        )
    )
    return [row[0] for row in rows]


def upgrade() -> None:
    conn = op.get_bind()
    for name in _unique_code_indexes(conn):
        op.drop_index(name, table_name="departments")


def downgrade() -> None:
    conn = op.get_bind()
    if not _unique_code_indexes(conn):
        op.create_index("Department_code_key", "departments", ["code"], unique=True)
