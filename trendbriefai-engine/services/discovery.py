"""Resource Discovery Service — auto-find new Vietnamese news sources.

Strategies:
1. RSS auto-detect: fetch HTML, find <link rel="alternate" type="application/rss+xml">
2. Backlink mining: extract outbound domains from crawled articles
3. Google News VN scan: find popular VN domains from Google News feed
4. Quality gate: only propose sources with quality score > threshold

Discovered sources are stored with `is_active: false` for admin review.
Runs weekly via cron or manual trigger via API.
"""

import asyncio
import hashlib
import logging
import re
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from config import settings
from services.quality_scorer import ContentQualityScorer

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "TrendBrief/1.0 (resource-discovery)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
}

_GOOGLE_NEWS_VN_RSS = "https://news.google.com/rss?hl=vi&gl=VN&ceid=VN:vi"

# Domains to skip (aggregators, social, non-news)
_SKIP_DOMAINS = {
    "google.com", "facebook.com", "youtube.com", "tiktok.com",
    "twitter.com", "x.com", "instagram.com", "zalo.me",
    "play.google.com", "apps.apple.com", "wikipedia.org",
    "baomoi.com",  # aggregator, not original source
}

# Known VN TLDs and patterns
_VN_DOMAIN_PATTERNS = re.compile(
    r"\.(vn|com\.vn|net\.vn|org\.vn|gov\.vn|edu\.vn)$", re.IGNORECASE
)

_quality_scorer = ContentQualityScorer()


# ─── Helpers ───────────────────────────────────────────────


def _extract_domain(url: str) -> str:
    """Extract clean domain from URL."""
    parsed = urlparse(url)
    return parsed.netloc.lower().removeprefix("www.")


def _is_vn_domain(domain: str) -> bool:
    """Check if domain is Vietnamese."""
    return bool(_VN_DOMAIN_PATTERNS.search(domain))


def _is_skip_domain(domain: str) -> bool:
    """Check if domain should be skipped."""
    for skip in _SKIP_DOMAINS:
        if domain == skip or domain.endswith("." + skip):
            return True
    return False


def _domain_to_name(domain: str) -> str:
    """Convert domain to human-readable name. e.g. 'cafef.vn' → 'CafeF'."""
    name = domain.split(".")[0]
    return name.replace("-", " ").title()


# ─── Strategy 1: RSS Auto-Detect ──────────────────────────


async def detect_rss_feeds(url: str, client: httpx.AsyncClient) -> list[dict]:
    """Fetch a URL and find RSS feed links in the HTML <head>.

    Returns list of {url, title} for each discovered feed.
    """
    feeds = []
    try:
        resp = await client.get(url, follow_redirects=True)
        if resp.status_code != 200:
            return feeds

        soup = BeautifulSoup(resp.text, "html.parser")

        # Find <link rel="alternate" type="application/rss+xml">
        for link in soup.find_all("link", rel="alternate"):
            link_type = (link.get("type") or "").lower()
            if "rss" in link_type or "atom" in link_type or "xml" in link_type:
                href = link.get("href", "").strip()
                if href:
                    full_url = urljoin(url, href)
                    title = link.get("title", "").strip()
                    feeds.append({"url": full_url, "title": title})

        # Common RSS URL patterns to try if none found in HTML
        if not feeds:
            domain = _extract_domain(url)
            common_paths = [
                "/rss", "/rss/home.rss", "/rss/tin-moi-nhat.rss",
                "/feed", "/feed/rss", "/atom.xml", "/rss.xml",
            ]
            for path in common_paths:
                rss_url = f"https://{domain}{path}"
                try:
                    r = await client.head(rss_url, follow_redirects=True)
                    ct = (r.headers.get("content-type") or "").lower()
                    if r.status_code == 200 and ("xml" in ct or "rss" in ct):
                        feeds.append({"url": rss_url, "title": f"{domain} RSS"})
                        break
                except Exception:
                    continue

    except Exception:
        logger.debug("RSS detect failed for %s", url)

    return feeds


# ─── Strategy 2: Backlink Mining ──────────────────────────


async def mine_backlinks_from_articles(db) -> Counter:
    """Scan recent articles for outbound links to VN domains.

    Returns Counter of {domain: count} for domains not already in rss_sources.
    """
    domain_counter: Counter = Counter()

    # Get recent articles (last 7 days)
    cutoff = datetime.now(timezone.utc)
    cutoff = cutoff.replace(day=cutoff.day - 7) if cutoff.day > 7 else cutoff.replace(month=cutoff.month - 1, day=28)

    articles_col = db["articles"]
    cursor = articles_col.find(
        {"created_at": {"$gte": cutoff}, "content_clean": {"$exists": True}},
        {"content_clean": 1, "url": 1},
    ).limit(500)

    async for article in cursor:
        content = article.get("content_clean", "")
        source_domain = _extract_domain(article.get("url", ""))

        # Extract URLs from content
        urls_in_content = re.findall(r"https?://[^\s<>\"']+", content)
        for u in urls_in_content:
            domain = _extract_domain(u)
            if (
                domain
                and domain != source_domain
                and _is_vn_domain(domain)
                and not _is_skip_domain(domain)
            ):
                domain_counter[domain] += 1

    # Filter: only domains mentioned 3+ times
    return Counter({d: c for d, c in domain_counter.items() if c >= 3})


# ─── Strategy 3: Google News VN Scan ──────────────────────


async def scan_google_news_vn(client: httpx.AsyncClient) -> Counter:
    """Parse Google News Vietnam RSS to find popular VN source domains.

    Returns Counter of {domain: article_count}.
    """
    domain_counter: Counter = Counter()

    try:
        resp = await client.get(_GOOGLE_NEWS_VN_RSS)
        if resp.status_code != 200:
            logger.warning("Google News VN RSS returned %d", resp.status_code)
            return domain_counter

        soup = BeautifulSoup(resp.text, "xml")
        items = soup.find_all("item")

        for item in items:
            link = item.find("link")
            if link and link.string:
                # Google News redirects — try to extract real domain from source tag
                source_tag = item.find("source")
                if source_tag and source_tag.get("url"):
                    domain = _extract_domain(source_tag["url"])
                else:
                    domain = _extract_domain(link.string)

                if domain and _is_vn_domain(domain) and not _is_skip_domain(domain):
                    domain_counter[domain] += 1

    except Exception:
        logger.exception("Google News VN scan failed")

    return domain_counter


# ─── Strategy 4: Quality Probe ─────────────────────────────


async def probe_source_quality(
    url: str, client: httpx.AsyncClient, min_articles: int = 3
) -> dict:
    """Fetch a source URL, extract articles, score quality.

    Returns {avg_quality, article_count, sample_titles}.
    """
    try:
        resp = await client.get(url, follow_redirects=True)
        if resp.status_code != 200:
            return {"avg_quality": 0, "article_count": 0, "sample_titles": []}

        soup = BeautifulSoup(resp.text, "html.parser")

        # Try common article selectors
        selectors = ["h3 a", "h2 a", "article a", ".title a", "h4 a"]
        articles = []
        for sel in selectors:
            found = soup.select(sel)
            if len(found) >= min_articles:
                articles = found[:10]
                break

        if len(articles) < min_articles:
            return {"avg_quality": 0, "article_count": len(articles), "sample_titles": []}

        # Probe first 3 articles for quality
        scores = []
        titles = []
        for a_tag in articles[:3]:
            href = a_tag.get("href", "")
            if not href:
                continue
            full_url = urljoin(url, href)
            title = a_tag.get_text(strip=True)
            titles.append(title)

            try:
                await asyncio.sleep(1)  # polite delay
                art_resp = await client.get(full_url, follow_redirects=True)
                if art_resp.status_code == 200:
                    art_soup = BeautifulSoup(art_resp.text, "html.parser")
                    # Extract text from common content containers
                    for content_sel in ["article", "div.article-content", "div.detail-content", "div.content", "div.entry-content"]:
                        el = art_soup.select_one(content_sel)
                        if el and len(el.get_text(strip=True)) > 200:
                            signals = _quality_scorer.score(el.get_text(strip=True))
                            scores.append(signals.overall)
                            break
            except Exception:
                continue

        avg_quality = sum(scores) / len(scores) if scores else 0

        return {
            "avg_quality": round(avg_quality, 3),
            "article_count": len(articles),
            "sample_titles": titles[:5],
        }

    except Exception:
        logger.debug("Quality probe failed for %s", url)
        return {"avg_quality": 0, "article_count": 0, "sample_titles": []}


# ─── Main Discovery Pipeline ──────────────────────────────


async def discover_new_sources(
    db,
    quality_threshold: float = 0.4,
    max_discoveries: int = 20,
) -> list[dict]:
    """Run full discovery pipeline. Returns list of discovered source candidates.

    Steps:
    1. Get existing source domains (to skip)
    2. Google News VN scan → find popular domains
    3. Backlink mining from recent articles → find referenced domains
    4. Merge + deduplicate candidates
    5. For each candidate: RSS auto-detect + quality probe
    6. Store qualified sources in DB with is_active=false

    Returns list of {domain, rss_url, quality, article_count, source} dicts.
    """
    logger.info("🔍 Starting resource discovery pipeline...")

    # Step 1: Get existing domains
    sources_col = db["rss_sources"]
    existing_domains: set[str] = set()
    async for src in sources_col.find({}, {"url": 1}):
        existing_domains.add(_extract_domain(src["url"]))
    logger.info("Existing sources: %d domains", len(existing_domains))

    async with httpx.AsyncClient(
        headers=_HEADERS,
        timeout=httpx.Timeout(20.0),
        follow_redirects=True,
    ) as client:

        # Step 2: Google News VN scan
        google_domains = await scan_google_news_vn(client)
        logger.info("Google News VN: found %d VN domains", len(google_domains))

        # Step 3: Backlink mining
        backlink_domains = await mine_backlinks_from_articles(db)
        logger.info("Backlink mining: found %d referenced domains", len(backlink_domains))

        # Step 4: Merge candidates (union, sum counts)
        all_candidates: Counter = Counter()
        all_candidates.update(google_domains)
        all_candidates.update(backlink_domains)

        # Remove already-known domains
        for domain in existing_domains:
            all_candidates.pop(domain, None)

        # Sort by mention count (most popular first)
        ranked = all_candidates.most_common(max_discoveries * 2)
        logger.info("Candidate domains after dedup: %d", len(ranked))

        # Step 5: Probe each candidate
        discoveries = []
        for domain, mention_count in ranked:
            if len(discoveries) >= max_discoveries:
                break

            base_url = f"https://{domain}"
            logger.info("Probing %s (mentions: %d)...", domain, mention_count)

            # RSS auto-detect
            feeds = await detect_rss_feeds(base_url, client)
            rss_url = feeds[0]["url"] if feeds else None

            # Quality probe
            quality = await probe_source_quality(base_url, client)

            if quality["avg_quality"] < quality_threshold:
                logger.info("  ❌ %s — quality %.3f below threshold", domain, quality["avg_quality"])
                continue

            source_type = "rss" if rss_url else "html_scrape"
            crawl_url = rss_url or base_url

            discovery = {
                "domain": domain,
                "name": _domain_to_name(domain),
                "url": crawl_url,
                "source_type": source_type,
                "rss_detected": rss_url is not None,
                "mention_count": mention_count,
                "avg_quality": quality["avg_quality"],
                "article_count": quality["article_count"],
                "sample_titles": quality["sample_titles"],
                "discovered_at": datetime.now(timezone.utc),
                "discovered_via": [],
            }

            if domain in google_domains:
                discovery["discovered_via"].append("google_news")
            if domain in backlink_domains:
                discovery["discovered_via"].append("backlink")

            discoveries.append(discovery)
            logger.info(
                "  ✅ %s — quality %.3f, %d articles, type=%s",
                domain, quality["avg_quality"], quality["article_count"], source_type,
            )

            await asyncio.sleep(1)  # polite delay between probes

        # Step 6: Store in DB as inactive sources (for admin review)
        stored = 0
        for d in discoveries:
            # Check not already stored from a previous discovery run
            existing = await sources_col.find_one({"url": d["url"]})
            if existing:
                continue

            source_doc = {
                "name": f"[NEW] {d['name']}",
                "url": d["url"],
                "category": None,  # admin assigns topic
                "source_type": d["source_type"],
                "is_active": False,  # requires admin approval
                "crawl_interval_minutes": 30,
                "last_crawled_at": None,
                "created_at": datetime.now(timezone.utc),
                # Discovery metadata
                "discovery_meta": {
                    "domain": d["domain"],
                    "rss_detected": d["rss_detected"],
                    "mention_count": d["mention_count"],
                    "avg_quality": d["avg_quality"],
                    "article_count": d["article_count"],
                    "sample_titles": d["sample_titles"],
                    "discovered_via": d["discovered_via"],
                    "discovered_at": d["discovered_at"].isoformat(),
                },
            }
            await sources_col.insert_one(source_doc)
            stored += 1

        logger.info(
            "🔍 Discovery complete: %d candidates probed, %d qualified, %d stored",
            len(ranked), len(discoveries), stored,
        )

    return discoveries
