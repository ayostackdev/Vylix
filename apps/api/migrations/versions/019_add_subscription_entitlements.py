"""add quota/storage entitlement columns to subscriptions

Revision ID: 019
Revises: 018
Create Date: 2026-08-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Backfill for pre-existing active "premium" subscribers: keep them working by
# granting a generous quota instead of silently dropping them to the free tier.
_LEGACY_QUOTA = 36_500  # ~100 AI queries/day for a year
_LEGACY_STORAGE = 500 * 1024 * 1024  # 500 MB


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("quota_total", sa.Integer(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("quota_used", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "subscriptions",
        sa.Column("storage_bytes_total", sa.Integer(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("storage_bytes_used", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )

    op.execute(
        sa.text(
            "UPDATE subscriptions "
            "SET quota_total = :quota, storage_bytes_total = :storage "
            "WHERE status = 'active' AND plan = 'premium' AND quota_total IS NULL"
        ).bindparams(quota=_LEGACY_QUOTA, storage=_LEGACY_STORAGE)
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "storage_bytes_used")
    op.drop_column("subscriptions", "storage_bytes_total")
    op.drop_column("subscriptions", "quota_used")
    op.drop_column("subscriptions", "quota_total")
