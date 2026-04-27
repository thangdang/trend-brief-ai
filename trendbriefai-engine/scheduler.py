"""
Independent Crawl Scheduler — runs in the AI engine, no service dependency.

Reads RSS sources from MongoDB, crawls on schedule, writes results back.
All AI processing (summarize, classify, dedup, embed) happens locally.

Usage:
  python scheduler.py

Schedule:
  - Crawl all active sources: every 10 minutes
  - Source discovery: every Sunday 3:00 AM
  - FAISS index rebuild: every 6 hours
"""

import asyncio
import logging
import signal
import sys
from datetime import datetime, timedelta

from config import settings
from db.connection import connect_db, close_db, get_db
from pipeline import run_ingestion_pipeline

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("scheduler")

CRAWL_INTERVAL_MINUTES = int(__import__("os").environ.get("CRAWL_INTERVAL_MINUTES", "10"))
_running = True


async def crawl_all_sources():
    """Read active RSS sources from MongoDB, crawl each one."""
    db = get_db()
    sources_col = db["rss_sources"]

    sources = await sources_col.find({"is_active": True}).to_list(200)
    logger.info(f"Found {len(sources)} active RSS sources")

    processed = 0
    for source in sources:
        name = source.get("name", "unknown")
        url = source.get("url", "")
        if not url:
            continue

        # Skip auto-disabled sources
        health = source.get("health", {})
        if health.get("auto_disabled"):
            disabled_until = health.get("disabled_until")
            if disabled_until and disabled_until > datetime.utcnow():
                logger.info(f"Skipping auto-disabled: {name} (until {disabled_until})")
                continue
            else:
                # Re-enable
                await sources_col.update_one(
                    {"_id": source["_id"]},
                    {"$set": {
                        "health.auto_disabled": False,
                        "health.disabled_until": None,
                        "health.consecutive_failures": 0,
                    }},
                )
                logger.info(f"Re-enabled source: {name}")

        try:
            stats = await run_ingestion_pipeline(
                source_url=url,
                source_name=name,
                source_type=source.get("source_type", "rss"),
                scrape_link_selector=source.get("scrape_link_selector"),
                concurrency_limit=settings.pipeline_concurrency_limit,
                rate_limit_delay=settings.pipeline_rate_limit_delay,
            )

            # Update health: success
            await sources_col.update_one(
                {"_id": source["_id"]},
                {"$set": {
                    "last_crawled_at": datetime.utcnow(),
                    "health.last_successful_at": datetime.utcnow(),
                    "health.consecutive_failures": 0,
                }, "$inc": {
                    "health.success_count_24h": 1,
                    "health.total_count_24h": 1,
                }},
            )
            processed += 1
            logger.info(f"Crawled {name}: new={stats.get('new', 0)} dup={stats.get('duplicate', 0)} fail={stats.get('failed', 0)}")

        except Exception as e:
            # Update health: failure
            consecutive = health.get("consecutive_failures", 0) + 1
            total = health.get("total_count_24h", 0) + 1
            success = health.get("success_count_24h", 0)
            rate = success / max(total, 1)

            update: dict = {
                "health.consecutive_failures": consecutive,
                "health.total_count_24h": total,
                "health.success_rate": rate,
                "health.last_error": str(e)[:200],
            }

            # Auto-disable if success rate < 10% after 5+ attempts
            if total >= 5 and rate < 0.1:
                update["health.auto_disabled"] = True
                update["health.disabled_until"] = datetime.utcnow() + timedelta(hours=24)
                logger.warning(f"Auto-disabled {name} (success_rate: {rate:.0%})")

            if consecutive >= 5:
                logger.warning(f"⚠️ {name} has {consecutive} consecutive failures")

            await sources_col.update_one({"_id": source["_id"]}, {"$set": update})
            logger.error(f"Failed to crawl {name}: {e}")

    logger.info(f"Crawl cycle complete: {processed}/{len(sources)} sources")


async def run_discovery():
    """Weekly source discovery — find new Vietnamese news sources."""
    try:
        from services.discovery import discover_new_sources
        db = get_db()
        discoveries = await discover_new_sources(db)
        stored = sum(1 for d in discoveries if d.get("avg_quality", 0) > 0)
        logger.info(f"Discovery complete: {len(discoveries)} found, {stored} stored")
    except Exception as e:
        logger.error(f"Discovery failed: {e}")


async def rebuild_faiss():
    """Rebuild FAISS index from article embeddings."""
    try:
        from services.dedup import rebuild_faiss_index
        db = get_db()
        count = await rebuild_faiss_index(db)
        logger.info(f"FAISS index rebuilt: {count} vectors")
    except Exception as e:
        logger.error(f"FAISS rebuild failed: {e}")


async def scheduler_loop():
    """Main scheduler loop — runs crawl every N minutes, discovery weekly, FAISS every 6h."""
    await connect_db()
    logger.info(f"Scheduler started — crawl every {CRAWL_INTERVAL_MINUTES}min")

    # Initial crawl on startup
    await crawl_all_sources()

    last_discovery = datetime.utcnow()
    last_faiss_rebuild = datetime.utcnow()

    while _running:
        await asyncio.sleep(CRAWL_INTERVAL_MINUTES * 60)
        if not _running:
            break

        # Regular crawl
        await crawl_all_sources()

        # Weekly discovery (every 7 days)
        if (datetime.utcnow() - last_discovery).days >= 7:
            await run_discovery()
            last_discovery = datetime.utcnow()

        # FAISS rebuild (every 6 hours)
        if (datetime.utcnow() - last_faiss_rebuild).total_seconds() >= 6 * 3600:
            await rebuild_faiss()
            last_faiss_rebuild = datetime.utcnow()

    await close_db()
    logger.info("Scheduler stopped")


def main():
    def shutdown(signum, frame):
        global _running
        logger.info(f"Received signal {signum}, shutting down...")
        _running = False

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    logger.info("=" * 50)
    logger.info("  TrendBrief AI — Independent Scheduler")
    logger.info("  Reads sources from MongoDB, crawls + AI locally")
    logger.info("  No service dependency")
    logger.info("=" * 50)

    asyncio.run(scheduler_loop())


if __name__ == "__main__":
    main()
