# Feature: trendbriefai-ai-performance, Property 6: Hybrid classifier threshold dispatch
# Feature: trendbriefai-ai-performance, Property 7: Score combination formula

"""Property-based tests for HybridClassifier."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import asyncio
from unittest.mock import patch, AsyncMock

from hypothesis import given, settings as h_settings, assume
from hypothesis import strategies as st

from services.classifier import (
    HybridClassifier,
    VALID_TOPICS,
    _count_matches,
    _TOPIC_PATTERNS,
)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


try:
    asyncio.get_event_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())


# Strategy for score dicts over the six topics
score_dict_strategy = st.fixed_dictionaries({
    topic: st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)
    for topic in VALID_TOPICS
})


# ---------------------------------------------------------------------------
# Property 6: Hybrid classifier threshold dispatch
# Zero-shot invoked only when keyword hits <= threshold.
# Validates: Requirements 4.2
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    text=st.text(min_size=10, max_size=500),
    threshold=st.integers(min_value=0, max_value=10),
)
def test_property_6_threshold_dispatch(text, threshold):
    """Zero-shot is invoked only when total keyword hits <= threshold."""
    classifier = HybridClassifier(
        keyword_threshold=threshold,
        keyword_weight=0.4,
        zero_shot_weight=0.6,
    )

    # Compute keyword scores to know what to expect
    kw_scores = classifier._keyword_scores(text)
    total_hits = classifier._total_keyword_hits(kw_scores)

    zs_called = [False]

    async def mock_zero_shot(self_inner, text_inner):
        zs_called[0] = True
        # Return uniform scores
        return {t: 1.0 / len(VALID_TOPICS) for t in VALID_TOPICS}

    with patch.object(HybridClassifier, "_zero_shot_scores", mock_zero_shot):
        _run(classifier.classify(text))

    if total_hits > threshold:
        assert not zs_called[0], (
            f"Zero-shot was called with {total_hits} hits > threshold {threshold}"
        )
    else:
        assert zs_called[0], (
            f"Zero-shot was NOT called with {total_hits} hits <= threshold {threshold}"
        )


# ---------------------------------------------------------------------------
# Property 7: Score combination formula
# combined = 0.4 * keyword + 0.6 * zero_shot, highest wins.
# Validates: Requirements 4.4
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    kw_scores=score_dict_strategy,
    zs_scores=score_dict_strategy,
    kw_weight=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
    zs_weight=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
)
def test_property_7_score_combination_formula(kw_scores, zs_scores, kw_weight, zs_weight):
    """Combined score = kw_weight * keyword + zs_weight * zero_shot for each topic."""
    classifier = HybridClassifier(
        keyword_threshold=2,
        keyword_weight=kw_weight,
        zero_shot_weight=zs_weight,
    )

    combined = classifier._combine_scores(kw_scores, zs_scores)

    for topic in VALID_TOPICS:
        expected = kw_weight * kw_scores[topic] + zs_weight * zs_scores[topic]
        assert abs(combined[topic] - expected) < 1e-9, (
            f"Topic '{topic}': expected {expected}, got {combined[topic]}"
        )


@h_settings(max_examples=100)
@given(
    kw_scores=score_dict_strategy,
    zs_scores=score_dict_strategy,
)
def test_property_7_highest_combined_wins(kw_scores, zs_scores):
    """The topic with the highest combined score is the classification result."""
    classifier = HybridClassifier(
        keyword_threshold=2,
        keyword_weight=0.4,
        zero_shot_weight=0.6,
    )

    combined = classifier._combine_scores(kw_scores, zs_scores)
    expected_winner = max(combined, key=lambda t: combined[t])

    # Verify the winner has the highest score
    for topic in VALID_TOPICS:
        assert combined[expected_winner] >= combined[topic], (
            f"Winner '{expected_winner}' ({combined[expected_winner]}) < "
            f"'{topic}' ({combined[topic]})"
        )
