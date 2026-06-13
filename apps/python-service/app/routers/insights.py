from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.request import Request, urlopen

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.docling_parser import parse_with_docling
from app.services.study_assistant import generate_study_insights

router = APIRouter(prefix="/insights", tags=["insights"])


class InsightsRequest(BaseModel):
    title: str = Field(default="Uploaded PDF")
    department_code: str = Field(default="COLPHY")
    file_url: str | None = None
    text: str | None = None


class InsightsResponse(BaseModel):
    department_code: str
    summary: str
    questions: list[str]
    tips: list[str]


@router.post("/from-url", response_model=InsightsResponse)
async def generate_insights_from_url(payload: InsightsRequest) -> InsightsResponse:
    if payload.text and payload.text.strip():
        insights = generate_study_insights(payload.text, department_code=payload.department_code)
        return InsightsResponse(
            department_code=insights.department_code,
            summary=insights.summary,
            questions=insights.questions,
            tips=insights.tips,
        )

    if not payload.file_url:
        insights = generate_study_insights(payload.title, department_code=payload.department_code)
        return InsightsResponse(
            department_code=insights.department_code,
            summary=insights.summary,
            questions=insights.questions,
            tips=insights.tips,
        )

    request = Request(payload.file_url, headers={"User-Agent": "Vylix/1.0"})
    with urlopen(request) as response:
        content_type = response.headers.get_content_type()
        suffix = ".pdf" if content_type == "application/pdf" or payload.file_url.lower().endswith(".pdf") else ".txt"
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(response.read())
            temp_path = Path(temp_file.name)

    try:
        parsed_document = parse_with_docling(
            temp_path,
            document_id=temp_path.stem,
            source_name=payload.title,
        )
        insights = generate_study_insights(parsed_document.markdown, department_code=payload.department_code)
        return InsightsResponse(
            department_code=insights.department_code,
            summary=insights.summary,
            questions=insights.questions,
            tips=insights.tips,
        )
    finally:
        temp_path.unlink(missing_ok=True)