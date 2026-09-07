from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.pdf import extract_pdf_text

try:
    from docling.document_converter import DocumentConverter
except ImportError:  # pragma: no cover - optional dependency
    DocumentConverter = None

logger = logging.getLogger(__name__)

_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".heic"}


@dataclass(slots=True)
class ParsedDocument:
    document_id: str
    source_name: str
    content: str
    markdown: str
    metadata: dict[str, Any]


def parse_with_docling(
    source_path: str | Path,
    *,
    document_id: str | None = None,
    source_name: str | None = None,
) -> ParsedDocument:
    path = Path(source_path)
    suffix = path.suffix.lower()
    resolved_document_id = document_id or path.stem
    resolved_source_name = source_name or path.name

    if suffix in _IMAGE_SUFFIXES:
        return _parse_image(path, resolved_document_id, resolved_source_name, suffix)

    if DocumentConverter is not None and suffix == ".pdf":
        converter = DocumentConverter()
        conversion_result = converter.convert(str(path))
        docling_document = conversion_result.document
        markdown_exporter = getattr(docling_document, "export_to_markdown", None)
        markdown = markdown_exporter() if callable(markdown_exporter) else str(docling_document)
        content = getattr(docling_document, "text", None) or markdown
        return ParsedDocument(
            document_id=resolved_document_id,
            source_name=resolved_source_name,
            content=content,
            markdown=markdown,
            metadata={"parser": "docling", "suffix": suffix},
        )

    if suffix == ".pdf":
        content = extract_pdf_text(path)
    else:
        content = path.read_text(encoding="utf-8", errors="ignore")

    return ParsedDocument(
        document_id=resolved_document_id,
        source_name=resolved_source_name,
        content=content,
        markdown=content,
        metadata={"parser": "fallback", "suffix": suffix},
    )


def _parse_image(
    path: Path, document_id: str, source_name: str, suffix: str
) -> ParsedDocument:
    """OCR a snapped handout/photo: shadow-destroy first, then Docling or tesseract."""
    from app.services.imaging import preprocess_handout
    from app.services.ocr import extract_text_with_tesseract

    processed = preprocess_handout(path)

    if DocumentConverter is not None:
        try:
            converter = DocumentConverter()
            conversion_result = converter.convert(str(processed))
            docling_document = conversion_result.document
            markdown_exporter = getattr(docling_document, "export_to_markdown", None)
            markdown = markdown_exporter() if callable(markdown_exporter) else str(
                docling_document
            )
            content = getattr(docling_document, "text", None) or markdown
            if content and content.strip():
                return ParsedDocument(
                    document_id=document_id,
                    source_name=source_name,
                    content=content,
                    markdown=markdown,
                    metadata={"parser": "docling", "suffix": suffix, "preprocessed": True},
                )
        except Exception as exc:  # pragma: no cover - docling image conversion is flaky
            logger.warning("Docling image OCR failed for %s (%s); falling back.", path, exc)

    text = extract_text_with_tesseract(processed)
    return ParsedDocument(
        document_id=document_id,
        source_name=source_name,
        content=text,
        markdown=text,
        metadata={"parser": "tesseract", "suffix": suffix, "preprocessed": True},
    )