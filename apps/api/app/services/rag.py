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


def build_hierarchical_chunks(
    content: str,
    parent_size: int = 4500,
    parent_overlap: int = 300,
    child_size: int = 900,
    child_overlap: int = 120,
) -> tuple[list[str], list[list[str]]]:
    """Split a document into parent/child windows for hierarchical retrieval.

    Parents (~4500 chars ≈ 1000 tokens) preserve broad conceptual context and
    are what gets fed to the LLM; children (~900 chars ≈ 200 tokens) are the
    small, high-density units that get embedded and matched. Returns
    ``(parents, children)`` where ``children[i]`` are the child windows of
    ``parents[i]``.
    """
    if parent_size <= 0 or child_size <= 0:
        raise ValueError("parent_size and child_size must be positive")
    if parent_overlap < 0 or parent_overlap >= parent_size:
        raise ValueError("parent_overlap must be between 0 and parent_size - 1")
    if child_overlap < 0 or child_overlap >= child_size:
        raise ValueError("child_overlap must be between 0 and child_size - 1")

    parents = build_chunks(content, chunk_size=parent_size, overlap=parent_overlap)
    children: list[list[str]] = []
    for parent in parents:
        child_blocks = build_chunks(parent, chunk_size=child_size, overlap=child_overlap)
        children.append(child_blocks)
    return parents, children


def embed_chunks(chunks: list[str]) -> list[dict[str, Any]]:
    return [
        {
            "chunk_index": index,
            "text": chunk,
            "embedding": None,
        }
        for index, chunk in enumerate(chunks)
    ]
