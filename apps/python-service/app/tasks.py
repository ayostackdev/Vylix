from __future__ import annotations

from pathlib import Path

from app.core.celery_app import celery_app
from app.services.pdf import compress_pdf


@celery_app.task(name="documents.compress_pdf")
def compress_pdf_task(input_path: str, output_path: str | None = None) -> str:
    compressed_path = compress_pdf(Path(input_path), Path(output_path) if output_path else None)
    return str(compressed_path)
