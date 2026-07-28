"""Add daily AI token quota fields to users table

Revision ID: 006_add_ai_token_quota
Revises: 005_add_flashcards
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa

revision = "006_add_ai_token_quota"
down_revision = "005_add_flashcards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("daily_tokens_used", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("daily_tokens_limit", sa.Integer(), server_default=sa.text("15"), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("daily_tokens_reset_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "daily_tokens_reset_at")
    op.drop_column("users", "daily_tokens_limit")
    op.drop_column("users", "daily_tokens_used")
