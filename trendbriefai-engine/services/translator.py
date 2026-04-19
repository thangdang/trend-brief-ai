"""Language detection + Ollama-based translation to Vietnamese.

Inserted into the pipeline between cleaning and quality scoring.
Only triggers for non-Vietnamese content (e.g. Medium English articles).

Detection: langdetect (lightweight, no model download).
Translation: Ollama LLM (free, local — same model as summarizer).
Fallback: if Ollama offline or detection fails, content passes through untranslated.
"""

import asyncio
import logging
import re

import ollama

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

_langdetect_available = False
try:
    from langdetect import detect as _detect_lang
    from langdetect import LangDetectException
    _langdetect_available = True
except ImportError:
    logger.warning("langdetect not installed — translation disabled. Run: pip install langdetect")
    LangDetectException = Exception


# Vietnamese diacritics heuristic (fast pre-check before calling langdetect)
_VN_DIACRITICS = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡ"
    r"ùúụủũưừứựửữỳýỵỷỹđ"
    r"ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ"
    r"ÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]"
)


def detect_language(text: str) -> str:
    """Detect language of *text*. Returns ISO 639-1 code (e.g. 'vi', 'en').

    Uses a fast Vietnamese diacritics heuristic first — if ≥5% of alpha
    characters are Vietnamese-specific, returns 'vi' immediately without
    calling langdetect. This avoids false negatives on short texts.

    Returns 'vi' on any error (safe default — skip translation).
    """
    if not text or len(text.strip()) < 20:
        return "vi"

    # Fast heuristic: count Vietnamese diacritics
    alpha_chars = [c for c in text[:2000] if c.isalpha()]
    if alpha_chars:
        vn_count = len(_VN_DIACRITICS.findall(text[:2000]))
        ratio = vn_count / len(alpha_chars)
        if ratio >= 0.05:
            return "vi"

    # Fallback to langdetect
    if not _langdetect_available:
        return "vi"

    try:
        lang = _detect_lang(text[:3000])
        return lang
    except LangDetectException:
        return "vi"


# ---------------------------------------------------------------------------
# Translation via Ollama
# ---------------------------------------------------------------------------

_TRANSLATE_SYSTEM = (
    "Bạn là dịch giả chuyên nghiệp. Dịch chính xác sang tiếng Việt, "
    "giữ nguyên ý nghĩa, thuật ngữ chuyên ngành giữ nguyên tiếng Anh trong ngoặc. "
    "Chỉ trả về bản dịch, không giải thích."
)

_TRANSLATE_PROMPT = """\
Dịch đoạn văn sau sang tiếng Việt:

{text}
"""


async def translate_to_vietnamese(
    text: str,
    model_name: str | None = None,
    max_chars: int | None = None,
) -> str | None:
    """Translate *text* to Vietnamese using Ollama.

    Returns translated text, or ``None`` if translation fails
    (caller should use original text as fallback).
    """
    model = model_name or settings.summarizer_model
    limit = max_chars or settings.max_article_chars
    truncated = text[:limit]

    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=model,
            messages=[
                {"role": "system", "content": _TRANSLATE_SYSTEM},
                {"role": "user", "content": _TRANSLATE_PROMPT.format(text=truncated)},
            ],
            options={"num_predict": 2048, "temperature": 0.3},
        )
        translated = response["message"]["content"].strip()

        # Sanity check: translation should be non-empty and roughly similar length
        if not translated or len(translated) < len(truncated) * 0.3:
            logger.warning("Translation too short — discarding")
            return None

        logger.info(
            "Translated %d chars (%s → vi) via model '%s'",
            len(truncated), detect_language(text[:500]), model,
        )
        return translated

    except Exception:
        logger.exception("Translation failed via Ollama model '%s'", model)
        return None


# ---------------------------------------------------------------------------
# Pipeline helper: detect + translate if needed
# ---------------------------------------------------------------------------


async def ensure_vietnamese(text: str, title: str = "") -> dict:
    """Detect language and translate to Vietnamese if needed.

    Returns
    -------
    dict
        ``{"text": str, "title": str, "translated": bool, "source_lang": str}``
    """
    source_lang = detect_language(text)

    if source_lang == "vi":
        return {
            "text": text,
            "title": title,
            "translated": False,
            "source_lang": "vi",
        }

    logger.info("Non-Vietnamese content detected (lang=%s), translating...", source_lang)

    # Translate body
    translated_text = await translate_to_vietnamese(text)
    if translated_text is None:
        # Fallback: pass through untranslated, summarizer prompt will try its best
        return {
            "text": text,
            "title": title,
            "translated": False,
            "source_lang": source_lang,
        }

    # Translate title if non-empty
    translated_title = title
    if title and detect_language(title) != "vi":
        t = await translate_to_vietnamese(title, max_chars=200)
        if t:
            translated_title = t

    return {
        "text": translated_text,
        "title": translated_title,
        "translated": True,
        "source_lang": source_lang,
    }
