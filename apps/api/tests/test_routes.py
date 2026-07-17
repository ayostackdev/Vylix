from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_colleges_requires_no_auth(client):
    resp = await client.get("/api/v1/colleges")
    assert resp.status_code in (200, 500, 503)


@pytest.mark.asyncio
async def test_unauthenticated_user_profile_returns_401(client):
    resp = await client.get("/api/v1/user/profile")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unauthenticated_streak_returns_401(client):
    resp = await client.get("/api/v1/user/streak")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unauthenticated_courses_returns_401(client):
    resp = await client.get("/api/v1/courses/my")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unauthenticated_conversations_returns_401(client):
    resp = await client.get("/api/v1/collaboration/conversations")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unauthenticated_qna_returns_401(client):
    resp = await client.get("/api/v1/qna/trending")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_maintenance_requires_key(client):
    resp = await client.get("/api/v1/maintenance/materials/queue")
    assert resp.status_code in (401, 403, 503)
