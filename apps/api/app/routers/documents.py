from __future__ import annotations

from contextlib import suppress
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.services.pdf import compress_pdf
from app.services.ocr import extract_text_with_tesseract
from app.services.ingestion import ingest_document, search_documents
from app.services.docling_parser import parse_with_docling
from app.services.gemini import chat as gemini_chat, general_chat
from app.services.rag import build_chunks
from app.services.vector_store import VectorStore

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


class ChatRequest(BaseModel):
    document_id: str
    query: str


class ChatResponse(BaseModel):
    answer: str
    context_chunks: list[str]
    follow_up_questions: list[str]


_vector_store_for_chat = VectorStore()


@router.post("/chat", response_model=ChatResponse)
async def chat_with_document(payload: ChatRequest) -> ChatResponse:
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    results = _vector_store_for_chat.query(payload.query, top_k=3)

    document_results = [r for r in results if r.document_id == payload.document_id]

    relevant_results = document_results if document_results else results

    if not relevant_results:
        return ChatResponse(
            answer="I couldn't find relevant content in this document to answer your question. Try rephrasing or asking about a different topic.",
            context_chunks=[],
            follow_up_questions=[],
        )

    best = relevant_results[0]
    context_chunks = [r.text for r in relevant_results]

    context_text = "\n\n".join(context_chunks)
    ai_answer = gemini_chat(payload.query, context_text)
    answer = ai_answer if ai_answer else best.text[:500]

    follow_up_questions = _generate_follow_ups(best.text, payload.query)

    return ChatResponse(
        answer=answer,
        context_chunks=context_chunks,
        follow_up_questions=follow_up_questions,
    )


def _generate_follow_ups(text: str, query: str) -> list[str]:
    import re
    from collections import Counter

    words = re.findall(r"[A-Za-z][A-Za-z\-]{2,}", text.lower())
    stopwords = {
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
        "her", "was", "one", "our", "out", "has", "have", "been", "some",
        "them", "than", "that", "this", "very", "what", "which", "will",
        "with", "your", "from", "they", "been", "said", "each",
    }
    terms = [w for w in words if w not in stopwords and len(w) > 3]
    top_terms = [t for t, _ in Counter(terms).most_common(5)]

    suggestions = []
    for term in top_terms[:3]:
        suggestions.append(f"What does '{term}' mean in this context?")
    if not suggestions:
        suggestions = ["Can you summarize the key points?", "What are the main formulas or concepts?"]

    return suggestions


class GeneralChatMessage(BaseModel):
    role: str
    content: str


class GeneralChatRequest(BaseModel):
    messages: list[GeneralChatMessage]


class GeneralChatResponse(BaseModel):
    content: str


@router.post("/general-chat", response_model=GeneralChatResponse)
async def general_chat_endpoint(payload: GeneralChatRequest) -> GeneralChatResponse:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    history_text = "\n".join(
        f"{'Student' if m.role == 'user' else 'Assistant'}: {m.content}"
        for m in payload.messages[-10:]
    )

    answer = general_chat(history_text)
    if not answer:
        answer = "I'm having trouble connecting to my knowledge base right now. Please try again in a moment."

    return GeneralChatResponse(content=answer)
