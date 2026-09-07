from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_health_root(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    # Ready only when DB and Redis are reachable; the test env has neither,
    # so "degraded" is the expected steady state here (mirrors readiness).
    assert data["status"] in ("ok", "degraded")
    assert set(data) >= {"ai", "db", "redis"}
    assert data["ai"]["provider"] == "gemini"
    assert data["db"]["status"] in ("ok", "error")
    assert data["redis"]["status"] in ("ok", "error")


@pytest.mark.asyncio
async def test_health_live(client):
    resp = await client.get("/health/live")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_health_ready(client):
    resp = await client.get("/health/ready")
    assert resp.status_code in (200, 503)
