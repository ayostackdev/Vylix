from __future__ import annotations

from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import Subscription, User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

settings = get_settings()
router = APIRouter(prefix="/payments", tags=["payments"])

PAYSTACK_BASE = "https://api.paystack.co"
PREMIUM_PRICE_KOBO = 250_000  # #2,500 = 250,000 kobo
PREMIUM_DURATION_DAYS = 365


class InitializeRequest(BaseModel):
    email: str


class InitializeResponse(BaseModel):
    authorization_url: str
    reference: str


class VerifyResponse(BaseModel):
    status: str
    plan: str
    expires_at: str | None


@router.post("/initialize", response_model=InitializeResponse)
async def initialize_payment(
    body: InitializeRequest,
    user: CurrentUser = Depends(get_current_user),
):
    ref = f"VYLIX-PREMIUM-{user.user.id}-{int(datetime.now(timezone.utc).timestamp())}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PAYSTACK_BASE}/transaction/initialize",
            json={
                "email": body.email,
                "amount": PREMIUM_PRICE_KOBO,
                "reference": ref,
                "currency": "NGN",
                "callback_url": f"{settings.frontend_url}/pricing?trxref={ref}",
                "metadata": {
                    "user_id": user.user.id,
                    "plan": "premium",
                },
            },
            headers={
                "Authorization": f"Bearer {settings.paystack_secret_key}",
                "Content-Type": "application/json",
            },
        )

    data = resp.json()
    if not data.get("status"):
        raise HTTPException(status_code=400, detail=data.get("message", "Paystack init failed"))

    return InitializeResponse(
        authorization_url=data["data"]["authorization_url"],
        reference=data["data"]["reference"],
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify_payment(
    reference: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{PAYSTACK_BASE}/transaction/verify/{reference}",
            headers={"Authorization": f"Bearer {settings.paystack_secret_key}"},
        )

    data = resp.json()
    if not data.get("status"):
        raise HTTPException(status_code=400, detail="Verification failed")

    txn = data["data"]
    if txn["status"] != "success":
        raise HTTPException(status_code=400, detail=f"Transaction not successful: {txn['status']}")

    if txn["metadata"]["user_id"] != user.user.id:
        raise HTTPException(status_code=403, detail="Reference belongs to another user")

    result = await db.execute(
        select(Subscription).where(Subscription.reference == reference)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return VerifyResponse(
            status=existing.status,
            plan=existing.plan,
            expires_at=str(existing.expires_at) if existing.expires_at else None,
        )

    expires_at = datetime.now(timezone.utc) + timedelta(days=PREMIUM_DURATION_DAYS)

    sub = Subscription(
        user_id=user.user.id,
        reference=reference,
        plan="premium",
        status="active",
        expires_at=expires_at,
    )
    db.add(sub)

    u = await db.get(User, user.user.id)
    u.daily_tokens_limit = 100

    await db.commit()

    return VerifyResponse(
        status="active",
        plan="premium",
        expires_at=str(expires_at),
    )


@router.post("/webhook")
async def paystack_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    event = body.get("event")

    if event != "charge.success":
        return {"status": "ignored"}

    data = body.get("data", {})
    reference = data.get("reference")
    metadata = data.get("metadata", {})
    user_id = metadata.get("user_id")

    if not reference or not user_id:
        return {"status": "ignored"}

    result = await db.execute(
        select(Subscription).where(Subscription.reference == reference)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return {"status": "duplicate"}

    expires_at = datetime.now(timezone.utc) + timedelta(days=PREMIUM_DURATION_DAYS)

    sub = Subscription(
        user_id=user_id,
        reference=reference,
        plan="premium",
        status="active",
        expires_at=expires_at,
    )
    db.add(sub)

    u = await db.get(User, user_id)
    if u:
        u.daily_tokens_limit = 100

    await db.commit()
    return {"status": "ok"}
