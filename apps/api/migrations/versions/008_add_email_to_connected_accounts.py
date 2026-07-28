from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: str | None = "007_add_subscriptions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("connected_accounts", sa.Column("email", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("connected_accounts", "email")
