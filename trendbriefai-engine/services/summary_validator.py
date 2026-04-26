"""Summary quality validation — scores AI-generated summaries for quality.

Checks: title length, bullet count/length, reason quality, hallucination detection.
Returns quality_score 0.0-1.0 and detailed breakdown.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

GENERIC_REASONS = [
    "Đây là tin tức đáng chú ý mà bạn nên biết.",
    "Bạn nên biết điều này.",
    "Đây là thông tin quan trọng.",
    "Tin tức này đáng để bạn quan tâm.",
]

# URL pattern for hallucination detection
_URL_RE = re.compile(r"https?://[^\s]+")


class SummaryValidator:
    """Validate and score AI-generated summaries."""

    def validate(self, summary: dict, original_text: str = "") -> dict:
        """
        Validate a summary and return quality score.

        Returns:
            {
                "scores": { "title_length": float, "bullet_count": float, ... },
                "overall": float (0.0-1.0),
                "valid": bool (overall >= 0.6),
                "issues": list[str],
            }
        """
        scores = {}
        issues = []

        title = summary.get("title_ai", "")
        bullets = summary.get("summary_bullets", [])
        reason = summary.get("reason", "")

        # 1. Title length (≤15 words, ≥3 words)
        word_count = len(title.split()) if title else 0
        if 3 <= word_count <= 15:
            scores["title_length"] = 1.0
        elif word_count > 0:
            scores["title_length"] = 0.5
            issues.append(f"Title has {word_count} words (ideal: 3-15)")
        else:
            scores["title_length"] = 0.0
            issues.append("Title is empty")

        # 2. Bullet count (exactly 3)
        if len(bullets) == 3:
            scores["bullet_count"] = 1.0
        elif len(bullets) >= 2:
            scores["bullet_count"] = 0.5
            issues.append(f"Expected 3 bullets, got {len(bullets)}")
        else:
            scores["bullet_count"] = 0.0
            issues.append(f"Expected 3 bullets, got {len(bullets)}")

        # 3. Bullet quality (each 10-50 words)
        if bullets:
            good_bullets = sum(1 for b in bullets if 5 <= len(b.split()) <= 60)
            scores["bullet_quality"] = good_bullets / max(len(bullets), 1)
            if scores["bullet_quality"] < 1.0:
                issues.append("Some bullets are too short or too long")
        else:
            scores["bullet_quality"] = 0.0

        # 4. Reason quality (not generic, not empty)
        if not reason or not reason.strip():
            scores["reason_quality"] = 0.0
            issues.append("Reason is empty")
        elif reason.strip() in GENERIC_REASONS:
            scores["reason_quality"] = 0.0
            issues.append("Reason is generic fallback")
        elif len(reason.split()) < 5:
            scores["reason_quality"] = 0.3
            issues.append("Reason is too short")
        else:
            scores["reason_quality"] = 1.0

        # 5. Hallucination check (URLs in summary not in original)
        if original_text:
            original_urls = set(_URL_RE.findall(original_text))
            summary_text = f"{title} {' '.join(bullets)} {reason}"
            summary_urls = set(_URL_RE.findall(summary_text))
            hallucinated_urls = summary_urls - original_urls
            if hallucinated_urls:
                scores["no_hallucination"] = 0.0
                issues.append(f"Hallucinated URLs: {hallucinated_urls}")
            else:
                scores["no_hallucination"] = 1.0
        else:
            scores["no_hallucination"] = 0.8  # can't verify without original

        # Overall score (weighted)
        overall = (
            scores.get("title_length", 0) * 0.15
            + scores.get("bullet_count", 0) * 0.25
            + scores.get("bullet_quality", 0) * 0.15
            + scores.get("reason_quality", 0) * 0.25
            + scores.get("no_hallucination", 0) * 0.20
        )

        return {
            "scores": scores,
            "overall": round(overall, 3),
            "valid": overall >= 0.6,
            "issues": issues,
        }


# Singleton
summary_validator = SummaryValidator()
