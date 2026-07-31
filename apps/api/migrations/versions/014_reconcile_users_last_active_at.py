"""Reconcile users table: add missing last_active_at column

Revision ID: 014
Revises: 013
Create Date: 2026-07-31

The shared production database is missing columns that were claimed to be
applied by earlier migrations (002_add_last_active_at).  The ORM User model
selects last_active_at on every row load, so any query touching users fails
with "column users.last_active_at does not exist".  Add it idempotently so
re-running is safe.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014"
down_revision: str | None = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamp with time zone"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_last_active_at ON users (last_active_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_last_active_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_active_at")
