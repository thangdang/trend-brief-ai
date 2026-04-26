"""Per-domain rate limiter for crawling.

Ensures minimum delay between requests to the same domain,
preventing IP bans and being a good web citizen.
"""

import asyncio
import logging
import time
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Per-domain last request timestamps
_domain_timestamps: dict[str, float] = {}
_domain_locks: dict[str, asyncio.Lock] = {}

DEFAULT_DELAY = 1.5  # seconds between requests to same domain


def _get_domain(url: str) -> str:
    """Extract domain from URL."""
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return "unknown"


def _get_lock(domain: str) -> asyncio.Lock:
    """Get or create a lock for a domain."""
    if domain not in _domain_locks:
        _domain_locks[domain] = asyncio.Lock()
    return _domain_locks[domain]


async def wait_for_domain(url: str, min_delay: float = DEFAULT_DELAY):
    """Wait until it's safe to make a request to this domain.

    Ensures at least `min_delay` seconds between requests to the same domain.
    Thread-safe via per-domain asyncio locks.
    """
    domain = _get_domain(url)
    lock = _get_lock(domain)

    async with lock:
        last_request = _domain_timestamps.get(domain, 0)
        elapsed = time.time() - last_request
        if elapsed < min_delay:
            wait_time = min_delay - elapsed
            logger.debug(f"Rate limit: waiting {wait_time:.1f}s for {domain}")
            await asyncio.sleep(wait_time)
        _domain_timestamps[domain] = time.time()


def get_domain_stats() -> dict:
    """Return rate limiter stats for monitoring."""
    now = time.time()
    return {
        "tracked_domains": len(_domain_timestamps),
        "domains": {
            domain: {
                "last_request_ago_sec": round(now - ts, 1),
            }
            for domain, ts in sorted(_domain_timestamps.items(), key=lambda x: -x[1])[:20]
        },
    }
