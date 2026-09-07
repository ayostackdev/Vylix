"""pgvector semantic cache for the academic agent.

Embeds the raw student prompt and looks up the nearest previously generated
answer within the same course + tier using cosine distance (``<=>``). A hit
returns the cached generation with zero retrieval and zero LLM cost; a miss
falls through to the normal agent pipeline, which stores the fresh answer for
the next student asking the same question.

Guard rails (the cache must never break the answer path):

* dimension mismatch -> skip. The hashing fallback outputs 256-d vectors and
  the ``semantic_cache.question_embedding`` column is ``VECTOR(1024)``; casting
  a mismatched literal would raise, so we bail before the SQL.
* any ``psycopg`` failure -> log and treat as a miss / skip the write.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import psycopg

from app.core.config import get_settings
from app.core.postgres import get_connection
from app.services.vector_store import _vector_literal

logger = logging.getLogger(__name__)
settings = get_settings()


def _within_dimensions(embedding: list[float]) -> bool:
    return len(embedding) == settings.embedding_dimensions


def get_semantic_cache(
    embedding: list[float],
    course_id: str,
    tier: str,
    threshold: float | None = None,
) -> str | None:
    """Return the cached answer for the closest stored query (same course+tier)
    when cosine similarity >= threshold, else ``None``. Never raises."""
    if not _within_dimensions(embedding):
        logger.debug(
            "Semantic cache skip: embedding dim %d != %d",
            len(embedding),
            settings.embedding_dimensions,
        )
        return None
    sim = (1.0 - threshold) if threshold is not None else (1.0 - settings.semantic_cache_threshold)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.semantic_cache_ttl_seconds)
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, answer
                FROM semantic_cache
                WHERE course_id = %s AND tier = %s
                  AND created_at > %s
                  AND question_embedding <=> %s::vector <= %s
                ORDER BY question_embedding <=> %s::vector
                LIMIT 1
                """,
                (
                    course_id,
                    tier,
                    cutoff,
                    _vector_literal(embedding),
                    sim,
                    _vector_literal(embedding),
                ),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            cursor.execute(
                "UPDATE semantic_cache SET hit_count = hit_count + 1, "
                "last_hit_at = NOW() WHERE id = %s",
                (row["id"],),
            )
            conn.commit()
            return row["answer"]
    except psycopg.Error:
        logger.exception(
            "Semantic cache lookup failed course=%s tier=%s", course_id, tier
        )
        return None


def put_semantic_cache(
    embedding: list[float],
    course_id: str,
    tier: str,
    question: str,
    answer: str,
) -> None:
    """Store a generated answer keyed by its question embedding. Never raises."""
    if not _within_dimensions(embedding):
        return
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO semantic_cache
                    (course_id, tier, question_embedding, question, answer)
                VALUES (%s, %s, %s::vector, %s, %s)
                """,
                (course_id, tier, _vector_literal(embedding), question, answer),
            )
            conn.commit()
    except psycopg.Error:
        logger.exception(
            "Semantic cache write failed course=%s tier=%s", course_id, tier
        )