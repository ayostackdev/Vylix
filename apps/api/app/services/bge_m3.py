"""Self-hosted BGE-M3 embeddings (dense + sparse) with no paid API.

BGE-M3 produces three signal types from one model:

* Dense vectors (1024-dim, L2-normalized) for conceptual semantic search.
* Learned sparse lexical weights (``token_id -> weight``) for exact keyword
  matches such as ``MTH101`` / ``STA401``, fused with the dense score at
  retrieval time for a hybrid result.
* Multi-vector (ColBERT-style) late-interaction embeddings, reserved for a
  future re-ranking pass.

The actual model is imported lazily so this module loads cleanly on machines
without ``torch`` / ``FlagEmbedding`` (dev boxes, lean containers) and the
whole class degrades to a clear ``RuntimeError`` only when explicitly used.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_available: bool | None = None
_availability_lock = threading.Lock()

DENSE_DIMENSIONS = 1024


def bge_m3_available() -> bool:
    """Return ``True`` once if ``FlagEmbedding`` is importable (cached)."""
    global _available
    if _available is not None:
        return _available
    with _availability_lock:
        if _available is not None:
            return _available
        try:  # noqa: SIM105
            import FlagEmbedding  # noqa: F401
        except Exception:
            logger.warning(
                "FlagEmbedding is not installed; BGE-M3 embeddings are unavailable. "
                "Install it (and torch) on the worker to use the self-hosted provider."
            )
            _available = False
        else:
            _available = True
    return _available


class BGEM3EmbeddingFunction:
    """Lazy, thread-safe wrapper around ``BGEM3FlagModel`` with dense+sparse output.

    Exposes the same ``name()`` / ``embed_documents()`` / ``embed_query()``
    interface as the Gemini provider so the vector store is agnostic, and adds
    ``embed_sparse()`` for the hybrid signal when the provider supports it.
    """

    dimensions = DENSE_DIMENSIONS
    supports_sparse = True
    supports_colbert = True

    def __init__(self) -> None:
        self.model_name = settings.bge_m3_model
        self.device = settings.bge_m3_device
        self.batch_size = settings.embedding_batch_size
        self._model: Any | None = None
        self._lock = threading.Lock()
        self._name = f"bge-m3:{Path(self.model_name).name}"

    def _load(self) -> Any:
        if self._model is not None:
            return self._model
        if not bge_m3_available():
            raise RuntimeError(
                "BGE-M3 provider is selected but FlagEmbedding is not installed."
            )
        with self._lock:
            if self._model is not None:
                return self._model
            from FlagEmbedding import BGEM3FlagModel

            logger.info(
                "Loading BGE-M3 model %r on %s (batch_size=%s)",
                self.model_name,
                self.device,
                self.batch_size,
            )
            self._model = BGEM3FlagModel(
                self.model_name,
                use_fp16=False,
                device=self.device,
            )
            logger.info("BGE-M3 model %r loaded.", self.model_name)
        return self._model

    def name(self) -> str:
        return self._name

    def __call__(self, texts: list[str]) -> list[list[float]]:
        return self.embed_documents(texts)

    def encode(
        self,
        texts: list[str],
        with_colbert: bool = False,
    ) -> dict[str, Any]:
        """Return normalized dense vectors and lexical weights for ``texts``.

        ``with_colbert`` additionally returns the multi-vector token/char-level
        embeddings used for late-interaction (MaxSim) reranking. ColBERT output
        is only materialized on demand: ingestion calls go through
        ``embed_documents``/``embed_sparse`` (colbert off), while the query-time
        rerank in ``embed_colbert`` pays the extra compute on a handful of
        candidates instead of storing per-token vectors in the database.
        """
        model = self._load()
        with self._lock:
            output = model.encode(
                texts,
                batch_size=self.batch_size,
                max_length=8192,
                return_dense=True,
                return_sparse=True,
                return_colbert_vectors=with_colbert,
            )
        dense = _normalize(np.asarray(output["dense_vecs"], dtype=np.float32))
        lexical = output["lexical_weights"]
        result: dict[str, Any] = {
            "dense_vecs": dense,
            "lexical_weights": [dict(w) for w in lexical],
        }
        if with_colbert:
            # BGEM3FlagModel returns the multi-vectors shape (T, 1024) per text
            # (or (1, T, 1024) for a lone text); normalize each token vector.
            result["colbert_vecs"] = [
                _normalize(_as_token_matrix(vec, DENSE_DIMENSIONS))
                for vec in output["colbert_vecs"]
            ]
        return result

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self.encode(texts)["dense_vecs"].tolist()

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]

    def embed_sparse(self, texts: list[str]) -> list[dict[int, float]]:
        """Return lexical weights keyed by token id for hybrid retrieval."""
        return self.encode(texts)["lexical_weights"]

    def embed_colbert(self, texts: list[str]) -> list[np.ndarray]:
        """Return per-token L2-normalized multi-vectors for late-interaction scoring."""
        return self.encode(texts, with_colbert=True)["colbert_vecs"]


def _as_token_matrix(vec, columns: int) -> np.ndarray:
    """Coerce a text's colbert vector to a (num_tokens, columns) matrix.

    Handles flat token vectors as well as batched shapes like ``(1, T, D)``.
    """
    return np.asarray(vec, dtype=np.float32).reshape(-1, columns)


def _normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


def sparse_cosine(query: dict[int, float], document: dict[int, float]) -> float:
    """Cosine similarity between two sparse token-weight dictionaries."""
    if not query or not document:
        return 0.0
    smaller, larger = (query, document) if len(query) <= len(document) else (document, query)
    dot = sum(weight * larger.get(token, 0.0) for token, weight in smaller.items())
    q_norm = float(np.sqrt(sum(w * w for w in query.values())))
    d_norm = float(np.sqrt(sum(w * w for w in document.values())))
    if q_norm == 0 or d_norm == 0:
        return 0.0
    return float(dot / (q_norm * d_norm))


def colbert_maxsim(query: np.ndarray, document: np.ndarray) -> float:
    """Late-interaction MaxSim score between two (T, D) token matrices.

    For every query token, take its maximum similarity over all document
    tokens, then average across query tokens (ColBERT's scoring rule). Inputs
    must be row-L2-normalized (``embed_colbert`` already is). Returns ``0.0``
    when either side has no tokens.
    """
    if query.shape[0] == 0 or document.shape[0] == 0:
        return 0.0
    similarities = query @ document.T
    return float(similarities.max(axis=1).mean())