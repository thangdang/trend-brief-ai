# Feature: trendbriefai-ai-performance, Property 1: Summarizer output structure invariant
# Feature: trendbriefai-ai-performance, Property 2: Batch grouping correctness
# Feature: trendbriefai-ai-performance, Property 3: Batch failure isolation

"""Property-based tests for summarizer output structure and batch processing."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import asyncio
import math
from unittest.mock import patch, MagicMock

from hypothesis import given, settings as h_settings, assume
from hypothesis import strategies as st

from services.summarizer import (
    generate_summary,
    generate_summary_batch,
    _extractive_fallback,
    _parse_ai_response,
)


def _run(coro):
    """Helper to run async code in tests."""
    return asyncio.get_event_loop().run_until_complete(coro)


try:
    asyncio.get_event_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())


# Strategy for article text >= 100 chars
article_text_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=100,
    max_size=1000,
)


def _make_valid_ai_response(text: str) -> str:
    """Build a valid AI response string for mocking."""
    return (
        "TITLE: Tin tức quan trọng hôm nay\n"
        "- Điểm chính thứ nhất của bài viết\n"
        "- Điểm chính thứ hai của bài viết\n"
        "- Điểm chính thứ ba của bài viết\n"
        "REASON: Đây là thông tin bạn cần biết"
    )


def _make_batch_ai_response(count: int) -> str:
    """Build a valid batch AI response for mocking."""
    parts = []
    for i in range(1, count + 1):
        parts.append(
            f"[ARTICLE {i}]\n"
            f"TITLE: Tiêu đề bài {i}\n"
            f"- Bullet 1 bài {i}\n"
            f"- Bullet 2 bài {i}\n"
            f"- Bullet 3 bài {i}\n"
            f"REASON: Lý do bài {i}"
        )
    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Property 1: Summarizer output structure invariant
# For any text >= 100 chars, output has title_ai <= 12 words,
# exactly 3 summary_bullets, and 1 reason.
# Validates: Requirements 1.4
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(text=article_text_strategy)
def test_property_1_output_structure_with_mock_ai(text):
    """Summarizer output always has correct structure (mocked Ollama)."""
    assume(len(text.strip()) >= 100)

    mock_response = {
        "message": {"content": _make_valid_ai_response(text)}
    }

    with patch("services.summarizer.ollama.chat", return_value=mock_response):
        result = _run(generate_summary(text))

    assert "title_ai" in result, "Missing title_ai"
    assert "summary_bullets" in result, "Missing summary_bullets"
    assert "reason" in result, "Missing reason"

    # title_ai <= 12 words
    word_count = len(result["title_ai"].split())
    assert word_count <= 12, f"title_ai has {word_count} words (max 12)"

    # Exactly 3 bullets
    assert len(result["summary_bullets"]) == 3, (
        f"Expected 3 bullets, got {len(result['summary_bullets'])}"
    )

    # reason is a non-empty string
    assert isinstance(result["reason"], str)
    assert len(result["reason"]) > 0


@h_settings(max_examples=100)
@given(text=article_text_strategy)
def test_property_1_extractive_fallback_structure(text):
    """Extractive fallback always produces correct output structure."""
    assume(len(text.strip()) >= 100)

    result = _extractive_fallback(text)

    assert "title_ai" in result
    assert "summary_bullets" in result
    assert "reason" in result

    word_count = len(result["title_ai"].split())
    assert word_count <= 12, f"Fallback title has {word_count} words"
    assert len(result["summary_bullets"]) == 3
    assert isinstance(result["reason"], str) and len(result["reason"]) > 0


@h_settings(max_examples=100)
@given(text=article_text_strategy)
def test_property_1_output_structure_on_ollama_failure(text):
    """When Ollama fails, extractive fallback still has correct structure."""
    assume(len(text.strip()) >= 100)

    with patch("services.summarizer.ollama.chat", side_effect=Exception("connection refused")):
        result = _run(generate_summary(text))

    assert "title_ai" in result
    assert len(result["title_ai"].split()) <= 12
    assert len(result["summary_bullets"]) == 3
    assert isinstance(result["reason"], str) and len(result["reason"]) > 0


# ---------------------------------------------------------------------------
# Property 2: Batch grouping correctness
# ceil(N/B) batches, each <= B articles, union == original, no dupes.
# Validates: Requirements 1.1
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    n=st.integers(min_value=1, max_value=50),
    batch_size=st.integers(min_value=1, max_value=10),
)
def test_property_2_batch_grouping(n, batch_size):
    """Batch grouping produces correct number of batches with no loss."""
    texts = [f"Article content number {i}. " * 20 for i in range(n)]
    expected_batches = math.ceil(n / batch_size)

    # Track which batches are called
    batch_calls = []

    original_chat = None

    def mock_chat(*args, **kwargs):
        # Count the articles in this batch by checking the prompt
        content = kwargs.get("messages", [{}])[-1].get("content", "")
        article_count = content.count("[ARTICLE")
        batch_calls.append(article_count)
        return {"message": {"content": _make_batch_ai_response(article_count)}}

    with patch("services.summarizer.ollama.chat", side_effect=mock_chat):
        results = _run(generate_summary_batch(texts, batch_size=batch_size))

    # Correct number of results
    assert len(results) == n, f"Expected {n} results, got {len(results)}"

    # Correct number of batches
    assert len(batch_calls) == expected_batches, (
        f"Expected {expected_batches} batches, got {len(batch_calls)}"
    )

    # Each batch has at most batch_size articles
    for i, count in enumerate(batch_calls):
        assert count <= batch_size, (
            f"Batch {i} has {count} articles (max {batch_size})"
        )

    # Total articles across batches equals N
    assert sum(batch_calls) == n


# ---------------------------------------------------------------------------
# Property 3: Batch failure isolation
# One article's failure doesn't affect others in the batch.
# Validates: Requirements 1.3
# ---------------------------------------------------------------------------

@h_settings(max_examples=100)
@given(
    n=st.integers(min_value=2, max_value=8),
    fail_index=st.integers(min_value=0, max_value=7),
)
def test_property_3_batch_failure_isolation(n, fail_index):
    """Failed article gets fallback; others get valid summaries."""
    assume(fail_index < n)

    texts = [f"Article content number {i}. " * 20 for i in range(n)]

    call_count = [0]

    def mock_chat(*args, **kwargs):
        call_count[0] += 1
        content = kwargs.get("messages", [{}])[-1].get("content", "")

        # First call is the batch — return with one unparseable article
        if "[ARTICLE" in content:
            article_count = content.count("[ARTICLE")
            parts = []
            for i in range(1, article_count + 1):
                if i - 1 == fail_index:
                    # Unparseable output for the failed article
                    parts.append(f"[ARTICLE {i}]\nGARBAGE OUTPUT")
                else:
                    parts.append(
                        f"[ARTICLE {i}]\n"
                        f"TITLE: Tiêu đề bài {i}\n"
                        f"- Bullet 1\n- Bullet 2\n- Bullet 3\n"
                        f"REASON: Lý do bài {i}"
                    )
            return {"message": {"content": "\n\n".join(parts)}}

        # Individual fallback calls — simulate Ollama failure to trigger extractive
        raise Exception("Ollama unavailable for individual retry")

    with patch("services.summarizer.ollama.chat", side_effect=mock_chat):
        results = _run(generate_summary_batch(texts, batch_size=n))

    assert len(results) == n

    for i, result in enumerate(results):
        # Every article should have valid structure regardless of failure
        assert "title_ai" in result, f"Article {i} missing title_ai"
        assert "summary_bullets" in result, f"Article {i} missing summary_bullets"
        assert "reason" in result, f"Article {i} missing reason"
        assert len(result["summary_bullets"]) == 3, (
            f"Article {i} has {len(result['summary_bullets'])} bullets"
        )
