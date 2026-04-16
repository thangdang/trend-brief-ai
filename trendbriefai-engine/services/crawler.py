"""RSS crawler service — fetches and parses RSS feeds."""

import asyncio
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import mktime

import feedparser

logger = logging.getLogger(__name__)


def _parse_published_date(entry: feedparser.FeedParserDict) -> datetime | None:
    """Extract a datetime from an RSS entry's date fields.

    Handles ``published_parsed``, ``updated_parsed`` (struct_time) and falls
    back to parsing the raw ``published`` / ``updated`` strings via
    :func:`email.utils.parsedate_to_datetime` (RFC-2822).
    """
    # 1. Try struct_time fields produced by feedparser
    for attr in ("published_parsed", "updated_parsed"):
        struct = getattr(entry, attr, None)
        if struct is not None:
            try:
                return datetime.fromtimestamp(mktime(struct), tz=timezone.utc)
            except (OverflowError, OSError, ValueError):
                continue

    # 2. Try raw date strings via RFC-2822 parser
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None) or entry.get(attr)
        if raw:
            try:
                return parsedate_to_datetime(raw).astimezone(timezone.utc)
            except (ValueError, TypeError):
                continue

    return None


async def crawl_rss_source(source_url: str, source_name: str) -> list[dict]:
    """Fetch and parse an RSS feed, returning raw article entries.

    Parameters
    ----------
    source_url:
        HTTP/HTTPS URL of the RSS feed.
    source_name:
        Human-readable identifier for the source (used in logs).

    Returns
    -------
    list[dict]
        Each dict contains ``url``, ``title``, ``published_at``
        (datetime | None), and ``source`` (str).  Returns an empty
        list when the feed is unreachable or malformed.
    """
    logger.info("Crawling RSS source '%s' at %s", source_name, source_url)

    try:
        # feedparser is synchronous — run in a thread so we don't block the
        # event loop.  Pass a custom User-Agent to avoid being blocked by
        # Vietnamese news sites.
        feed = await asyncio.to_thread(
            feedparser.parse, source_url, agent="TrendBrief/1.0"
        )
    except Exception:
        logger.exception(
            "Failed to fetch RSS feed for '%s' (%s)", source_name, source_url
        )
        return []

    # feedparser sets bozo=1 when the feed is malformed.  If there are *no*
    # entries at all we treat it as an error; otherwise we still try to
    # extract whatever we can.
    if feed.bozo and not feed.entries:
        logger.warning(
            "Malformed/empty RSS feed for '%s' (%s): %s",
            source_name,
            source_url,
            getattr(feed, "bozo_exception", "unknown error"),
        )
        return []

    entries: list[dict] = []
    for item in feed.entries:
        link = item.get("link", "").strip()
        title = item.get("title", "").strip()

        if not link:
            logger.debug("Skipping RSS entry without link in '%s'", source_name)
            continue

        published_at = _parse_published_date(item)

        entries.append(
            {
                "url": link,
                "title": title,
                "published_at": published_at,
                "source": source_name,
            }
        )

    logger.info(
        "Crawled %d entries from '%s' (%s)", len(entries), source_name, source_url
    )
    return entries
