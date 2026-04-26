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
    """Download and parse a full article.

    Uses trafilatura as primary extractor (better quality, actively maintained),
    falls back to newspaper3k if trafilatura fails.

    Returns ``{"title": str, "text": str, "published_at": datetime | None, "image_url": str | None}``
    or ``None`` on failure.
    """
    logger.info("Extracting article from %s", url)

    # Primary: trafilatura (better extraction quality)
    try:
        import trafilatura
        downloaded = await asyncio.to_thread(
            trafilatura.fetch_url, url
        )
        if downloaded:
            result = await asyncio.to_thread(
                trafilatura.extract,
                downloaded,
                include_comments=False,
                include_tables=False,
                favor_precision=True,
                output_format="txt",
            )
            if result and len(result.strip()) >= settings.min_article_chars:
                # Extract metadata
                metadata = await asyncio.to_thread(
                    trafilatura.extract,
                    downloaded,
                    output_format="json",
                    include_comments=False,
                )
                meta = {}
                if metadata:
                    import json
                    try:
                        meta = json.loads(metadata)
                    except (json.JSONDecodeError, TypeError):
                        pass

                return {
                    "title": (meta.get("title") or "").strip(),
                    "text": result.strip(),
                    "published_at": meta.get("date"),
                    "image_url": meta.get("image") or None,
                }
    except ImportError:
        logger.debug("trafilatura not installed — using newspaper3k")
    except Exception:
        logger.warning("trafilatura failed for %s — falling back to newspaper3k", url)

    # Fallback: newspaper3k
    try:
        article = Article(url, language="vi")
        await asyncio.to_thread(article.download)
        await asyncio.to_thread(article.parse)

        return {
            "title": (article.title or "").strip(),
            "text": (article.text or "").strip(),
            "published_at": article.publish_date,
            "image_url": (article.top_image or "").strip() or None,
        }
    except Exception:
        logger.exception("Both extractors failed for %s", url)
        return None


async def extract_and_clean(url: str) -> dict | None:
    """Extract an article and clean its text.

    Combines extract_article (trafilatura/newspaper3k) with clean_html
    (BeautifulSoup fallback). Validates images and parses dates.
    """
    result = await extract_article(url)
    if result is None:
        return None

    cleaned_text = clean_html(result["text"])

    if len(cleaned_text) < settings.min_article_chars:
        logger.info(
            "Skipping %s — cleaned text too short (%d < %d chars)",
            url, len(cleaned_text), settings.min_article_chars,
        )
        return None

    # Validate image URL
    image_url = result.get("image_url")
    if image_url:
        image_url = await _validate_image(image_url)

    # Parse published_at from multiple formats
    published_at = _parse_date(result.get("published_at"))

    return {
        "title": unicodedata.normalize("NFC", result["title"]),
        "text": cleaned_text,
        "published_at": published_at,
        "image_url": image_url,
    }


async def _validate_image(url: str) -> str | None:
    """Validate image URL: check content-type and basic size heuristic."""
    if not url or not url.startswith("http"):
        return None
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.head(url, timeout=aiohttp.ClientTimeout(total=5), allow_redirects=True) as resp:
                if resp.status != 200:
                    return None
                ct = resp.headers.get("Content-Type", "")
                if not ct.startswith("image/"):
                    return None
                # Check Content-Length if available (skip tiny images < 5KB)
                cl = resp.headers.get("Content-Length")
                if cl and int(cl) < 5000:
                    return None
                return url
    except ImportError:
        # aiohttp not available — accept URL as-is
        return url
    except Exception:
        return None


def _parse_date(value) -> object | None:
    """Parse date from multiple formats (ISO, Vietnamese, RSS pubDate)."""
    if value is None:
        return None
    if hasattr(value, 'isoformat'):
        return value  # already a datetime

    if isinstance(value, str):
        from datetime import datetime
        formats = [
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%a, %d %b %Y %H:%M:%S %z",  # RSS pubDate
            "%a, %d %b %Y %H:%M:%S GMT",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except (ValueError, TypeError):
                continue
    return None
