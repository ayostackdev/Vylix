"""DB-free guard-rail tests for the semantic cache.

Exercise the pure guards that keep the cache from ever breaking the answer
path: dimension mismatch (hashing fallback is 256-d vs the VECTOR(1024)
column) and graceful degradation when the database is unreachable. The live
pgvector round-trip runs in CI, where the migration has been applied.
"""
from __future__ import annotations

import psycopg

from app.core.config import get_settings
from app.services import semantic_cache

DIMS = get_settings().embedding_dimensions


def test_get_skips_dimension_mismatch() -> None:
    assert semantic_cache.get_semantic_cache([0.0] * 256, "course-1", "standard") is None


def test_put_skips_dimension_mismatch() -> None:
    # Must not attempt SQL (a 256-d literal cannot cast into VECTOR(1024)).
    semantic_cache.put_semantic_cache([0.0] * 256, "course-1", "standard", "q", "a")


def test_get_misses_gracefully_when_db_unreachable(monkeypatch) -> None:
    def _boom(*args, **kwargs):
        raise psycopg.OperationalError("connection refused")

    monkeypatch.setattr(semantic_cache, "get_connection", _boom)
    assert semantic_cache.get_semantic_cache([0.0] * DIMS, "course-1", "standard") is None


def test_put_skips_gracefully_when_db_unreachable(monkeypatch) -> None:
    def _boom(*args, **kwargs):
        raise psycopg.OperationalError("connection refused")

    monkeypatch.setattr(semantic_cache, "get_connection", _boom)
    semantic_cache.put_semantic_cache([0.0] * DIMS, "course-1", "standard", "q", "a")