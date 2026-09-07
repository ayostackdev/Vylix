"""End-to-end validation of the real Vylix retrieval stack.

Runs the exact production path against a live Supabase/pgvector database:

    Docling (optional, ``--pdf``) or raw text
        -> hierarchical parent/child chunks
        -> real BGE-M3 embeddings (FlagEmbedding/torch, the worker image)
        -> scoped pgvector upsert (course + university stamped)
        -> scoped hybrid query (BGE-M3 dense+sparse + ColBERT rerank)
        -> assertions on hit quality and institution isolation

The local regression suite tests these layers against mocks/synthetic
vectors, so this script is the guard that proves the real model + real
database agree with the design. Run it against staging Supabase from the
worker image; it exits non-zero (and loud) on the first broken link.

Exit codes:
  0  all checks passed
  1  BGE-M3/torch not importable (run me on the worker image, not the API one)
  2  database unreachable or pgvector migration not applied
  3  ingest/query/isolation assertions failed
"""

from __future__ import annotations

import argparse
import logging
import uuid
from pathlib import Path

from app.core.config import get_settings
from app.core.postgres import get_connection
from app.services.academic_agent import resolve_course_context
from app.services.bge_m3 import bge_m3_available
from app.services.docling_parser import parse_with_docling
from app.services.rag import build_hierarchical_chunks
from app.services.vector_store import VectorStore

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("validate_stack")

RUNNER_USER_ID = "00000000-0000-0000-0000-0000000000aa"
RUNNER_TOPIC_ID = "00000000-0000-0000-0000-0000000000bb"
RUNNER_MATERIAL_ID = "00000000-0000-0000-0000-0000000000cc"
RUNNER_FILE = "stack-validator.txt"
RUNNER_URL = "validator://stack"

SAMPLE_HANDOUT = """PHY101 Projectile Motion

A projectile is any object that moves through the air with only gravity
acting on it after it is launched. Its path, called the trajectory, is a
parabola in the absence of air resistance.

Resolve the motion into two independent components. The horizontal motion
has constant velocity because no horizontal force acts after launch. The
vertical motion has constant downward acceleration equal to g = 9.8 m/s2.

The horizontal range R of a projectile launched at speed v0 and angle theta
is R = (v0^2 * sin(2 * theta)) / g. The range is maximised at 45 degrees,
where sin(90) reaches its maximum value of 1, giving R_max = v0^2 / g.

Time of flight T = (2 * v0 * sin(theta)) / g. Maximum height H = (v0^2 *
sin(theta)^2) / (2 * g).

For example, a ball kicked at 20 m/s at 45 degrees stays airborne for about
2.9 seconds and lands about 41 metres downrange. Ignoring drag, doubling
the launch speed quadruples the range.

Variable acceleration and calculus: position is the integral of velocity,
velocity is the integral of acceleration. With constant gravity the
vertical position is y = y0 + v0y*t - (1/2)*g*t^2.
"""

PROBE_QUERY = "What is the formula for the range of a projectile?"


# ── helpers ─────────────────────────────────────────────────────────────────


def _cleanup_previous(material_id: str) -> None:
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "DELETE FROM material_chunks WHERE document_id = %s", (material_id,)
        )
        cursor.execute(
            "DELETE FROM material_parents WHERE document_id = %s", (material_id,)
        )
        cursor.execute("DELETE FROM materials WHERE id = %s", (material_id,))


def _seed_chain(course_id: str, university_id: str | None) -> str:
    """Insert the runner user, topic and material under the resolved course."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO users (id, full_name, university_id)
            VALUES (%s, 'Stack Validation Runner', %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (RUNNER_USER_ID, university_id),
        )
        cursor.execute(
            """
            INSERT INTO topics (id, title, course_id, author_id)
            VALUES (%s, 'Stack Validation', %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (RUNNER_TOPIC_ID, course_id, RUNNER_USER_ID),
        )
        cursor.execute(
            """
            INSERT INTO materials
                (id, file_name, file_url, file_size, topic_id, uploader_id,
                 processing_status, is_seed, is_shared, content_hash)
            VALUES (%s, %s, %s, %s, %s, %s, 'processed', TRUE, TRUE,
                    'stack-validator-v1')
            """,
            (
                RUNNER_MATERIAL_ID,
                RUNNER_FILE,
                RUNNER_URL,
                len(SAMPLE_HANDOUT),
                RUNNER_TOPIC_ID,
                RUNNER_USER_ID,
            ),
        )
    return RUNNER_MATERIAL_ID


def _ingest(store: VectorStore, pdf: Path | None, material_id: str) -> int:
    if pdf is not None:
        logger.info("Parsing %s with Docling...", pdf)
        parsed = parse_with_docling(
            pdf, document_id=material_id, source_name=f"validate-{pdf.name}"
        )
        content = parsed.markdown
    else:
        content = SAMPLE_HANDOUT
    parents, children_by_parent = build_hierarchical_chunks(content)
    count = sum(len(group) for group in children_by_parent)
    logger.info("Building %d child chunks across %d parents", count, len(parents))
    upserted = store.upsert_hierarchical_document(
        document_id=material_id,
        source_name=RUNNER_FILE,
        parents=parents,
        children_by_parent=children_by_parent,
    )
    if upserted != count:
        raise AssertionError(
            f"Upsert returned {upserted} chunks, expected {count}: "
            "pgvector insert path is out of sync with chunking."
        )
    return count


def _verify_scope_sync(material_id: str) -> tuple[str, str | None]:
    """Confirm scope-stamping ran; return (course_id, university_id) as stored."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT course_id, university_id
            FROM material_chunks
            WHERE document_id = %s
            LIMIT 1
            """,
            (material_id,),
        )
        row = cursor.fetchone()
    if not row or row["course_id"] is None:
        raise AssertionError(
            "material_chunks were not course-scoped by _run_scope_sync "
            "(no course_id in scope sync, or migration 035/036 not applied)."
        )
    return str(row["course_id"]), (
        str(row["university_id"]) if row["university_id"] else None
    )


def _probe_isolation(
    store: VectorStore,
    course_id: str,
    university_id: str | None,
    material_id: str,
) -> None:
    """A question scoped to another institution must not surface our chunks.

    Only applies when the seed is institution-owned (has a university_id);
    legacy shared rows (NULL) are allowed by design.
    """
    if not university_id:
        logger.info(
            "Course is shared (no university_id); cross-institution isolation "
            "is vacuously satisfied for this seed."
        )
        return
    fake_uni = uuid.uuid4()
    results = store.query(
        PROBE_QUERY, top_k=5, course_id=course_id, university_id=str(fake_uni)
    )
    leaked = [r for r in results if r.document_id == material_id]
    if leaked:
        raise AssertionError(
            f"Institution isolation BROKEN: {len(leaked)} chunks from the "
            f"{university_id} seed matched a query scoped to {fake_uni}."
        )
    logger.info("Institution isolation OK (foreign-uni query returned 0 of our chunks)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--pdf",
        type=Path,
        default=None,
        help="Optional real handout PDF to parse with Docling instead of raw text.",
    )
    parser.add_argument(
        "--course-code", default="COLPHY", help="Course code to resolve and seed."
    )
    parser.add_argument(
        "--keep", action="store_true", help="Leave the seeded material in the DB."
    )
    args = parser.parse_args()

    if not bge_m3_available():
        logger.error(
            "FlagEmbedding/torch is not importable. Run this on the worker image "
            "(pip install -r requirements.txt), not the lean API image."
        )
        return 1

    settings = get_settings()
    if not settings.database_url:
        logger.error("DATABASE_URL is not configured.")
        return 2

    try:
        _cleanup_previous(RUNNER_MATERIAL_ID)
    except Exception as exc:
        logger.error("Cannot reach the database: %s", exc)
        return 2

    course_id, university_id = resolve_course_context(args.course_code)
    if not course_id:
        logger.error("Course %r does not exist in the target database.", args.course_code)
        return 2
    logger.info(
        "Resolved %s -> course=%s university=%s",
        args.course_code,
        course_id,
        university_id,
    )

    _seed_chain(course_id, university_id)
    store = VectorStore(persist_directory=settings.temp_dir, backend="pgvector")
    if store._pg_backend is None:  # noqa: SLF001 - intentional strictness
        logger.error(
            "pgvector backend was not selected. Is EMBEDDING_DIMENSIONS 1024 and "
            "does the embedding provider (BGE-M3) agree?"
        )
        return 3

    material_id = RUNNER_MATERIAL_ID
    try:
        _ingest(store, args.pdf, material_id)

        stored_course, stored_uni = _verify_scope_sync(material_id)
        if stored_course != course_id:
            raise AssertionError(
                f"Scope sync stamped course {stored_course}, expected {course_id}."
            )
        logger.info(
            "Scope sync OK: chunks stamped course=%s university=%s",
            stored_course,
            stored_uni,
        )

        results = store.query(
            PROBE_QUERY,
            top_k=5,
            course_id=course_id,
            university_id=stored_uni,
        )
        if not results:
            raise AssertionError("Scoped query returned no chunks.")
        best = results[0]
        if best.document_id != material_id:
            raise AssertionError(
                f"Top hit is {best.document_id!r}, expected the seeded material "
                f"{material_id!r}.\nSample results:\n"
                + "\n".join(f"  {r.score:.3f} {r.document_id} {r.text[:80]!r}" for r in results[:3])
            )
        if best.score <= 0.25:
            raise AssertionError(
                f"Top hit scored only {best.score:.3f}; hybrid ranking is not "
                "sane (expected > 0.25 for an exact-topic probe)."
            )
        logger.info(
            "Retrieval OK: top hit is the seeded material at score %.3f "
            "(%d candidates returned; %s)",
            best.score,
            len(results),
            "ColBERT rerank active" if getattr(store._pg_backend.embedding_function, "supports_colbert", False) else "hybrid dense+sparse only",
        )

        _probe_isolation(store, course_id, stored_uni, material_id)

        if args.pdf is not None:
            logger.info("Docling pipeline OK on %s", args.pdf)

        logger.info("STACK VALIDATION PASSED")
        return 0
    except AssertionError as exc:
        logger.error("STACK VALIDATION FAILED: %s", exc)
        return 3
    except Exception as exc:  # noqa: BLE001 - report and exit cleanly
        logger.exception("STACK VALIDATION FAILED: %s", exc)
        return 3
    finally:
        if not args.keep:
            try:
                _cleanup_previous(material_id)
                logger.info("Cleaned up seeded material.")
            except Exception:
                logger.exception("Cleanup failed (run again to retry).")
        else:
            logger.info("Kept seeded material %s", material_id)


if __name__ == "__main__":
    raise SystemExit(main())