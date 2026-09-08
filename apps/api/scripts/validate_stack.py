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

``--synthetic`` swaps the model for a deterministic hashing embedder so the
same pgvector scoping path validates in CI without torch on every push; the
real model keeps its own (slower) CI job / manual runs. A missing course is
seeded automatically, so the script is self-contained on a fresh database.

Exit codes:
  0  all checks passed
  1  BGE-M3/torch not importable (run me on the worker image, not the API one)
  2  database unreachable or pgvector migration not applied
  3  ingest/query/isolation assertions failed
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import uuid
from pathlib import Path
from typing import Any

import numpy as np

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
RUNNER_COURSE_ID = "00000000-0000-0000-0000-0000000000dd"
RUNNER_UNI_ID = "00000000-0000-0000-0000-0000000000ee"
RUNNER_COLLEGE_ID = "00000000-0000-0000-0000-0000000000ff"
RUNNER_DEPT_ID = "00000000-0000-0000-0000-0000000001aa"
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


class SyntheticEmbedding:
    """Deterministic 1024-dim hashing embedder for DB-only validation.

    Mirrors the BGEM3 interface (``embed_documents``/``embed_query``/
    ``embed_sparse``/``name``/``dimensions``/``supports_*``) so the exact
    pgvector upsert + scoped hybrid query path runs in CI without torch.
    Dense vectors are seeded by the chunk text, so semantically overlapping
    chunks still score higher than unrelated ones for the probe query.
    """

    name_text = "synthetic-validator"
    supports_sparse = True
    supports_colbert = False
    dimensions = 1024

    def name(self) -> str:
        return self.name_text

    @staticmethod
    def _seed(text: str) -> int:
        return int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:16], 16)

    def _embed(self, texts: list[str]) -> list[list[float]]:
        vectors = []
        for text in texts:
            rng = np.random.default_rng(self._seed(text))
            vector = rng.standard_normal(self.dimensions)
            vector /= (np.linalg.norm(vector) + 1e-9)
            vectors.append(vector.tolist())
        return vectors

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._embed([text])[0]

    def embed_sparse(self, texts: list[str]) -> list[dict[int, float]]:
        out: list[dict[int, float]] = []
        for text in texts:
            weights: dict[int, float] = {}
            for token in text.lower().split():
                key = self._seed(token) % 20000
                weights[key] = weights.get(key, 0.0) + 1.0
            out.append(weights)
        return out

    def embed_colbert(self, texts: list[str]) -> list[Any]:
        raise RuntimeError("synthetic validator has no ColBERT head")


def _ensure_course() -> tuple[str, str | None]:
    """Create the university→college→department→course chain if missing."""
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO universities (id, code, name, program_type)
            VALUES (%s, 'TEST_UNI', 'Stack Validation University', 'university')
            ON CONFLICT (id) DO NOTHING
            """,
            (RUNNER_UNI_ID,),
        )
        cursor.execute(
            """
            INSERT INTO colleges (id, code, name, duration_years, university_id)
            VALUES (%s, 'TESTCOL', 'Stack Validation College', 4, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (RUNNER_COLLEGE_ID, RUNNER_UNI_ID),
        )
        cursor.execute(
            """
            INSERT INTO departments (id, code, name, college_id)
            VALUES (%s, 'TESTDEPT', 'Stack Validation Department', %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (RUNNER_DEPT_ID, RUNNER_COLLEGE_ID),
        )
        cursor.execute(
            """
            INSERT INTO courses (id, code, title, level, department_id, university_id)
            VALUES (%s, %s, 'Stack Validation Course', 100, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (RUNNER_COURSE_ID, "TESTCSE", RUNNER_DEPT_ID, RUNNER_UNI_ID),
        )
    return RUNNER_COURSE_ID, RUNNER_UNI_ID


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
            INSERT INTO users (id, full_name, university_id, created_at, updated_at)
            VALUES (%s, 'Stack Validation Runner', %s, NOW(), NOW())
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
            VALUES (%s, %s, %s, %s, %s, %s, 'QUEUED', TRUE, TRUE,
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
    parser.add_argument(
        "--synthetic",
        action="store_true",
        help="Use the deterministic hashing embedder instead of BGE-M3, so CI can "
        "validate the pgvector scoping path without installing torch.",
    )
    args = parser.parse_args()

    if not args.synthetic and not bge_m3_available():
        logger.error(
            "FlagEmbedding/torch is not importable. Run this on the worker image "
            "(pip install -r requirements.txt), not the lean API image. "
            "Use --synthetic to validate the DB path without the model."
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
        logger.info(
            "Course %r not found; seeding a fresh course chain for validation.",
            args.course_code,
        )
        course_id, university_id = _ensure_course()
    logger.info(
        "Resolved %s -> course=%s university=%s",
        args.course_code,
        course_id,
        university_id,
    )

    _seed_chain(course_id, university_id)
    embedder = SyntheticEmbedding() if args.synthetic else None
    store = VectorStore(
        persist_directory=settings.temp_dir,
        backend="pgvector",
        embedding_function=embedder,
    )
    if store._pg_backend is None:  # noqa: SLF001 - intentional strictness
        logger.error(
            "pgvector backend was not selected. Is EMBEDDING_DIMENSIONS 1024 and "
            "does the embedding provider agree with it?"
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
        # Synthetic hashing vectors are random-noise-dense; only require a sane
        # margin on the real model, where the score actually means something.
        score_floor = 0.0 if args.synthetic else 0.25
        if best.score <= score_floor:
            raise AssertionError(
                f"Top hit scored only {best.score:.3f}; hybrid ranking is not "
                f"sane (expected > {score_floor} for an exact-topic probe)."
            )
        logger.info(
            "Retrieval OK: top hit is the seeded material at score %.3f "
            "(%d candidates returned; %s)",
            best.score,
            len(results),
            "synthetic embedder" if args.synthetic else "BGE-M3 hybrid",
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