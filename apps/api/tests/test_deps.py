from __future__ import annotations

import base64
import hashlib
import hmac
import json

import pytest
from fastapi import HTTPException

from app.deps import (
    CurrentUser,
    RateLimiter,
    ai_rate_limiter,
    anonymous_ip_limiter,
    check_ai_rate_limit,
    _decode_jwt_payload,
)


SECRET = "test-secret-for-ci"


def _make_jwt(payload: dict, secret: str = SECRET, algorithm: str = "HS256") -> str:
    """Helper to build a signed JWT string for testing."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": algorithm, "typ": "JWT"}).encode()).rstrip(b"=").decode()
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    sig = hmac.new(secret.encode(), f"{header}.{payload_b64}".encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    return f"{header}.{payload_b64}.{sig_b64}"


async def test_decode_valid_signed_token():
    """Valid signed token is accepted."""
    token = _make_jwt({"sub": "user-123", "email": "test@example.com", "aud": "authenticated"})
    result = await _decode_jwt_payload(token)
    assert result["sub"] == "user-123"
    assert result["email"] == "test@example.com"


async def test_decode_wrong_secret():
    """Token signed with wrong secret is rejected."""
    token = _make_jwt({"sub": "user-123"}, secret="wrong-secret")
    with pytest.raises(HTTPException) as exc_info:
        await _decode_jwt_payload(token)
    assert exc_info.value.status_code == 401


async def test_decode_invalid_format():
    with pytest.raises(HTTPException) as exc_info:
        await _decode_jwt_payload("not-a-jwt")
    assert exc_info.value.status_code == 401


async def test_decode_too_many_parts():
    with pytest.raises(HTTPException) as exc_info:
        await _decode_jwt_payload("a.b.c.d")
    assert exc_info.value.status_code == 401


def _make_request(client_host: str = "1.2.3.4"):
    from starlette.requests import Request

    return Request(scope={"type": "http", "client": (client_host, 1234)})


def test_rate_limiter_sliding_window():
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    assert not limiter.is_rate_limited("k")
    assert not limiter.is_rate_limited("k")
    assert not limiter.is_rate_limited("k")
    assert limiter.is_rate_limited("k")


def test_check_ai_rate_limit_anonymous_per_ip():
    request = _make_request(client_host="10.20.30.99")
    for _ in range(anonymous_ip_limiter.max_requests):
        check_ai_rate_limit(request, user=None)
    with pytest.raises(HTTPException) as exc_info:
        check_ai_rate_limit(request, user=None)
    assert exc_info.value.status_code == 429


def test_check_ai_rate_limit_keyed_by_user_id():
    user_a = CurrentUser(id="user-a", email=None, full_name=None, user=None)
    user_b = CurrentUser(id="user-b", email=None, full_name=None, user=None)
    request = _make_request(client_host="10.20.30.99")
    for _ in range(ai_rate_limiter.max_requests):
        check_ai_rate_limit(request, user=user_a)
    check_ai_rate_limit(request, user=user_b)
    with pytest.raises(HTTPException) as exc_info:
        check_ai_rate_limit(request, user=user_a)
    assert exc_info.value.status_code == 429
