from __future__ import annotations

import base64
import json
from dataclasses import dataclass

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


@dataclass
class CurrentUser:
    id: str
    email: str | None
    full_name: str | None
    user: User


def _decode_jwt_payload(token: str) -> dict:
    """Decode and verify JWT signature using the Supabase JWT secret.

    Falls back to unsigned decode only when SUPABASE_JWT_SECRET is not configured
    (local dev convenience), but logs a warning.
    """
    jwt_secret = settings.supabase_jwt_secret

    if jwt_secret:
        try:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidAudienceError:
            raise HTTPException(status_code=401, detail="Invalid token audience")
        except jwt.InvalidSignatureError:
            raise HTTPException(status_code=401, detail="Invalid token signature")
        except jwt.DecodeError:
            raise HTTPException(status_code=401, detail="Invalid token")
    else:
        import logging
        logging.warning(
            "SUPABASE_JWT_SECRET is not set — skipping JWT signature verification. "
            "This is insecure and should only be used in local development."
        )
        try:
            parts = token.split(".")
            if len(parts) != 3:
                raise HTTPException(status_code=401, detail="Invalid token format")
            payload_segment = parts[1]
            padding = 4 - len(payload_segment) % 4
            payload_segment += "=" * padding
            decoded = base64.urlsafe_b64decode(payload_segment)
            return json.loads(decoded)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    payload = _decode_jwt_payload(token)

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
