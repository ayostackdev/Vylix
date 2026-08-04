from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.main import app

TEST_JWT_SECRET = "test-secret-for-ci"


@pytest.fixture(scope="session", autouse=True)
def _force_test_jwt_secret():
    """Use a known HS256 secret for the whole session so JWT flows are
    deterministic regardless of what SUPABASE_JWT_SECRET is set to locally."""
    get_settings().supabase_jwt_secret = TEST_JWT_SECRET


@pytest_asyncio.fixture(scope="session")
async def db_schema():
    """Create all tables once for tests that actually touch the database.

    Existing tests (health/401 paths) never open the DB, so this fixture is
    only pulled in by the smoke tests that need real rows.
    """
    from app.database import engine
    from app.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
