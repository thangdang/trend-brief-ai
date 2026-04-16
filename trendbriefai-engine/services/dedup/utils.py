"""Deduplication utility functions."""

import hashlib


def url_hash(url: str) -> str:
    """Compute MD5 hash of a URL for O(1) duplicate lookup."""
    return hashlib.md5(url.encode()).hexdigest()
