from __future__ import annotations

import base64
import hashlib
import hmac
import json

import pytest
from fastapi import HTTPException

from app.deps import _decode_jwt_payload


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
