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
    """Enhanced health endpoint with model readiness and provider chain info."""
    model_status = getattr(app.state, "model_status", {
        "sentence_transformer": "unknown",
        "ollama": "unknown",
    })

    # Determine overall status
    all_ready = all(v == "ready" for v in model_status.values())
    status = "ok" if all_ready else "degraded"

    faiss_size = getattr(app.state, "faiss_index_size", 0)
    lru_size = getattr(app.state, "lru_cache_size", 0)

    # Provider chain health
    try:
        from services.llm_providers import provider_chain
        providers = provider_chain.get_health_status()
    except Exception:
        providers = []

    return HealthResponse(
        status=status,
        models={**model_status, "providers": {p["name"]: "healthy" if p["healthy"] else "degraded" for p in providers}},
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


# ---------------------------------------------------------------------------
# "Tóm tắt cho tôi" — user pastes any URL, AI summarizes (Task 35.1)
# ---------------------------------------------------------------------------

class SummarizeUrlRequest(BaseModel):
    url: str


class SummarizeUrlResponse(BaseModel):
    title_ai: str
    summary_bullets: list[str]
    reason: str
    topic: str
    source_url: str


@app.post("/summarize-url", response_model=SummarizeUrlResponse)
async def summarize_url(req: SummarizeUrlRequest):
    """User pastes any URL → AI extracts, cleans, summarizes, classifies."""
    from services.cleaner import extract_and_clean

    try:
        # Extract and clean
        cleaned = await extract_and_clean(req.url)
        if cleaned is None or len(cleaned["text"]) < 100:
            raise HTTPException(status_code=422, detail="Không thể trích xuất nội dung từ URL này")

        text = cleaned["text"]
        title = cleaned["title"] or ""

        # Translate if needed
        tr = await ensure_vietnamese(text, title)
        text = tr["text"]
        title = tr["title"]

        # Summarize
        summary = await generate_summary(text)

        # Classify
        topic = await classify_topic(text, title)

        return SummarizeUrlResponse(
            title_ai=summary.get("title_ai", title[:80]),
            summary_bullets=summary.get("summary_bullets", []),
            reason=summary.get("reason", ""),
            topic=topic,
            source_url=req.url,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Summarize URL failed for %s", req.url)
        raise HTTPException(status_code=500, detail="Không thể tóm tắt URL này")


# ---------------------------------------------------------------------------
# Daily AI briefing — personalized audio summary (Task 35.2)
# ---------------------------------------------------------------------------

class BriefingRequest(BaseModel):
    user_interests: list[str] = []
    max_articles: int = 5


class BriefingResponse(BaseModel):
    text: str
    article_count: int
    topics_covered: list[str]


@app.post("/briefing", response_model=BriefingResponse)
async def daily_briefing(req: BriefingRequest):
    """Generate a personalized text briefing from top articles.

    TTS conversion would be handled client-side or via a separate TTS service.
    """
    try:
        db = get_db()
        articles_col = db["articles"]

        # Get top articles from last 24h matching user interests
        from datetime import timedelta
        since = datetime.utcnow() - timedelta(hours=24)

        filter_q: dict = {
            "processing_status": "done",
            "created_at": {"$gte": since},
        }
        if req.user_interests:
            filter_q["topic"] = {"$in": req.user_interests}

        articles = await articles_col.find(filter_q).sort("created_at", -1).limit(req.max_articles).to_list(req.max_articles)

        if not articles:
            return BriefingResponse(text="Chưa có tin tức mới hôm nay.", article_count=0, topics_covered=[])

        # Build briefing text
        lines = ["Chào buổi sáng! Đây là tóm tắt tin tức hôm nay từ TrendBrief AI.\n"]
        topics = set()
        for i, a in enumerate(articles, 1):
            title = a.get("title_ai") or a.get("title_original", "")
            bullets = a.get("summary_bullets", [])
            topic = a.get("topic", "")
            topics.add(topic)
            lines.append(f"Tin {i}: {title}")
            for b in bullets:
                lines.append(f"  • {b}")
            lines.append("")

        lines.append("Đó là tóm tắt tin tức hôm nay. Chúc bạn một ngày tốt lành!")

        return BriefingResponse(
            text="\n".join(lines),
            article_count=len(articles),
            topics_covered=list(topics),
        )
    except Exception:
        logger.exception("Briefing generation failed")
        raise HTTPException(status_code=500, detail="Briefing generation failed")


# ---------------------------------------------------------------------------
# ML-based feed personalization (Task 35.3)
# ---------------------------------------------------------------------------

class PersonalizeRequest(BaseModel):
    user_id: str
    candidate_article_ids: list[str]
    max_results: int = 20


class PersonalizeResponse(BaseModel):
    ranked_article_ids: list[str]


@app.post("/personalize", response_model=PersonalizeResponse)
async def personalize_feed(req: PersonalizeRequest):
    """Re-rank candidate articles based on user's learned preferences.

    Uses interaction history (views, bookmarks, shares) to build a simple
    preference vector and score candidates by cosine similarity.
    """
    try:
        db = get_db()
        interactions_col = db["interactions"]
        articles_col = db["articles"]

        # Get user's recent interactions to build preference profile
        user_interactions = await interactions_col.find(
            {"user_id": req.user_id, "action": {"$in": ["view", "bookmark", "share"]}},
        ).sort("created_at", -1).limit(50).to_list(50)

        if not user_interactions:
            # No history — return as-is
            return PersonalizeResponse(ranked_article_ids=req.candidate_article_ids[:req.max_results])

        # Build topic preference weights from interaction history
        topic_weights: dict[str, float] = {}
        action_weights = {"view": 1.0, "bookmark": 3.0, "share": 5.0}

        interacted_article_ids = [i["article_id"] for i in user_interactions]
        interacted_articles = await articles_col.find(
            {"_id": {"$in": interacted_article_ids}},
        ).to_list(50)

        article_topic_map = {str(a["_id"]): a.get("topic", "") for a in interacted_articles}

        for interaction in user_interactions:
            topic = article_topic_map.get(str(interaction["article_id"]), "")
            if topic:
                weight = action_weights.get(interaction["action"], 1.0)
                topic_weights[topic] = topic_weights.get(topic, 0) + weight

        # Normalize weights
        total = sum(topic_weights.values()) or 1
        for t in topic_weights:
            topic_weights[t] /= total

        # Score candidates
        from bson import ObjectId
        candidate_oids = [ObjectId(cid) for cid in req.candidate_article_ids if ObjectId.is_valid(cid)]
        candidates = await articles_col.find({"_id": {"$in": candidate_oids}}).to_list(len(candidate_oids))

        scored = []
        for c in candidates:
            topic = c.get("topic", "")
            score = topic_weights.get(topic, 0.1)  # Base score for unknown topics
            # Recency boost
            age_hours = (datetime.utcnow() - c.get("created_at", datetime.utcnow())).total_seconds() / 3600
            recency = max(0, 1 - age_hours / 72)  # Decay over 72h
            final_score = 0.6 * score + 0.4 * recency
            scored.append((str(c["_id"]), final_score))

        scored.sort(key=lambda x: x[1], reverse=True)
        ranked_ids = [s[0] for s in scored[:req.max_results]]

        return PersonalizeResponse(ranked_article_ids=ranked_ids)
    except Exception:
        logger.exception("Personalization failed for user %s", req.user_id)
        return PersonalizeResponse(ranked_article_ids=req.candidate_article_ids[:req.max_results])
