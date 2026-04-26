"""AI summarization service with multi-model fallback, quality validation, and topic-specific prompts.

Provider chain: Ollama (local) → Groq (free) → Gemini (free)
Quality validation: auto-retry if quality_score < 0.6
Prompt templates: topic-specific tone and focus
"""

import asyncio
import json
import logging
import math
import pathlib
import re

import ollama

from config import settings
from services.llm_providers import provider_chain, _random_fallback_reason
from services.summary_validator import summary_validator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates (topic-specific)
# ---------------------------------------------------------------------------

_PROMPT_TEMPLATES: dict[str, str] = {}
try:
    _templates_path = pathlib.Path(__file__).parent / "data" / "prompt_templates.json"
    if _templates_path.exists():
        _PROMPT_TEMPLATES = json.loads(_templates_path.read_text(encoding="utf-8"))
        logger.info("Loaded %d prompt templates", len(_PROMPT_TEMPLATES) - 2)  # exclude _version, _description
except Exception:
    logger.warning("Failed to load prompt templates — using default")

_DEFAULT_PROMPT = _PROMPT_TEMPLATES.get("default", """\
Tóm tắt bài viết sau thành:
- 1 tiêu đề ngắn (<=12 từ), bắt đầu bằng "TITLE:"
- 3 bullet chính, mỗi bullet bắt đầu bằng "- "
- 1 câu trả lời: Vì sao bạn nên quan tâm, bắt đầu bằng "REASON:"

Tone: trẻ, dễ hiểu

Bài viết:
{text}
""")

_SYSTEM_PROMPT = (
    "Bạn là trợ lý tóm tắt tin tức cho giới trẻ Việt Nam. "
    "Trả lời bằng tiếng Việt, tone trẻ, dễ hiểu."
)


def _get_prompt(text: str, topic: str = "") -> str:
    """Get topic-specific prompt template, fallback to default."""
    template = _PROMPT_TEMPLATES.get(topic, _DEFAULT_PROMPT)
    if template.startswith("_"):  # skip metadata keys
        template = _DEFAULT_PROMPT
    return template.format(text=text)

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

    Used when all AI providers fail. Uses varied fallback reasons.
    """
    sentences = _split_sentences(clean_text)

    title_ai = _truncate_title(sentences[0]) if sentences else clean_text[:80]
    bullets = sentences[:3] if len(sentences) >= 3 else sentences + [""] * (3 - len(sentences))
    reason = _random_fallback_reason()

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
    topic: str = "",
) -> dict:
    """Generate an AI title, 3 bullets, and a reason from article text.

    Uses multi-model provider chain (Ollama → Groq → Gemini) with
    quality validation and auto-retry.

    Parameters
    ----------
    clean_text:
        Cleaned article body.
    model_name:
        Ollama model override (ignored when using provider chain).
    cache:
        Optional SummarizerCache instance.
    topic:
        Article topic for topic-specific prompt template.

    Returns
    -------
    dict with title_ai, summary_bullets, reason, quality_score, provider.
    """
    # Check cache first
    if cache is not None:
        cached = await cache.get(clean_text)
        if cached is not None:
            logger.info("Summary served from cache")
            cached["from_cache"] = True
            return cached

    truncated = clean_text[: settings.max_article_chars]
    prompt = _get_prompt(truncated, topic)

    max_retries = 2
    best_result = None
    best_score = 0.0
    used_provider = "fallback"

    for attempt in range(max_retries + 1):
        # Use provider chain (Ollama → Groq → Gemini)
        raw_response, provider_name = await provider_chain.summarize(truncated, prompt)

        if raw_response is not None:
            parsed = _parse_ai_response(raw_response)
            if parsed is not None:
                # Validate quality
                validation = summary_validator.validate(parsed, clean_text)
                parsed["quality_score"] = validation["overall"]
                parsed["provider"] = provider_name
                parsed["prompt_version"] = _PROMPT_TEMPLATES.get("_version", "1.0")

                if validation["valid"]:
                    logger.info(
                        "AI summary generated (provider=%s, quality=%.3f, attempt=%d)",
                        provider_name, validation["overall"], attempt + 1,
                    )
                    if cache is not None:
                        await cache.put(clean_text, parsed)
                    return parsed

                # Track best result so far (even if below threshold)
                if validation["overall"] > best_score:
                    best_result = parsed
                    best_score = validation["overall"]
                    used_provider = provider_name

                logger.warning(
                    "Summary quality %.3f below threshold (attempt %d/%d, issues: %s)",
                    validation["overall"], attempt + 1, max_retries + 1,
                    validation["issues"],
                )
            else:
                logger.warning("AI response unparseable (attempt %d, provider=%s)", attempt + 1, provider_name)
        else:
            logger.warning("All providers failed (attempt %d)", attempt + 1)

    # Use best result if we got one, even if below threshold
    if best_result is not None:
        logger.info("Using best available summary (quality=%.3f, provider=%s)", best_score, used_provider)
        if cache is not None:
            await cache.put(clean_text, best_result)
        return best_result

    # Final fallback: extractive
    result = _extractive_fallback(truncated)
    result["quality_score"] = 0.0
    result["provider"] = "extractive_fallback"
    result["prompt_version"] = "fallback"
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
