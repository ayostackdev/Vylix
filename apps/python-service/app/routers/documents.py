from __future__ import annotations

from contextlib import suppress
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, File, Query, UploadFile
from pydantic import BaseModel, Field

from app.services.pdf import compress_pdf
from app.services.ocr import extract_text_with_tesseract
from app.services.ingestion import ingest_document, search_documents
from app.services.docling_parser import parse_with_docling
from app.services.rag import build_chunks

router = APIRouter(prefix="/documents", tags=["documents"])


class CompressResponse(BaseModel):
    original_name: str
    compressed_name: str
    compressed_path: str


class OcrResponse(BaseModel):
    source_name: str
    extracted_text: str


class IngestResponse(BaseModel):
    document_id: str
    source_name: str
    compressed_path: str
    chunk_count: int
    parser: str
    department_code: str
    summary: str
    questions: list[str]
    tips: list[str]


class SearchHit(BaseModel):
    id: str
    document_id: str
    source_name: str
    chunk_index: int
    text: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchHit]


class ParseResponse(BaseModel):
    source_name: str
    document_id: str
    parser: str
    markdown: str
    chunk_count: int
    chunks: list[str]


@router.post("/compress", response_model=CompressResponse)
async def compress_document(file: UploadFile = File(...)) -> CompressResponse:
    suffix = Path(file.filename or "document.pdf").suffix or ".pdf"

    with NamedTemporaryFile(delete=False, suffix=suffix) as source_file:
        source_file.write(await file.read())
        source_path = Path(source_file.name)

    compressed_path = compress_pdf(source_path)
    return CompressResponse(
        original_name=file.filename or "document.pdf",
        compressed_name=compressed_path.name,
        compressed_path=str(compressed_path),
    )
    


@router.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile = File(...)) -> ParseResponse:
    suffix = Path(file.filename or "document.pdf").suffix.lower() or ".pdf"

    with NamedTemporaryFile(delete=False, suffix=suffix) as source_file:
        source_file.write(await file.read())
        source_path = Path(source_file.name)

    try:
        parsed_document = parse_with_docling(
            source_path,
            document_id=Path(file.filename or source_path.name).stem,
            source_name=file.filename or source_path.name,
        )
        chunks = build_chunks(parsed_document.markdown)
        return ParseResponse(
            source_name=file.filename or "document.txt",
            document_id=parsed_document.document_id,
            parser=str(parsed_document.metadata.get("parser", "unknown")),
            markdown=parsed_document.markdown,
            chunk_count=len(chunks),
            chunks=chunks,
        )
    finally:
        with suppress(FileNotFoundError):
            source_path.unlink()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_uploaded_document(
    file: UploadFile = File(...),
    department_code: str = Query(default="COLPHY")
) -> IngestResponse:
    suffix = Path(file.filename or "document.pdf").suffix or ".pdf"

    with NamedTemporaryFile(delete=False, suffix=suffix) as source_file:
        source_file.write(await file.read())
        source_path = Path(source_file.name)

    try:
        result = ingest_document(source_path, department_code=department_code)
        return IngestResponse(
            document_id=result.document_id,
            source_name=result.source_name,
            compressed_path=result.compressed_path,
            chunk_count=result.chunk_count,
            parser=result.parser,
            department_code=result.department_code,
            summary=result.summary,
            questions=result.questions,
            tips=result.tips,
        )
    finally:
        with suppress(FileNotFoundError):
            source_path.unlink()


@router.get("/search", response_model=SearchResponse)
async def search_document_chunks(query: str, top_k: int = 5) -> SearchResponse:
    results = search_documents(query, top_k=top_k)
    return SearchResponse(
        query=query,
        results=[
            SearchHit(
                id=result.id,
                document_id=result.document_id,
                source_name=result.source_name,
                chunk_index=result.chunk_index,
                text=result.text,
                score=result.score,
            )
            for result in results
        ],
    )


@router.post("/ocr", response_model=OcrResponse)
async def ocr_document(file: UploadFile = File(...)) -> OcrResponse:
    suffix = Path(file.filename or "image.png").suffix or ".png"

    with NamedTemporaryFile(delete=False, suffix=suffix) as source_file:
        source_file.write(await file.read())
        source_path = Path(source_file.name)

    try:
        extracted_text = extract_text_with_tesseract(source_path)
        return OcrResponse(
            source_name=file.filename or "image.png",
            extracted_text=extracted_text,
        )
    finally:
        with suppress(FileNotFoundError):
            source_path.unlink()
