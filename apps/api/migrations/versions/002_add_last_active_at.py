"""Add last_active_at to users table

Revision ID: 002
Revises: 001_initial_schema
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "002_add_last_active_at"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_last_active_at", "users", ["last_active_at"])


def downgrade() -> None:
    op.drop_index("ix_users_last_active_at", table_name="users")
    op.drop_column("users", "last_active_at")
