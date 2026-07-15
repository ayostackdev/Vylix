from __future__ import annotations

import base64
import json

import pytest
from fastapi import HTTPException

from app.deps import _decode_jwt_payload


def _make_jwt(payload: dict, secret: str = "", algorithm: str = "HS256") -> str:
    """Helper to build a JWT string for testing."""
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    if secret:
        import hmac
        sig = hmac.new(secret.encode(), f"{header}.{payload_b64}".encode(), algorithm="sha256").digest()
        sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
        return f"{header}.{payload_b64}.{sig_b64}"
    return f"{header}.{payload_b64}.fake-sig"


def test_decode_valid_unsigned_token():
    """When SUPABASE_JWT_SECRET is empty, unsigned tokens are accepted (dev mode)."""
    token = _make_jwt({"sub": "user-123", "email": "test@example.com"})
    result = _decode_jwt_payload(token)
    assert result["sub"] == "user-123"
    assert result["email"] == "test@example.com"


def test_decode_invalid_format():
    with pytest.raises(HTTPException) as exc_info:
        _decode_jwt_payload("not-a-jwt")
    assert exc_info.value.status_code == 401


def test_decode_too_many_parts():
    with pytest.raises(HTTPException) as exc_info:
        _decode_jwt_payload("a.b.c.d")
    assert exc_info.value.status_code == 401
