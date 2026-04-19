"""Two-level summarizer cache: in-memory LRU + Redis.

Checks LRU first (sub-millisecond), then Redis (cross-restart persistence),
and only calls Ollama on a complete miss.
"""

import hashlib
import logging
from collections import OrderedDict

from services.cache.redis_cache import RedisAICache

logger = logging.getLogger(__name__)


class SummarizerCache:
    """Two-level cache: in-memory LRU → Redis."""

    def __init__(self, max_lru_size: int = 1000, redis_cache: RedisAICache | None = None):
        self._lru: OrderedDict[str, dict] = OrderedDict()
        self._max_size: int = max_lru_size
        self._redis_cache: RedisAICache | None = redis_cache

    def _content_hash(self, text: str) -> str:
        """SHA-256 hash of truncated content for cache key."""
        truncated = text[:4000]
        return hashlib.sha256(truncated.encode("utf-8")).hexdigest()

    async def get(self, content_text: str) -> dict | None:
        """Check LRU first, then Redis. Returns cached summary or None."""
        key = self._content_hash(content_text)

        # Check LRU
        if key in self._lru:
            self._lru.move_to_end(key)
            result = self._lru[key].copy()
            result["from_cache"] = True
            logger.debug("SummarizerCache: LRU hit for %s", key[:12])
            return result

        # Check Redis
        if self._redis_cache is not None:
            redis_result = await self._redis_cache.get_summary(key)
            if redis_result is not None:
                # Promote to LRU
                self._lru[key] = redis_result
                self._lru.move_to_end(key)
                self._evict_if_needed()
                result = redis_result.copy()
                result["from_cache"] = True
                logger.debug("SummarizerCache: Redis hit for %s", key[:12])
                return result

        return None

    async def put(self, content_text: str, summary: dict) -> None:
        """Store in both LRU and Redis."""
        key = self._content_hash(content_text)

        # Store in LRU
        self._lru[key] = summary.copy()
        self._lru.move_to_end(key)
        self._evict_if_needed()

        # Store in Redis
        if self._redis_cache is not None:
            await self._redis_cache.put_summary(key, summary)

    def _evict_if_needed(self) -> None:
        """Evict LRU entries if cache exceeds max size."""
        while len(self._lru) > self._max_size:
            self._lru.popitem(last=False)
