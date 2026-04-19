"""Content quality scoring service.

Evaluates article text quality based on length, structure, Vietnamese
character ratio, and spam indicators. Used as a pre-summarization gate
to skip low-quality or spam content early.
"""

import logging
import re
import unicodedata
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Vietnamese Unicode character ranges (Latin-based with diacritics)
_VN_CHARS = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡ"
    r"ùúụủũưừứựửữỳýỵỷỹđ"
    r"ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ"
    r"ÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]"
)

# Spam indicators
_URL_PATTERN = re.compile(r"https?://\S+", re.IGNORECASE)
_ALL_CAPS_PATTERN = re.compile(r"\b[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]{5,}\b")
_REPEATED_PHRASE_PATTERN = re.compile(r"(.{10,}?)\1{2,}")


@dataclass
class QualitySignals:
    """Quality signal values for an article."""
    length_score: float
    structure_score: float
    vietnamese_ratio: float
    spam_score: float
    overall: float


class ContentQualityScorer:
    """Evaluate article text quality with weighted signal combination."""

    WEIGHTS = {
        "length": 0.3,
        "structure": 0.25,
        "vietnamese_ratio": 0.25,
        "spam": 0.2,
    }

    def score(self, text: str) -> QualitySignals:
        """Compute quality signals and overall score for article text."""
        length = self._length_score(text)
        structure = self._structure_score(text)
        vn_ratio = self._vietnamese_ratio(text)
        spam = self._spam_score(text)

        overall = (
            self.WEIGHTS["length"] * length
            + self.WEIGHTS["structure"] * structure
            + self.WEIGHTS["vietnamese_ratio"] * vn_ratio
            + self.WEIGHTS["spam"] * (1.0 - spam)
        )
        overall = max(0.0, min(1.0, overall))

        signals = QualitySignals(
            length_score=length,
            structure_score=structure,
            vietnamese_ratio=vn_ratio,
            spam_score=spam,
            overall=overall,
        )

        logger.info(
            "Quality score: overall=%.3f length=%.3f structure=%.3f "
            "vn_ratio=%.3f spam=%.3f",
            signals.overall,
            signals.length_score,
            signals.structure_score,
            signals.vietnamese_ratio,
            signals.spam_score,
        )

        return signals

    def _length_score(self, text: str) -> float:
        """Score based on text length: 0 if <100 chars, 1.0 if >=800."""
        length = len(text)
        if length < 100:
            return 0.0
        if length >= 800:
            return 1.0
        return max(0.0, min(1.0, (length - 100) / 700.0))

    def _structure_score(self, text: str) -> float:
        """Score based on paragraph count: >=3 paragraphs = 1.0."""
        if not text.strip():
            return 0.0
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        count = len(paragraphs)
        if count >= 3:
            return 1.0
        return max(0.0, min(1.0, count / 3.0))

    def _vietnamese_ratio(self, text: str) -> float:
        """Ratio of Vietnamese-specific characters to total alpha characters."""
        alpha_chars = [c for c in text if c.isalpha()]
        if not alpha_chars:
            return 0.0
        vn_count = len(_VN_CHARS.findall(text))
        ratio = vn_count / len(alpha_chars)
        return max(0.0, min(1.0, ratio))

    def _spam_score(self, text: str) -> float:
        """Spam indicator score: 0 = clean, 1 = all spam."""
        if not text.strip():
            return 0.0

        signals = 0.0
        total_weight = 3.0

        # Excessive URLs
        url_count = len(_URL_PATTERN.findall(text))
        word_count = max(len(text.split()), 1)
        url_ratio = url_count / word_count
        signals += min(1.0, url_ratio * 10)

        # All-caps blocks
        caps_matches = len(_ALL_CAPS_PATTERN.findall(text))
        signals += min(1.0, caps_matches / 5.0)

        # Repeated phrases
        repeated = len(_REPEATED_PHRASE_PATTERN.findall(text))
        signals += min(1.0, repeated / 3.0)

        return max(0.0, min(1.0, signals / total_weight))
