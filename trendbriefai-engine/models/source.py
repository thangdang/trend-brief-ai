"""RSS source data models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SourceType = Literal["rss", "html_scrape", "api"]


class RssSource(BaseModel):
    """RSS source configuration stored in MongoDB."""
    name: str
    url: str
    category: str | None = None
    source_type: SourceType = "rss"
    is_active: bool = True
    crawl_interval_minutes: int = 10
    last_crawled_at: datetime | None = None
    scrape_link_selector: str | None = None
    scrape_content_selector: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
