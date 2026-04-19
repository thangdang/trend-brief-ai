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


def encode_texts_batch(texts: list[str], max_chars: int = 4000) -> list[list[float]]:
    """Batch encode multiple texts into 384-dim normalized vectors.

    Single model.encode() call for the entire batch.
    Each text truncated to max_chars before encoding.
    """
    if not texts:
        return []

    model = _get_model()
    truncated = [t[:max_chars] for t in texts]
    embeddings = model.encode(truncated, normalize_embeddings=True)
    return [e.tolist() for e in embeddings]
