# Feature: trendbriefai-ai-performance, Property 11: Batch embedding equivalence

"""Property-based tests for batch embedding."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
from unittest.mock import patch, MagicMock
from hypothesis import given, settings as h_settings, assume
from hypothesis import strategies as st

from services.dedup.embedding import encode_text, encode_texts_batch


# We mock the sentence-transformer model to avoid loading the real model
# in tests. The mock returns deterministic 384-dim vectors based on text hash.

DIM = 384


def _mock_encode(texts_or_text, normalize_embeddings=True):
    """Deterministic mock encoder: SHA-256 hash -> 384-dim vector."""
    import hashlib

    if isinstance(texts_or_text, str):
        texts = [texts_or_text]
    else:
        texts = list(texts_or_text)

    results = []
    for text in texts:
        h = hashlib.sha256(text.encode("utf-8")).digest()
        # Use hash bytes to seed a deterministic vector
        rng = np.random.RandomState(int.from_bytes(h[:4], "big"))
        vec = rng.randn(DIM).astype(np.float32)
        if normalize_embeddings:
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
        results.append(vec)

    if isinstance(texts_or_text, str):
        return results[0]
    return np.array(results)


def _create_mock_model():
    mock_model = MagicMock()
    mock_model.encode = _mock_encode
    return mock_model


# ---------------------------------------------------------------------------
# Property 11: Batch embedding equivalence
# encode_texts_batch(texts) returns same-length list of 384-dim,
# L2-normalized vectors identical to individual encode_text() calls.
# Validates: Requirements 6.1, 6.3
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    texts=st.lists(
        st.text(min_size=1, max_size=200),
        min_size=1,
        max_size=10,
    ),
)
def test_property_11_batch_embedding_equivalence(texts):
    """Batch encoding produces same results as individual encoding."""
    mock_model = _create_mock_model()

    with patch("services.dedup.embedding._get_model", return_value=mock_model):
        # Individual encoding
        individual_results = [encode_text(t) for t in texts]

        # Batch encoding
        batch_results = encode_texts_batch(texts)

    # Same length
    assert len(batch_results) == len(texts), (
        f"Batch returned {len(batch_results)} results for {len(texts)} texts"
    )

    for i, (individual, batch) in enumerate(zip(individual_results, batch_results)):
        ind_arr = np.array(individual, dtype=np.float32)
        bat_arr = np.array(batch, dtype=np.float32)

        # Same dimension
        assert ind_arr.shape == (DIM,), (
            f"Individual embedding {i} has shape {ind_arr.shape}"
        )
        assert bat_arr.shape == (DIM,), (
            f"Batch embedding {i} has shape {bat_arr.shape}"
        )

        # L2-normalized (norm ~= 1.0)
        ind_norm = np.linalg.norm(ind_arr)
        bat_norm = np.linalg.norm(bat_arr)
        assert abs(ind_norm - 1.0) < 1e-4, (
            f"Individual embedding {i} norm={ind_norm}"
        )
        assert abs(bat_norm - 1.0) < 1e-4, (
            f"Batch embedding {i} norm={bat_norm}"
        )

        # Identical values
        assert np.allclose(ind_arr, bat_arr, atol=1e-5), (
            f"Embedding {i} mismatch: max diff={np.max(np.abs(ind_arr - bat_arr))}"
        )


@h_settings(max_examples=100)
@given(
    texts=st.lists(
        st.text(min_size=1, max_size=200),
        min_size=1,
        max_size=10,
    ),
)
def test_property_11_batch_dimension_384(texts):
    """All batch embeddings are 384-dimensional."""
    mock_model = _create_mock_model()

    with patch("services.dedup.embedding._get_model", return_value=mock_model):
        batch_results = encode_texts_batch(texts)

    for i, vec in enumerate(batch_results):
        assert len(vec) == DIM, (
            f"Embedding {i} has dimension {len(vec)}, expected {DIM}"
        )
