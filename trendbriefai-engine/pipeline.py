"""Full ingestion pipeline: crawl → clean → summarize → classify → dedup → store."""

import asyncio
import logging
from datetime import datetime

from db.connection import get_db
from services.crawler import crawl_rss_source
from services.scraper import crawl_html_source
from services.cleaner import extract_and_clean
from services.summarizer import generate_summary
from services.classifier import classify_topic
from services.dedup import deduplicate_article, url_hash

logger = logging.getLogger(__name__)


async def _fetch_entries(
    source_url: str,
    source_name: str,
    source_type: str = "rss",
    scrape_link_selector: str | None = None,
) -> list[dict]:
    """Dispatch to the right crawler based on source_type."""
    if source_type == "html_scrape":
        return await crawl_html_source(
            source_url,
            source_name,
            link_selector=scrape_link_selector or "a[href]",
        )
    # Default: RSS
    return await crawl_rss_source(source_url, source_name)


async def run_ingestion_pipeline(
    source_url: str,
    source_name: str,
    source_type: str = "rss",
    scrape_link_selector: str | None = None,
) -> dict:
    """Full pipeline: crawl → for each entry: clean → summarize → classify → dedup → store.

    Returns ``{"new": int, "duplicate": int, "failed": int}``.
    """
    db = get_db()
    articles_col = db["articles"]

    stats = {"new": 0, "duplicate": 0, "failed": 0}

    # Step 1: Fetch entries (RSS or HTML scrape)
    entries = await _fetch_entries(source_url, source_name, source_type, scrape_link_selector)
    logger.info("Pipeline: %d entries from '%s' (type=%s)", len(entries), source_name, source_type)

    for entry in entries:
        entry_url = entry["url"]
        try:
            # Step 2a: Quick URL hash dedup (O(1) skip)
            hash_val = url_hash(entry_url)
            existing = await articles_col.find_one({"url_hash": hash_val})
            if existing is not None:
                stats["duplicate"] += 1
                continue

            # Step 2b: Extract and clean article
            cleaned = await extract_and_clean(entry_url)
            if cleaned is None or len(cleaned["text"]) < 100:
                stats["failed"] += 1
                continue

            clean_text = cleaned["text"]
            title = cleaned["title"] or entry.get("title", "")

            # Step 2c: AI summarization
            summary = await generate_summary(clean_text)
            # Determine processing status based on whether AI or fallback was used
            processing_status = "done"
            if summary.get("title_ai", "") == clean_text[:80] or summary.get("reason") == "Đây là tin tức đáng chú ý mà bạn nên biết.":
                processing_status = "fallback"

            # Step 2d: Topic classification
            topic = await classify_topic(clean_text, title)

            # Step 2e: Full dedup (URL hash + title similarity + embedding)
            dedup_result = await deduplicate_article(
                db,
                entry_url,
                title,
                clean_text,
            )

            if dedup_result["is_duplicate"]:
                stats["duplicate"] += 1
                continue

            # Step 2f: Store in MongoDB
            article_doc = {
                "url": entry_url,
                "url_hash": hash_val,
                "title_original": title,
                "title_ai": summary["title_ai"],
                "summary_bullets": summary["summary_bullets"],
                "reason": summary["reason"],
                "content_clean": clean_text,
                "topic": topic,
                "source": source_name,
                "published_at": entry.get("published_at") or cleaned.get("published_at"),
                "embedding": dedup_result.get("embedding"),
                "cluster_id": dedup_result.get("cluster_id"),
                "processing_status": processing_status,
                "created_at": datetime.utcnow(),
            }
            await articles_col.insert_one(article_doc)
            stats["new"] += 1

        except Exception:
            logger.exception("Failed to process entry %s", entry_url)
            stats["failed"] += 1

        # Polite crawl delay between entries to avoid IP blocking by news sites.
        await asyncio.sleep(1.5)

    logger.info(
        "Pipeline complete for '%s': new=%d, duplicate=%d, failed=%d",
        source_name, stats["new"], stats["duplicate"], stats["failed"],
    )
    return stats
