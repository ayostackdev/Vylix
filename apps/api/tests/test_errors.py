from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.materials import MAX_COMPRESS_BYTES, _compress_pdf_bytes


@pytest.mark.asyncio
async def test_unhandled_errors_return_json_detail():
    @app.get("/_test_crash")
    async def _crash():
        raise ValueError("boom")

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            resp = await client.get("/_test_crash")
            assert resp.status_code == 500
            assert resp.headers["content-type"].startswith("application/json")
            assert "ValueError" in resp.json()["detail"]
            assert "boom" in resp.json()["detail"]
    finally:
        app.router.routes = [r for r in app.router.routes if getattr(r, "path", "") != "/_test_crash"]


def test_compress_skips_non_pdf():
    data = b"%PDF-1.4 fake"
    assert _compress_pdf_bytes(data, "notes.png") is data


def test_compress_skips_large_pdfs():
    data = b"0" * (MAX_COMPRESS_BYTES + 1)
    result = _compress_pdf_bytes(data, "big.pdf")
    assert result is data
