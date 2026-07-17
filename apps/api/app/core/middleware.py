from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_ACTIVITY_PATHS = {"/api/"}
_ACTIVITY_EXCLUDE = {"/api/health", "/api/ws"}


class ActivityTrackingMiddleware(BaseHTTPMiddleware):
    """Update user's last_active_at on authenticated API requests.

    Runs a lightweight background update so request latency is minimal.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        path = request.url.path
        if not any(path.startswith(p) for p in _ACTIVITY_PATHS):
            return response
        if any(path.startswith(p) for p in _ACTIVITY_EXCLUDE):
            return response
        if request.method not in {"GET", "POST", "PATCH", "PUT", "DELETE"}:
            return response

        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return response

        try:
            import jwt
            from app.core.postgres import get_connection

            token = auth[7:]
            jwt_secret = settings.supabase_jwt_secret
            if not jwt_secret:
                return response

            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
            user_id = payload.get("sub")
            if not user_id:
                return response

            with get_connection() as conn, conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE users SET last_active_at = NOW() WHERE id = %s",
                    (user_id,),
                )
                conn.commit()
        except Exception as e:
            logger.debug("Activity tracking skipped: %s", e)

        return response
