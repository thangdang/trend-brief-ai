# Feature: trendbriefai-ai-performance, Property 5: LRU cache eviction invariant
# Feature: trendbriefai-ai-performance, Property 4: Two-level cache round-trip

"""Property-based tests for SummarizerCache."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import asyncio

from hypothesis import given, settings as h_settings, assume
from hypothesis import strategies as st

from services.cache.summarizer_cache import SummarizerCache


def _run(coro):
    """Helper to run async code in tests."""
    return asyncio.get_event_loop().run_until_complete(coro)


# Ensure we have an event loop
try:
    asyncio.get_event_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())


# Strategy for generating summary dicts
summary_strategy = st.fixed_dictionaries({
    "title_ai": st.text(min_size=1, max_size=50),
    "summary_bullets": st.lists(st.text(min_size=1, max_size=100), min_size=3, max_size=3),
    "reason": st.text(min_size=1, max_size=100),
})

# Strategy for content text
content_strategy = st.text(min_size=10, max_size=500)


# ---------------------------------------------------------------------------
# Property 5: LRU cache eviction invariant
# Cache size never exceeds max_lru_size, and LRU entry is evicted.
# Validates: Requirements 2.3
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    max_size=st.integers(min_value=1, max_value=10),
    items=st.lists(
        st.tuples(content_strategy, summary_strategy),
        min_size=1,
        max_size=30,
    ),
)
def test_property_5_lru_eviction_invariant(max_size, items):
    """LRU cache size never exceeds max_lru_size."""
    cache = SummarizerCache(max_lru_size=max_size, redis_cache=None)

    async def run():
        for content, summary in items:
            await cache.put(content, summary)
            # Invariant: cache size never exceeds max_size
            assert len(cache._lru) <= max_size, (
                f"LRU size {len(cache._lru)} exceeds max {max_size}"
            )

    _run(run())


@h_settings(max_examples=100)
@given(
    contents=st.lists(
        st.text(min_size=10, max_size=200),
        min_size=4,
        max_size=10,
        unique=True,
    ),
)
def test_property_5_lru_evicts_oldest(contents):
    """When cache is full, the least recently used entry is evicted."""
    max_size = 3
    cache = SummarizerCache(max_lru_size=max_size, redis_cache=None)
    dummy_summary = {"title_ai": "t", "summary_bullets": ["a", "b", "c"], "reason": "r"}

    async def run():
        # Fill cache to capacity
        for content in contents[:max_size]:
            await cache.put(content, dummy_summary)

        # The first item should be in cache
        first_key = cache._content_hash(contents[0])
        assert first_key in cache._lru

        # Add one more item to trigger eviction
        await cache.put(contents[max_size], dummy_summary)

        # Cache should still be at max_size
        assert len(cache._lru) <= max_size

        # The first item (LRU) should have been evicted
        assert first_key not in cache._lru, (
            "LRU entry was not evicted"
        )

    _run(run())


# ---------------------------------------------------------------------------
# Property 4: Two-level cache round-trip
# Store summary, retrieve again, verify identical with from_cache=True.
# Validates: Requirements 2.2, 2.5, 10.3
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    content=content_strategy,
    summary=summary_strategy,
)
def test_property_4_cache_round_trip(content, summary):
    """Cached summary round-trips with from_cache=True flag."""
    cache = SummarizerCache(max_lru_size=100, redis_cache=None)

    async def run():
        # Initially, cache miss
        result = await cache.get(content)
        assert result is None, "Expected cache miss on empty cache"

        # Store
        await cache.put(content, summary)

        # Retrieve — should be a hit
        result = await cache.get(content)
        assert result is not None, "Expected cache hit after put"
        assert result.get("from_cache") is True, (
            "Cache hit should have from_cache=True"
        )

        # Verify content matches (excluding from_cache metadata)
        for key in ("title_ai", "summary_bullets", "reason"):
            assert result[key] == summary[key], (
                f"Mismatch on '{key}': {result[key]} != {summary[key]}"
            )

    _run(run())


@h_settings(max_examples=100)
@given(
    content=content_strategy,
    summary=summary_strategy,
)
def test_property_4_no_ollama_on_cache_hit(content, summary):
    """Cache hit returns result without needing Ollama invocation."""
    cache = SummarizerCache(max_lru_size=100, redis_cache=None)

    async def run():
        await cache.put(content, summary)

        # Multiple gets should all return from cache
        for _ in range(3):
            result = await cache.get(content)
            assert result is not None
            assert result["from_cache"] is True

    _run(run())
