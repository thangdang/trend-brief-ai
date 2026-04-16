"""HTML scraper service — crawls listing pages that don't provide RSS feeds.

Used for sources like Spiderum, TopDev, etc. where we need to:
1. Fetch the listing/index page
2. Extract article links using a CSS selector
3. Return entries in the same format as the RSS crawler
"""

import asyncio
import logging
from datetime import datetime, timezone
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_DEFAULT_HEADERS = {
    "User-Agent": "TrendBrief/1.0",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
}

# Polite delay between HTTP requests (seconds)
_REQUEST_DELAY = 2.0


async def crawl_html_source(
    source_url: str,
    source_name: str,
    link_selector: str = "a[href]",
    max_links: int = 20,
) -> list[dict]:
    """Scrape a listing page and extract article links.

    Parameters
    ----------
    source_url:
        URL of the listing / index page to scrape.
    source_name:
        Human-readable name for logging.
    link_selector:
        CSS selector to find article ``<a>`` elements on the page.
        Defaults to all anchors; callers should provide a more specific
        selector stored in the source config (e.g. ``"h2.title a"``).
    max_links:
        Cap on the number of links to return per crawl cycle.

    Returns
    -------
    list[dict]
        Each dict has ``url``, ``title``, ``published_at`` (None for HTML
        scrapes), and ``source`` — same shape as :func:`crawl_rss_source`.
    """
    logger.info("Scraping HTML source '%s' at %s", source_name, source_url)

    try:
        async with httpx.AsyncClient(
            headers=_DEFAULT_HEADERS,
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
        ) as client:
            resp = await client.get(source_url)
            resp.raise_for_status()
    except Exception:
        logger.exception(
            "Failed to fetch HTML listing for '%s' (%s)", source_name, source_url
        )
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    anchors = soup.select(link_selector)

    if not anchors:
        logger.warning(
            "No links found with selector '%s' on '%s' (%s)",
            link_selector, source_name, source_url,
        )
        return []

    entries: list[dict] = []
    seen_urls: set[str] = set()

    for a_tag in anchors:
        href = (a_tag.get("href") or "").strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue

        # Resolve relative URLs
        full_url = urljoin(source_url, href)

        # Skip duplicates within the same crawl
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        title = a_tag.get_text(strip=True) or ""

        entries.append({
            "url": full_url,
            "title": title,
            "published_at": None,  # HTML scrapes rarely expose dates on listing pages
            "source": source_name,
        })

        if len(entries) >= max_links:
            break

    logger.info(
        "Scraped %d article links from '%s' (%s)",
        len(entries), source_name, source_url,
    )
    return entries
