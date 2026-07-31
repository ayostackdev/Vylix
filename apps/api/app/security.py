from __future__ import annotations

import json
import time

import httpx
import jwt
from fastapi import HTTPException, status

from app.core.config import get_settings

settings = get_settings()

_jwks_cache: tuple[str, float, list[dict]] | None = None


def _jwt_secret() -> str | None:
    """Return the Supabase JWT secret when usable for HS256 verification.

    Supabase's new-style secret keys are prefixed with ``sb_`` and are NOT
    the JWT signing secret, so they are ignored here.
    """
    secret = settings.supabase_jwt_secret
    if not secret or secret.startswith("sb_"):
        return None
    return secret


async def fetch_jwks() -> list[dict]:
    global _jwks_cache
    supabase_url = settings.supabase_url
    if not supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL not configured",
        )
    now = time.monotonic()
    if _jwks_cache and _jwks_cache[0] == supabase_url and now - _jwks_cache[1] < 3600:
        return _jwks_cache[2]
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{supabase_url}/auth/v1/.well-known/jwks.json", timeout=10
        )
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
    _jwks_cache = (supabase_url, now, keys)
    return keys


def _public_key_from_jwk(jwk: dict):
    kty = jwk.get("kty")
    if kty == "EC":
        return jwt.algorithms.ECAlgorithm.from_jwk(json.dumps(jwk))
    if kty == "RSA":
        return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
    raise jwt.InvalidKeyError(f"Unsupported JWK key type: {kty}")


async def decode_access_token(token: str) -> dict:
    """Verify a Supabase access token and return its payload.

    Supports ES256/RS256 (verified against the project's JWKS, matched by
    ``kid`` when present) and HS256 (verified with ``SUPABASE_JWT_SECRET``).
    """
    try:
        unverified = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    alg = unverified.get("alg", "")
    kid = unverified.get("kid")

    if alg in {"RS256", "ES256"}:
        keys = await fetch_jwks()
        for key in keys:
            if kid and key.get("kid") != kid:
                continue
            try:
                public_key = _public_key_from_jwk(key)
                return jwt.decode(
                    token, public_key, algorithms=[alg], audience="authenticated"
                )
            except jwt.ExpiredSignatureError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
                )
            except jwt.InvalidTokenError:
                continue
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature"
        )

    if alg == "HS256":
        jwt_secret = _jwt_secret()
        if not jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="SUPABASE_JWT_SECRET not set",
            )
        try:
            return jwt.decode(
                token, jwt_secret, algorithms=["HS256"], audience="authenticated"
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature"
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Unsupported algorithm: {alg}"
    )
