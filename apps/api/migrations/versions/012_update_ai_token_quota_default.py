"""Raise default daily AI token quota from 15 to 50

Revision ID: 012
Revises: 011
Create Date: 2026-07-31
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012"
down_revision: str | None = "011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE users SET daily_tokens_limit = 50 WHERE daily_tokens_limit = 15")
    op.alter_column(
        "users",
        "daily_tokens_limit",
        existing_type=sa.Integer(),
        server_default=sa.text("50"),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute("UPDATE users SET daily_tokens_limit = 15 WHERE daily_tokens_limit = 50")
    op.alter_column(
        "users",
        "daily_tokens_limit",
        existing_type=sa.Integer(),
        server_default=sa.text("15"),
        existing_nullable=False,
    )
