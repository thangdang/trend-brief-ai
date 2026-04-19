"""FastAPI application — AI service entry point."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime

import ollama
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from config import settings
from db.connection import connect_db, close_db, get_db
from pipeline import run_ingestion_pipeline
from services.cleaner import clean_html
from services.classifier import classify_topic
from services.dedup import deduplicate_article, url_hash
from services.summarizer import generate_summary
from services.translator import detect_language, translate_to_vietnamese, ensure_vietnamese

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


class HealthResponse(BaseModel):
    status: str
    service: str = "ai-service"
    models: dict[str, str]
    cache: dict[str, str]
    faiss_index_size: int


# ---------------------------------------------------------------------------
# App lifecycle with model warm-up
# ---------------------------------------------------------------------------

async def _ping_ollama() -> bool:
    """Verify Ollama connectivity with a test prompt."""
    import asyncio
    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=settings.summarizer_model,
            messages=[{"role": "user", "content": "ping"}],
            options={"num_predict": 1},
        )
        return True
    except Exception:
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Enhanced startup: DB + model warm-up."""
    await connect_db()

    model_status = {"sentence_transformer": "loading", "ollama": "checking"}

    # Warm sentence-transformer
    try:
        from services.dedup.embedding import _get_model
        _get_model()  # Force load
        model_status["sentence_transformer"] = "ready"
        logger.info("Sentence-transformer model loaded successfully")
    except Exception:
        logger.error("Failed to load sentence-transformer — falling back to lazy loading")
        model_status["sentence_transformer"] = "fallback"

    # Warm Ollama
    try:
        if await _ping_ollama():
            model_status["ollama"] = "ready"
            logger.info("Ollama connectivity verified")
        else:
            model_status["ollama"] = "fallback"
            logger.warning("Ollama unreachable — summarizer in fallback-only mode")
    except Exception:
        model_status["ollama"] = "fallback"
        logger.warning("Ollama unreachable — summarizer in fallback-only mode")

    app.state.model_status = model_status
    app.state.faiss_index_size = 0
    app.state.lru_cache_size = 0

    yield
    await close_db()


app = FastAPI(
    title="TrendBrief AI Service",
    version="0.2.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health():
    """Enhanced health endpoint with model readiness info."""
    model_status = getattr(app.state, "model_status", {
        "sentence_transformer": "unknown",
        "ollama": "unknown",
    })

    # Determine overall status
    all_ready = all(v == "ready" for v in model_status.values())
    status = "ok" if all_ready else "degraded"

    faiss_size = getattr(app.state, "faiss_index_size", 0)
    lru_size = getattr(app.state, "lru_cache_size", 0)

    return HealthResponse(
        status=status,
        models=model_status,
        cache={"lru_size": str(lru_size), "redis": "unknown"},
        faiss_index_size=faiss_size,
    )


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

        # Translate if non-Vietnamese
        tr = await ensure_vietnamese(content_clean, req.title)
        content_clean = tr["text"]
        title_for_classify = tr["title"]

        # Summarize
        summary = await generate_summary(content_clean)
        processing_status = "done"
        if (
            summary.get("reason") == "Đây là tin tức đáng chú ý mà bạn nên biết."
        ):
            processing_status = "fallback"

        # Classify
        topic = await classify_topic(content_clean, title_for_classify)

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


# ---------------------------------------------------------------------------
# Translation endpoint
# ---------------------------------------------------------------------------

class TranslateRequest(BaseModel):
    text: str
    title: str = ""


class TranslateResponse(BaseModel):
    text: str
    title: str
    source_lang: str
    translated: bool


@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    """Detect language and translate to Vietnamese if needed."""
    try:
        result = await ensure_vietnamese(req.text, req.title)
        return TranslateResponse(**result)
    except Exception:
        logger.exception("Translation failed")
        raise HTTPException(status_code=500, detail="Translation failed")


# ---------------------------------------------------------------------------
# Resource Discovery endpoint
# ---------------------------------------------------------------------------

class DiscoveryResponse(BaseModel):
    discovered: int
    stored: int
    sources: list[dict]


@app.post("/discover", response_model=DiscoveryResponse)
async def discover_sources():
    """Run resource discovery pipeline — find new VN news sources.

    Scans Google News VN + backlinks from recent articles.
    Probes each candidate for RSS feeds and content quality.
    Stores qualified sources with is_active=false for admin review.
    """
    from services.discovery import discover_new_sources
    try:
        db = get_db()
        discoveries = await discover_new_sources(db)
        stored = sum(1 for d in discoveries if d.get("avg_quality", 0) > 0)
        return DiscoveryResponse(
            discovered=len(discoveries),
            stored=stored,
            sources=[{
                "domain": d["domain"],
                "name": d["name"],
                "url": d["url"],
                "source_type": d["source_type"],
                "rss_detected": d["rss_detected"],
                "quality": d["avg_quality"],
                "mentions": d["mention_count"],
                "via": d["discovered_via"],
            } for d in discoveries],
        )
    except Exception:
        logger.exception("Discovery pipeline failed")
        raise HTTPException(status_code=500, detail="Discovery pipeline failed")
