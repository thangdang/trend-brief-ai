"""Article text extraction and HTML cleaning service.

Uses newspaper3k for primary extraction and BeautifulSoup as a fallback
cleaner to strip residual HTML, ads, and navigation elements.
Includes Vietnamese-specific artifact removal and NFC normalization.
"""

import asyncio
import logging
import re
import unicodedata

from bs4 import BeautifulSoup
from newspaper import Article

from config import settings

logger = logging.getLogger(__name__)

# Tags commonly used for ads, navigation, and non-content elements.
_STRIP_TAGS = frozenset({
    "script", "style", "nav", "header", "footer", "aside",
    "iframe", "noscript", "form", "button", "svg",
})

# CSS class / id substrings that typically indicate non-article content.
_AD_NAV_PATTERNS = re.compile(
    r"(advert|banner|sidebar|menu|nav|footer|header|popup|modal|cookie|social"
    r"|share|comment|related|recommend|promo)",
    re.IGNORECASE,
)

# Collapse multiple whitespace / blank lines into a single space.
_MULTI_WS = re.compile(r"[ \t]+")
_MULTI_NL = re.compile(r"\n{3,}")

# Vietnamese-specific artifact patterns
VN_ARTIFACTS: list[re.Pattern] = [
    re.compile(r"(Đọc thêm|Xem thêm|Tin liên quan|Bài liên quan)\s*:.*", re.IGNORECASE),
    re.compile(r"(Nguồn|Theo)\s*:.*$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"©.*$", re.MULTILINE),
    re.compile(r"Chia sẻ\s*(Facebook|Twitter|Zalo|LinkedIn|Email).*$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"(Quảng cáo|Advertisement|Sponsored|Tài trợ).*$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"(Gửi bình luận|Bình luận|Comment).*$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"(Chia sẻ bài viết|Share this|Chia sẻ qua).*$", re.MULTILINE | re.IGNORECASE),
]


def _remove_repeated_paragraphs(text: str) -> str:
    """Detect and remove repeated paragraphs."""
    paragraphs = text.split("\n\n")
    seen: set[str] = set()
    unique: list[str] = []
    for p in paragraphs:
        normalized = p.strip()
        if not normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        unique.append(p)
    return "\n\n".join(unique)


def clean_vietnamese_artifacts(text: str) -> str:
    """Strip Vietnamese web artifacts, boilerplate, repeated paragraphs."""
    if not text:
        return ""

    for pattern in VN_ARTIFACTS:
        text = pattern.sub("", text)

    text = _remove_repeated_paragraphs(text)

    return text.strip()


def clean_html(raw_html: str) -> str:
    """Remove HTML tags, ads, navigation elements, and excess whitespace.

    Parameters
    ----------
    raw_html:
        Raw HTML string (or already-plain text with residual markup).

    Returns
    -------
    str
        Cleaned plain text with normalised whitespace.
    """
    if not raw_html:
        return ""

    soup = BeautifulSoup(raw_html, "html.parser")

    # 1. Remove known non-content tags entirely.
    for tag in soup.find_all(list(_STRIP_TAGS)):
        tag.decompose()

    # 2. Remove elements whose class or id looks like ads / navigation.
    for el in soup.find_all(True):
        classes = " ".join(el.get("class", []))
        el_id = el.get("id", "") or ""
        if _AD_NAV_PATTERNS.search(classes) or _AD_NAV_PATTERNS.search(el_id):
            el.decompose()

    # 3. Extract visible text.
    text = soup.get_text(separator="\n")

    # 4. Normalise whitespace.
    text = _MULTI_WS.sub(" ", text)
    text = _MULTI_NL.sub("\n\n", text)

    # 5. Remove Vietnamese-specific artifacts.
    text = clean_vietnamese_artifacts(text)

    # 6. Normalise Vietnamese unicode diacritics to NFC form.
    text = unicodedata.normalize("NFC", text)

    return text.strip()


async def extract_article(url: str) -> dict | None:
    """Download and parse a full article using newspaper3k.

    Parameters
    ----------
    url:
        HTTP/HTTPS URL of the article to extract.

    Returns
    -------
    dict | None
        ``{"title": str, "text": str, "published_at": datetime | None}``
        on success, or ``None`` when the article cannot be fetched / parsed.
    """
    logger.info("Extracting article from %s", url)

    try:
        article = Article(url, language="vi")
        # newspaper3k is synchronous — offload to a thread.
        await asyncio.to_thread(article.download)
        await asyncio.to_thread(article.parse)
    except Exception:
        logger.exception("newspaper3k failed for %s", url)
        return None

    return {
        "title": (article.title or "").strip(),
        "text": (article.text or "").strip(),
        "published_at": article.publish_date,
    }


async def extract_and_clean(url: str) -> dict | None:
    """Extract an article and clean its text.

    Combines :func:`extract_article` (newspaper3k) with :func:`clean_html`
    (BeautifulSoup fallback).  Returns ``None`` when extraction fails or the
    cleaned text is shorter than ``settings.min_article_chars``.

    Parameters
    ----------
    url:
        HTTP/HTTPS URL of the article.

    Returns
    -------
    dict | None
        ``{"title": str, "text": str, "published_at": datetime | None}``
        with *cleaned* text, or ``None`` if the article should be skipped.
    """
    result = await extract_article(url)
    if result is None:
        return None

    # Apply BeautifulSoup cleaning on the extracted text to strip any
    # residual HTML or ad fragments that newspaper3k may have left behind.
    cleaned_text = clean_html(result["text"])

    if len(cleaned_text) < settings.min_article_chars:
        logger.info(
            "Skipping %s — cleaned text too short (%d < %d chars)",
            url,
            len(cleaned_text),
            settings.min_article_chars,
        )
        return None

    return {
        "title": unicodedata.normalize("NFC", result["title"]),
        "text": cleaned_text,
        "published_at": result["published_at"],
    }
