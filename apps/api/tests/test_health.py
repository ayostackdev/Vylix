from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_health_root(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_health_live(client):
    resp = await client.get("/health/live")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_health_ready(client):
    resp = await client.get("/health/ready")
    assert resp.status_code in (200, 503)
