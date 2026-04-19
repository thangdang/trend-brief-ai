# TrendBrief AI – Application Flow

## 1. Authentication Flow

```
User → Flutter/Angular → POST /api/auth/register hoặc /login
     → trendbriefai-service → bcrypt verify → JWT sign
     → Return {accessToken(15m), refreshToken(7d)}
     → Client lưu token (flutter_secure_storage / localStorage)
```

Token hết hạn → `POST /api/auth/refresh` → access token mới, user không cần login lại.

---

## 2. Article Ingestion Flow (Core Pipeline)

```
node-cron trigger (mỗi 10 phút)
        ↓
trendbriefai-service:
  1. BullMQ enqueue crawl job
  2. Worker fetch active sources từ MongoDB (rss_sources)
  3. Gọi trendbriefai-engine POST /crawl cho mỗi source
     → Gửi kèm source_type + scrape_link_selector
        ↓
trendbriefai-engine:
  4. Dispatch theo source_type:
     a. source_type="rss" → feedparser.parse(rss_url)
     b. source_type="html_scrape" → httpx fetch listing page
        → BeautifulSoup + CSS selector → extract article links
  5. Với mỗi entry:
     a. URL hash check (MD5, O(1)) → skip nếu trùng
     b. newspaper3k download + parse → full article text
     c. BeautifulSoup clean (remove HTML, ads, nav)
     d. Skip nếu text < 100 ký tự
     d2. Language detect (langdetect + VN diacritics heuristic ≥5%)
         → Nếu non-VN (e.g. English từ Medium) → Ollama translate to Vietnamese
         → Fallback: pass-through untranslated (summarizer prompt sẽ cố gắng)
     e. Quality score gate (skip nếu < 0.3)
     f. Ollama summarize → title_ai + 3 bullets + reason
     g. Keyword classify → topic (ai/finance/lifestyle/drama/career/insight/technology/health/entertainment/sport)
     g. 3-layer dedup:
        - Layer 1: URL hash exact match
        - Layer 2: Title similarity ≥ 0.8 (48h window)
        - Layer 3: Embedding cosine ≥ 0.8 (48h window, max 200 candidates)
     h. Nếu unique → insert MongoDB + tạo cluster mới
     i. Nếu duplicate → skip
  6. Return stats {new, duplicate, failed}
        ↓
trendbriefai-service:
  7. Update rss_sources.last_crawled_at
  8. Log kết quả
```

### Fallback khi AI fail:
```
Ollama timeout/error
  → Extractive fallback:
    - title_ai = câu đầu tiên (≤12 từ)
    - summary_bullets = 3 câu đầu
    - reason = "Đây là tin tức đáng chú ý mà bạn nên biết."
    - processing_status = "fallback"
```

---

## 3. Feed Request Flow

```
User mở app/web
        ↓
Client → GET /api/feed?topic=ai&page=1&limit=20
        ↓
trendbriefai-service:
  1. Verify JWT token
  2. Record user activity (DAU tracking, fire-and-forget)
  3. Check Redis cache (key: feed:{userId}:{topic}:{page})
     → Cache hit: return cached data
     → Cache miss: tiếp tục
  4. Fetch user interests từ MongoDB
  5. Fetch user viewed articles (interactions)
  6. Query articles (processing_status: done/fallback)
  7. Apply ranking algorithm:
     - topicBoost: +2.0 (match interest)
     - recencyScore: 1.0→0.0 (48h decay)
     - interactionPenalty: -5.0 (đã xem)
  8. Sort by score DESC, created_at DESC
  9. Paginate (offset + limit)
  10. Check bookmarks cho isBookmarked field
  11. Fetch active ads → inject every 5th item (track impressions)
  12. Fetch affiliate links by topic → attach max 2 per article (track impressions)
  13. Set isSponsored flag from article.is_sponsored
  14. Add readingTimeSec estimate (15–60s, Vietnamese 200 wpm)
  15. Cache result (Redis, TTL 300s)
  16. Return FeedResponse (FeedItem[] + AdItem[])
        ↓
Client hiển thị:
  - Search bar (tìm kiếm bài viết)
  - 🔥 Trending section (bài hot 24h)
  - Topic filter tabs (All, AI, Finance, Lifestyle, Drama, Career, Insight, Technology, Health, Entertainment, Sport)
  - Article cards: title_ai, 3 bullets, reason, source, ⏱ reading time
  - Bookmark toggle ☆/★
  - Share button ↗
  - "Đọc full →" link bài gốc
  - Native ad cards (every 5th item, labeled "Sponsored")
  - Affiliate links (dưới mỗi article card)
```

---

## 4. Bookmark Flow

```
User nhấn ☆ trên article card
        ↓
Client → POST /api/bookmarks {articleId}
        ↓
trendbriefai-service:
  1. Verify JWT
  2. Insert bookmark (user_id + article_id)
  3. Nếu đã tồn tại (duplicate key) → return 200 (idempotent)
  4. Nếu mới → return 201
        ↓
Client cập nhật icon ★

User nhấn ★ (bỏ lưu):
  → DELETE /api/bookmarks/:id → 204
```

---

## 5. Interaction Tracking Flow

```
User xem bài / click "Đọc full" / share
        ↓
Client → POST /api/interactions {articleId, action}
        ↓
trendbriefai-service:
  1. Insert interaction record
  2. action ∈ {view, click_original, share, bookmark}
        ↓
Ảnh hưởng feed ranking:
  - "view" → bài bị penalty -5.0 trong feed tiếp theo
```

---

## 6. Interest Update Flow

```
User vào Profile → chọn topics (AI, Finance, Lifestyle, Drama, Career, Insight, Technology, Health, Entertainment, Sport)
        ↓
Client → PUT /api/users/interests {interests: ["ai", "finance"]}
        ↓
trendbriefai-service:
  1. Update user.interests trong MongoDB
  2. Invalidate Redis feed cache (SCAN + DEL feed:{userId}:*)
  3. Return updated profile
        ↓
Feed request tiếp theo sẽ dùng interests mới để ranking
```

---

## 7. Deduplication Flow (Chi tiết)

```
Bài viết mới vào pipeline
        ↓
Layer 1: URL Hash (O(1))
  MD5(url) → lookup articles.url_hash
  → Match: DUPLICATE (skip)
  → No match: tiếp tục
        ↓
Layer 2: Title Similarity (O(n))
  SequenceMatcher(new_title, candidate_title)
  Candidates: articles trong 48h gần nhất (max 200)
  → Ratio ≥ 0.8: DUPLICATE (link to cluster)
  → < 0.8: tiếp tục
        ↓
Layer 3: Embedding Cosine (O(n))
  all-MiniLM-L6-v2 encode → 384-dim vector
  cosine_similarity(new_embedding, candidate_embedding)
  → Score ≥ 0.8: DUPLICATE (link to cluster)
  → < 0.8: UNIQUE → tạo cluster mới
```

---

## 8. Topic Classification Flow

```
Clean article text + title
        ↓
Keyword matching (Vietnamese + English dictionaries):
  - AI: trí tuệ nhân tạo, machine learning, ChatGPT, công nghệ, blockchain...
  - Finance: tài chính, chứng khoán, đầu tư, lương, kinh doanh...
  - Lifestyle: sức khỏe, du lịch, ẩm thực, thời trang...
  - Drama: scandal, viral, TikTok, influencer, gossip...
  - Career: nghề nghiệp, tuyển dụng, kiếm tiền, freelance, skill...
  - Insight: phân tích, góc nhìn, deep dive, review, spiderum, medium...
  - Sport: thể thao, bóng đá, V-League, Premier League, FIFA, SEA Games...
        ↓
Title keywords: 2x weight
Text keywords: 1x weight
        ↓
Topic = max(scores)
Nếu tất cả = 0 → default "lifestyle"
```


---

## 9. Search Flow

```
User nhập keyword vào search bar
        ↓
Client → GET /api/search?q=keyword&topic=ai&page=1
        ↓
trendbriefai-service:
  1. Verify JWT
  2. MongoDB $text search trên title_original + title_ai
  3. Sort by text score (relevance)
  4. Filter by topic (optional) + processing_status
  5. Paginate
  6. Return FeedResponse
        ↓
Client hiển thị kết quả tìm kiếm
  - "Kết quả cho 'keyword'" + nút xóa tìm kiếm
```

---

## 10. Trending Flow

```
Client → GET /api/trending?limit=10
        ↓
trendbriefai-service:
  1. Verify JWT
  2. Aggregate interactions trong 24h gần nhất
  3. Group by article_id, count interactions
  4. Sort by count DESC
  5. Fetch article details
  6. Return top N articles
        ↓
Client hiển thị:
  - 🔥 Đang hot section (horizontal scroll cards)
```

---

## 11. Native Ads Flow

```
Admin tạo quảng cáo:
  POST /api/ads {title, description, target_url, advertiser, topic, budget_cents, start_date, end_date}
        ↓
User xem feed:
  1. Feed service fetch active ads (status=active, not expired, within budget)
  2. Inject 1 ad card mỗi 5 bài viết
  3. Track impression (increment Ad.impressions)
  4. Ad card hiển thị với label "Sponsored"
        ↓
User click ad:
  POST /api/ads/:id/click → increment Ad.clicks
  → Redirect to target_url
```

---

## 12. Affiliate Marketing Flow

```
Admin tạo affiliate link:
  POST /api/affiliates {title, url, topic, commission, provider}
        ↓
User xem feed:
  1. Feed service fetch active affiliate links by article topic
  2. Attach max 2 links per article card
  3. Track impressions (bulk increment AffiliateLink.impressions)
        ↓
User click affiliate link:
  POST /api/affiliates/:id/click → increment AffiliateLink.clicks
  → Redirect to affiliate URL
        ↓
Metrics:
  CTR = clicks / impressions
```

---

## 13. Analytics & Metrics Flow

```
Tự động:
  - Mỗi feed request → record UserActivity (DAU tracking)
  - Mỗi interaction "view" → increment articles_viewed
  - Mỗi ad shown → increment impressions
  - Mỗi affiliate link shown → increment impressions

Admin xem analytics:
  GET /api/analytics?startDate=2026-04-01&endDate=2026-04-16
  GET /api/analytics/dau?date=2026-04-16
  GET /api/analytics/mau?month=2026-04
  GET /api/analytics/retention?cohortDate=2026-04-09
  GET /api/analytics/engagement?startDate=...&endDate=...

Trigger aggregation:
  POST /api/analytics/aggregate → tổng hợp stats hôm nay
```

### Metrics có thể đo:

| Metric | Cách tính |
|--------|-----------|
| DAU | `UserActivity.countDocuments({ date: today })` |
| MAU | `UserActivity.distinct('user_id', { date: this_month })` |
| Sessions/user/day | `UserActivity.avg(sessions)` |
| Articles/session | `UserActivity.avg(articles_viewed)` |
| D7 Retention | Users active on day X also active on day X+7 |
| Ad CTR | `Ad.clicks / Ad.impressions` |
| Affiliate CTR | `AffiliateLink.clicks / AffiliateLink.impressions` |

---

## 14. Translation Flow (Non-Vietnamese Content)

```
Article cleaned text
        ↓
Step 1: VN diacritics heuristic (fast)
  Count Vietnamese-specific chars in first 2000 chars
  → ≥5% of alpha chars are VN diacritics → lang = "vi" (skip translation)
  → <5% → continue to langdetect
        ↓
Step 2: langdetect library
  → Detect language code (vi/en/fr/...)
  → Error → default "vi" (safe, skip translation)
        ↓
Step 3: If lang ≠ "vi" → Ollama translate
  System prompt: "Dịch chính xác sang tiếng Việt, giữ thuật ngữ chuyên ngành trong ngoặc"
  Temperature: 0.3 (low for accuracy)
  → Translate body text + title separately
  → Sanity check: translated text ≥ 30% length of original
  → Fail → pass-through untranslated (summarizer prompt tries its best)
        ↓
Article stored with:
  source_lang: "en" (detected language)
  was_translated: true/false
```

Trigger: Automatic in pipeline (Step 2b, between clean and quality score).
Manual test: `POST /translate {text, title}` on AI engine.

---

## 15. Resource Discovery Flow (Auto-Find New Sources)

```
Weekly cron (Sunday 3:00 AM) OR manual POST /discover
        ↓
Step 1: Get existing source domains from rss_sources (skip list)
        ↓
Step 2: Google News VN scan
  Fetch https://news.google.com/rss?hl=vi&gl=VN
  → Parse RSS XML → extract VN domains from <source> tags
  → Count domain frequency
        ↓
Step 3: Backlink mining
  Query recent articles (last 7 days, max 500)
  → Extract outbound URLs from content_clean
  → Count VN domains referenced ≥3 times
        ↓
Step 4: Merge + deduplicate candidates
  Union Google News + backlink domains
  Remove already-known domains
  Rank by total mention count
        ↓
Step 5: For each candidate (top 20):
  a. RSS auto-detect:
     - Fetch HTML → find <link rel="alternate" type="application/rss+xml">
     - Fallback: try common paths (/rss, /feed, /rss/home.rss)
  b. Quality probe:
     - Fetch homepage → find article links
     - Download 3 sample articles
     - Score with ContentQualityScorer (length + structure + VN ratio + spam)
     - Reject if avg quality < 0.4
        ↓
Step 6: Store qualified sources in rss_sources
  name: "[NEW] Domain Name"
  is_active: false (requires admin approval)
  discovery_meta: {domain, rss_detected, mention_count, avg_quality, discovered_via, discovered_at}
        ↓
Admin reviews on dashboard → toggle is_active: true → source joins crawl rotation
```
