# Feature: trendbriefai-ai-performance, Property 19: Redis key namespace invariant

"""Property-based tests for RedisAICache key namespacing."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings as h_settings
from hypothesis import strategies as st

from services.cache.redis_cache import RedisAICache


# ---------------------------------------------------------------------------
# Property 19: Redis key namespace invariant
# Summary keys start with "ai:summary:" and classification keys start
# with "ai:classify:", followed by the content hash.
# Validates: Requirements 10.5
# ---------------------------------------------------------------------------

# Create an instance (no actual Redis connection needed for key generation)
_cache = RedisAICache(redis_url="redis://localhost:6379")


@h_settings(max_examples=100)
@given(content_hash=st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")),
    min_size=1,
    max_size=128,
))
def test_property_19_summary_key_namespace(content_hash):
    """Summary cache keys always start with 'ai:summary:' prefix."""
    key = _cache._summary_key(content_hash)
    assert key.startswith("ai:summary:"), (
        f"Summary key does not start with 'ai:summary:': {key}"
    )
    assert key == f"ai:summary:{content_hash}", (
        f"Summary key format incorrect: {key}"
    )


@h_settings(max_examples=100)
@given(content_hash=st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")),
    min_size=1,
    max_size=128,
))
def test_property_19_classify_key_namespace(content_hash):
    """Classification cache keys always start with 'ai:classify:' prefix."""
    key = _cache._classify_key(content_hash)
    assert key.startswith("ai:classify:"), (
        f"Classify key does not start with 'ai:classify:': {key}"
    )
    assert key == f"ai:classify:{content_hash}", (
        f"Classify key format incorrect: {key}"
    )


@h_settings(max_examples=100)
@given(content_hash=st.text(
    alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")),
    min_size=1,
    max_size=128,
))
def test_property_19_namespaces_are_disjoint(content_hash):
    """Summary and classification keys never collide for the same hash."""
    summary_key = _cache._summary_key(content_hash)
    classify_key = _cache._classify_key(content_hash)
    assert summary_key != classify_key, (
        f"Summary and classify keys collide: {summary_key}"
    )
