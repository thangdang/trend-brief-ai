"""Full ingestion pipeline: crawl → clean → summarize → classify → dedup → store.

Supports concurrent processing with semaphore-controlled concurrency,
quality scoring gate, summarizer caching, and FAISS-accelerated dedup.
"""

import asyncio
import logging
from datetime import datetime

from config import settings
from db.connection import get_db
from services.crawler import crawl_rss_source
from services.scraper import crawl_html_source
from services.cleaner import extract_and_clean
from services.summarizer import generate_summary
from services.classifier import classify_topic
from services.dedup import deduplicate_article, url_hash
from services.quality_scorer import ContentQualityScorer

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
    return await crawl_rss_source(source_url, source_name)


async def _process_single_article(
    entry: dict,
    db,
    semaphore: asyncio.Semaphore,
    rate_limiter: asyncio.Lock,
    rate_delay: float,
    cache=None,
    faiss_index=None,
    quality_scorer: ContentQualityScorer | None = None,
    redis_cache=None,
) -> str:
    """Process one article. Returns 'new', 'duplicate', or 'failed'."""
    entry_url = entry["url"]

    async with semaphore:
        try:
            articles_col = db["articles"]

            # Rate limit: acquire lock, sleep, release
            async with rate_limiter:
                await asyncio.sleep(rate_delay)

            # Step 1: Quick URL hash dedup (O(1) skip)
            hash_val = url_hash(entry_url)
            existing = await articles_col.find_one({"url_hash": hash_val})
            if existing is not None:
                return "duplicate"

            # Step 2: Extract and clean article
            cleaned = await extract_and_clean(entry_url)
            if cleaned is None or len(cleaned["text"]) < 100:
                return "failed"

            clean_text = cleaned["text"]
            title = cleaned["title"] or entry.get("title", "")

            # Step 3: Quality scoring gate
            if quality_scorer is not None:
                signals = quality_scorer.score(clean_text)
                if signals.overall < settings.quality_score_threshold:
                    logger.info(
                        "Skipping %s — quality score %.3f below threshold %.3f",
                        entry_url, signals.overall, settings.quality_score_threshold,
                    )
                    # Store as failed
                    article_doc = {
                        "url": entry_url,
                        "url_hash": hash_val,
                        "title_original": title,
                        "content_clean": clean_text,
                        "processing_status": "failed",
                        "quality_score": signals.overall,
                        "source": entry.get("source", ""),
                        "created_at": datetime.utcnow(),
                    }
                    await articles_col.insert_one(article_doc)
                    return "failed"

            # Step 4: AI summarization (with cache)
            summary = await generate_summary(clean_text, cache=cache)
            processing_status = "done"
            if summary.get("from_cache"):
                processing_status = "cached"
            elif (
                summary.get("title_ai", "") == clean_text[:80]
                or summary.get("reason") == "Đây là tin tức đáng chú ý mà bạn nên biết."
            ):
                processing_status = "fallback"

            # Step 5: Topic classification (with Redis cache)
            topic = await classify_topic(clean_text, title)
            if redis_cache is not None:
                import hashlib
                content_hash = hashlib.sha256(clean_text[:4000].encode()).hexdigest()
                await redis_cache.put_classification(content_hash, topic)

            # Step 6: Full dedup (URL hash + title similarity + embedding)
            dedup_result = await deduplicate_article(
                db, entry_url, title, clean_text,
                faiss_index=faiss_index,
            )

            if dedup_result["is_duplicate"]:
                return "duplicate"

            # Step 7: Store in MongoDB
            article_doc = {
                "url": entry_url,
                "url_hash": hash_val,
                "title_original": title,
                "title_ai": summary.get("title_ai", ""),
                "summary_bullets": summary.get("summary_bullets", []),
                "reason": summary.get("reason", ""),
                "content_clean": clean_text,
                "topic": topic,
                "source": entry.get("source", ""),
                "published_at": entry.get("published_at") or cleaned.get("published_at"),
                "embedding": dedup_result.get("embedding"),
                "cluster_id": dedup_result.get("cluster_id"),
                "processing_status": processing_status,
                "created_at": datetime.utcnow(),
            }
            await articles_col.insert_one(article_doc)
            return "new"

        except Exception:
            logger.exception("Failed to process entry %s", entry_url)
            return "failed"


async def run_ingestion_pipeline(
    source_url: str,
    source_name: str,
    source_type: str = "rss",
    scrape_link_selector: str | None = None,
    concurrency_limit: int | None = None,
    rate_limit_delay: float | None = None,
) -> dict:
    """Concurrent pipeline: crawl → for each entry concurrently: clean → quality → cache → summarize → classify → dedup → store.

    Returns ``{"new": int, "duplicate": int, "failed": int}``.
    """
    db = get_db()
    concurrency = concurrency_limit or settings.pipeline_concurrency_limit
    rate_delay = rate_limit_delay if rate_limit_delay is not None else settings.pipeline_rate_limit_delay

    # Initialize components
    semaphore = asyncio.Semaphore(concurrency)
    rate_limiter = asyncio.Lock()
    quality_scorer = ContentQualityScorer()

    # Optional: initialize caches (best-effort)
    cache = None
    redis_cache = None
    faiss_index = None

    try:
        from services.cache.redis_cache import RedisAICache
        from services.cache.summarizer_cache import SummarizerCache
        redis_cache = RedisAICache(settings.redis_url, settings.redis_ai_cache_ttl)
        await redis_cache.connect()
        cache = SummarizerCache(
            max_lru_size=settings.lru_cache_max_size,
            redis_cache=redis_cache,
        )
    except Exception:
        logger.warning("Cache initialization failed — proceeding without cache")

    try:
        from services.dedup.faiss_index import FAISSIndex
        faiss_index = FAISSIndex()
    except Exception:
        logger.warning("FAISS initialization failed — using brute-force dedup")

    # Fetch entries
    entries = await _fetch_entries(source_url, source_name, source_type, scrape_link_selector)
    logger.info("Pipeline: %d entries from '%s' (type=%s, concurrency=%d)",
                len(entries), source_name, source_type, concurrency)

    # Process all entries concurrently
    tasks = [
        _process_single_article(
            entry, db, semaphore, rate_limiter, rate_delay,
            cache=cache, faiss_index=faiss_index,
            quality_scorer=quality_scorer, redis_cache=redis_cache,
        )
        for entry in entries
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Aggregate stats
    stats = {"new": 0, "duplicate": 0, "failed": 0}
    for r in results:
        if isinstance(r, Exception):
            logger.exception("Unexpected pipeline error: %s", r)
            stats["failed"] += 1
        elif r in stats:
            stats[r] += 1
        else:
            stats["failed"] += 1

    # Cleanup
    if redis_cache is not None:
        try:
            await redis_cache.close()
        except Exception:
            pass

    logger.info(
        "Pipeline complete for '%s': new=%d, duplicate=%d, failed=%d",
        source_name, stats["new"], stats["duplicate"], stats["failed"],
    )
    return stats
