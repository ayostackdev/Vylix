"""Public pricing plans endpoint — no auth required.

The web UI reads its cards from here so the frontend never hardcodes prices.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app import plans

router = APIRouter(prefix="/plans", tags=["plans"])


class PlanOut(BaseModel):
    key: str
    name: str
    price_ngn: int
    price_kobo: int
    duration_days: int | None
    query_quota: int | None
    storage_mb: int
    tagline: str
    featured: bool
    paid: bool


class PlansResponse(BaseModel):
    plans: list[PlanOut]


def _to_out(p: plans.Plan) -> PlanOut:
    return PlanOut(
        key=p.key,
        name=p.name,
        price_ngn=p.price_ngn,
        price_kobo=p.price_kobo,
        duration_days=p.duration_days,
        query_quota=p.query_quota,
        storage_mb=p.storage_bytes // (1024 * 1024),
        tagline=p.tagline,
        featured=p.featured,
        paid=p.price_kobo > 0,
    )


@router.get("", response_model=PlansResponse)
async def get_plans() -> PlansResponse:
    return PlansResponse(plans=[_to_out(p) for p in plans.public_plans()])
