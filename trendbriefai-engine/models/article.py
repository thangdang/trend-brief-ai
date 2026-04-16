"""Article data models."""

from datetime import datetime
from pydantic import BaseModel, Field


class ArticleBase(BaseModel):
    url: str
    url_hash: str
    title_original: str
    source: str
    published_at: datetime | None = None


class ArticleDocument(ArticleBase):
    """Full article document stored in MongoDB."""
    title_ai: str | None = None
    summary_bullets: list[str] = Field(default_factory=list)
    reason: str | None = None
    content_clean: str | None = None
    topic: str | None = None  # 'ai' | 'finance' | 'lifestyle' | 'drama'
    embedding: list[float] | None = None
    cluster_id: str | None = None
    processing_status: str = "pending"  # pending | processing | done | failed | fallback
    created_at: datetime = Field(default_factory=datetime.utcnow)
