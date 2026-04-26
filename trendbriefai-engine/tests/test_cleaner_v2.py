"""Tests for cleaner v2 — trafilatura, image validation, date parsing."""
import pytest
from services.cleaner import clean_html, clean_vietnamese_artifacts, _parse_date, _validate_image


class TestCleanHtml:
    def test_strips_script_tags(self):
        html = '<p>Hello</p><script>alert("x")</script><p>World</p>'
        assert 'alert' not in clean_html(html)
        assert 'Hello' in clean_html(html)

    def test_strips_nav_elements(self):
        html = '<nav>Menu</nav><article>Content here</article>'
        result = clean_html(html)
        assert 'Content here' in result

    def test_strips_ad_classes(self):
        html = '<div class="advertisement">Ad</div><p>Real content</p>'
        result = clean_html(html)
        assert 'Ad' not in result
        assert 'Real content' in result

    def test_normalizes_whitespace(self):
        html = '<p>Hello    World</p>'
        result = clean_html(html)
        assert '    ' not in result

    def test_empty_input(self):
        assert clean_html('') == ''
        assert clean_html(None) == ''


class TestVietnameseArtifacts:
    def test_removes_read_more(self):
        text = 'Nội dung bài viết.\nĐọc thêm: bài viết liên quan'
        result = clean_vietnamese_artifacts(text)
        assert 'Đọc thêm' not in result

    def test_removes_source_attribution(self):
        text = 'Nội dung.\nTheo: VnExpress'
        result = clean_vietnamese_artifacts(text)
        assert 'Theo:' not in result

    def test_removes_share_buttons(self):
        text = 'Nội dung.\nChia sẻ Facebook Twitter Zalo'
        result = clean_vietnamese_artifacts(text)
        assert 'Chia sẻ Facebook' not in result


class TestDateParsing:
    def test_iso_format(self):
        result = _parse_date('2024-01-15T10:30:00')
        assert result is not None
        assert result.year == 2024

    def test_iso_with_z(self):
        result = _parse_date('2024-01-15T10:30:00Z')
        assert result is not None

    def test_vietnamese_date(self):
        result = _parse_date('15/01/2024 10:30')
        assert result is not None
        assert result.day == 15

    def test_rss_pubdate(self):
        result = _parse_date('Mon, 15 Jan 2024 10:30:00 GMT')
        assert result is not None

    def test_date_only(self):
        result = _parse_date('2024-01-15')
        assert result is not None

    def test_none_input(self):
        assert _parse_date(None) is None

    def test_invalid_string(self):
        assert _parse_date('not a date') is None

    def test_datetime_passthrough(self):
        from datetime import datetime
        dt = datetime(2024, 1, 15)
        assert _parse_date(dt) == dt


class TestImageValidation:
    @pytest.mark.asyncio
    async def test_none_url(self):
        result = await _validate_image(None)
        assert result is None

    @pytest.mark.asyncio
    async def test_empty_url(self):
        result = await _validate_image('')
        assert result is None

    @pytest.mark.asyncio
    async def test_non_http_url(self):
        result = await _validate_image('ftp://example.com/img.jpg')
        assert result is None


class TestRateLimiter:
    @pytest.mark.asyncio
    async def test_per_domain_delay(self):
        import time
        from services.rate_limiter import wait_for_domain, _domain_timestamps

        _domain_timestamps.clear()
        await wait_for_domain('https://example.com/page1', min_delay=0.1)
        t1 = time.time()
        await wait_for_domain('https://example.com/page2', min_delay=0.1)
        t2 = time.time()
        assert t2 - t1 >= 0.09  # at least 0.1s delay

    @pytest.mark.asyncio
    async def test_different_domains_no_delay(self):
        import time
        from services.rate_limiter import wait_for_domain, _domain_timestamps

        _domain_timestamps.clear()
        await wait_for_domain('https://a.com/page', min_delay=0.5)
        t1 = time.time()
        await wait_for_domain('https://b.com/page', min_delay=0.5)
        t2 = time.time()
        assert t2 - t1 < 0.1  # different domain, no delay

    def test_domain_stats(self):
        from services.rate_limiter import get_domain_stats
        stats = get_domain_stats()
        assert 'tracked_domains' in stats
