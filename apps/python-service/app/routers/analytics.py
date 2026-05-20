from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.analytics import GpaPredictionInput, GpaPredictor

router = APIRouter(prefix="/analytics", tags=["analytics"])

_predictor = GpaPredictor()


class GpaPredictionRequest(BaseModel):
    study_hours_per_week: float = Field(ge=0)
    attendance_rate: float = Field(ge=0, le=100)
    assessment_score: float = Field(ge=0, le=100)


class GpaPredictionResponse(BaseModel):
    predicted_gpa: float
    note: str


@router.post("/gpa-prediction", response_model=GpaPredictionResponse)
async def predict_gpa(payload: GpaPredictionRequest) -> GpaPredictionResponse:
    if not _predictor.is_fitted:
        # Lightweight default training surface for scaffolded usage.
        from pandas import DataFrame

        _predictor.fit(
            DataFrame(
                [
                    {
                        "study_hours_per_week": 2.0,
                        "attendance_rate": 75.0,
                        "assessment_score": 62.0,
                        "gpa": 2.4,
                    },
                    {
                        "study_hours_per_week": 8.0,
                        "attendance_rate": 92.0,
                        "assessment_score": 88.0,
                        "gpa": 4.2,
                    },
                ]
            )
        )

    predicted = _predictor.predict(
        GpaPredictionInput(
            study_hours_per_week=payload.study_hours_per_week,
            attendance_rate=payload.attendance_rate,
            assessment_score=payload.assessment_score,
        )
    )
    return GpaPredictionResponse(
        predicted_gpa=predicted,
        note="Scaffold prediction generated from the current starter model.",
    )
