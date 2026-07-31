from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import get_settings
from app.db_rls import set_current_user_id
from app.security import decode_access_token

logger = logging.getLogger(__name__)
settings = get_settings()

_ACTIVITY_PATHS = {"/api/v1/"}
_ACTIVITY_EXCLUDE = {"/api/v1/health", "/api/v1/ws"}


async def _extract_user_id(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = await decode_access_token(auth[7:])
        return payload.get("sub")
    except Exception:
        return None


class ActivityTrackingMiddleware(BaseHTTPMiddleware):
    """Update user's last_active_at on authenticated API requests.

    Also sets the RLS user context so Postgres row-level security policies
    can enforce per-user access on every database transaction.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        user_id = await _extract_user_id(request)
        set_current_user_id(user_id)
        request.state.user_id = user_id or ""

        try:
            response = await call_next(request)
        finally:
            set_current_user_id(None)

        if user_id and _should_track(request.url.path, request.method):
            self._update_last_active(user_id)

        return response

    def _update_last_active(self, user_id: str) -> None:
        try:
            from app.core.postgres import get_connection

            with get_connection() as conn, conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE users SET last_active_at = NOW() WHERE id = %s",
                    (user_id,),
                )
                conn.commit()
        except Exception as e:
            logger.debug("Activity tracking skipped: %s", e)


def _should_track(path: str, method: str) -> bool:
    if method not in {"GET", "POST", "PATCH", "PUT", "DELETE"}:
        return False
    if not any(path.startswith(p) for p in _ACTIVITY_PATHS):
        return False
    if any(path.startswith(p) for p in _ACTIVITY_EXCLUDE):
        return False
    return True
