"""rename College->University, Faculty->College, drop users.college_id, add department_catalog

Revision ID: 011
Revises: 010
Create Date: 2025-07-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "011"
down_revision: Union[str, None] = "010"
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


def _col_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM information_schema.columns WHERE table_name = :tbl AND column_name = :col"),
        {"tbl": table, "col": column},
    )
    return bool(result.scalar())


def upgrade() -> None:
    # 1. Create department_catalog
    op.create_table(
        "department_catalog",
        sa.Column("code", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
    )

    # 2. Drop FK constraints if they exist
    if _fk_exists("faculties", "faculties_college_id_fkey"):
        op.drop_constraint("faculties_college_id_fkey", "faculties", type_="foreignkey")
    if _fk_exists("departments", "departments_faculty_id_fkey"):
        op.drop_constraint("departments_faculty_id_fkey", "departments", type_="foreignkey")
    if _fk_exists("users", "users_college_id_fkey"):
        op.drop_constraint("users_college_id_fkey", "users", type_="foreignkey")

    # 3. Drop indexes if they exist
    if _ix_exists("faculties", "ix_faculties_college_id"):
        op.drop_index("ix_faculties_college_id", table_name="faculties")
    if _ix_exists("departments", "ix_departments_faculty_id"):
        op.drop_index("ix_departments_faculty_id", table_name="departments")
    if _ix_exists("users", "ix_users_college_id"):
        op.drop_index("ix_users_college_id", table_name="users")

    # 4. Rename colleges -> universities, drop duration_years
    op.rename_table("colleges", "universities")
    if _col_exists("universities", "duration_years"):
        op.drop_column("universities", "duration_years")

    # 5. Rename faculties -> colleges, rename college_id -> university_id
    op.rename_table("faculties", "colleges")
    if _col_exists("colleges", "college_id"):
        op.alter_column("colleges", "college_id", new_column_name="university_id")

    # 6. Rename departments.faculty_id -> college_id
    if _col_exists("departments", "faculty_id"):
        op.alter_column("departments", "faculty_id", new_column_name="college_id")

    # 7. Rename users.college_id -> university_id
    if _col_exists("users", "college_id"):
        op.alter_column("users", "college_id", new_column_name="university_id")

    # 8. Add duration_years to colleges
    if not _col_exists("colleges", "duration_years"):
        op.add_column("colleges", sa.Column("duration_years", sa.Integer, server_default="4"))

    # 9. Add FK constraints back
    if not _fk_exists("colleges", "colleges_university_id_fkey"):
        op.create_foreign_key(
            "colleges_university_id_fkey", "colleges", "universities",
            ["university_id"], ["id"], ondelete="CASCADE",
        )
    if not _fk_exists("departments", "departments_college_id_fkey"):
        op.create_foreign_key(
            "departments_college_id_fkey", "departments", "colleges",
            ["college_id"], ["id"], ondelete="CASCADE",
        )
    if not _fk_exists("users", "users_university_id_fkey"):
        op.create_foreign_key(
            "users_university_id_fkey", "users", "universities",
            ["university_id"], ["id"], ondelete="RESTRICT",
        )

    # 10. Re-create indexes
    if not _ix_exists("colleges", "ix_colleges_university_id"):
        op.create_index("ix_colleges_university_id", "colleges", ["university_id"])
    if not _ix_exists("departments", "ix_departments_college_id"):
        op.create_index("ix_departments_college_id", "departments", ["college_id"])
    if not _ix_exists("users", "ix_users_university_id"):
        op.create_index("ix_users_university_id", "users", ["university_id"])


def downgrade() -> None:
    if _ix_exists("users", "ix_users_university_id"):
        op.drop_index("ix_users_university_id", table_name="users")
    if _ix_exists("departments", "ix_departments_college_id"):
        op.drop_index("ix_departments_college_id", table_name="departments")
    if _ix_exists("colleges", "ix_colleges_university_id"):
        op.drop_index("ix_colleges_university_id", table_name="colleges")

    if _fk_exists("users", "users_university_id_fkey"):
        op.drop_constraint("users_university_id_fkey", "users", type_="foreignkey")
    if _fk_exists("departments", "departments_college_id_fkey"):
        op.drop_constraint("departments_college_id_fkey", "departments", type_="foreignkey")
    if _fk_exists("colleges", "colleges_university_id_fkey"):
        op.drop_constraint("colleges_university_id_fkey", "colleges", type_="foreignkey")

    if _col_exists("colleges", "duration_years"):
        op.drop_column("colleges", "duration_years")

    if _col_exists("users", "university_id"):
        op.alter_column("users", "university_id", new_column_name="college_id")
    if _col_exists("departments", "college_id"):
        op.alter_column("departments", "college_id", new_column_name="faculty_id")
    if _col_exists("colleges", "university_id"):
        op.alter_column("colleges", "university_id", new_column_name="college_id")

    op.rename_table("colleges", "faculties")
    if not _col_exists("universities", "duration_years"):
        op.add_column("universities", sa.Column("duration_years", sa.Integer, server_default="4"))
    op.rename_table("universities", "colleges")

    if not _ix_exists("users", "ix_users_college_id"):
        op.create_index("ix_users_college_id", "users", ["college_id"])
    if not _ix_exists("departments", "ix_departments_faculty_id"):
        op.create_index("ix_departments_faculty_id", "departments", ["faculty_id"])
    if not _ix_exists("faculties", "ix_faculties_college_id"):
        op.create_index("ix_faculties_college_id", "faculties", ["college_id"])

    if not _fk_exists("users", "users_college_id_fkey"):
        op.create_foreign_key("users_college_id_fkey", "users", "colleges", ["college_id"], ["id"], ondelete="RESTRICT")
    if not _fk_exists("departments", "departments_faculty_id_fkey"):
        op.create_foreign_key("departments_faculty_id_fkey", "departments", "faculties", ["faculty_id"], ["id"], ondelete="CASCADE")
    if not _fk_exists("faculties", "faculties_college_id_fkey"):
        op.create_foreign_key("faculties_college_id_fkey", "faculties", "colleges", ["college_id"], ["id"], ondelete="CASCADE")

    op.drop_table("department_catalog")
