# Feature: trendbriefai-ai-performance, Property 8: FAISS search equivalence to brute-force
# Feature: trendbriefai-ai-performance, Property 9: FAISS inner product equals cosine similarity on normalized vectors
# Feature: trendbriefai-ai-performance, Property 10: FAISS rebuild removes expired entries

"""Property-based tests for FAISS index."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timedelta

import numpy as np
from hypothesis import given, settings as h_settings, assume
from hypothesis import strategies as st
from hypothesis.extra.numpy import arrays

from services.dedup.faiss_index import FAISSIndex


DIM = 384


def _normalize(vec):
    """L2-normalize a vector."""
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm


# Strategy for generating L2-normalized 384-dim vectors
def normalized_vector_strategy():
    return arrays(
        dtype=np.float32,
        shape=(DIM,),
        elements=st.floats(min_value=-1.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    ).filter(lambda v: np.linalg.norm(v) > 1e-6).map(
        lambda v: (v / np.linalg.norm(v)).astype(np.float32)
    )


# ---------------------------------------------------------------------------
# Property 8: FAISS search equivalence to brute-force
# FAISS top-k results match brute-force cosine similarity.
# Validates: Requirements 5.2
# ---------------------------------------------------------------------------

@h_settings(max_examples=100, deadline=None)
@given(
    n_vectors=st.integers(min_value=2, max_value=20),
    k=st.integers(min_value=1, max_value=10),
    data=st.data(),
)
def test_property_8_faiss_search_equivalence(n_vectors, k, data):
    """FAISS top-k matches brute-force cosine similarity."""
    actual_k = min(k, n_vectors)

    # Generate random normalized vectors
    vectors = []
    for _ in range(n_vectors):
        v = data.draw(normalized_vector_strategy())
        vectors.append(v)

    query = data.draw(normalized_vector_strategy())

    # Build FAISS index
    index = FAISSIndex(dimension=DIM)
    for i, vec in enumerate(vectors):
        index.add(f"article_{i}", vec.tolist())

    # FAISS search
    faiss_results = index.search(query.tolist(), k=actual_k)
    faiss_ids = [r[0] for r in faiss_results]
    faiss_scores = [r[1] for r in faiss_results]

    # Brute-force search
    bf_scores = []
    for i, vec in enumerate(vectors):
        score = float(np.dot(query, vec))
        bf_scores.append((f"article_{i}", score))

    bf_scores.sort(key=lambda x: x[1], reverse=True)
    bf_top_k = bf_scores[:actual_k]
    bf_ids = [r[0] for r in bf_top_k]
    bf_score_vals = [r[1] for r in bf_top_k]

    # Verify scores match within tolerance
    for faiss_s, bf_s in zip(faiss_scores, bf_score_vals):
        assert abs(faiss_s - bf_s) < 1e-4, (
            f"Score mismatch: FAISS={faiss_s}, brute-force={bf_s}"
        )

    # Verify same article IDs (order may differ for tied scores)
    assert set(faiss_ids) == set(bf_ids), (
        f"ID mismatch: FAISS={faiss_ids}, brute-force={bf_ids}"
    )


# ---------------------------------------------------------------------------
# Property 9: FAISS inner product equals cosine similarity on normalized vectors
# FAISS IP score == numpy.dot(a, b) within ±1e-6.
# Validates: Requirements 5.6
# ---------------------------------------------------------------------------

@h_settings(max_examples=100, deadline=None)
@given(data=st.data())
def test_property_9_faiss_ip_equals_cosine(data):
    """FAISS inner product equals numpy dot product on normalized vectors."""
    vec_a = data.draw(normalized_vector_strategy())
    vec_b = data.draw(normalized_vector_strategy())

    # Build index with vec_a
    index = FAISSIndex(dimension=DIM)
    index.add("test_article", vec_a.tolist())

    # Search with vec_b
    results = index.search(vec_b.tolist(), k=1)
    assert len(results) == 1

    faiss_score = results[0][1]
    numpy_score = float(np.dot(vec_a, vec_b))

    assert abs(faiss_score - numpy_score) < 1e-5, (
        f"FAISS IP={faiss_score}, numpy.dot={numpy_score}, "
        f"diff={abs(faiss_score - numpy_score)}"
    )


# ---------------------------------------------------------------------------
# Property 10: FAISS rebuild removes expired entries
# After rebuild, only non-expired entries remain.
# Validates: Requirements 5.1, 5.4
# ---------------------------------------------------------------------------

@h_settings(max_examples=100, deadline=None)
@given(
    n_recent=st.integers(min_value=0, max_value=10),
    n_expired=st.integers(min_value=0, max_value=10),
    window_hours=st.integers(min_value=1, max_value=168),
    data=st.data(),
)
def test_property_10_faiss_rebuild_expiry(n_recent, n_expired, window_hours, data):
    """Rebuild removes expired entries and keeps recent ones."""
    assume(n_recent + n_expired > 0)

    index = FAISSIndex(dimension=DIM)
    now = datetime.utcnow()

    recent_ids = set()
    expired_ids = set()

    # Add recent entries (within window)
    for i in range(n_recent):
        vec = data.draw(normalized_vector_strategy())
        ts = now - timedelta(hours=window_hours // 2)  # Within window
        article_id = f"recent_{i}"
        index.add(article_id, vec.tolist(), timestamp=ts)
        recent_ids.add(article_id)

    # Add expired entries (outside window)
    for i in range(n_expired):
        vec = data.draw(normalized_vector_strategy())
        ts = now - timedelta(hours=window_hours + 24)  # Outside window
        article_id = f"expired_{i}"
        index.add(article_id, vec.tolist(), timestamp=ts)
        expired_ids.add(article_id)

    assert index.size == n_recent + n_expired

    # Rebuild
    removed = index.rebuild(window_hours=window_hours)

    # Verify correct count
    assert removed == n_expired, (
        f"Expected {n_expired} removed, got {removed}"
    )
    assert index.size == n_recent, (
        f"Expected {n_recent} remaining, got {index.size}"
    )

    # Verify remaining IDs are all recent
    remaining_ids = set(index._id_map)
    assert remaining_ids == recent_ids, (
        f"Remaining IDs mismatch: {remaining_ids} != {recent_ids}"
    )

    # Verify no expired IDs remain
    assert remaining_ids.isdisjoint(expired_ids), (
        f"Expired IDs still in index: {remaining_ids & expired_ids}"
    )
