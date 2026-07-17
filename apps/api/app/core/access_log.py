from __future__ import annotations

import json
import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger("vylix.access")


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Structured JSON access log with request timing.

    Every HTTP request produces one log line like:
    {"method":"POST","path":"/api/v1/materials/upload","status":201,"duration_ms":342.1,"request_id":"...","user_id":"..."}
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id", uuid.uuid4().hex[:12])
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error(json.dumps({
                "method": request.method,
                "path": request.url.path,
                "query": str(request.query_params) if request.query_params else None,
                "status": 500,
                "duration_ms": round(duration_ms, 1),
                "request_id": request_id,
                "error": True,
            }))
            raise

        duration_ms = (time.perf_counter() - start) * 1000

        user_id = getattr(request.state, "user_id", None) or ""

        log_data = {
            "method": request.method,
            "path": request.url.path,
            "query": str(request.query_params) if request.query_params else None,
            "status": response.status_code,
            "duration_ms": round(duration_ms, 1),
            "request_id": request_id,
        }
        if user_id:
            log_data["user_id"] = user_id

        response.headers["x-request-id"] = request_id

        if response.status_code >= 500:
            logger.error(json.dumps(log_data))
        elif response.status_code >= 400:
            logger.warning(json.dumps(log_data))
        else:
            logger.info(json.dumps(log_data))

        return response
