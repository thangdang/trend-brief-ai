"""AI summarization service with extractive fallback and batch processing."""

import asyncio
import logging
import math
import re

import ollama

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "Bạn là trợ lý tóm tắt tin tức cho giới trẻ Việt Nam. "
    "Trả lời bằng tiếng Việt, tone trẻ, dễ hiểu."
)

_USER_PROMPT_TEMPLATE = """\
Tóm tắt bài viết sau thành:
- 1 tiêu đề ngắn (<=12 từ), bắt đầu bằng "TITLE:"
- 3 bullet chính, mỗi bullet bắt đầu bằng "- "
- 1 câu trả lời: Vì sao bạn nên quan tâm, bắt đầu bằng "REASON:"

Tone: trẻ, dễ hiểu

Bài viết:
{text}
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SENTENCE_RE = re.compile(r"(?<=[.!?。])\s+")


def _split_sentences(text: str) -> list[str]:
    """Split *text* into sentences using punctuation boundaries."""
    parts = _SENTENCE_RE.split(text.strip())
    return [s.strip() for s in parts if s.strip()]


def _truncate_title(title: str, max_words: int = 12) -> str:
    """Ensure *title* has at most *max_words* words."""
    words = title.split()
    if len(words) <= max_words:
        return title
    return " ".join(words[:max_words])


def _extractive_fallback(clean_text: str) -> dict:
    """Produce a summary using simple sentence extraction.

    Used when the AI model is unavailable or returns unusable output.
    """
    sentences = _split_sentences(clean_text)

    title_ai = _truncate_title(sentences[0]) if sentences else clean_text[:80]
    bullets = sentences[:3] if len(sentences) >= 3 else sentences + [""] * (3 - len(sentences))
    reason = "Đây là tin tức đáng chú ý mà bạn nên biết."

    return {
        "title_ai": title_ai,
        "summary_bullets": bullets[:3],
        "reason": reason,
    }


def _parse_ai_response(raw: str) -> dict | None:
    """Parse structured fields from the model's raw text output.

    Expected format (flexible):
        TITLE: <title text>
        - bullet 1
        - bullet 2
        - bullet 3
        REASON: <reason text>

    Returns ``None`` when parsing fails so the caller can fall back.
    """
    title_ai: str | None = None
    bullets: list[str] = []
    reason: str | None = None

    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        upper = stripped.upper()
        if upper.startswith("TITLE:"):
            title_ai = stripped[len("TITLE:"):].strip()
        elif upper.startswith("REASON:"):
            reason = stripped[len("REASON:"):].strip()
        elif stripped.startswith("- "):
            bullets.append(stripped[2:].strip())

    if not title_ai or len(bullets) < 3 or not reason:
        return None

    return {
        "title_ai": _truncate_title(title_ai),
        "summary_bullets": bullets[:3],
        "reason": reason,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def generate_summary(
    clean_text: str,
    model_name: str | None = None,
    cache=None,
) -> dict:
    """Generate an AI title, 3 bullets, and a reason from article text.

    Parameters
    ----------
    clean_text:
        Cleaned article body.  Truncated to ``settings.max_article_chars``
        before being sent to the model.
    model_name:
        Ollama model to use.  Defaults to ``settings.summarizer_model``.
    cache:
        Optional SummarizerCache instance. When provided, checks cache
        before calling Ollama and stores results after generation.

    Returns
    -------
    dict
        ``{"title_ai": str, "summary_bullets": list[str], "reason": str}``
        Always contains exactly 3 bullets.  Falls back to extractive
        summarization when the AI model is unreachable or returns
        unparseable output. Includes ``from_cache`` flag when cache is used.
    """
    # Check cache first
    if cache is not None:
        cached = await cache.get(clean_text)
        if cached is not None:
            logger.info("Summary served from cache")
            return cached

    model = model_name or settings.summarizer_model
    truncated = clean_text[: settings.max_article_chars]

    prompt = _USER_PROMPT_TEMPLATE.format(text=truncated)

    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            options={"num_predict": 512},
        )

        raw_content: str = response["message"]["content"]
        parsed = _parse_ai_response(raw_content)

        if parsed is not None:
            logger.info("AI summary generated successfully via model '%s'", model)
            # Store in cache
            if cache is not None:
                await cache.put(clean_text, parsed)
            return parsed

        logger.warning(
            "AI response could not be parsed — falling back to extractive summary. "
            "Raw response: %.200s",
            raw_content,
        )
    except Exception:
        logger.exception(
            "Ollama model '%s' failed — falling back to extractive summary", model
        )

    result = _extractive_fallback(truncated)
    if cache is not None:
        await cache.put(clean_text, result)
    return result


# ---------------------------------------------------------------------------
# Batch processing
# ---------------------------------------------------------------------------

_BATCH_PROMPT_TEMPLATE = """\
Tóm tắt {count} bài viết sau. Mỗi bài viết được đánh dấu bằng [ARTICLE {n}].
Trả lời theo format cho MỖI bài:

[ARTICLE {n}]
TITLE: <tiêu đề ngắn <=12 từ>
- bullet 1
- bullet 2
- bullet 3
REASON: <vì sao nên quan tâm>

Tone: trẻ, dễ hiểu

{articles}
"""


def _build_batch_prompt(texts: list[str]) -> str:
    """Build a single prompt containing multiple articles."""
    articles_text = ""
    for i, text in enumerate(texts, 1):
        truncated = text[: settings.max_article_chars]
        articles_text += f"\n[ARTICLE {i}]\n{truncated}\n"
    return _BATCH_PROMPT_TEMPLATE.format(
        count=len(texts), n="N", articles=articles_text
    )


def _parse_batch_response(raw: str, count: int) -> list[dict | None]:
    """Parse batch AI response into individual article results."""
    results: list[dict | None] = [None] * count

    # Split by article markers
    sections = re.split(r"\[ARTICLE\s+(\d+)\]", raw)

    # sections alternates: [preamble, "1", content1, "2", content2, ...]
    for i in range(1, len(sections) - 1, 2):
        try:
            idx = int(sections[i]) - 1
            if 0 <= idx < count:
                parsed = _parse_ai_response(sections[i + 1])
                results[idx] = parsed
        except (ValueError, IndexError):
            continue

    return results


async def generate_summary_batch(
    texts: list[str],
    batch_size: int | None = None,
    model_name: str | None = None,
) -> list[dict]:
    """Process multiple articles in batches via Ollama.

    Falls back to individual processing on batch failure.
    Falls back to extractive for unparseable individual results.
    """
    if not texts:
        return []

    batch_size = batch_size or settings.summarizer_batch_size
    model = model_name or settings.summarizer_model
    results: list[dict] = [{}] * len(texts)
    num_batches = math.ceil(len(texts) / batch_size)

    for batch_idx in range(num_batches):
        start = batch_idx * batch_size
        end = min(start + batch_size, len(texts))
        batch_texts = texts[start:end]

        try:
            prompt = _build_batch_prompt(batch_texts)
            response = await asyncio.to_thread(
                ollama.chat,
                model=model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                options={"num_predict": 512 * len(batch_texts)},
            )

            raw_content: str = response["message"]["content"]
            parsed_list = _parse_batch_response(raw_content, len(batch_texts))

            for i, parsed in enumerate(parsed_list):
                global_idx = start + i
                if parsed is not None:
                    results[global_idx] = parsed
                else:
                    # Individual fallback for unparseable items
                    results[global_idx] = await generate_summary(batch_texts[i], model)

        except Exception:
            logger.exception("Batch %d failed — falling back to individual processing", batch_idx)
            for i, text in enumerate(batch_texts):
                global_idx = start + i
                results[global_idx] = await generate_summary(text, model)

    return results
