"""convert remaining text/varchar id columns to native uuid

The production schema was created with ``metadata.create_all()`` while the SQLAlchemy
models declare ``UUID(as_uuid=False)`` for primary keys and foreign keys. Most columns
were therefore created as ``text``/``varchar``, which makes ORM queries fail with
``operator does not exist: character varying = uuid`` (e.g. ``GET /colleges/{id}/colleges``).

This migration:

* discovers every FK constraint in the ``public`` schema that touches a column we convert
  (either as the referencing or referenced column) and drops it,
* drops RLS policies in the ``public`` schema (PostgreSQL refuses to alter a column used in
  a policy, even when the policy lives on another table and references it via a subquery),
* converts the columns to ``uuid`` (safe ``USING NULLIF(trim(...), '')::uuid``),
* recreates the FK constraints verbatim from ``pg_get_constraintdef`` so naming, on-delete
  and on-update behaviour are preserved,
* recreates the policies with the referenced columns cast to ``text`` so the original
  text-based comparisons (e.g. ``user_id = current_setting(...)``) keep working.

The conversion list only contains columns that the models declare as UUID. FK children
declared as ``String`` (``material_unlocks``, ``flashcard_decks.user_id``,
``subscriptions.user_id``) are converted too so the constraints can be recreated and ORM
joins against converted parents keep working.

Revision ID: 016
Revises: 015
Create Date: 2026-08-01
"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, [columns to convert to uuid]) -- mirrors the models' UUID(as_uuid=False) columns
CONVERSIONS: list[tuple[str, list[str]]] = [
    ("badges", ["id"]),
    ("colleges", ["id", "university_id"]),
    ("connected_accounts", ["id", "user_id"]),
    ("conversation_members", ["id", "conversation_id", "user_id"]),
    ("conversations", ["id", "created_by_id", "department_id", "topic_id"]),
    ("courses", ["id", "department_id"]),
    ("departments", ["id", "college_id"]),
    ("imported_files", ["id", "material_id", "user_id"]),
    ("lessons", ["id", "course_id", "host_id"]),
    ("materials", ["id", "topic_id", "uploader_id"]),
    ("message_read_receipts", ["id", "message_id", "user_id"]),
    ("messages", ["id", "conversation_id", "sender_id"]),
    ("notifications", ["id", "source_message_id", "user_id"]),
    ("points_transactions", ["id", "user_id"]),
    ("question_answers", ["id", "author_id", "question_id"]),
    ("reward_items", ["id"]),
    ("rsvps", ["id", "lesson_id", "user_id"]),
    ("topic_questions", ["id", "author_id", "topic_id"]),
    ("topics", ["id", "author_id", "course_id"]),
    ("universities", ["id"]),
    ("user_badges", ["id", "badge_id", "user_id"]),
    ("user_emails", ["id", "user_id"]),
    ("user_privacy", ["id", "user_id"]),
    ("user_profiles", ["id", "user_id"]),
    ("user_reward_purchases", ["id", "reward_id", "user_id"]),
    ("user_streaks", ["id", "user_id"]),
    ("users", ["id", "department_id", "university_id", "user_streak_id"]),
    ("vault_items", ["id", "user_id"]),
    ("material_unlocks", ["material_id", "referrer_id", "user_id"]),
    ("flashcard_decks", ["user_id"]),
    ("subscriptions", ["user_id"]),
]


def _conversion_pairs() -> list[tuple[str, str]]:
    return [(tbl, col) for tbl, cols in CONVERSIONS for col in cols]


def _values_clause(pairs: list[tuple[str, str]]) -> str:
    rows = ", ".join(f"('{t}', '{c}')" for t, c in pairs)
    return f"(VALUES {rows}) AS want(t, c)"


def _fk_constraintdefs(conn, pairs: list[tuple[str, str]]) -> list[tuple[str, str, str]]:
    """Return (constraint_name, child_table, constraint_def) for every FK touching a
    converted column, either as the referencing or the referenced side."""
    child_sql = sa.text(
        f"""
        SELECT DISTINCT con.conname, child.relname AS t, pg_get_constraintdef(con.oid) AS d
        FROM pg_constraint con
        JOIN pg_class child ON child.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = child.relnamespace
        JOIN pg_attribute ca ON ca.attrelid = con.conrelid
        JOIN {_values_clause(pairs)} ON want.t = child.relname AND want.c = ca.attname
        WHERE con.contype = 'f' AND ns.nspname = 'public'
          AND ca.attnum = ANY(con.conkey)
        """
    )
    parent_sql = sa.text(
        f"""
        SELECT DISTINCT con.conname, child.relname AS t, pg_get_constraintdef(con.oid) AS d
        FROM pg_constraint con
        JOIN pg_class child ON child.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = child.relnamespace
        JOIN pg_attribute pa ON pa.attrelid = con.confrelid
        JOIN pg_class parent ON parent.oid = con.confrelid
        JOIN {_values_clause(pairs)} ON want.t = parent.relname AND want.c = pa.attname
        WHERE con.contype = 'f' AND ns.nspname = 'public'
          AND pa.attnum = ANY(con.confkey)
        """
    )

    seen: dict[str, tuple[str, str, str]] = {}
    for stmt in (child_sql, parent_sql):
        for name, tbl, defn in conn.execute(stmt):
            if name not in seen:
                seen[name] = (name, tbl, defn)
    return [seen[k] for k in sorted(seen)]


def _column_type(conn, table: str, column: str) -> str:
    row = conn.execute(
        sa.text(
            "SELECT udt_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).first()
    return row[0] if row else "missing"


def _policies(conn) -> list[dict]:
    """RLS policies on tables we convert. ``qual``/``with_check`` are the raw expressions."""
    rows = conn.execute(
        sa.text(
            """
            SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check
            FROM pg_policies
            WHERE schemaname = 'public'
            """
        )
    )
    return [
        {
            "tablename": r.tablename,
            "policyname": r.policyname,
            "cmd": r.cmd,
            "roles": r.roles,
            "qual": r.qual,
            "with_check": r.with_check,
        }
        for r in rows
    ]


def _rewrite_expr(expr: str | None, pairs: list[tuple[str, str]]) -> str | None:
    """Cast every reference to a converted column to ``text`` so the original text-based
    comparisons keep working after the column becomes ``uuid``. Word-boundary matching also
    covers qualified references (e.g. ``flashcard_decks.user_id``)."""
    if not expr:
        return expr
    out = expr
    for col in {c for _t, c in pairs}:
        out = re.sub(rf"\b{re.escape(col)}\b", f"{col}::text", out)
    return out


def _recreate_policy(conn, p: dict, pairs: list[tuple[str, str]]) -> None:
    stmt = f'CREATE POLICY "{p["policyname"]}" ON "{p["tablename"]}"'
    if p["cmd"] and p["cmd"].lower() != "all":
        stmt += f' FOR {p["cmd"]}'
    roles = [r.strip() for r in (p["roles"] or "").strip("{}").split(",") if r.strip()]
    if roles:
        stmt += " TO " + ", ".join(f'"{r}"' for r in roles)
    qual = _rewrite_expr(p["qual"], pairs)
    with_check = _rewrite_expr(p["with_check"], pairs)
    if qual:
        stmt += f" USING ({qual})"
    if with_check:
        stmt += f" WITH CHECK ({with_check})"
    conn.execute(sa.text(stmt + ";"))


def upgrade() -> None:
    conn = op.get_bind()
    pairs = _conversion_pairs()

    policies = _policies(conn)
    for p in policies:
        op.execute(sa.text(f'DROP POLICY IF EXISTS "{p["policyname"]}" ON "{p["tablename"]}"'))

    fks = _fk_constraintdefs(conn, pairs)
    for name, tbl, _def in fks:
        op.drop_constraint(name, tbl, type_="foreignkey")

    converted = 0
    for tbl, cols in CONVERSIONS:
        for col in cols:
            if _column_type(conn, tbl, col) == "uuid":
                continue
            op.execute(
                sa.text(
                    f'ALTER TABLE "{tbl}" ALTER COLUMN "{col}" TYPE uuid '
                    f'USING NULLIF(trim("{col}"), \'\')::uuid'
                )
            )
            converted += 1
    print(f"converted {converted} columns to uuid")

    for name, tbl, defn in fks:
        op.execute(sa.text(f'ALTER TABLE "{tbl}" ADD CONSTRAINT "{name}" {defn}'))

    for p in policies:
        _recreate_policy(conn, p, pairs)


def downgrade() -> None:
    conn = op.get_bind()
    pairs = _conversion_pairs()

    policies = _policies(conn)
    for p in policies:
        op.execute(sa.text(f'DROP POLICY IF EXISTS "{p["policyname"]}" ON "{p["tablename"]}"'))

    fks = _fk_constraintdefs(conn, pairs)
    for name, tbl, _def in fks:
        op.drop_constraint(name, tbl, type_="foreignkey")

    for tbl, cols in CONVERSIONS:
        for col in cols:
            if _column_type(conn, tbl, col) != "uuid":
                continue
            op.execute(
                sa.text(
                    f'ALTER TABLE "{tbl}" ALTER COLUMN "{col}" TYPE text USING "{col}"::text'
                )
            )

    for name, tbl, defn in fks:
        op.execute(sa.text(f'ALTER TABLE "{tbl}" ADD CONSTRAINT "{name}" {defn}'))

    for p in policies:
        _recreate_policy(conn, p, pairs)
