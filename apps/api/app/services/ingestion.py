from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.core.config import get_settings
from app.services.docling_parser import ParsedDocument, parse_with_docling
from app.services.pdf import compress_pdf
from app.services.rag import build_chunks
from app.services.study_assistant import StudyInsights, generate_study_insights
from app.services.vector_store import VectorStore

settings = get_settings()
_vector_store = VectorStore(persist_directory=settings.temp_dir / "chromadb")


@dataclass(slots=True)
class IngestionResult:
    document_id: str
    source_name: str
    compressed_path: str
    chunk_count: int
    parser: str
    department_code: str
    summary: str
    questions: list[str]
    tips: list[str]


def ingest_document(
    source_path: str | Path,
    department_code: str = "COLPHY",
    document_id: str | None = None,
) -> IngestionResult:
    path = Path(source_path)
    compressed_path = compress_pdf(path) if path.suffix.lower() == ".pdf" else path
    parsed_document: ParsedDocument = parse_with_docling(
        compressed_path,
        document_id=document_id or path.stem,
        source_name=path.name,
    )
    chunks = build_chunks(parsed_document.markdown)
    insights: StudyInsights = generate_study_insights(
        parsed_document.markdown,
        department_code=department_code,
    )
    _vector_store.upsert_document(
        document_id=parsed_document.document_id,
        source_name=parsed_document.source_name,
        chunks=chunks,
        metadata=parsed_document.metadata,
    )
    return IngestionResult(
        document_id=parsed_document.document_id,
        source_name=parsed_document.source_name,
        compressed_path=str(compressed_path),
        chunk_count=len(chunks),
        parser=str(parsed_document.metadata.get("parser", "unknown")),
        department_code=insights.department_code,
        summary=insights.summary,
        questions=insights.questions,
        tips=insights.tips,
    )


def search_documents(query: str, top_k: int = 5):
    return _vector_store.query(query, top_k=top_k)