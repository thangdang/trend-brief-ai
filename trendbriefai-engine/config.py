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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
