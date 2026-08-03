from __future__ import annotations

import json as _json
import logging
from pathlib import Path
from uuid import UUID, uuid4

import httpx

from app.core.celery_app import celery_app
from app.core.config import get_settings
from app.core.postgres import get_connection
from app.services.academic_agent import run_vylix_academic_agent
from app.services.ingestion import ingest_document
from app.services.pdf import compress_pdf

logger = logging.getLogger(__name__)
settings = get_settings()


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


def _update_material(
    material_id: str,
    *,
    status: str,
    summary: str | None = None,
    questions: list[str] | None = None,
    tips: list[str] | None = None,
    error: str | None = None,
) -> None:
    query = """
        UPDATE materials
        SET processing_status = %s,
            summary = %s,
            questions = %s,
            tips = %s,
            processing_error = %s,
            processed_at = NOW()
        WHERE id = %s
    """
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            query,
            (
                status,
                summary,
                _json.dumps(questions) if questions else None,
                _json.dumps(tips) if tips else None,
                error,
                material_id,
            ),
        )
        conn.commit()


@celery_app.task(
    name="materials.process_material",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
)
def process_material_task(
    self,
    material_id: str,
    file_url: str,
    file_name: str,
    department_code: str = "COLPHY",
) -> str:
    """Download uploaded material, run ingestion pipeline, update DB record."""
    _update_material(material_id, status="PROCESSING")

    tmp_dir = settings.temp_dir / "materials"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "pdf"
    local_path = tmp_dir / f"{material_id}.{ext}"

    try:
        with httpx.Client(timeout=120) as client:
            resp = client.get(file_url)
            resp.raise_for_status()
            local_path.write_bytes(resp.content)

        result = ingest_document(
            local_path,
            department_code=department_code,
            document_id=material_id,
        )

        _update_material(
            material_id,
            status="COMPLETED",
            summary=result.summary,
            questions=result.questions,
            tips=result.tips,
        )
        logger.info("Material %s processed successfully (%d chunks)", material_id, result.chunk_count)
        return material_id

    except Exception:
        logger.exception("Material processing failed for %s", material_id)
        _update_material(
            material_id,
            status="FAILED",
            error="Processing failed. See worker logs for details.",
        )
        raise

    finally:
        if local_path.exists():
            local_path.unlink(missing_ok=True)
