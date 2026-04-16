"""Unit tests for the RSS crawler service."""

import asyncio
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

import pytest

from services.crawler import crawl_rss_source, _parse_published_date


# ---------------------------------------------------------------------------
# Helpers — build fake feedparser results
# ---------------------------------------------------------------------------

def _make_feed(entries, bozo=False, bozo_exception=None):
    """Return a minimal object that looks like feedparser.parse() output."""
    feed = MagicMock()
    feed.entries = entries
    feed.bozo = 1 if bozo else 0
    feed.bozo_exception = bozo_exception
    return feed


def _make_entry(link="https://example.com/article", title="Test Article",
                published_parsed=None, published=None):
    entry = {"link": link, "title": title}
    if published_parsed is not None:
        entry["published_parsed"] = published_parsed
    if published is not None:
        entry["published"] = published
    return entry


# ---------------------------------------------------------------------------
# _parse_published_date
# ---------------------------------------------------------------------------

class TestParsePublishedDate:
    def test_struct_time(self):
        """published_parsed struct_time is converted to UTC datetime."""
        import time
        struct = time.strptime("2024-06-15 10:30:00", "%Y-%m-%d %H:%M:%S")
        entry = MagicMock()
        entry.published_parsed = struct
        entry.updated_parsed = None
        entry.published = None
        entry.updated = None
        entry.get = lambda k, d=None: None

        result = _parse_published_date(entry)
        assert result is not None
        assert isinstance(result, datetime)
        assert result.tzinfo is not None  # timezone-aware

    def test_rfc2822_string(self):
        """Raw RFC-2822 date string is parsed correctly."""
        entry = MagicMock()
        entry.published_parsed = None
        entry.updated_parsed = None
        entry.published = "Sat, 15 Jun 2024 10:30:00 +0700"
        entry.updated = None
        entry.get = lambda k, d=None: {
            "published": "Sat, 15 Jun 2024 10:30:00 +0700"
        }.get(k, d)

        result = _parse_published_date(entry)
        assert result is not None
        assert result.year == 2024
        assert result.month == 6
        assert result.day == 15

    def test_no_date_returns_none(self):
        """Entry with no date fields returns None."""
        entry = MagicMock()
        entry.published_parsed = None
        entry.updated_parsed = None
        entry.published = None
        entry.updated = None
        entry.get = lambda k, d=None: None

        assert _parse_published_date(entry) is None


# ---------------------------------------------------------------------------
# crawl_rss_source
# ---------------------------------------------------------------------------

class TestCrawlRssSource:
    @pytest.mark.asyncio
    async def test_returns_entries(self):
        """Valid feed returns list of dicts with url, title, published_at."""
        entries = [
            _make_entry(
                link="https://vnexpress.net/a1",
                title="Article 1",
                published="Mon, 10 Jun 2024 08:00:00 +0000",
            ),
            _make_entry(
                link="https://vnexpress.net/a2",
                title="Article 2",
            ),
        ]
        fake_feed = _make_feed(entries)

        with patch("services.crawler.feedparser.parse", return_value=fake_feed):
            result = await crawl_rss_source(
                "https://vnexpress.net/rss", "vnexpress"
            )

        assert len(result) == 2
        assert result[0]["url"] == "https://vnexpress.net/a1"
        assert result[0]["title"] == "Article 1"
        assert result[0]["published_at"] is not None
        assert result[1]["published_at"] is None

    @pytest.mark.asyncio
    async def test_empty_feed(self):
        """Feed with no entries returns empty list."""
        fake_feed = _make_feed([])
        with patch("services.crawler.feedparser.parse", return_value=fake_feed):
            result = await crawl_rss_source("https://example.com/rss", "test")
        assert result == []

    @pytest.mark.asyncio
    async def test_malformed_feed_no_entries(self):
        """Malformed feed with no entries returns empty list."""
        fake_feed = _make_feed([], bozo=True, bozo_exception="bad xml")
        with patch("services.crawler.feedparser.parse", return_value=fake_feed):
            result = await crawl_rss_source("https://bad.com/rss", "bad")
        assert result == []

    @pytest.mark.asyncio
    async def test_malformed_feed_with_entries(self):
        """Malformed feed that still has entries returns those entries."""
        entries = [_make_entry(link="https://example.com/a1", title="OK")]
        fake_feed = _make_feed(entries, bozo=True)
        with patch("services.crawler.feedparser.parse", return_value=fake_feed):
            result = await crawl_rss_source("https://example.com/rss", "test")
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_network_error_returns_empty(self):
        """Network/exception during fetch returns empty list."""
        with patch(
            "services.crawler.feedparser.parse",
            side_effect=Exception("connection refused"),
        ):
            result = await crawl_rss_source("https://down.com/rss", "down")
        assert result == []

    @pytest.mark.asyncio
    async def test_skips_entries_without_link(self):
        """Entries missing a link are skipped."""
        entries = [
            _make_entry(link="", title="No Link"),
            _make_entry(link="https://example.com/ok", title="Has Link"),
        ]
        fake_feed = _make_feed(entries)
        with patch("services.crawler.feedparser.parse", return_value=fake_feed):
            result = await crawl_rss_source("https://example.com/rss", "test")
        assert len(result) == 1
        assert result[0]["url"] == "https://example.com/ok"

    @pytest.mark.asyncio
    async def test_each_entry_has_required_keys(self):
        """Every returned dict has url, title, published_at keys."""
        entries = [_make_entry()]
        fake_feed = _make_feed(entries)
        with patch("services.crawler.feedparser.parse", return_value=fake_feed):
            result = await crawl_rss_source("https://example.com/rss", "test")
        for item in result:
            assert "url" in item
            assert "title" in item
            assert "published_at" in item
