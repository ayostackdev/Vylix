from __future__ import annotations

import logging

import psycopg
from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.postgres import get_connection
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)
settings = get_settings()

FLASH_MODEL = "gemini-2.5-flash"
PRO_MODEL = "gemini-2.5-pro-preview"

_client: genai.Client | None = None
_vector_store: VectorStore | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore(persist_directory=settings.temp_dir / "chromadb")
    return _vector_store


# ── Stage 1: Investigator ────────────────────────────────────────────────


def get_student_weakness_metrics(user_id: str) -> str:
    query = """
        SELECT question_id, topic, category, COUNT(*) AS fail_count
        FROM answers
        WHERE user_id = %s AND is_correct = FALSE
        GROUP BY question_id, topic, category
        ORDER BY fail_count DESC
        LIMIT 30
    """
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute(query, (user_id,))
            rows = cursor.fetchall()
    except psycopg.Error:
        logger.exception("Weakness metrics query failed for user %s", user_id)
        return ""

    if not rows:
        return "No incorrect answers recorded for this student."

    parts: list[str] = ["Student Weakness Report"]
    for row in rows:
        parts.append(
            f"- Question {row['question_id']} | Topic: {row['topic']} | "
            f"Category: {row['category']} | Failed {row['fail_count']} times"
        )
    return "\n".join(parts)


# ── Stage 2: Researcher ─────────────────────────────────────────────────


def search_course_vector_chunks(course_code: str, query: str) -> str:
    try:
        store = _get_vector_store()
        enriched = f"[{course_code}] {query}"
        results = store.query(enriched, top_k=5)
    except Exception:
        logger.exception("Vector search failed for course %s", course_code)
        return ""

    if not results:
        return "No relevant course material found."

    parts: list[str] = ["Relevant Course Material"]
    for r in results:
        parts.append(f"[{r.source_name} - chunk {r.chunk_index}] {r.text}")
    return "\n\n".join(parts)


# ── Stage 3: Executive Coach ────────────────────────────────────────────


def run_vylix_academic_agent(
    user_id: str,
    course_code: str,
    user_prompt: str,
    task_tier: str = "standard",
) -> str:
    logger.info(
        "Agent start user=%s course=%s tier=%s",
        user_id,
        course_code,
        task_tier,
    )

    weakness = get_student_weakness_metrics(user_id)
    material = search_course_vector_chunks(course_code, user_prompt)

    model_id = PRO_MODEL if task_tier == "complex" else FLASH_MODEL

    system = (
        "You are the Vylix Autonomous Academic Coach - a private tutor. "
        "You have been given the student's historical weakness data and relevant "
        "course material. Synthesize them into a hyper-personalized, actionable response."
    )

    prompt = (
        f"## Weakness Data\n{weakness}\n\n"
        f"## Course Material\n{material}\n\n"
        f"## Student Request\n{user_prompt}"
    )

    client = _get_client()

    try:
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.3,
                max_output_tokens=4096,
            ),
        )
    except Exception:
        logger.exception("Gemini call failed for user %s course %s", user_id, course_code)
        raise

    result = response.text
    logger.info("Agent complete output_length=%d", len(result))
    return result
