"""AI summarization service with extractive fallback."""

import asyncio
import logging
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


async def generate_summary(clean_text: str, model_name: str | None = None) -> dict:
    """Generate an AI title, 3 bullets, and a reason from article text.

    Parameters
    ----------
    clean_text:
        Cleaned article body.  Truncated to ``settings.max_article_chars``
        before being sent to the model.
    model_name:
        Ollama model to use.  Defaults to ``settings.summarizer_model``.

    Returns
    -------
    dict
        ``{"title_ai": str, "summary_bullets": list[str], "reason": str}``
        Always contains exactly 3 bullets.  Falls back to extractive
        summarization when the AI model is unreachable or returns
        unparseable output.
    """
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

    return _extractive_fallback(truncated)
