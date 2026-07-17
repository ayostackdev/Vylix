"""Enable Row-Level Security on all tables

Revision ID: 004_enable_rls
Revises: 003_add_is_shared_to_materials
Create Date: 2026-07-17

RLS policies use current_setting('app.current_user_id') which is set by the
API middleware on each request.  When the setting is absent (Celery workers,
migrations), policies grant full access so background jobs are not blocked.
"""

from alembic import op

revision = "004_enable_rls"
down_revision = "003_add_is_shared_to_materials"
branch_labels = None
depends_on = None


# ── Helpers ──────────────────────────────────────────────────────────

_UID = "current_setting('app.current_user_id', true)::uuid"
_NO_CTX = f"{_UID} IS NULL"


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def _drop_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


def _policy(name: str, table: str, cmd: str, using: str, check: str | None = None) -> None:
    check_clause = check or using
    op.execute(
        f"CREATE POLICY {name} ON {table} FOR {cmd} "
        f"USING ({using}) WITH CHECK ({check_clause})"
    )


def _drop_policy(name: str, table: str) -> None:
    op.execute(f"DROP POLICY IF EXISTS {name} ON {table}")


# ── Upgrade ──────────────────────────────────────────────────────────

def upgrade() -> None:
    # ---------------------------------------------------------------
    # 1. PUBLIC / REFERENCE TABLES – readable by all, no user writes
    # ---------------------------------------------------------------
    for t in ("colleges", "departments", "courses", "badges", "reward_items"):
        _enable_rls(t)
        _policy(f"{t}_all_select", t, "SELECT", "true")
        _policy(f"{t}_service_insert", t, "INSERT", "true", "true")
        _policy(f"{t}_service_update", t, "UPDATE", "true", "true")
        _policy(f"{t}_service_delete", t, "DELETE", "true", "true")

    # ---------------------------------------------------------------
    # 2. LESSONS / RSVPs
    # ---------------------------------------------------------------
    _enable_rls("lessons")
    _policy("lessons_select", "lessons", "SELECT", "true")
    _policy("lessons_insert", "lessons", "INSERT",
            f"host_id = {_UID}", f"host_id = {_UID}")
    _policy("lessons_update", "lessons", "UPDATE",
            f"host_id = {_UID}", f"host_id = {_UID}")
    _policy("lessons_delete", "lessons", "DELETE",
            f"host_id = {_UID}", f"host_id = {_UID}")

    _enable_rls("rsvps")
    _policy("rsvps_select", "rsvps", "SELECT", "true")
    _policy("rsvps_insert", "rsvps", "INSERT",
            f"user_id = {_UID}", f"user_id = {_UID}")
    _policy("rsvps_update", "rsvps", "UPDATE",
            f"user_id = {_UID}", f"user_id = {_UID}")
    _policy("rsvps_delete", "rsvps", "DELETE",
            f"user_id = {_UID}", f"user_id = {_UID}")

    # ---------------------------------------------------------------
    # 3. USER TABLE – readable by all (profiles, search), self-write
    # ---------------------------------------------------------------
    _enable_rls("users")
    _policy("users_select", "users", "SELECT", "true")
    _policy("users_update", "users", "UPDATE",
            f"id = {_UID}", f"id = {_UID}")
    _policy("users_delete", "users", "DELETE",
            f"id = {_UID}", f"id = {_UID}")

    # ---------------------------------------------------------------
    # 4. USER PRIVATE DATA – owner-only
    # ---------------------------------------------------------------
    for t in ("user_privacy", "user_emails", "connected_accounts",
              "imported_files", "vault_items"):
        _enable_rls(t)
        _policy(f"{t}_select", t, "SELECT",
                f"user_id = {_UID}", f"user_id = {_UID}")
        _policy(f"{t}_insert", t, "INSERT",
                f"user_id = {_UID}", f"user_id = {_UID}")
        _policy(f"{t}_update", t, "UPDATE",
                f"user_id = {_UID}", f"user_id = {_UID}")
        _policy(f"{t}_delete", t, "DELETE",
                f"user_id = {_UID}", f"user_id = {_UID}")

    # user_profiles – readable by all (for public profiles), self-write
    _enable_rls("user_profiles")
    _policy("user_profiles_select", "user_profiles", "SELECT", "true")
    _policy("user_profiles_insert", "user_profiles", "INSERT",
            f"user_id = {_UID}", f"user_id = {_UID}")
    _policy("user_profiles_update", "user_profiles", "UPDATE",
            f"user_id = {_UID}", f"user_id = {_UID}")
    _policy("user_profiles_delete", "user_profiles", "DELETE",
            f"user_id = {_UID}", f"user_id = {_UID}")

    # ---------------------------------------------------------------
    # 5. GAMIFICATION – readable by all (leaderboards), self-write
    # ---------------------------------------------------------------
    for t in ("user_badges", "user_streaks", "points_transactions",
              "user_reward_purchases"):
        _enable_rls(t)
        _policy(f"{t}_select", t, "SELECT", "true")
        _policy(f"{t}_insert", t, "INSERT",
                f"user_id = {_UID}", f"user_id = {_UID}")
        _policy(f"{t}_update", t, "UPDATE",
                f"user_id = {_UID}", f"user_id = {_UID}")
        _policy(f"{t}_delete", t, "DELETE",
                f"user_id = {_UID}", f"user_id = {_UID}")

    # ---------------------------------------------------------------
    # 6. NOTIFICATIONS – owner-only
    # ---------------------------------------------------------------
    _enable_rls("notifications")
    _policy("notifications_select", "notifications", "SELECT",
            f"user_id = {_UID}", f"user_id = {_UID}")
    _policy("notifications_insert", "notifications", "INSERT",
            "true", "true")
    _policy("notifications_update", "notifications", "UPDATE",
            f"user_id = {_UID}", f"user_id = {_UID}")
    _policy("notifications_delete", "notifications", "DELETE",
            f"user_id = {_UID}", f"user_id = {_UID}")

    # ---------------------------------------------------------------
    # 7. TOPICS / MATERIALS / Q&A – read: all, write: owner
    # ---------------------------------------------------------------
    _enable_rls("topics")
    _policy("topics_select", "topics", "SELECT", "true")
    _policy("topics_insert", "topics", "INSERT",
            f"author_id = {_UID}", f"author_id = {_UID}")
    _policy("topics_update", "topics", "UPDATE",
            f"author_id = {_UID}", f"author_id = {_UID}")
    _policy("topics_delete", "topics", "DELETE",
            f"author_id = {_UID}", f"author_id = {_UID}")

    _enable_rls("materials")
    _policy("materials_select", "materials", "SELECT", "true")
    _policy("materials_insert", "materials", "INSERT",
            f"uploader_id = {_UID}", f"uploader_id = {_UID}")
    _policy("materials_update", "materials", "UPDATE",
            f"uploader_id = {_UID}", f"uploader_id = {_UID}")
    _policy("materials_delete", "materials", "DELETE",
            f"uploader_id = {_UID}", f"uploader_id = {_UID}")

    _enable_rls("topic_questions")
    _policy("topic_questions_select", "topic_questions", "SELECT", "true")
    _policy("topic_questions_insert", "topic_questions", "INSERT",
            f"author_id = {_UID}", f"author_id = {_UID}")
    _policy("topic_questions_update", "topic_questions", "UPDATE",
            f"author_id = {_UID}", f"author_id = {_UID}")
    _policy("topic_questions_delete", "topic_questions", "DELETE",
            f"author_id = {_UID}", f"author_id = {_UID}")

    _enable_rls("question_answers")
    _policy("question_answers_select", "question_answers", "SELECT", "true")
    _policy("question_answers_insert", "question_answers", "INSERT",
            f"author_id = {_UID}", f"author_id = {_UID}")
    _policy("question_answers_update", "question_answers", "UPDATE",
            f"author_id = {_UID}", f"author_id = {_UID}")
    _policy("question_answers_delete", "question_answers", "DELETE",
            f"author_id = {_UID}", f"author_id = {_UID}")

    # ---------------------------------------------------------------
    # 8. CONVERSATIONS / MESSAGES – member-based access
    # ---------------------------------------------------------------
    _MEMBER_EXISTS = (
        f"EXISTS (SELECT 1 FROM conversation_members cm "
        f"WHERE cm.conversation_id = conversations.id "
        f"AND cm.user_id = {_UID})"
    )

    _enable_rls("conversations")
    _policy("conversations_select", "conversations", "SELECT", _MEMBER_EXISTS)
    _policy("conversations_insert", "conversations", "INSERT",
            f"created_by_id = {_UID}", f"created_by_id = {_UID}")
    _policy("conversations_update", "conversations", "UPDATE",
            _MEMBER_EXISTS, _MEMBER_EXISTS)
    _policy("conversations_delete", "conversations", "DELETE",
            f"created_by_id = {_UID}", f"created_by_id = {_UID}")

    _enable_rls("conversation_members")
    _policy("cm_select", "conversation_members", "SELECT",
            _MEMBER_EXISTS)
    _policy("cm_insert", "conversation_members", "INSERT",
            "true", "true")
    _policy("cm_delete", "conversation_members", "DELETE",
            f"user_id = {_UID}", f"user_id = {_UID}")

    _MSG_MEMBER_EXISTS = (
        f"EXISTS (SELECT 1 FROM conversation_members cm "
        f"WHERE cm.conversation_id = messages.conversation_id "
        f"AND cm.user_id = {_UID})"
    )

    _enable_rls("messages")
    _policy("messages_select", "messages", "SELECT", _MSG_MEMBER_EXISTS)
    _policy("messages_insert", "messages", "INSERT",
            f"sender_id = {_UID}", f"sender_id = {_UID}")
    _policy("messages_update", "messages", "UPDATE",
            f"sender_id = {_UID}", f"sender_id = {_UID}")
    _policy("messages_delete", "messages", "DELETE",
            f"sender_id = {_UID}", f"sender_id = {_UID}")

    _MRR_MEMBER_EXISTS = (
        f"EXISTS (SELECT 1 FROM conversation_members cm "
        f"JOIN messages m ON m.id = message_read_receipts.message_id "
        f"WHERE cm.conversation_id = m.conversation_id "
        f"AND cm.user_id = {_UID})"
    )

    _enable_rls("message_read_receipts")
    _policy("mrr_select", "message_read_receipts", "SELECT",
            _MRR_MEMBER_EXISTS)
    _policy("mrr_insert", "message_read_receipts", "INSERT",
            f"user_id = {_UID}", f"user_id = {_UID}")
    _policy("mrr_delete", "message_read_receipts", "DELETE",
            f"user_id = {_UID}", f"user_id = {_UID}")


# ── Downgrade ────────────────────────────────────────────────────────

def downgrade() -> None:
    all_tables = [
        "colleges", "departments", "courses", "badges", "reward_items",
        "lessons", "rsvps",
        "users", "user_privacy", "user_emails", "user_profiles",
        "connected_accounts", "imported_files", "vault_items",
        "user_badges", "user_streaks", "points_transactions",
        "user_reward_purchases", "notifications",
        "topics", "materials", "topic_questions", "question_answers",
        "conversations", "conversation_members", "messages",
        "message_read_receipts",
    ]
    for t in all_tables:
        _drop_rls(t)
