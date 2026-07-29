"""drop unique constraint from department.code so codes can be reused across universities

Revision ID: 009
Revises: 008
Create Date: 2025-07-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_constraint WHERE conname = 'departments_code_key'")
    )
    if result.scalar():
        op.drop_constraint("departments_code_key", "departments", type_="unique")


def downgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_constraint WHERE conname = 'departments_code_key'")
    )
    if not result.scalar():
        op.create_unique_constraint("departments_code_key", "departments", ["code"])
