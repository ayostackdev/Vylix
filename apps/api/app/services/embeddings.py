from __future__ import annotations

import hashlib
import json
import logging
import random
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.preprocessing import normalize

from app.core.config import get_settings

logger = logging.getLogger(__name__)

EMBED_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

MAX_ATTEMPTS = 3
BASE_RETRY_DELAY = 1.0
MAX_RETRY_DELAY = 8.0

RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}

settings = get_settings()

_redis_client: Any | None = None


def _get_redis() -> Any:
    """Lazily connect to Redis for the query-embedding cache; ``None`` when unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis

        client = redis.from_url(
            settings.redis_url,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        client.ping()
        _redis_client = client
    except Exception:
        logger.warning("Redis unavailable; embedding cache disabled.")
        _redis_client = None
    return _redis_client


def _cache_key(text: str) -> str:
    return f"vylix:emb:{hashlib.sha256(text.encode()).hexdigest()}"


def _cache_get(text: str) -> list[float] | None:
    client = _get_redis()
    if not client:
        return None
    try:
        raw = client.get(_cache_key(text))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


def _cache_set(text: str, values: list[float]) -> None:
    client = _get_redis()
    if not client:
        return
    try:
        client.set(
            _cache_key(text),
            json.dumps(values),
            ex=settings.embedding_cache_ttl_seconds,
        )
    except Exception:
        pass


class HashingEmbeddingFunction:
    """Deterministic local embedding used when no Gemini API key is available.

    Exists as a ``name()``/``__call__`` interface so the ChromaDB fallback store keeps
    working without any network dependency.
    """

    def __init__(self, n_features: int = 256) -> None:
        self.vectorizer = HashingVectorizer(
            n_features=n_features,
            alternate_sign=False,
            norm=None,
            stop_words="english",
        )

    def name(self) -> str:
        return "hashing"

    def __call__(self, input: list[str]) -> list[list[float]]:
        matrix = self.vectorizer.transform(input)
        normalized = normalize(matrix, norm="l2")
        return normalized.toarray().tolist()


class GeminiEmbeddingFunction:
    """Real semantic embeddings via a Gemini embedding model.

    Batches documents for ingestion and caches single-query embeddings in Redis so
    repeated/similar questions don't hit the paid API. Uses ``RETRIEVAL_DOCUMENT``
    task type for stored chunks and ``RETRIEVAL_QUERY`` for search, and pins
    ``outputDimensionality`` to the configured value so vectors always match the
    ``material_chunks.embedding`` column dimensions.
    """

    DOCUMENT_TASK = "RETRIEVAL_DOCUMENT"
    QUERY_TASK = "RETRIEVAL_QUERY"

    def __init__(
        self,
        model: str | None = None,
        batch_size: int | None = None,
        api_key: str | None = None,
    ) -> None:
        self.model = model or settings.embedding_model
        self.batch_size = batch_size or settings.embedding_batch_size
        self.dimensions = settings.embedding_dimensions
        self.api_key = api_key or settings.gemini_api_key
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

    def name(self) -> str:
        return self.model

    def __call__(self, input: list[str]) -> list[list[float]]:
        return self.embed_documents(input)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), self.batch_size):
            vectors.extend(
                self._call_batch(texts[start : start + self.batch_size], self.DOCUMENT_TASK)
            )
        return vectors

    def embed_query(self, text: str) -> list[float]:
        cached = _cache_get(text)
        if cached is not None:
            return cached
        vectors = self.embed_documents([text])
        if not vectors:
            raise RuntimeError("Embedding API returned no vectors")
        vector = vectors[0]
        _cache_set(text, vector)
        return vector

    def _call_batch(self, texts: list[str], task_type: str) -> list[list[float]]:
        url = f"{EMBED_BASE}/{self.model}:batchEmbedContents?key={self.api_key}"
        body = {
            "requests": [
                {
                    "model": f"models/{self.model}",
                    "content": {"parts": [{"text": text}]},
                    "taskType": task_type,
                    "outputDimensionality": self.dimensions,
                }
                for text in texts
            ]
        }
        data = json.dumps(body).encode()
        req = Request(url, data=data, headers={"Content-Type": "application/json"})

        for attempt in range(MAX_ATTEMPTS):
            try:
                with urlopen(req, timeout=60) as resp:
                    result = json.loads(resp.read())
                break
            except HTTPError as e:
                error_body = e.read().decode(errors="replace")[:500]
                logger.error(
                    "Gemini embedding API returned HTTP %s (%s): %s",
                    e.code,
                    e.reason,
                    error_body,
                )
                if e.code in (400, 401, 403):
                    raise RuntimeError(
                        "Embedding API rejected the request. Check that the API key is valid "
                        f"and has access to the {self.model} model.",
                    ) from e
                if e.code not in RETRYABLE_STATUS:
                    raise RuntimeError(
                        f"Embedding API returned HTTP {e.code} ({e.reason})",
                    ) from e
                if attempt < MAX_ATTEMPTS - 1:
                    time.sleep(_retry_delay(attempt, e.headers))
                else:
                    raise RuntimeError("Embedding API is busy right now.") from e
            except (URLError, TimeoutError) as e:
                logger.error("Gemini embedding API call failed: %s", e)
                if attempt < MAX_ATTEMPTS - 1:
                    time.sleep(_retry_delay(attempt, {}))
                else:
                    raise RuntimeError("Embedding API is busy right now.") from e
            except json.JSONDecodeError as e:
                logger.error("Gemini embedding API returned invalid JSON: %s", e)
                raise RuntimeError("Embedding API returned an invalid response") from e

        try:
            return [entry["values"] for entry in result["embeddings"]]
        except (KeyError, IndexError, TypeError):
            logger.warning(
                "Gemini embedding response contained no vectors: %s",
                json.dumps(result)[:500],
            )
            raise RuntimeError("Embedding API returned an empty response")


def _retry_delay(attempt: int, headers: Any) -> float:
    if attempt == 0:
        return 0.0
    base = min(BASE_RETRY_DELAY * (2 ** (attempt - 1)), MAX_RETRY_DELAY)
    jittered = base * random.uniform(0.5, 1.5)
    try:
        value = headers.get("Retry-After") or headers.get("retry-after")
        parsed = max(0.0, float(value)) if value else jittered
    except (TypeError, ValueError):
        parsed = jittered
    return min(parsed, MAX_RETRY_DELAY)


def embed_query(text: str) -> list[float]:
    """Top-level helper: returns a real embedding or falls back to hashing."""
    if not settings.gemini_api_key:
        return HashingEmbeddingFunction()([text])[0]
    return GeminiEmbeddingFunction().embed_query(text)


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Top-level helper: returns real embeddings or falls back to hashing."""
    if not settings.gemini_api_key:
        return HashingEmbeddingFunction()(texts)
    return GeminiEmbeddingFunction().embed_documents(texts)


def is_gemini_available() -> bool:
    return bool(settings.gemini_api_key)
