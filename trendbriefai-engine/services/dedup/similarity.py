"""Similarity computation utilities."""

import difflib

import numpy as np


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two normalized vectors via dot product."""
    a = np.asarray(vec_a, dtype=np.float64)
    b = np.asarray(vec_b, dtype=np.float64)
    return float(np.dot(a, b))


def title_similarity(title_a: str, title_b: str) -> float:
    """Compute title similarity using SequenceMatcher."""
    return difflib.SequenceMatcher(None, title_a, title_b).ratio()
