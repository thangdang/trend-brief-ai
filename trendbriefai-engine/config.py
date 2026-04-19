"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017/trendbriefai"
    mongodb_db_name: str = "trendbriefai"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Ollama / AI
    ollama_url: str = "http://localhost:11434"
    summarizer_model: str = "llama3"
    embedding_model: str = "all-MiniLM-L6-v2"

    # Service
    ai_service_port: int = 8000
    log_level: str = "INFO"

    # Pipeline
    max_article_chars: int = 4000
    min_article_chars: int = 100
    dedup_window_hours: int = 48
    dedup_title_threshold: float = 0.8
    dedup_embed_threshold: float = 0.8
    dedup_max_candidates: int = 200

    # Batch processing
    summarizer_batch_size: int = 5

    # Caching
    lru_cache_max_size: int = 1000
    redis_ai_cache_ttl: int = 86400  # 24 hours

    # Classification
    classifier_keyword_threshold: int = 2
    classifier_keyword_weight: float = 0.4
    classifier_zero_shot_weight: float = 0.6

    # FAISS
    faiss_top_k: int = 10
    faiss_rebuild_interval_hours: int = 6

    # Pipeline concurrency
    pipeline_concurrency_limit: int = 5
    pipeline_rate_limit_delay: float = 1.5

    # Quality scoring
    quality_score_threshold: float = 0.3

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
