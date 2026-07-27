"""Add flashcard decks and flashcards tables

Revision ID: 005_add_flashcards
Revises: 004_enable_rls
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa

revision = "005_add_flashcards"
down_revision = "004_enable_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "flashcard_decks",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("document_id", sa.String()),
        sa.Column("course_code", sa.String()),
        sa.Column("card_count", sa.Integer(), server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_flashcard_decks_user_id", "flashcard_decks", ["user_id"])

    op.create_table(
        "flashcards",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("deck_id", sa.UUID(), sa.ForeignKey("flashcard_decks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("front", sa.Text(), nullable=False),
        sa.Column("back", sa.Text(), nullable=False),
        sa.Column("ease_factor", sa.Float(), server_default=sa.text("2.5")),
        sa.Column("interval_days", sa.Integer(), server_default=sa.text("0")),
        sa.Column("next_review", sa.DateTime(timezone=True)),
        sa.Column("review_count", sa.Integer(), server_default=sa.text("0")),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_flashcards_deck_id", "flashcards", ["deck_id"])
    op.create_index("ix_flashcards_next_review", "flashcards", ["next_review"])

    op.execute("ALTER TABLE flashcard_decks ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY flashcard_decks_user_policy ON flashcard_decks
        USING (user_id::text = current_setting('app.current_user_id', true))
        WITH CHECK (user_id::text = current_setting('app.current_user_id', true));
    """)
    op.execute("""
        CREATE POLICY flashcards_user_policy ON flashcards
        USING (deck_id IN (SELECT id FROM flashcard_decks WHERE user_id::text = current_setting('app.current_user_id', true)))
        WITH CHECK (deck_id IN (SELECT id FROM flashcard_decks WHERE user_id::text = current_setting('app.current_user_id', true)));
    """)


def downgrade() -> None:
    op.drop_policy("flashcards_user_policy", table_name="flashcards")
    op.drop_policy("flashcard_decks_user_policy", table_name="flashcard_decks")
    op.execute("ALTER TABLE flashcards DISABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE flashcard_decks DISABLE ROW LEVEL SECURITY;")
    op.drop_index("ix_flashcards_next_review", table_name="flashcards")
    op.drop_index("ix_flashcards_deck_id", table_name="flashcards")
    op.drop_table("flashcards")
    op.drop_index("ix_flashcard_decks_user_id", table_name="flashcard_decks")
    op.drop_table("flashcard_decks")
