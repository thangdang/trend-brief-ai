"""Simple Vietnamese sentiment analysis using keyword scoring.

Returns: 'positive', 'negative', or 'neutral'.
No external API needed — pure keyword-based for speed.
"""

import re
import logging

logger = logging.getLogger(__name__)

POSITIVE_KEYWORDS = [
    "thành công", "tăng trưởng", "kỷ lục", "đột phá", "chiến thắng", "giải thưởng",
    "tích cực", "lạc quan", "cải thiện", "phát triển", "hỗ trợ", "miễn phí",
    "giảm giá", "ưu đãi", "cơ hội", "triển vọng", "ấn tượng", "xuất sắc",
    "breakthrough", "success", "growth", "record", "award", "positive",
    "improve", "support", "opportunity", "impressive", "excellent",
    "vui", "hạnh phúc", "yêu thích", "tuyệt vời", "đáng mừng",
]

NEGATIVE_KEYWORDS = [
    "sụp đổ", "khủng hoảng", "thiệt hại", "tai nạn", "tử vong", "bắt giữ",
    "lừa đảo", "phá sản", "giảm mạnh", "cảnh báo", "nguy hiểm", "rủi ro",
    "scandal", "bê bối", "tranh cãi", "phản đối", "biểu tình", "chiến tranh",
    "crash", "crisis", "damage", "fraud", "bankrupt", "warning", "danger",
    "risk", "scandal", "controversy", "protest", "war", "death",
    "buồn", "lo lắng", "sợ hãi", "tức giận", "thất vọng", "đau lòng",
]


def analyze_sentiment(text: str) -> str:
    """Analyze sentiment of Vietnamese/English text. Returns 'positive', 'negative', or 'neutral'."""
    if not text:
        return "neutral"

    lower = text.lower()
    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in lower)
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in lower)

    if pos_count > neg_count + 1:
        return "positive"
    elif neg_count > pos_count + 1:
        return "negative"
    return "neutral"
