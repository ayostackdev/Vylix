from __future__ import annotations

from typing import Any


def build_chunks(content: str, chunk_size: int = 1000, overlap: int = 150) -> list[str]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be between 0 and chunk_size - 1")

    chunks: list[str] = []
    start = 0
    while start < len(content):
        end = min(start + chunk_size, len(content))
        chunk = content[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(content):
            break
        start = end - overlap
    return chunks


def embed_chunks(chunks: list[str]) -> list[dict[str, Any]]:
    return [
        {
            "chunk_index": index,
            "text": chunk,
            "embedding": None,
        }
        for index, chunk in enumerate(chunks)
    ]
