from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta

import json

import jwt
import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.database import get_db
from app.models import User, UserEmail

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


class RateLimiter:
    """Simple in-memory sliding window rate limiter."""

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_rate_limited(self, key: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]
        if len(self._requests[key]) >= self.max_requests:
            return True
        self._requests[key].append(now)
        return False


ai_rate_limiter = RateLimiter(max_requests=15, window_seconds=60)


def check_ai_rate_limit(request: Request) -> None:
    """Dependency that enforces rate limiting on AI endpoints."""
    client_ip = request.client.host if request.client else "unknown"
    if ai_rate_limiter.is_rate_limited(f"ai:{client_ip}"):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment before trying again.",
        )


DAILY_TOKEN_LIMIT = 15
PREMIUM_TOKEN_LIMIT = 100


@dataclass
class CurrentUser:
    id: str
    email: str | None
    full_name: str | None
    user: User


_jwks_cache: tuple[str, list[dict]] | None = None


async def _fetch_jwks() -> list[dict]:
    global _jwks_cache
    supabase_url = settings.supabase_url
    if not supabase_url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")
    if _jwks_cache and _jwks_cache[0] == supabase_url:
        return _jwks_cache[1]
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{supabase_url}/auth/v1/.well-known/jwks.json", timeout=10)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
    _jwks_cache = (supabase_url, keys)
    return keys


async def _decode_jwt_payload(token: str) -> dict:
    unverified = jwt.get_unverified_header(token)
    alg = unverified.get("alg", "HS256")

    if alg == "HS256":
        jwt_secret = settings.supabase_jwt_secret
        if not jwt_secret:
            raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not set")
        try:
            return jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidAudienceError:
            raise HTTPException(status_code=401, detail="Invalid token audience")
        except jwt.InvalidSignatureError:
            raise HTTPException(status_code=401, detail="Invalid token signature")
        except jwt.DecodeError:
            raise HTTPException(status_code=401, detail="Invalid token")

    if alg == "RS256":
        keys = await _fetch_jwks()
        for key in keys:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
            try:
                return jwt.decode(token, public_key, algorithms=["RS256"], audience="authenticated")
            except jwt.InvalidSignatureError:
                continue
        raise HTTPException(status_code=401, detail="Invalid token signature")

    raise HTTPException(status_code=401, detail=f"Unsupported algorithm: {alg}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    payload = await _decode_jwt_payload(token)

    supabase_user_id = payload.get("sub")
    email = payload.get("email")

    if not supabase_user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == supabase_user_id))
    user = result.scalar_one_or_none()

    if not user:
        # Auto-create user from JWT (onboarding flow)
        user = User(
            id=supabase_user_id,
            full_name=payload.get("user_metadata", {}).get("full_name", email or "User"),
        )
        db.add(user)
        await db.flush()

        if email:
            user_email = UserEmail(email=email, user_id=user.id, is_primary=True, is_verified=True)
            db.add(user_email)
            await db.flush()

    return CurrentUser(id=user.id, email=email, full_name=user.full_name, user=user)


async def check_ai_token_quota(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    u = current_user.user
    now = datetime.now(timezone.utc)
    today = now.date()

    if u.daily_tokens_reset_at is None or u.daily_tokens_reset_at.date() < today:
        u.daily_tokens_used = 0
        u.daily_tokens_reset_at = now

    if u.daily_tokens_used >= u.daily_tokens_limit:
        raise HTTPException(
            status_code=429,
            detail="DAILY_LIMIT_REACHED",
            headers={"X-Tokens-Reset": "midnight"},
        )

    u.daily_tokens_used += 1
    u.daily_tokens_reset_at = now
    await db.flush()

    return current_user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser | None:
    if not credentials:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


async def verify_maintenance_key(request: Request) -> str:
    auth_header = request.headers.get("authorization", "")
    x_key = request.headers.get("x-maintenance-key", "")

    key = ""
    if auth_header.startswith("Bearer "):
        key = auth_header[7:]
    elif x_key:
        key = x_key

    if not settings.maintenance_api_key:
        raise HTTPException(status_code=503, detail="Maintenance mode not configured")
    if key != settings.maintenance_api_key:
        raise HTTPException(status_code=403, detail="Invalid maintenance key")
    return key
