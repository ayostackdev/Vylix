from __future__ import annotations

import contextvars

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_current_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_user_id", default=None
)


def set_current_user_id(user_id: str | None) -> None:
    _current_user_id.set(user_id)


def get_current_user_id() -> str | None:
    return _current_user_id.get()


async def apply_rls_context(session: AsyncSession) -> None:
    """Set the RLS user context on the current transaction.

    When ``app.current_user_id`` is set, Postgres RLS policies use it to
    enforce row-level access.  When it is *not* set (e.g. Celery workers),
    policies grant full access so background jobs are not blocked.
    """
    user_id = get_current_user_id()
    if user_id:
        await session.execute(
            text("SET LOCAL app.current_user_id = :uid"), {"uid": user_id}
        )
