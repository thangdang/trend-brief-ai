"""Topic classification service using keyword-based matching."""

import re
from typing import Dict, List

# Valid topics
VALID_TOPICS = ("ai", "finance", "lifestyle", "drama", "career", "insight")

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
        "thể thao", "fitness", "yoga", "meditation",
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
}

# Pre-compile a single regex pattern per topic for efficient matching.
# Each pattern matches any keyword as a whole word (case-insensitive).
_TOPIC_PATTERNS: Dict[str, re.Pattern] = {}
for _topic, _keywords in TOPIC_KEYWORDS.items():
    # Sort by length descending so longer phrases match first
    sorted_kw = sorted(_keywords, key=len, reverse=True)
    escaped = [re.escape(kw) for kw in sorted_kw]
    _TOPIC_PATTERNS[_topic] = re.compile(
        r"(?<!\w)(?:" + "|".join(escaped) + r")(?!\w)",
        re.IGNORECASE,
    )


def _count_matches(text: str, pattern: re.Pattern) -> int:
    """Count non-overlapping keyword matches in text."""
    return len(pattern.findall(text))


async def classify_topic(text: str, title: str = "") -> str:
    """Classify article into exactly one topic using keyword matching.

    Combines *title* and *text* for classification. Keywords found in the
    title are weighted 2× to reflect headline importance.

    Returns one of: ``'ai'``, ``'finance'``, ``'lifestyle'``, ``'drama'``.
    Defaults to ``'lifestyle'`` when no keywords match.
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
