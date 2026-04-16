"""Embedding generation using sentence-transformers."""

from __future__ import annotations

from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    """Lazy-load the sentence-transformer model (global singleton)."""
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def encode_text(text: str) -> list[float]:
    """Encode text into a 384-dim normalized embedding vector using all-MiniLM-L6-v2."""
    model = _get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()
