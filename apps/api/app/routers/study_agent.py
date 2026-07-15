from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import CurrentUser, get_current_user
from app.services.academic_agent import run_vylix_academic_agent

router = APIRouter(prefix="/study-agent", tags=["study-agent"])


class StudyAgentRequest(BaseModel):
    course_code: str = Field(..., min_length=1, max_length=20)
    prompt: str = Field(
        default="Analyze my weaknesses and create a personalized study plan",
        max_length=2000,
    )
    task_tier: str = Field(default="standard", pattern="^(standard|complex)$")


class StudyAgentResponse(BaseModel):
    plan: str
    course_code: str
    tier: str


@router.post("/run", response_model=StudyAgentResponse)
async def run_study_agent(
    payload: StudyAgentRequest,
    user: CurrentUser = Depends(get_current_user),
):
    try:
        result = run_vylix_academic_agent(
            user_id=user.id,
            course_code=payload.course_code,
            user_prompt=payload.prompt,
            task_tier=payload.task_tier,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Academic agent failed: {exc}",
        )

    return StudyAgentResponse(
        plan=result,
        course_code=payload.course_code,
        tier=payload.task_tier,
    )
