"""initial schema

Revision ID: 001
Revises: 
Create Date: 2025-07-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    userstatus = postgresql.ENUM("STUDENT", "ALUMNI", name="userstatus", create_type=False)
    badgerarity = postgresql.ENUM("COMMON", "RARE", "EPIC", "LEGENDARY", name="badgerarity", create_type=False)
    materialprocessingstatus = postgresql.ENUM("QUEUED", "PROCESSING", "COMPLETED", "FAILED", name="materialprocessingstatus", create_type=False)
    conversationtype = postgresql.ENUM("DIRECT", "GROUP", name="conversationtype", create_type=False)
    conversationrole = postgresql.ENUM("OWNER", "ADMIN", "MEMBER", name="conversationrole", create_type=False)
    rsvpstatus = postgresql.ENUM("GOING", "MAYBE", "DECLINED", name="rsvpstatus", create_type=False)

    for e in [userstatus, badgerarity, materialprocessingstatus, conversationtype, conversationrole, rsvpstatus]:
        e.create(op.get_bind(), checkfirst=True)

    # Colleges
    op.create_table(
        "colleges",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("code", sa.String, unique=True, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("duration_years", sa.Integer, server_default="4"),
    )

    # Departments
    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("code", sa.String, unique=True, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("college_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("colleges.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_departments_college_id", "departments", ["college_id"])

    # Courses
    op.create_table(
        "courses",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("code", sa.String, unique=True, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("level", sa.Integer, nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("departments.id", ondelete="SET NULL")),
        sa.Column("is_general", sa.Boolean, server_default="false"),
    )
    op.create_index("ix_courses_department_id", "courses", ["department_id"])
    op.create_index("ix_courses_department_id_is_general", "courses", ["department_id", "is_general"])

    # User Streaks (before Users, since Users references it)
    op.create_table(
        "user_streaks",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), unique=True),
        sa.Column("current_streak", sa.Integer, server_default="0"),
        sa.Column("longest_streak", sa.Integer, server_default="0"),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("streak_started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_streaks_user_id", "user_streaks", ["user_id"])
    op.create_index("ix_user_streaks_current_streak", "user_streaks", ["current_streak"])

    # Users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("full_name", sa.String, nullable=False),
        sa.Column("matric_number", sa.String, unique=True),
        sa.Column("entry_year", sa.Integer),
        sa.Column("current_level", sa.String),
        sa.Column("level_updated_at", sa.DateTime(timezone=True)),
        sa.Column("school_email", sa.String),
        sa.Column("status", userstatus, server_default="STUDENT"),
        sa.Column("graduated_at", sa.DateTime(timezone=True)),
        sa.Column("college_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("colleges.id", ondelete="RESTRICT")),
        sa.Column("department_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("departments.id", ondelete="RESTRICT")),
        sa.Column("bio", sa.Text),
        sa.Column("avatar_url", sa.String),
        sa.Column("contribution_score", sa.Integer, server_default="0"),
        sa.Column("school_email_prompt_dismissed_at", sa.DateTime(timezone=True)),
        sa.Column("email_prompt_dismissed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("user_streak_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("user_streaks.id")),
    )
    op.create_index("ix_users_department_id", "users", ["department_id"])
    op.create_index("ix_users_college_id", "users", ["college_id"])
    op.create_index("ix_users_current_level", "users", ["current_level"])
    op.create_index("ix_users_status", "users", ["status"])

    # User Privacy
    op.create_table(
        "user_privacy",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("is_stealth_mode", sa.Boolean, server_default="false"),
        sa.Column("show_contributions", sa.Boolean, server_default="true"),
        sa.Column("show_email", sa.Boolean, server_default="false"),
        sa.Column("show_department", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_privacy_user_id", "user_privacy", ["user_id"])

    # User Profiles
    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("bio", sa.Text),
        sa.Column("website", sa.String),
        sa.Column("social_links", postgresql.JSON),
        sa.Column("profile_image_url", sa.String),
        sa.Column("banner_image_url", sa.String),
        sa.Column("last_profile_view", sa.DateTime(timezone=True)),
        sa.Column("view_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_profiles_user_id", "user_profiles", ["user_id"])

    # User Emails
    op.create_table(
        "user_emails",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("email", sa.String, unique=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_primary", sa.Boolean, server_default="false"),
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_emails_user_id", "user_emails", ["user_id"])
    op.create_index("ix_user_emails_email", "user_emails", ["email"])

    # Badges
    op.create_table(
        "badges",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("code", sa.String, unique=True, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("icon", sa.String, nullable=False),
        sa.Column("rarity", badgerarity, server_default="COMMON"),
        sa.Column("criteria", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_badges_rarity", "badges", ["rarity"])

    # User Badges
    op.create_table(
        "user_badges",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("badge_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("badges.id", ondelete="CASCADE"), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("awarded_by", sa.String),
    )
    op.create_index("ix_user_badges_user_id", "user_badges", ["user_id"])
    op.create_index("ix_user_badges_badge_id", "user_badges", ["badge_id"])

    # Topics
    op.create_table(
        "topics",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_activity", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_topics_course_id", "topics", ["course_id"])
    op.create_index("ix_topics_last_activity", "topics", ["last_activity"])
    op.create_index("ix_topics_course_id_is_active_last_activity", "topics", ["course_id", "is_active", "last_activity"])

    # Materials
    op.create_table(
        "materials",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("file_name", sa.String, nullable=False),
        sa.Column("file_url", sa.String, nullable=False),
        sa.Column("file_path", sa.String),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("topic_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploader_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("processing_status", materialprocessingstatus, server_default="QUEUED"),
        sa.Column("processing_job_id", sa.String),
        sa.Column("summary", sa.Text),
        sa.Column("questions", postgresql.JSON),
        sa.Column("tips", postgresql.JSON),
        sa.Column("processing_error", sa.Text),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("is_seed", sa.Boolean, server_default="false"),
        sa.Column("is_past_question", sa.Boolean, server_default="false"),
        sa.Column("exam_year", sa.Integer),
        sa.Column("semester", sa.String),
    )
    op.create_index("ix_materials_processing_status", "materials", ["processing_status"])
    op.create_index("ix_materials_processing_job_id", "materials", ["processing_job_id"])
    op.create_index("ix_materials_uploaded_at", "materials", ["uploaded_at"])
    op.create_index("ix_materials_topic_id_uploaded_at", "materials", ["topic_id", "uploaded_at"])
    op.create_index("ix_materials_topic_id_is_seed", "materials", ["topic_id", "is_seed"])
    op.create_index("ix_materials_is_seed", "materials", ["is_seed"])

    # Conversations
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("type", conversationtype, server_default="GROUP"),
        sa.Column("title", sa.String),
        sa.Column("department_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("departments.id", ondelete="SET NULL")),
        sa.Column("topic_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("topics.id", ondelete="SET NULL")),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_conversations_department_id", "conversations", ["department_id"])
    op.create_index("ix_conversations_topic_id", "conversations", ["topic_id"])
    op.create_index("ix_conversations_created_by_id", "conversations", ["created_by_id"])
    op.create_index("ix_conversations_updated_at", "conversations", ["updated_at"])

    # Conversation Members
    op.create_table(
        "conversation_members",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", conversationrole, server_default="MEMBER"),
        sa.Column("last_read_at", sa.DateTime(timezone=True)),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_conversation_members_user_id", "conversation_members", ["user_id"])
    op.create_index("ix_conversation_members_conversation_id", "conversation_members", ["conversation_id"])
    op.create_index("ix_conversation_members_last_read_at", "conversation_members", ["last_read_at"])

    # Messages
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("metadata", postgresql.JSON),
        sa.Column("edited_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_messages_conversation_id_created_at", "messages", ["conversation_id", "created_at"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_deleted_at", "messages", ["deleted_at"])
    op.create_index("ix_messages_conversation_id_deleted_at_created_at", "messages", ["conversation_id", "deleted_at", "created_at"])

    # Message Read Receipts
    op.create_table(
        "message_read_receipts",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("message_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_message_read_receipts_user_id", "message_read_receipts", ["user_id"])
    op.create_index("ix_message_read_receipts_message_id", "message_read_receipts", ["message_id"])
    op.create_index("ix_message_read_receipts_read_at", "message_read_receipts", ["read_at"])

    # Notifications
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String, nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("message", sa.Text),
        sa.Column("payload", postgresql.JSON),
        sa.Column("source_message_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("messages.id", ondelete="SET NULL")),
        sa.Column("delivered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_kind", "notifications", ["kind"])
    op.create_index("ix_notifications_read_at", "notifications", ["read_at"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index("ix_notifications_user_id_read_at", "notifications", ["user_id", "read_at"])

    # Points Transactions
    op.create_table(
        "points_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("reason", sa.String, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("related_id", sa.String),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_points_transactions_user_id", "points_transactions", ["user_id"])
    op.create_index("ix_points_transactions_created_at", "points_transactions", ["created_at"])
    op.create_index("ix_points_transactions_user_id_created_at", "points_transactions", ["user_id", "created_at"])

    # Reward Items
    op.create_table(
        "reward_items",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("code", sa.String, unique=True, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("points_cost", sa.Integer, nullable=False),
        sa.Column("category", sa.String, nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_reward_items_is_active", "reward_items", ["is_active"])
    op.create_index("ix_reward_items_points_cost", "reward_items", ["points_cost"])

    # User Reward Purchases
    op.create_table(
        "user_reward_purchases",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reward_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("code", sa.String, unique=True, nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_reward_purchases_user_id", "user_reward_purchases", ["user_id"])
    op.create_index("ix_user_reward_purchases_reward_id", "user_reward_purchases", ["reward_id"])
    op.create_index("ix_user_reward_purchases_redeemed_at", "user_reward_purchases", ["redeemed_at"])

    # Topic Questions
    op.create_table(
        "topic_questions",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("topic_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("help_count", sa.Integer, server_default="0"),
        sa.Column("view_count", sa.Integer, server_default="0"),
        sa.Column("is_resolved", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_topic_questions_topic_id", "topic_questions", ["topic_id"])
    op.create_index("ix_topic_questions_created_at", "topic_questions", ["created_at"])
    op.create_index("ix_topic_questions_is_resolved", "topic_questions", ["is_resolved"])
    op.create_index("ix_topic_questions_help_count", "topic_questions", ["help_count"])

    # Question Answers
    op.create_table(
        "question_answers",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("topic_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("help_count", sa.Integer, server_default="0"),
        sa.Column("is_accepted", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_question_answers_question_id", "question_answers", ["question_id"])
    op.create_index("ix_question_answers_help_count", "question_answers", ["help_count"])
    op.create_index("ix_question_answers_is_accepted", "question_answers", ["is_accepted"])

    # Vault Items
    op.create_table(
        "vault_items",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("local_blob_id", sa.String, nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vault_items_user_id", "vault_items", ["user_id"])

    # Lessons
    op.create_table(
        "lessons",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String, nullable=False),
        sa.Column("host_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_lessons_course_id_scheduled_for", "lessons", ["course_id", "scheduled_for"])

    # RSVPs
    op.create_table(
        "rsvps",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", rsvpstatus, server_default="GOING"),
        sa.Column("responded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Uploaded files (from python-service)
    op.create_table(
        "uploaded_files",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("filename", sa.Text, nullable=False),
        sa.Column("content_hash", sa.Text, unique=True, nullable=False),
        sa.Column("storage_path", sa.Text),
        sa.Column("file_size", sa.BigInteger),
        sa.Column("content_type", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Academic agent tasks (from python-service)
    op.create_table(
        "academic_agent_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("task_id", sa.Text, unique=True, nullable=False),
        sa.Column("user_id", sa.Text, nullable=False),
        sa.Column("course_code", sa.Text, nullable=False),
        sa.Column("user_prompt", sa.Text, nullable=False),
        sa.Column("task_tier", sa.Text, server_default="standard"),
        sa.Column("status", sa.Text, server_default="PENDING"),
        sa.Column("result", sa.Text),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Connected Accounts (Google Drive)
    op.create_table(
        "connected_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String, nullable=False),
        sa.Column("provider_user_id", sa.String, nullable=False),
        sa.Column("access_token", sa.Text, nullable=False),
        sa.Column("refresh_token", sa.Text),
        sa.Column("token_expires_at", sa.DateTime(timezone=True)),
        sa.Column("scope", sa.String),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_connected_accounts_user_id", "connected_accounts", ["user_id"])
    op.create_index("ix_connected_accounts_provider", "connected_accounts", ["provider"])

    # Imported Files (from Google Drive)
    op.create_table(
        "imported_files",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drive_file_id", sa.String, nullable=False),
        sa.Column("file_name", sa.String, nullable=False),
        sa.Column("mime_type", sa.String, nullable=False),
        sa.Column("file_size", sa.Integer, server_default="0"),
        sa.Column("folder_path", sa.String),
        sa.Column("material_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("materials.id", ondelete="SET NULL")),
        sa.Column("status", sa.String, server_default="pending"),
        sa.Column("error", sa.Text),
        sa.Column("imported_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_imported_files_user_id", "imported_files", ["user_id"])
    op.create_index("ix_imported_files_drive_file_id", "imported_files", ["drive_file_id"])
    op.create_index("ix_imported_files_status", "imported_files", ["status"])


def downgrade() -> None:
    tables = [
        "imported_files", "connected_accounts",
        "academic_agent_tasks", "uploaded_files", "rsvps", "lessons", "vault_items",
        "question_answers", "topic_questions", "user_reward_purchases", "reward_items",
        "points_transactions", "notifications", "message_read_receipts", "messages",
        "conversation_members", "conversations", "materials", "topics",
        "user_badges", "badges", "user_emails", "user_profiles", "user_privacy",
        "users", "user_streaks", "courses", "departments", "colleges",
    ]
    for t in tables:
        op.drop_table(t)

    for e in ["rsvpstatus", "conversationrole", "conversationtype", "materialprocessingstatus", "badgerarity", "userstatus"]:
        op.execute(f"DROP TYPE IF EXISTS {e}")
