from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID, uuid4

from app.core.celery_app import celery_app
from app.core.postgres import get_connection
from app.services.academic_agent import run_vylix_academic_agent
from app.services.pdf import compress_pdf

logger = logging.getLogger(__name__)


def _ensure_tracking_table() -> None:
    query = """
        CREATE TABLE IF NOT EXISTS academic_agent_tasks (
            id UUID PRIMARY KEY,
            task_id TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL,
            course_code TEXT NOT NULL,
            user_prompt TEXT NOT NULL,
            task_tier TEXT NOT NULL DEFAULT 'standard',
            status TEXT NOT NULL DEFAULT 'PENDING',
            result TEXT,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(query)
        conn.commit()


def _upsert_task(
    row_id: UUID,
    task_id: str,
    user_id: str,
    course_code: str,
    user_prompt: str,
    task_tier: str,
    status: str,
    *,
    result: str | None = None,
    error_message: str | None = None,
) -> None:
    query = """
        INSERT INTO academic_agent_tasks
            (id, task_id, user_id, course_code, user_prompt, task_tier, status, result, error_message)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (task_id)
        DO UPDATE SET
            status = EXCLUDED.status,
            result = EXCLUDED.result,
            error_message = EXCLUDED.error_message,
            updated_at = NOW()
    """
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            query,
            (row_id, task_id, user_id, course_code, user_prompt, task_tier, status, result, error_message),
        )
        conn.commit()


@celery_app.task(name="documents.compress_pdf")
def compress_pdf_task(input_path: str, output_path: str | None = None) -> str:
    compressed_path = compress_pdf(Path(input_path), Path(output_path) if output_path else None)
    return str(compressed_path)


@celery_app.task(
    name="tasks.execute_academic_agent",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
    autoretry_for=(Exception,),
)
def execute_academic_agent(
    self,
    user_id: str,
    course_code: str,
    user_prompt: str,
    task_tier: str = "standard",
) -> str:
    task_id = self.request.id
    _ensure_tracking_table()

    row_id = uuid4()
    _upsert_task(
        row_id, task_id, user_id, course_code, user_prompt, task_tier, "PROCESSING",
    )

    try:
        result = run_vylix_academic_agent(user_id, course_code, user_prompt, task_tier)
    except Exception:
        logger.exception("Academic agent failed for task %s", task_id)
        _upsert_task(
            row_id, task_id, user_id, course_code, user_prompt, task_tier, "FAILED",
            error_message="Agent execution failed. See worker logs for details.",
        )
        raise

    _upsert_task(
        row_id, task_id, user_id, course_code, user_prompt, task_tier, "COMPLETED",
        result=result,
    )
    return result
