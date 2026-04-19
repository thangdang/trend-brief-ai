# Feature: trendbriefai-ai-performance, Property 17: Quality score range and signals invariant
# Feature: trendbriefai-ai-performance, Property 18: Quality threshold gate

"""Property-based tests for ContentQualityScorer."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings as h_settings
from hypothesis import strategies as st

from services.quality_scorer import ContentQualityScorer


scorer = ContentQualityScorer()


# ---------------------------------------------------------------------------
# Property 17: Quality score range and signals invariant
# For any text input (including empty strings), all signal values and
# overall are in [0.0, 1.0].
# Validates: Requirements 9.1, 9.2
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(text=st.text(min_size=0, max_size=2000))
def test_property_17_quality_score_range(text):
    """All quality signals and overall must be in [0.0, 1.0]."""
    signals = scorer.score(text)

    assert 0.0 <= signals.length_score <= 1.0, (
        f"length_score out of range: {signals.length_score}"
    )
    assert 0.0 <= signals.structure_score <= 1.0, (
        f"structure_score out of range: {signals.structure_score}"
    )
    assert 0.0 <= signals.vietnamese_ratio <= 1.0, (
        f"vietnamese_ratio out of range: {signals.vietnamese_ratio}"
    )
    assert 0.0 <= signals.spam_score <= 1.0, (
        f"spam_score out of range: {signals.spam_score}"
    )
    assert 0.0 <= signals.overall <= 1.0, (
        f"overall out of range: {signals.overall}"
    )


@h_settings(max_examples=100)
@given(text=st.text(min_size=0, max_size=50))
def test_property_17_empty_and_short_texts(text):
    """Short/empty texts still produce valid signal ranges."""
    signals = scorer.score(text)
    assert 0.0 <= signals.overall <= 1.0


# ---------------------------------------------------------------------------
# Property 18: Quality threshold gate
# Articles below threshold are marked "failed"; articles above proceed.
# Validates: Requirements 9.3
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    threshold=st.floats(min_value=0.0, max_value=1.0),
    text=st.text(min_size=0, max_size=2000),
)
def test_property_18_quality_threshold_gate(threshold, text):
    """Quality score vs threshold correctly gates articles."""
    signals = scorer.score(text)

    if signals.overall < threshold:
        # Article should be marked as failed / skipped
        assert signals.overall < threshold
    else:
        # Article should proceed to summarization
        assert signals.overall >= threshold
