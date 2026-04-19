"""Redis cache for AI results with namespace prefixes.

Stores summarization and classification results in Redis with configurable
TTL. Handles Redis unavailability gracefully by logging warnings and
returning None.
"""

import json
import logging

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class RedisAICache:
    """Redis cache for AI results with namespace prefixes."""

    SUMMARY_PREFIX = "ai:summary:"
    CLASSIFY_PREFIX = "ai:classify:"

    def __init__(self, redis_url: str, default_ttl: int = 86400):
        self._redis_url = redis_url
        self._default_ttl = default_ttl
        self._redis: aioredis.Redis | None = None

    async def connect(self) -> None:
        """Connect to Redis."""
        try:
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True
            )
            await self._redis.ping()
            logger.info("RedisAICache connected to %s", self._redis_url)
        except Exception:
            logger.warning("RedisAICache: Redis unavailable at %s", self._redis_url)
            self._redis = None

    async def close(self) -> None:
        """Close Redis connection."""
        if self._redis is not None:
            await self._redis.close()
            self._redis = None

    def _summary_key(self, content_hash: str) -> str:
        return f"{self.SUMMARY_PREFIX}{content_hash}"

    def _classify_key(self, content_hash: str) -> str:
        return f"{self.CLASSIFY_PREFIX}{content_hash}"

    async def get_summary(self, content_hash: str) -> dict | None:
        """Retrieve cached summary by content hash."""
        if self._redis is None:
            return None
        try:
            data = await self._redis.get(self._summary_key(content_hash))
            if data is not None:
                return json.loads(data)
        except Exception:
            logger.warning("RedisAICache: failed to get summary for %s", content_hash)
        return None

    async def put_summary(self, content_hash: str, summary: dict) -> None:
        """Store summary result in Redis with TTL."""
        if self._redis is None:
            return
        try:
            await self._redis.setex(
                self._summary_key(content_hash),
                self._default_ttl,
                json.dumps(summary, ensure_ascii=False),
            )
        except Exception:
            logger.warning("RedisAICache: failed to put summary for %s", content_hash)

    async def get_classification(self, content_hash: str) -> str | None:
        """Retrieve cached classification by content hash."""
        if self._redis is None:
            return None
        try:
            return await self._redis.get(self._classify_key(content_hash))
        except Exception:
            logger.warning("RedisAICache: failed to get classification for %s", content_hash)
        return None

    async def put_classification(self, content_hash: str, topic: str) -> None:
        """Store classification result in Redis with TTL."""
        if self._redis is None:
            return
        try:
            await self._redis.setex(
                self._classify_key(content_hash),
                self._default_ttl,
                topic,
            )
        except Exception:
            logger.warning("RedisAICache: failed to put classification for %s", content_hash)
