from __future__ import annotations

import numpy as np

from app.services.vector_store import PgVectorBackend


class _FakeColbertEmbedder:
    """Minimal stand-in for BGEM3EmbeddingFunction with only colbert support."""

    supports_sparse = True
    supports_colbert = True
    dimensions = 128

    def embed_colbert(self, texts: list[str]) -> list[np.ndarray]:
        return [_as_tokens(t) for t in texts]


def _as_tokens(text: str) -> np.ndarray:
    """Deterministic per-char one-hot matrix; identical text => identical vectors."""
    rows = np.eye(128, dtype=np.float32)[np.asarray([ord(c) % 128 for c in text])]
    return rows if rows.size else np.zeros((1, 128), dtype=np.float32)


def _row(content: str) -> dict[str, object]:
    return {
        "id": 1,
        "document_id": "doc-1",
        "source_name": "handout.pdf",
        "chunk_index": 0,
        "content": content,
        "sparse_weights": {},
        "parent_content": f"parent... {content}",
    }


def _scores(items: list[tuple[float, dict]]) -> list[float]:
    return [round(score, 6) for score, _ in items]


def test_rerank_promotes_exact_token_match_over_hybrid_leader() -> None:
    backend = PgVectorBackend(embedding_function=_FakeColbertEmbedder())

    exact = "STA401 regression notes"
    unrelated = "bayes theorem chapter"

    # Hybrid scoring (dense-only since sparse_weights empty) ranks `unrelated`
    # first on distance; the colbert pass must flip it.
    hybrid = [
        (0.81, _row(unrelated)),
        (0.62, _row(exact)),
    ]
    reranked = backend._colbert_rerank("STA401 regression", hybrid, top_k=1)

    assert reranked[0][1]["content"] == exact
    assert _scores(reranked)[0] > _scores(hybrid)[0]


def test_rerank_is_stable_when_no_candidates() -> None:
    backend = PgVectorBackend(embedding_function=_FakeColbertEmbedder())
    assert backend._colbert_rerank("anything", [], top_k=5) == []


def test_rerank_preserves_hybrid_order_when_colbert_weight_zero() -> None:
    backend = PgVectorBackend(embedding_function=_FakeColbertEmbedder())
    from app.core.config import get_settings

    scored = [
        (0.9, _row("alpha beta")),
        (0.8, _row("gamma delta")),
    ]
    previous = get_settings().embedding_colbert_weight
    try:
        get_settings().embedding_colbert_weight = 0.0
        reranked = backend._colbert_rerank("alpha", scored, top_k=2)
        assert [float(score) for score, _ in reranked] == [0.9, 0.8]
        assert [row["content"] for _, row in reranked] == ["alpha beta", "gamma delta"]
    finally:
        get_settings().embedding_colbert_weight = previous