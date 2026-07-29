"""add faculties table, move department FK from college to faculty

Revision ID: 010
Revises: 009_drop_dept_code_unique
Create Date: 2025-07-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _fk_exists(table: str, constraint: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_constraint WHERE conname = :name AND conrelid = CAST(:tbl AS regclass)"),
        {"name": constraint, "tbl": table},
    )
    return bool(result.scalar())


def _ix_exists(table: str, index: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :name AND tablename = :tbl"),
        {"name": index, "tbl": table},
    )
    return bool(result.scalar())


def upgrade() -> None:
    op.create_table(
        "faculties",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("code", sa.String, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("college_id", sa.String, sa.ForeignKey("colleges.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_faculties_college_id", "faculties", ["college_id"])

    op.add_column("departments", sa.Column("faculty_id", sa.String, sa.ForeignKey("faculties.id", ondelete="CASCADE"), nullable=True))

    op.execute("""
        INSERT INTO faculties (id, code, name, college_id)
        SELECT DISTINCT ON (d.college_id)
            gen_random_uuid()::text,
            'FACULTY',
            'Faculty',
            d.college_id
        FROM departments d
    """)

    op.execute("""
        UPDATE departments d
        SET faculty_id = f.id
        FROM faculties f
        WHERE f.college_id = d.college_id
    """)

    op.alter_column("departments", "faculty_id", nullable=False)

    if _fk_exists("departments", "departments_college_id_fkey"):
        op.drop_constraint("departments_college_id_fkey", "departments", type_="foreignkey")
    if _ix_exists("departments", "ix_departments_college_id"):
        op.drop_index("ix_departments_college_id", table_name="departments")
    op.drop_column("departments", "college_id")


def downgrade() -> None:
    op.add_column("departments", sa.Column("college_id", sa.String, nullable=True))

    op.execute("""
        UPDATE departments d
        SET college_id = f.college_id
        FROM faculties f
        WHERE f.id = d.faculty_id
    """)

    op.alter_column("departments", "college_id", nullable=False)
    op.create_foreign_key("departments_college_id_fkey", "departments", "colleges", ["college_id"], ["id"], ondelete="CASCADE")
    if not _ix_exists("departments", "ix_departments_college_id"):
        op.create_index("ix_departments_college_id", "departments", ["college_id"])
    op.drop_column("departments", "faculty_id")
    if _ix_exists("faculties", "ix_faculties_college_id"):
        op.drop_index("ix_faculties_college_id", table_name="faculties")
    op.drop_table("faculties")
