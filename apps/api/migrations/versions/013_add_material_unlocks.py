"""Add material_unlocks table for share-to-unlock loop

Revision ID: 013
Revises: 012
Create Date: 2026-07-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "013"
down_revision: str | None = "012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "material_unlocks",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("material_id", sa.String(36), sa.ForeignKey("materials.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referrer_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "material_id", name="uq_material_unlocks_user_material"),
    )
    op.create_index("ix_material_unlocks_material_id", "material_unlocks", ["material_id"])
    op.create_index("ix_material_unlocks_user_id", "material_unlocks", ["user_id"])
    op.create_index("ix_material_unlocks_referrer_id", "material_unlocks", ["referrer_id"])


def downgrade() -> None:
    op.drop_index("ix_material_unlocks_referrer_id", table_name="material_unlocks")
    op.drop_index("ix_material_unlocks_user_id", table_name="material_unlocks")
    op.drop_index("ix_material_unlocks_material_id", table_name="material_unlocks")
    op.drop_table("material_unlocks")
