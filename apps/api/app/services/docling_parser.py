from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.pdf import extract_pdf_text

try:
    from docling.document_converter import DocumentConverter
except ImportError:  # pragma: no cover - optional dependency
    DocumentConverter = None


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