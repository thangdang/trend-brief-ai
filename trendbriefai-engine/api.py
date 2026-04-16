"""FastAPI application — AI service entry point."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from config import settings
from db.connection import connect_db, close_db, get_db
from pipeline import run_ingestion_pipeline
from services.cleaner import clean_html
from services.classifier import classify_topic
from services.dedup import deduplicate_article, url_hash
from services.summarizer import generate_summary

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class CrawlRequest(BaseModel):
    source_url: str
    source_name: str
    source_type: str = "rss"
    scrape_link_selector: str | None = None


class CrawlResponse(BaseModel):
    new: int
    duplicate: int
    failed: int


class ProcessRequest(BaseModel):
    url: str
    title: str
    content_raw: str


class ProcessResponse(BaseModel):
    title_ai: str
    summary_bullets: list[str]
    reason: str
    topic: str
    content_clean: str
    processing_status: str


class DedupCheckRequest(BaseModel):
    url: str
    title: str
    content: str


class DedupCheckResponse(BaseModel):
    is_duplicate: bool
    cluster_id: str | None = None


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="TrendBrief AI Service",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}


@app.post("/crawl", response_model=CrawlResponse)
async def crawl(req: CrawlRequest):
    """Trigger full ingestion pipeline for an RSS source."""
    try:
        stats = await run_ingestion_pipeline(
            req.source_url,
            req.source_name,
            source_type=req.source_type,
            scrape_link_selector=req.scrape_link_selector,
        )
        return CrawlResponse(**stats)
    except Exception:
        logger.exception("Crawl failed for %s", req.source_url)
        raise HTTPException(status_code=500, detail="Crawl pipeline failed")


@app.post("/process", response_model=ProcessResponse)
async def process_article(req: ProcessRequest):
    """Process a single article: clean → summarize → classify."""
    try:
        # Clean
        content_clean = clean_html(req.content_raw)
        if len(content_clean) < 100:
            raise HTTPException(
                status_code=422,
                detail="Cleaned content too short (< 100 chars)",
            )

        # Summarize
        summary = await generate_summary(content_clean)
        processing_status = "done"
        if (
            summary.get("reason") == "Đây là tin tức đáng chú ý mà bạn nên biết."
        ):
            processing_status = "fallback"

        # Classify
        topic = await classify_topic(content_clean, req.title)

        return ProcessResponse(
            title_ai=summary["title_ai"],
            summary_bullets=summary["summary_bullets"],
            reason=summary["reason"],
            topic=topic,
            content_clean=content_clean,
            processing_status=processing_status,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Process failed for %s", req.url)
        raise HTTPException(status_code=500, detail="Article processing failed")


@app.post("/dedup/check", response_model=DedupCheckResponse)
async def dedup_check(req: DedupCheckRequest):
    """Check whether an article is a duplicate."""
    try:
        db = get_db()
        result = await deduplicate_article(db, req.url, req.title, req.content)
        cluster_id = result.get("cluster_id")
        return DedupCheckResponse(
            is_duplicate=result["is_duplicate"],
            cluster_id=str(cluster_id) if cluster_id is not None else None,
        )
    except Exception:
        logger.exception("Dedup check failed for %s", req.url)
        raise HTTPException(status_code=500, detail="Dedup check failed")
