"""Content moderation: keyword blocklist + source whitelist/blacklist.

Loads moderation config from MongoDB dynamic_config collection.
Falls back to hardcoded defaults if DB unavailable.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Default Vietnamese spam/NSFW blocklist keywords
DEFAULT_BLOCK_KEYWORDS = [
    "cá cược", "casino", "18+", "cá độ", "slot game",
    "sex", "khiêu dâm", "cờ bạc", "lô đề", "xổ số online",
    "đánh bạc", "sòng bài", "gái gọi", "mại dâm",
]

DEFAULT_FLAG_KEYWORDS = [
    "quảng cáo", "tài trợ", "sponsored", "PR",
]

DEFAULT_BLOCK_DOMAINS: list[str] = []
DEFAULT_ALLOW_DOMAINS: list[str] = []  # empty = allow all


class ContentModerator:
    """Checks articles against keyword blocklist and source whitelist/blacklist."""

    def __init__(self, db=None):
        self._db = db
        self._block_keywords: list[str] = DEFAULT_BLOCK_KEYWORDS
        self._flag_keywords: list[str] = DEFAULT_FLAG_KEYWORDS
        self._block_domains: list[str] = DEFAULT_BLOCK_DOMAINS
        self._allow_domains: list[str] = DEFAULT_ALLOW_DOMAINS
        self._loaded = False

    async def load_config(self) -> None:
        """Load moderation config from dynamic_config collection."""
        if self._db is None or self._loaded:
            return
        try:
            config_col = self._db["dynamic_config"]
            doc = await config_col.find_one({"key": "moderation"})
            if doc and "value" in doc:
                v = doc["value"]
                self._block_keywords = v.get("block_keywords", DEFAULT_BLOCK_KEYWORDS)
                self._flag_keywords = v.get("flag_keywords", DEFAULT_FLAG_KEYWORDS)
                self._block_domains = v.get("block_domains", DEFAULT_BLOCK_DOMAINS)
                self._allow_domains = v.get("allow_domains", DEFAULT_ALLOW_DOMAINS)
            self._loaded = True
            logger.info("Moderation config loaded: %d block keywords, %d block domains",
                        len(self._block_keywords), len(self._block_domains))
        except Exception:
            logger.warning("Failed to load moderation config — using defaults")

    def check_keywords(self, text: str) -> dict:
        """Check text against keyword blocklist.

        Returns:
            {"blocked": bool, "flagged": bool, "matched_keywords": list[str]}
        """
        text_lower = text.lower()
        blocked_matches = [kw for kw in self._block_keywords if kw.lower() in text_lower]
        flagged_matches = [kw for kw in self._flag_keywords if kw.lower() in text_lower]

        return {
            "blocked": len(blocked_matches) > 0,
            "flagged": len(flagged_matches) > 0,
            "matched_keywords": blocked_matches + flagged_matches,
        }

    def check_source(self, url: str) -> dict:
        """Check source URL against whitelist/blacklist.

        Returns:
            {"allowed": bool, "reason": str}
        """
        from urllib.parse import urlparse
        try:
            domain = urlparse(url).netloc.lower()
        except Exception:
            return {"allowed": False, "reason": "invalid_url"}

        # Block domain check
        for blocked in self._block_domains:
            if blocked.lower() in domain:
                return {"allowed": False, "reason": f"blocked_domain:{blocked}"}

        # Allow domain check (if whitelist is set, only allow listed domains)
        if self._allow_domains:
            for allowed in self._allow_domains:
                if allowed.lower() in domain:
                    return {"allowed": True, "reason": "whitelisted"}
            return {"allowed": False, "reason": "not_in_whitelist"}

        return {"allowed": True, "reason": "no_restrictions"}

    def moderate(self, url: str, text: str, title: str = "") -> dict:
        """Run full moderation check.

        Returns:
            {"pass": bool, "blocked": bool, "flagged": bool, "reasons": list[str]}
        """
        reasons = []

        # Source check
        source_result = self.check_source(url)
        if not source_result["allowed"]:
            reasons.append(f"source:{source_result['reason']}")
            return {"pass": False, "blocked": True, "flagged": False, "reasons": reasons}

        # Keyword check on title + text
        combined = f"{title} {text}"
        kw_result = self.check_keywords(combined)

        if kw_result["blocked"]:
            reasons.extend([f"keyword:{kw}" for kw in kw_result["matched_keywords"]])
            return {"pass": False, "blocked": True, "flagged": False, "reasons": reasons}

        if kw_result["flagged"]:
            reasons.extend([f"flag:{kw}" for kw in kw_result["matched_keywords"]])
            return {"pass": True, "blocked": False, "flagged": True, "reasons": reasons}

        return {"pass": True, "blocked": False, "flagged": False, "reasons": []}
