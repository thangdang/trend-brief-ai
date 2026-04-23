# TrendBrief AI — Unified Technical Design

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     NGINX (Reverse Proxy)                 │
│               SSL + static serve + gzip                   │
├──────────┬───────────┬───────────────────────────────────┤
│          │           │                                    │
│ trendbriefai-web  trendbriefai-ui   trendbriefai-mobile   │
│ (Angular 21)     (Angular 21)      (Flutter)              │
│ Public SSR       Admin SPA         iOS/Android            │
│          │           │                                    │
├──────────┴───────────┴───────────────────────────────────┤
│                  trendbriefai-service                      │
│                  (Express.js / TypeScript)                 │
│  /api/feed  /api/search  /api/trending  /api/auth         │
│  /api/bookmarks  /api/interactions  /api/notifications     │
│  /api/topics  /api/users  /api/admin  /api/public          │
├──────────────────────────────────────────────────────────┤
│                  trendbriefai-engine                       │
│                  (FastAPI / Python)                        │
│  Crawl → Clean → Quality → Cache → Summarize → Classify  │
│  → Dedup → Store                                          │
├──────────────────────────────────────────────────────────┤
│  MongoDB    Redis    Ollama (LLaMA 3/Mistral)             │
│  (data)     (cache)  (local AI inference)                  │
├──────────────────────────────────────────────────────────┤
│  Firebase (FCM + Crashlytics + Analytics)                 │
└──────────────────────────────────────────────────────────┘
```

---

## 1. AI Engine Design (Python/FastAPI)

### Pipeline Flow (Concurrent)

```
Source RSS/HTML → Crawl entries
    │
    ▼ (asyncio.Semaphore, concurrency=5, rate_delay=1.5s)
For each article:
    │
[1] URL hash dedup (O(1) skip)
[2] Extract + clean (newspaper3k + BeautifulSoup + Vietnamese NFC)
[3] Quality score (length + structure + VN ratio + spam) → < 0.3 = skip
[4] Cache check (LRU → Redis) → hit = skip Ollama
[5] AI summarize (Ollama batch, fallback: extractive)
[6] Hybrid classify (keyword + zero-shot if low confidence)
[7] FAISS dedup (embedding cosine ≥ 0.8, top-k=10)
[8] Store in MongoDB
```

### Two-Level Cache

```
Request → LRU (in-memory, max 1000) → Redis (TTL 24h) → Ollama
                                                          ↓
                                              Store in both caches
```

Keys: `ai:summary:{sha256}`, `ai:classify:{sha256}`

### Hybrid Classifier

```
Article text → Keyword matching (9 topics)
    │
    ├── hits > 2 → Use keyword result
    │
    └── hits ≤ 2 → Zero-shot (xlm-roberta-large-xnli)
                    → Combine: 0.4×keyword + 0.6×zero-shot
                    → Highest score wins
```

Vietnamese labels: "công nghệ và trí tuệ nhân tạo", "tài chính và kinh tế", "phong cách sống", etc.

### FAISS Dedup

- IndexFlatIP (inner product on L2-normalized 384-dim vectors = cosine similarity)
- Top-k=10 nearest neighbors per query
- Rebuild every 6h (remove articles outside 48h window)
- Fallback: brute-force scan when index empty

### Content Quality Scorer

```python
overall = 0.3×length + 0.25×structure + 0.25×vn_ratio + 0.2×(1−spam)
# length: 0 if <100 chars, 1.0 if ≥800
# structure: based on paragraph count (≥3 = 1.0)
# vn_ratio: Vietnamese chars / total alpha chars
# spam: URLs, repeats, all-caps blocks
```

### Health Endpoint (`GET /health`)

```json
{
  "status": "ok",
  "models": { "sentence_transformer": "ready", "ollama": "ready" },
  "cache": { "lru_size": 42, "redis": "connected" },
  "faiss_index_size": 12500
}
```

---

## 2. Mobile App Design (Flutter)

### Screen Flow

```
First Launch → Onboarding (3 screens) → Feed
                                          │
Subsequent → Feed ←→ Search              │
              │       │                   │
              ├── Article Detail ←── Trending Carousel
              │       │
              │       ├── Share (Zalo/FB/Copy)
              │       └── "Đọc bài gốc" (in-app browser)
              │
              ├── Bookmarks
              ├── Reading History
              └── Profile (stats, settings, referral, streak)
```

### Onboarding Flow

```
Screen 1: Welcome — value proposition, "Bắt đầu" button
Screen 2: Topic Selection — dynamic chips from API, ≥1 required
Screen 3: Completion — "Khám phá ngay →"
    → POST /api/users/me/onboarding → Navigate to Feed
    → Show only once per account
```

### Design System

| Token | Light | Dark |
|-------|-------|------|
| Primary | #6366f1 (Indigo) | #818cf8 |
| Surface | #ffffff | #1e1e2e |
| On Surface | #1e293b | #e2e8f0 |
| Error | #ef4444 | #f87171 |

Typography: Inter (Vietnamese-friendly), 5 scales: headline/title/body/label/caption

### Enhanced Feed Card

```
┌─────────────────────────────┐
│ [Thumbnail 16:9 or gradient]│
├─────────────────────────────┤
│ 🔥 Trending  ·  AI  ·  2h  │
│                              │
│ Samsung ra mắt Galaxy S25    │
│ Ultra — giá từ 33 triệu     │
│                              │
│ • Camera 200MP cải tiến      │
│ • Pin 5000mAh, sạc 45W      │
│ • AI tích hợp Galaxy AI 2.0  │
│                              │
│ 💡 Đáng chú ý vì...         │
│                              │
│ ⏱ 30s  ☆ Bookmark  ↗ Share  │
└─────────────────────────────┘
```

### Offline Strategy

- Cache last feed page in Hive (SQLite-like, Flutter-native)
- Show cached data with "Dữ liệu cũ" badge when offline
- "Không có kết nối mạng" banner via connectivity_plus
- Disable search + share when offline

### Local Storage (Hive)

| Box | Key | Value |
|-----|-----|-------|
| feed_cache | last_feed_page | List\<FeedItem\> JSON |
| settings | theme_mode | "light" / "dark" / "system" |
| settings | onboarding_completed | bool |
| settings | review_last_prompt_date | ISO date string |
| settings | review_articles_viewed | int |

---

## 3. Push Notification Architecture

```
BullMQ Cron (service)
    │
    ├── trending_check (every 30 min) → articles with 1000+ views in 1h
    ├── daily_digest (8 AM daily) → top article by views + quality
    ├── weekly_digest (Sunday 9 AM) → top 5 articles of the week
    └── topic_update (every 2h) → 5+ new articles in subscribed topic
    │
    ▼
Notification Service
    → Build payload → Filter by user prefs → Dedup (Redis 24h) → Send via FCM → Log
    │
    ▼
Firebase Cloud Messaging → Android / iOS (deep link to article)
```

| Type | Frequency Cap | Deep Link |
|------|--------------|-----------|
| trending | 3/day | `/article/{id}` |
| topic_update | 1/topic/day | `/feed?topic={t}` |
| daily_digest | 1/day | `/feed` |
| weekly_digest | 1/week | `/feed` |

---

## 4. Content Moderation Pipeline

```
New article crawled
    → [1] Keyword blocklist (Vietnamese spam/NSFW)
    → [2] Source whitelist/blacklist check
    → [3] Quality score gate (< 0.3 = skip)
    → [4] AI classification confidence check (< 0.5 = flag)
    → [5] Published to feed
    → [6] User reports → 3+ reports = auto-hide → admin review
```

### Moderation Config (Dynamic)
```json
{
  "block_keywords": ["cá cược", "casino", "18+", "cá độ", "slot game"],
  "flag_keywords": ["quảng cáo", "tài trợ", "sponsored"],
  "block_domains": ["spam-news.vn"]
}
```

---

## 5. Rich Share Cards

```
GET /api/public/share-image/{articleId}
    → Generate OG image (sharp + canvas)
    → Cache in Redis (24h)
    → Return PNG/WebP
```

Per-article OG meta tags on web:
```html
<meta property="og:title" content="{titleAi}" />
<meta property="og:description" content="{summaryBullets[0]}" />
<meta property="og:image" content="https://trendbriefai.vn/api/public/share-image/{id}" />
<meta property="og:type" content="article" />
<meta property="article:published_time" content="{publishedAt}" />
```

---

## 6. Referral System

```
User A → Profile → "Mời bạn bè" → Copy: trendbriefai.vn/ref/NGUYENA
User B opens link → App store → Signs up with ref code
Both get: 7 ngày Premium (ad-free, unlimited AI, exclusive "Insight" topic)
Cap: max 10 referrals/user/month
```

User model additions: `referral_code`, `referred_by`, `referral_count`, `streak_count`, `last_active_date`, `premium_until`

---

## 7. Admin Dashboard Pages

| Page | Features |
|------|----------|
| Analytics | DAU/MAU/D7 retention chart, article views by topic, top 10 articles, ad/affiliate stats |
| Sources | List RSS sources + status, add/edit/delete, manual "Crawl Now" |
| Moderation | Reported articles queue, auto-hidden list, restore/confirm/delete, blocklist editor |
| Ads | CRUD native ads, impressions/clicks/CTR |
| Affiliates | CRUD links, clicks/conversions |
| Notifications | Send manual push, delivery logs |
| Users | View users, ban/suspend, activity |

---

## 8. ASO (App Store Optimization)

**Title:** TrendBrief AI - Đọc Tin Nhanh
**Subtitle:** Tin tức AI tóm tắt 30 giây

**Keywords:** đọc tin nhanh, tin tức AI, tóm tắt tin tức, tin tức Việt Nam, đọc báo, tin nóng hôm nay

**Screenshots:** Feed + trending, article detail + AI bullets, onboarding topics, search, push notification

**Category:** News → News Aggregator

---

## 9. Data Models

### New/Modified Collections

| Collection | Purpose |
|-----------|---------|
| `topics` | Dynamic topic list (key, label, icon, color, order, is_active) |
| `device_tokens` | FCM tokens (user_id, token, platform) |
| `notification_logs` | Push delivery tracking (user_id, article_id, sent_at, type) |
| `article_reports` | User reports (article_id, user_id, reason) |
| `referrals` | Referral tracking (referrer_id, referee_id, code, reward_granted) |

### User Model Additions

```json
{
  "onboarding_completed": true,
  "notifications_enabled": true,
  "notification_prefs": { "trending": true, "topic": true, "daily": true, "weekly": true },
  "settings": { "theme": "dark" },
  "referral_code": "NGUYENA_TB",
  "referred_by": "FRIEND_TB",
  "referral_count": 5,
  "streak_count": 12,
  "last_active_date": Date,
  "premium_until": Date
}
```

### FeedItem Additions

```json
{
  "thumbnailUrl": "https://...",
  "isTrending": true,
  "imageUrl": "https://..."
}
```

---

## 10. Backend API Endpoints

### Public (no auth)
- `GET /api/public/feed` — paginated feed with topic filter
- `GET /api/public/articles/{id}` — article detail
- `GET /api/public/search?q=` — full-text search
- `GET /api/public/trending` — top articles
- `GET /api/public/topics` — dynamic topic list
- `GET /api/public/share-image/{id}` — OG image for sharing

### Auth Required
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`
- `GET /api/feed` — personalized feed (topic boost + recency + interaction penalty)
- `GET /api/feed/cursor` — cursor-based pagination for infinite scroll
- `GET/POST/DELETE /api/bookmarks`
- `POST /api/interactions` — track view, click, share, bookmark
- `GET /api/users/me/profile`, `PUT /api/users/me/interests`
- `GET /api/users/me/stats` — articles read, bookmarks, days active
- `GET /api/users/me/history` — reading history (paginated)
- `POST /api/users/me/onboarding` — save interests, mark complete
- `PUT /api/users/me/settings` — theme, notifications
- `POST /api/notifications/register` — FCM token
- `POST /api/articles/{id}/report` — user report

### Admin
- `GET /api/admin/analytics` — DAU, MAU, retention, engagement
- `GET/POST/PUT/DELETE /api/admin/sources` — RSS source CRUD
- `GET /api/admin/moderation` — reported + auto-hidden articles
- `POST /api/admin/moderation/{id}/restore|hide|delete`
- `GET/POST/PUT /api/admin/ads` — native ad CRUD
- `GET/POST/PUT /api/admin/affiliates` — affiliate link CRUD
- `POST /api/admin/notifications/send` — manual push
- `GET /api/admin/notifications/logs` — delivery logs
- `GET /api/admin/users` — user list with activity

---

## 11. SEO Strategy (Web)

- Dynamic meta tags per page (SeoService — title, description, canonical, OG, Twitter Card)
- JSON-LD Article schema on article detail pages
- Dynamic sitemap from article catalog + Google News sitemap format
- robots.txt allowing / , disallowing /api/
- Noscript fallback content for crawlers
- Preconnect + preload for fonts
- nginx: gzip, 1y cache for JS/CSS, 30d for images, security headers

---

## 12. Correctness Properties (Testing)

### AI Engine (Hypothesis — Python)
- P1: Summarizer output structure invariant (title ≤12 words, 3 bullets, 1 reason)
- P2: Batch grouping correctness (ceil(N/B) batches, no duplicates)
- P3: Batch failure isolation (one failure doesn't affect others)
- P4: Two-level cache round-trip (identical result with from_cache=True)
- P5: LRU eviction invariant (size never exceeds max)
- P6: Hybrid classifier threshold dispatch
- P7: Score combination formula (0.4×kw + 0.6×zs)
- P8: FAISS search equivalence to brute-force
- P9: FAISS IP = cosine similarity on normalized vectors
- P10: FAISS rebuild removes expired entries
- P11: Batch embedding equivalence
- P12: Pipeline concurrency limit
- P13: Pipeline failure isolation
- P14: Pipeline stats invariant (new + dup + failed == N)
- P15: Vietnamese NFC idempotence
- P16: Vietnamese cleaning completeness
- P17: Quality score range [0.0, 1.0]
- P18: Quality threshold gate
- P19: Redis key namespace invariant

### Mobile (dart_check — Flutter)
- P1: Theme preference round-trip
- P2: Onboarding topic selection validation (≥1)
- P3: FeedCard thumbnail vs placeholder
- P4: Relative time formatting (Vietnamese)
- P5: Trending badge conditional rendering
- P6: ArticleDetailView field completeness
- P7: Search query minimum length (≥2)
- P9: Share content formatting
- P10: Review prompt eligibility
- P11: Review tracking state round-trip
- P12: Feed cache round-trip
- P13: Dynamic topic chips count

### Backend (fast-check — TypeScript)
- P8: Trending limit enforcement
- P14: Reading history ordering
- P15: Notification targeting by topic
- P16: Notification daily rate limit (max 3)
