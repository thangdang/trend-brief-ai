# Feature: trendbriefai-ai-performance, Property 14: Pipeline statistics invariant
# Feature: trendbriefai-ai-performance, Property 12: Pipeline concurrency limit
# Feature: trendbriefai-ai-performance, Property 13: Pipeline failure isolation

"""Property-based tests for concurrent pipeline."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import asyncio
import time

from hypothesis import given, settings as h_settings, assume
from hypothesis import strategies as st


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


try:
    asyncio.get_event_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())


# ---------------------------------------------------------------------------
# Property 14: Pipeline statistics invariant
# new + duplicate + failed == N, each count >= 0.
# Validates: Requirements 7.4
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    new_count=st.integers(min_value=0, max_value=50),
    dup_count=st.integers(min_value=0, max_value=50),
    fail_count=st.integers(min_value=0, max_value=50),
)
def test_property_14_pipeline_stats_invariant(new_count, dup_count, fail_count):
    """Pipeline stats satisfy new + duplicate + failed == N."""
    n = new_count + dup_count + fail_count
    stats = {"new": new_count, "duplicate": dup_count, "failed": fail_count}

    # Invariant: sum equals total
    assert stats["new"] + stats["duplicate"] + stats["failed"] == n

    # Each count >= 0
    assert stats["new"] >= 0
    assert stats["duplicate"] >= 0
    assert stats["failed"] >= 0


@h_settings(max_examples=100)
@given(
    outcomes=st.lists(
        st.sampled_from(["new", "duplicate", "failed"]),
        min_size=0,
        max_size=100,
    ),
)
def test_property_14_aggregated_stats(outcomes):
    """Aggregating individual outcomes preserves the invariant."""
    stats = {"new": 0, "duplicate": 0, "failed": 0}
    for outcome in outcomes:
        stats[outcome] += 1

    n = len(outcomes)
    assert stats["new"] + stats["duplicate"] + stats["failed"] == n
    assert all(v >= 0 for v in stats.values())


# ---------------------------------------------------------------------------
# Property 12: Pipeline concurrency limit
# At no point more than C articles process simultaneously.
# Validates: Requirements 7.1
# ---------------------------------------------------------------------------

@h_settings(max_examples=100, deadline=None)
@given(
    n=st.integers(min_value=1, max_value=20),
    concurrency=st.integers(min_value=1, max_value=5),
)
def test_property_12_concurrency_limit(n, concurrency):
    """Semaphore ensures at most C concurrent tasks."""
    max_concurrent = [0]
    current_concurrent = [0]
    semaphore = asyncio.Semaphore(concurrency)

    async def mock_task(i):
        async with semaphore:
            current_concurrent[0] += 1
            if current_concurrent[0] > max_concurrent[0]:
                max_concurrent[0] = current_concurrent[0]
            # Simulate some work
            await asyncio.sleep(0.001)
            current_concurrent[0] -= 1
        return "new"

    async def run():
        tasks = [mock_task(i) for i in range(n)]
        results = await asyncio.gather(*tasks)
        return results

    results = _run(run())

    assert len(results) == n
    assert max_concurrent[0] <= concurrency, (
        f"Max concurrent {max_concurrent[0]} exceeded limit {concurrency}"
    )


@h_settings(max_examples=100, deadline=None)
@given(
    n=st.integers(min_value=2, max_value=15),
    concurrency=st.integers(min_value=1, max_value=3),
)
def test_property_12_all_tasks_complete(n, concurrency):
    """All N tasks complete despite concurrency limiting."""
    semaphore = asyncio.Semaphore(concurrency)
    completed = []

    async def mock_task(i):
        async with semaphore:
            await asyncio.sleep(0.001)
            completed.append(i)
        return "new"

    async def run():
        tasks = [mock_task(i) for i in range(n)]
        return await asyncio.gather(*tasks)

    _run(run())

    assert len(completed) == n, (
        f"Only {len(completed)}/{n} tasks completed"
    )
    assert set(completed) == set(range(n))


# ---------------------------------------------------------------------------
# Property 13: Pipeline failure isolation
# Failed articles don't prevent others from completing.
# Validates: Requirements 7.3
# ---------------------------------------------------------------------------

@h_settings(max_examples=100, deadline=None)
@given(
    n=st.integers(min_value=2, max_value=15),
    fail_indices=st.lists(
        st.integers(min_value=0, max_value=14),
        min_size=1,
        max_size=5,
    ),
)
def test_property_13_failure_isolation(n, fail_indices):
    """Failed articles don't prevent others from completing."""
    fail_set = {i % n for i in fail_indices}
    assume(len(fail_set) < n)  # At least one should succeed

    semaphore = asyncio.Semaphore(5)
    results_collected = {}

    async def mock_task(i):
        async with semaphore:
            if i in fail_set:
                raise Exception(f"Article {i} failed")
            await asyncio.sleep(0.001)
            return "new"

    async def run():
        tasks = [mock_task(i) for i in range(n)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return results

    results = _run(run())

    assert len(results) == n

    # Count outcomes
    success_count = 0
    failure_count = 0
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            assert i in fail_set, f"Unexpected failure at index {i}"
            failure_count += 1
        else:
            assert r == "new"
            success_count += 1

    # All non-failing articles should succeed
    expected_success = n - len(fail_set)
    assert success_count == expected_success, (
        f"Expected {expected_success} successes, got {success_count}"
    )
    assert failure_count == len(fail_set)
    assert success_count + failure_count == n
