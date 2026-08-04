from __future__ import annotations

import time
import uuid

import jwt
import pytest

from app.core.config import get_settings
from app.database import async_session
from app.models import Course, Material, Topic, User
from app.routers import materials as materials_router
from app.security import decode_access_token

TEST_JWT_SECRET = "test-secret-for-ci"


def _make_token(sub: str, email: str = "smoke@example.com") -> str:
    """Build an HS256 JWT signed with the session's test secret."""
    now = int(time.time())
    payload = {
        "sub": sub,
        "aud": "authenticated",
        "iat": now,
        "exp": now + 3600,
        "email": email,
        "user_metadata": {"full_name": "Smoke Tester"},
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


async def _cleanup(*rows) -> None:
    """Delete created rows (best-effort) so repeated local runs stay clean."""
    async with async_session() as db:
        for row in rows:
            if row is not None:
                await db.delete(row)
        await db.commit()


@pytest.mark.asyncio
async def test_auth_profile_flow_creates_user(client, db_schema):
    uid = str(uuid.uuid4())
    token = _make_token(uid)

    payload = await decode_access_token(token)
    assert payload["sub"] == uid

    resp = await client.get(
        "/api/v1/user/profile", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == uid
    assert body["status"] == "STUDENT"
    assert body["full_name"] == "Smoke Tester"

    async with async_session() as db:
        user = await db.get(User, uid)
    assert user is not None
    await _cleanup(user)


@pytest.mark.asyncio
async def test_upload_past_question_roundtrip(client, db_schema, monkeypatch):
    class _FakeStorage:
        async def upload(self, bucket, path, data, content_type):
            return f"https://fake-storage.test/{bucket}/{path}"

        async def delete(self, bucket, path):
            return None

        async def get_signed_url(self, bucket, path, expires_in=3600):
            return f"https://fake-storage.test/{bucket}/{path}"

    # Do not touch the real broker/worker during the smoke test.
    monkeypatch.setattr(materials_router, "_celery_broker_reachable", lambda: False)
    monkeypatch.setattr(materials_router, "get_storage", lambda: _FakeStorage())

    uid = str(uuid.uuid4())
    token = _make_token(uid)
    headers = {"Authorization": f"Bearer {token}"}

    # A general course is required so upload resolves a topic without a code.
    course = Course(
        id=str(uuid.uuid4()), code="SMK101", title="Smoke General",
        level=100, is_general=True,
    )
    async with async_session() as db:
        db.add(course)
        await db.commit()

    files = {"file": ("past-question.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")}
    data = {
        "is_past_question": "true",
        "exam_year": "2024",
        "semester": "FIRST",
    }

    resp = await client.post(
        "/api/v1/materials/upload", headers=headers, files=files, data=data
    )
    assert resp.status_code == 200, resp.text
    material = resp.json()
    assert material["is_past_question"] is True
    assert material["exam_year"] == 2024
    assert material["semester"] == "FIRST"

    feed = await client.get("/api/v1/materials/past-questions")
    assert feed.status_code == 200
    assert any(item["id"] == material["id"] for item in feed.json()["items"])

    async with async_session() as db:
        db_material = await db.get(Material, material["id"])
        db_topic = await db.get(Topic, material["topic_id"])
        db_course = await db.get(Course, course.id)
        db_user = await db.get(User, uid)
    await _cleanup(db_material, db_topic, db_course, db_user)
