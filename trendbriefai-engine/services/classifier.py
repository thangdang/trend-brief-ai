"""Topic classification service using keyword-based matching with optional zero-shot hybrid mode."""

import logging
import re
from typing import Dict, List

from config import settings

logger = logging.getLogger(__name__)

# Valid topics
VALID_TOPICS = ("ai", "finance", "lifestyle", "drama", "career", "insight", "sport")

# Keyword lists per topic (Vietnamese + English)
TOPIC_KEYWORDS: Dict[str, List[str]] = {
    "ai": [
        "ai", "trí tuệ nhân tạo", "machine learning", "chatgpt", "robot",
        "công nghệ", "tech", "startup", "lập trình", "coding", "software",
        "phần mềm", "blockchain", "crypto", "nft", "metaverse", "gpu", "chip",
        "deep learning", "neural", "openai", "google ai", "gemini",
        "copilot", "automation", "tự động hóa", "dữ liệu lớn", "big data",
        "artificial intelligence", "mô hình ngôn ngữ", "llm", "gpt",
        "transformer", "nvidia", "điện toán đám mây", "cloud",
        "semiconductor", "bán dẫn", "5g", "iot",
    ],
    "finance": [
        "tài chính", "kinh tế", "chứng khoán", "ngân hàng", "lãi suất",
        "đầu tư", "tiền", "lương", "việc làm", "startup", "kinh doanh",
        "doanh nghiệp", "gdp", "lạm phát", "bất động sản", "bitcoin", "forex",
        "cổ phiếu", "trái phiếu", "vàng", "usd", "vnindex", "fed",
        "thuế", "ngân sách", "doanh thu", "lợi nhuận", "thị trường",
        "exchange", "stock", "bank", "investment", "economy",
        "tỷ giá", "nợ", "vay", "tín dụng", "bảo hiểm",
    ],
    "lifestyle": [
        "sức khỏe", "du lịch", "ẩm thực", "thời trang", "làm đẹp",
        "tình yêu", "gia đình", "giải trí", "phim", "nhạc", "sách",
        "fitness", "yoga", "meditation",
        "nấu ăn", "gym", "skincare", "makeup", "travel", "food",
        "recipe", "công thức", "dinh dưỡng", "giảm cân", "tập luyện",
        "thiền", "phong cách sống", "nhà cửa", "nội thất", "thú cưng",
        "pet", "mẹo vặt", "diy", "handmade", "cafe", "trà sữa",
        "âm nhạc", "game",
    ],
    "drama": [
        "scandal", "drama", "sao", "celeb", "hot girl", "influencer",
        "viral", "trend", "mạng xã hội", "tiktok", "facebook", "youtube",
        "gossip", "tin đồn", "tranh cãi",
        "nghệ sĩ", "showbiz", "hot", "instagram", "kol",
        "hẹn hò", "chia tay", "đám cưới sao", "paparazzi",
        "anti-fan", "fan", "fandom", "idol", "ca sĩ", "diễn viên",
        "người nổi tiếng", "giải trí sao", "hậu trường", "lộ",
        "bóc phốt", "sốc", "gây tranh cãi", "nóng", "xôn xao",
    ],
    "career": [
        "nghề nghiệp", "tuyển dụng", "phỏng vấn", "cv", "resume",
        "kiếm tiền", "thu nhập", "freelance", "remote", "làm thêm",
        "part-time", "full-time", "intern", "thực tập", "kỹ năng",
        "skill", "career", "job", "hiring", "salary",
        "lương thưởng", "thăng tiến", "promotion", "quản lý",
        "leadership", "networking", "personal brand", "side hustle",
        "kiếm tiền online", "mmo", "passive income", "thu nhập thụ động",
        "chuyển nghề", "định hướng nghề", "mentor", "coaching",
        "topdev", "linkedin", "việc làm it", "developer",
    ],
    "insight": [
        "phân tích", "góc nhìn", "deep dive", "long read", "opinion",
        "bình luận", "nhận định", "review", "đánh giá", "so sánh",
        "spiderum", "medium", "substack", "blog", "essay",
        "tư duy", "mindset", "triết lý", "suy ngẫm", "bài học",
        "kinh nghiệm", "chia sẻ", "câu chuyện", "story", "perspective",
        "research", "nghiên cứu", "xu hướng", "dự đoán", "forecast",
        "case study", "thống kê", "data", "infographic",
    ],
    "sport": [
        "thể thao", "bóng đá", "bóng rổ", "tennis", "bơi lội",
        "điền kinh", "olympic", "world cup", "v-league", "premier league",
        "champions league", "la liga", "serie a", "bundesliga",
        "cầu thủ", "huấn luyện viên", "trận đấu", "tỷ số", "bàn thắng",
        "chuyển nhượng", "giải đấu", "huy chương", "vô địch",
        "football", "soccer", "basketball", "f1", "formula 1",
        "mma", "boxing", "esports", "sea games", "asiad",
        "đội tuyển", "fifa", "afc", "vff", "ngoại hạng anh",
    ],
}

# Pre-compile a single regex pattern per topic for efficient matching.
_TOPIC_PATTERNS: Dict[str, re.Pattern] = {}
for _topic, _keywords in TOPIC_KEYWORDS.items():
    sorted_kw = sorted(_keywords, key=len, reverse=True)
    escaped = [re.escape(kw) for kw in sorted_kw]
    _TOPIC_PATTERNS[_topic] = re.compile(
        r"(?<!\w)(?:" + "|".join(escaped) + r")(?!\w)",
        re.IGNORECASE,
    )


def _count_matches(text: str, pattern: re.Pattern) -> int:
    """Count non-overlapping keyword matches in text."""
    return len(pattern.findall(text))


# ---------------------------------------------------------------------------
# Legacy keyword-only classification (preserved for backward compatibility)
# ---------------------------------------------------------------------------

async def classify_topic(text: str, title: str = "") -> str:
    """Classify article into exactly one topic using keyword matching.

    Combines *title* and *text* for classification. Keywords found in the
    title are weighted 2× to reflect headline importance.

    Returns one of the VALID_TOPICS. Defaults to ``'lifestyle'`` when no
    keywords match.
    """
    title = (title or "").strip().lower()
    text = (text or "").strip().lower()

    scores: Dict[str, int] = {}
    for topic, pattern in _TOPIC_PATTERNS.items():
        title_hits = _count_matches(title, pattern)
        text_hits = _count_matches(text, pattern)
        scores[topic] = title_hits * 2 + text_hits

    best_topic = max(scores, key=lambda t: scores[t])

    if scores[best_topic] == 0:
        return "lifestyle"

    return best_topic


# ---------------------------------------------------------------------------
# Hybrid classifier: keyword + zero-shot
# ---------------------------------------------------------------------------

# Zero-shot model singleton
_zs_pipeline = None
_zs_load_failed = False


def _get_zero_shot_pipeline():
    """Lazy-load the zero-shot classification pipeline (singleton)."""
    global _zs_pipeline, _zs_load_failed
    if _zs_load_failed:
        return None
    if _zs_pipeline is not None:
        return _zs_pipeline
    try:
        from transformers import pipeline as hf_pipeline
        _zs_pipeline = hf_pipeline(
            "zero-shot-classification",
            model="joeddav/xlm-roberta-large-xnli",
        )
        logger.info("Zero-shot classifier loaded: joeddav/xlm-roberta-large-xnli")
        return _zs_pipeline
    except Exception:
        logger.warning("Failed to load zero-shot classifier — falling back to keyword-only")
        _zs_load_failed = True
        return None


class HybridClassifier:
    """Keyword + zero-shot hybrid topic classifier."""

    VIETNAMESE_LABELS: Dict[str, str] = {
        "ai": "công nghệ và trí tuệ nhân tạo",
        "finance": "tài chính và kinh tế",
        "lifestyle": "phong cách sống và giải trí",
        "drama": "giải trí showbiz và mạng xã hội",
        "career": "nghề nghiệp và phát triển bản thân",
        "insight": "phân tích chuyên sâu và góc nhìn",
        "sport": "thể thao và bóng đá",
    }

    def __init__(
        self,
        keyword_threshold: int | None = None,
        keyword_weight: float | None = None,
        zero_shot_weight: float | None = None,
    ):
        self._keyword_threshold = keyword_threshold if keyword_threshold is not None else settings.classifier_keyword_threshold
        self._keyword_weight = keyword_weight if keyword_weight is not None else settings.classifier_keyword_weight
        self._zero_shot_weight = zero_shot_weight if zero_shot_weight is not None else settings.classifier_zero_shot_weight

    def _keyword_scores(self, text: str, title: str = "") -> Dict[str, float]:
        """Compute keyword match scores per topic."""
        title_lower = (title or "").strip().lower()
        text_lower = (text or "").strip().lower()

        scores: Dict[str, float] = {}
        for topic, pattern in _TOPIC_PATTERNS.items():
            title_hits = _count_matches(title_lower, pattern)
            text_hits = _count_matches(text_lower, pattern)
            scores[topic] = float(title_hits * 2 + text_hits)

        return scores

    def _total_keyword_hits(self, scores: Dict[str, float]) -> int:
        """Total keyword hits across all topics."""
        return int(sum(scores.values()))

    async def _zero_shot_scores(self, text: str) -> Dict[str, float] | None:
        """Get zero-shot classification probabilities."""
        zs = _get_zero_shot_pipeline()
        if zs is None:
            return None

        try:
            import asyncio
            labels = list(self.VIETNAMESE_LABELS.values())
            result = await asyncio.to_thread(
                zs, text[:1000], candidate_labels=labels
            )

            # Map Vietnamese labels back to topic keys
            label_to_topic = {v: k for k, v in self.VIETNAMESE_LABELS.items()}
            scores: Dict[str, float] = {}
            for label, score in zip(result["labels"], result["scores"]):
                topic = label_to_topic.get(label)
                if topic:
                    scores[topic] = float(score)

            return scores
        except Exception:
            logger.warning("Zero-shot inference failed — using keyword-only")
            return None

    def _combine_scores(
        self, kw: Dict[str, float], zs: Dict[str, float]
    ) -> Dict[str, float]:
        """Combine keyword and zero-shot scores with configurable weights."""
        combined: Dict[str, float] = {}
        for topic in VALID_TOPICS:
            kw_score = kw.get(topic, 0.0)
            zs_score = zs.get(topic, 0.0)
            combined[topic] = self._keyword_weight * kw_score + self._zero_shot_weight * zs_score
        return combined

    async def classify(self, text: str, title: str = "") -> str:
        """Classify article using hybrid keyword + zero-shot approach."""
        kw_scores = self._keyword_scores(text, title)
        total_hits = self._total_keyword_hits(kw_scores)

        if total_hits > self._keyword_threshold:
            # Keyword confidence is high enough — skip zero-shot
            best = max(kw_scores, key=lambda t: kw_scores[t])
            if kw_scores[best] == 0:
                return "lifestyle"
            return best

        # Low keyword confidence — invoke zero-shot
        zs_scores = await self._zero_shot_scores(text)
        if zs_scores is None:
            # Zero-shot failed — fall back to keyword-only
            best = max(kw_scores, key=lambda t: kw_scores[t])
            if kw_scores[best] == 0:
                return "lifestyle"
            return best

        # Normalize keyword scores to [0, 1] for combination
        max_kw = max(kw_scores.values()) if kw_scores else 1.0
        if max_kw > 0:
            normalized_kw = {t: v / max_kw for t, v in kw_scores.items()}
        else:
            normalized_kw = {t: 0.0 for t in kw_scores}

        combined = self._combine_scores(normalized_kw, zs_scores)
        best = max(combined, key=lambda t: combined[t])
        return best
