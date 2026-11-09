"""Best-effort product analytics (PostHog).

Server-side events are fire-and-forget: a missing key or a failed send must
never affect the request. Only pseudonymous user ids and coarse metadata are
sent — never emails, names, prompts, or uploaded content.
"""
from __future__ import annotations

import logging
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_client: Any | None = None
_initialized = False


def _get_client() -> Any | None:
    global _client, _initialized
    if _initialized:
        return _client

    _initialized = True
    settings = get_settings()
    if not settings.posthog_api_key:
        return None

    try:
        from posthog import Posthog

        _client = Posthog(settings.posthog_api_key, host=settings.posthog_host)
    except Exception:
        logger.warning("PostHog client initialisation failed", exc_info=True)
        _client = None
    return _client


def capture_event(
    distinct_id: str | None,
    event: str,
    properties: dict[str, Any] | None = None,
) -> None:
    """Send one analytics event. Never raises."""
    if not distinct_id:
        return

    client = _get_client()
    if client is None:
        return

    try:
        client.capture(event, distinct_id=distinct_id, properties=properties or {})
    except Exception:
        logger.warning("PostHog capture failed (event=%s)", event, exc_info=True)
