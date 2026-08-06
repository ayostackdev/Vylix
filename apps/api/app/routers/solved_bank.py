"""Solved Question Bank endpoints.

The bank is the high-margin paid product: pre-generated, cached answers that
cost ~₦0 to serve. Free users see a few samples per course; the full bank
requires an active paid pass (Semester Pro / Session VIP).
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, get_optional_user, verify_maintenance_key
from app.entitlements import has_active_paid_pass
from app.models import SolvedQuestion, SolvedQuestionStatus
from app.tasks_solvedbank import generate_for_course

router = APIRouter(prefix="/solved-bank", tags=["solved-bank"])

FREE_SAMPLE_COUNT = 3


class SolvedQuestionOut(BaseModel):
    id: str
    course_id: str
    question_text: str
    answer: dict | None
    year: int | None
    semester: str | None
    is_sample: bool
    view_count: int
    helpful_count: int


class SolvedBankListResponse(BaseModel):
    course_id: str
    has_paid_pass: bool
    samples: list[SolvedQuestionOut]
    locked_count: int


class StatsResponse(BaseModel):
    course_id: str
    completed: int
    queued: int
    failed: int
    samples: int
    cost_usd_total: float
    avg_cost_usd: float


class GenerateRequest(BaseModel):
    target_count: int = 300


class GenerateResponse(BaseModel):
    batch_task_id: str
    course_id: str


def _to_out(q: SolvedQuestion) -> SolvedQuestionOut:
    answer = None
    if q.answer_text:
        try:
            answer = json.loads(q.answer_text)
        except json.JSONDecodeError:
            answer = {"answer": q.answer_text}
    return SolvedQuestionOut(
        id=q.id,
        course_id=q.course_id,
        question_text=q.question_text,
        answer=answer,
        year=q.year,
        semester=q.semester,
        is_sample=q.is_sample,
        view_count=q.view_count,
        helpful_count=q.helpful_count,
    )


@router.get("/courses/{course_id}", response_model=SolvedBankListResponse)
async def list_solved_bank(
    course_id: str,
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> SolvedBankListResponse:
    paid = bool(user) and await has_active_paid_pass(db, user.user.id)

    result = await db.execute(
        select(SolvedQuestion)
        .where(
            SolvedQuestion.course_id == course_id,
            SolvedQuestion.is_active.is_(True),
            SolvedQuestion.status == SolvedQuestionStatus.COMPLETED,
        )
        .order_by(
            SolvedQuestion.is_sample.desc(),
            SolvedQuestion.helpful_count.desc(),
            SolvedQuestion.year.desc().nullslast(),
        )
    )
    questions = list(result.scalars().all())

    if paid:
        samples = [_to_out(q) for q in questions]
        locked = 0
    else:
        samples = [_to_out(q) for q in questions[:FREE_SAMPLE_COUNT]]
        locked = max(0, len(questions) - len(samples))

    return SolvedBankListResponse(
        course_id=course_id,
        has_paid_pass=paid,
        samples=samples,
        locked_count=locked,
    )


@router.get("/questions/{question_id}", response_model=SolvedQuestionOut)
async def get_solved_question(
    question_id: str,
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> SolvedQuestionOut:
    result = await db.execute(
        select(SolvedQuestion).where(SolvedQuestion.id == question_id)
    )
    q = result.scalar_one_or_none()
    if not q or not q.is_active or q.status != SolvedQuestionStatus.COMPLETED:
        raise HTTPException(status_code=404, detail="Solved question not found")

    if not q.is_sample:
        paid = bool(user) and await has_active_paid_pass(db, user.user.id)
        if not paid:
            raise HTTPException(
                status_code=403,
                detail="Semester Pro or Session VIP required for the Solved Question Bank",
            )

    q.view_count += 1
    await db.commit()
    return _to_out(q)


@router.get("/courses/{course_id}/stats", response_model=StatsResponse)
async def solved_bank_stats(
    course_id: str,
    db: AsyncSession = Depends(get_db),
) -> StatsResponse:
    rows = await db.execute(
        select(
            SolvedQuestion.status,
            func.count(SolvedQuestion.id),
            func.coalesce(func.sum(SolvedQuestion.cost_usd), 0.0),
        )
        .where(SolvedQuestion.course_id == course_id)
        .group_by(SolvedQuestion.status)
    )
    by_status = {row[0]: {"count": row[1], "cost_usd": float(row[2])} for row in rows.all()}

    sample_result = await db.execute(
        select(func.count(SolvedQuestion.id)).where(
            SolvedQuestion.course_id == course_id,
            SolvedQuestion.is_sample.is_(True),
            SolvedQuestion.status == SolvedQuestionStatus.COMPLETED,
        )
    )
    sample_count = int(sample_result.scalar_one())

    completed = by_status.get("COMPLETED", {"count": 0})["count"]
    cost_total = by_status.get("COMPLETED", {"cost_usd": 0.0})["cost_usd"]

    return StatsResponse(
        course_id=course_id,
        completed=int(completed),
        queued=int(by_status.get("QUEUED", {"count": 0})["count"]),
        failed=int(by_status.get("FAILED", {"count": 0})["count"]),
        samples=sample_count,
        cost_usd_total=cost_total,
        avg_cost_usd=cost_total / completed if completed else 0.0,
    )


@router.post("/courses/{course_id}/generate", response_model=GenerateResponse, status_code=202)
async def trigger_generation(
    course_id: str,
    body: GenerateRequest,
    _: str = Depends(verify_maintenance_key),
) -> GenerateResponse:
    task = generate_for_course.delay(course_id, body.target_count, "manual")
    return GenerateResponse(batch_task_id=task.id, course_id=course_id)
