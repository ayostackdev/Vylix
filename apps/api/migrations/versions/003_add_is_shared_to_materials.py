"""Add is_shared to materials table

Revision ID: 003
Revises: 002_add_last_active_at
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "003_add_is_shared_to_materials"
down_revision = "002_add_last_active_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "materials",
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.drop_index("ix_materials_is_seed", table_name="materials")
    op.create_index("ix_materials_is_shared", "materials", ["is_shared"])


def downgrade() -> None:
    op.drop_index("ix_materials_is_shared", table_name="materials")
    op.drop_column("materials", "is_shared")
    op.create_index("ix_materials_is_seed", "materials", ["is_seed"])
