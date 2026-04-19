# TrendBrief AI – Architecture

## Tổng quan

TrendBrief AI là ứng dụng giúp người trẻ Việt Nam (Gen Z, 18–30) cập nhật nhanh xu hướng, tin tức qua AI tóm tắt. Đọc nhanh trong 30–60 giây, giảm overload thông tin, cá nhân hóa theo sở thích.

## Kiến trúc tổng thể

```
┌──────────────────┐     ┌──────────────────┐
│ trendbriefai-    │     │  trendbriefai-ui  │
│ mobile           │     │  (Angular 19+)    │
│ (Flutter App)    │     │  ArchitectUI      │
│ Android + iOS    │     │  Port: 4200       │
└────────┬─────────┘     └────────┬──────────┘
         │  REST API               │  REST API
         └───────────┬─────────────┘
                     │
          ┌──────────▼──────────┐
          │ trendbriefai-service │
          │ Express.js + TS      │
          │ JWT Auth + BullMQ    │
          │ Port: 3000           │
          └──────────┬──────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──┐  ┌─────▼─────┐  ┌──▼────────────────┐
│ MongoDB   │  │   Redis   │  │ trendbriefai-      │
│ Port:     │  │   Port:   │  │ engine             │
│ 27017     │  │   6379    │  │ FastAPI + AI       │
└───────────┘  └───────────┘  │ Ollama + Embedding │
                              │ Port: 8000         │
                              └────────────────────┘
```

## Thành phần chi tiết

### 1. trendbriefai-service (Backend API)

| Thuộc tính | Giá trị |
|------------|---------|
| Framework | Express.js 4.x |
| Ngôn ngữ | TypeScript 5.x |
| Runtime | Node.js 20+ |
| Database | MongoDB 7 (Mongoose 8) |
| Cache | Redis 7 (ioredis) |
| Queue | BullMQ |
| Auth | JWT (access 15m + refresh 7d) |
| Security | CORS, Rate Limit (100 req/min), Zod validation |
| Scheduler | node-cron (crawl mỗi 10 phút) |

**Models:**
- `User` — email, password_hash, interests (topic array)
- `Article` — url, url_hash, title_original, title_ai, summary_bullets[3], reason, topic, source, embedding[384], cluster_id, processing_status, is_sponsored, sponsor_name, sponsor_url
- `Cluster` — centroid_embedding, representative_article_id, article_count
- `Bookmark` — user_id, article_id (unique compound)
- `Interaction` — user_id, article_id, action (view/click_original/share/bookmark)

Topics: `ai`, `finance`, `lifestyle`, `drama`, `technology`, `career`, `health`, `entertainment`, `sport`, `insight`
- `RssSource` — name, url, category, source_type (rss/html_scrape/api), is_active, crawl_interval_minutes, last_crawled_at, scrape_link_selector, scrape_content_selector
- `Ad` — title, description, image_url, target_url, advertiser, topic, status, start/end_date, impressions, clicks, budget_cents, spent_cents
- `AffiliateLink` — title, url, topic, commission, provider, is_active, clicks, impressions, conversions
- `Analytics` — date, total_views, unique_users, total_clicks, total_shares, total_bookmarks, ad_impressions, ad_clicks, affiliate_clicks, affiliate_impressions
- `UserActivity` — user_id, date, sessions, articles_viewed, first_seen_at, last_seen_at
- `DeviceToken` — user_id, token (unique), platform (ios/android)
- `NotificationLog` — user_id, article_id, type (trending/topic_update/weekly_digest), sent_at
- `Topic` — key (unique), label, icon, color, order, is_active

**API Routes:**

| Route | Mô tả |
|-------|-------|
| `POST /api/auth/register` | Đăng ký |
| `POST /api/auth/login` | Đăng nhập |
| `POST /api/auth/refresh` | Refresh token |
| `GET /api/feed` | Feed cá nhân hóa (query: topic, page, limit) — includes native ads + affiliate links |
| `GET /api/articles/:id` | Chi tiết bài viết |
| `GET /api/search` | Tìm kiếm bài viết (query: q, topic, page, limit) |
| `GET /api/trending` | Bài viết đang hot (query: limit) |
| `POST /api/bookmarks` | Lưu bài (idempotent) |
| `DELETE /api/bookmarks/:id` | Bỏ lưu |
| `GET /api/bookmarks` | Danh sách đã lưu |
| `POST /api/interactions` | Track hành vi user |
| `GET /api/topics` | Danh sách chủ đề |
| `PUT /api/users/interests` | Cập nhật sở thích |
| `GET /api/users/me` | Thông tin user profile |
| `GET /api/users/me/stats` | User engagement statistics |
| `GET /api/users/me/history` | Reading history |
| `POST /api/users/me/onboarding` | Complete onboarding |
| `PUT /api/users/me/settings` | Theme & notification preferences |
| `GET /api/ads` | Danh sách quảng cáo (admin) |
| `POST /api/ads` | Tạo quảng cáo (admin) |
| `PUT /api/ads/:id` | Cập nhật quảng cáo (admin) |
| `POST /api/ads/:id/click` | Track click quảng cáo (public) |
| `GET /api/affiliates` | Danh sách affiliate links (admin) |
| `POST /api/affiliates` | Tạo affiliate link (admin) |
| `POST /api/affiliates/:id/click` | Track click affiliate (public) |
| `GET /api/analytics` | Daily analytics (query: startDate, endDate) |
| `POST /api/analytics/aggregate` | Trigger aggregation hôm nay |
| `GET /api/analytics/dau` | DAU (query: date) |
| `GET /api/analytics/mau` | MAU (query: month) |
| `GET /api/analytics/retention` | D7 retention (query: cohortDate) |
| `GET /api/analytics/engagement` | Avg sessions + articles per user |

### 2. trendbriefai-engine (AI Service)

| Thuộc tính | Giá trị |
|------------|---------|
| Framework | FastAPI |
| Ngôn ngữ | Python 3.12 |
| LLM | Ollama (LLaMA 3 / Mistral) — free, local |
| Embedding | sentence-transformers (all-MiniLM-L6-v2, 384-dim) — free, local |
| Crawler | feedparser + newspaper3k + httpx (HTML scrape) |
| Cleaner | BeautifulSoup4 |
| Classifier | Keyword-based (Vietnamese + English), 9 topics + zero-shot hybrid |
| Dedup | 3-layer: URL hash + Title similarity + Embedding cosine |
| Quality Scorer | Weighted signal scoring (length, structure, Vietnamese ratio, spam) — pre-summarization gate |
| Scraper | HTML listing page crawler (httpx + BeautifulSoup) cho nguồn không có RSS |
| Translator | Language detection (langdetect + VN heuristic) + Ollama translation to Vietnamese |
| Discovery | Auto-find new VN news sources (Google News scan + backlink mining + RSS detect + quality probe) |

**AI Pipeline:**
```
Source (RSS/HTML) → feedparser or httpx+BeautifulSoup → newspaper3k → BeautifulSoup clean
→ Language detect (langdetect + VN diacritics heuristic)
→ Translate to Vietnamese if non-VN (Ollama, fallback: pass-through)
→ Quality score gate (skip if < 0.3)
→ Ollama summarize (title_ai + 3 bullets + reason)
→ Keyword classify (ai/finance/lifestyle/drama/technology/career/health/entertainment/sport/insight)
→ 3-layer dedup (URL hash → title ≥0.8 → embedding ≥0.8)
→ MongoDB store (with source_lang + was_translated metadata)
```

**AI Endpoints:**

| Endpoint | Mô tả |
|----------|-------|
| `POST /crawl` | Crawl source → full pipeline (RSS or HTML scrape) |
| `POST /process` | Process single article (clean + translate + summarize + classify) |
| `POST /dedup/check` | Check duplicate |
| `POST /translate` | Detect language + translate to Vietnamese |
| `POST /discover` | Auto-discover new VN news sources (Google News + backlinks + RSS detect + quality probe) |
| `GET /health` | Health check |

**Summarization Prompt:**
```
Tóm tắt bài viết thành:
- 1 tiêu đề ngắn (<=12 từ), bắt đầu bằng "TITLE:"
- 3 bullet chính, mỗi bullet bắt đầu bằng "- "
- 1 câu: Vì sao bạn nên quan tâm, bắt đầu bằng "REASON:"
Tone: trẻ, dễ hiểu
```

**Fallback:** Nếu Ollama fail → extractive summary (câu đầu = title, 3 câu đầu = bullets, reason mặc định).

### 3. trendbriefai-ui (Web Dashboard)

| Thuộc tính | Giá trị |
|------------|---------|
| Framework | Angular 19+ (standalone components) |
| UI Template | ArchitectUI Free (inspired) |
| State | Signals |
| HTTP | HttpClient + interceptor |

**Pages:**
- Login / Register — form validation, JWT storage
- Feed — article cards, topic filter tabs, search bar, trending section, infinite scroll, bookmark toggle, share button, reading time, native ads, affiliate links
- Bookmarks — saved articles, remove
- Profile — interest selection (AI, Finance, Lifestyle, Drama, Technology, Career, Health, Entertainment, Sport)

### 4. trendbriefai-mobile (Flutter App)

| Thuộc tính | Giá trị |
|------------|---------|
| Framework | Flutter 3.x |
| State | Provider |
| HTTP | Dio + interceptor |
| Storage | flutter_secure_storage |

**Screens:**
- Login — đăng nhập
- Register — đăng ký tài khoản
- Onboarding — chọn chủ đề quan tâm lần đầu
- Home — bottom navigation, điều hướng chính
- Feed — card UI, topic chips, pull-to-refresh, infinite scroll, share button, reading time
- Article Detail — chi tiết bài viết, bookmark, share
- Search — tìm kiếm bài viết
- Bookmarks — swipe-to-dismiss, danh sách đã lưu
- Reading History — lịch sử bài đã đọc
- Profile — interest chips, cài đặt, logout

## Database Schema (MongoDB)

```
users {
  _id, email (unique), password_hash,
  interests[] (ai/finance/lifestyle/drama/technology/career/health/entertainment/sport/insight),
  created_at, updated_at
}

articles {
  _id, url (unique), url_hash (unique, MD5),
  title_original, title_ai, summary_bullets[3],
  reason, content_clean,
  topic (ai/finance/lifestyle/drama/technology/career/health/entertainment/sport/insight),
  source, published_at, embedding[384],
  cluster_id, processing_status (pending/processing/done/failed/fallback),
  is_sponsored, sponsor_name, sponsor_url,
  source_lang (vi/en/...), was_translated (bool),
  created_at
}
Index: topic, created_at DESC, url_hash, source, processing_status,
       text(title_original, title_ai)

clusters {
  _id, centroid_embedding[], representative_article_id,
  article_count, created_at
}

bookmarks {
  _id, user_id, article_id, created_at
  UNIQUE(user_id, article_id)
}
Index: user_id + created_at DESC

interactions {
  _id, user_id, article_id,
  action (view/click_original/share/bookmark),
  created_at
}
Index: user_id + created_at DESC, article_id

rss_sources {
  _id, name, url, category,
  source_type (rss/html_scrape/api),
  is_active, crawl_interval_minutes,
  last_crawled_at,
  scrape_link_selector, scrape_content_selector,
  discovery_meta {domain, rss_detected, mention_count, avg_quality, discovered_via[], discovered_at},
  created_at
}
Index: is_active, source_type

ads {
  _id, title, description, image_url, target_url,
  advertiser, topic, status (active/paused/expired),
  start_date, end_date, impressions, clicks,
  budget_cents, spent_cents, created_at
}
Index: status + topic, end_date

affiliate_links {
  _id, title, url, topic, commission, provider,
  is_active, clicks, impressions, conversions, created_at
}
Index: topic + is_active

analytics {
  _id, date (unique, YYYY-MM-DD),
  total_views, unique_users, total_clicks,
  total_shares, total_bookmarks,
  ad_impressions, ad_clicks,
  affiliate_clicks, affiliate_impressions, created_at
}

user_activities {
  _id, user_id, date (YYYY-MM-DD),
  sessions, articles_viewed,
  first_seen_at, last_seen_at, created_at
  UNIQUE(user_id, date)
}
Index: date, user_id + created_at

device_tokens {
  _id, user_id, token (unique),
  platform (ios/android),
  created_at, updated_at
}
Index: user_id, token (unique)

notification_logs {
  _id, user_id, article_id,
  type (trending/topic_update/weekly_digest),
  sent_at
}
Index: user_id + sent_at DESC, user_id + sent_at ASC

topics {
  _id, key (unique), label, icon, color,
  order, is_active, created_at
}
Index: key (unique), order, is_active
```

## Content Sources (38 nguồn Việt Nam)

Sources are defined in `spec/resources.json` (9 topics × ~20 URLs each) and seeded via `database/002_seed_rss_sources.js`.

| Category | RSS | HTML Scrape | Total | Key Sources |
|----------|-----|-------------|-------|-------------|
| general | 9 | 0 | 9 | VnExpress, Tuổi Trẻ, Thanh Niên, Zing, Dân Trí, VietnamNet, VietnamPlus, Lao Động, VOV |
| ai | 8 | 6 | 14 | VnExpress Số hóa, ICT News, Genk, Tinhte, Dân Trí CN, VOV CN |
| finance | 9 | 7 | 16 | CafeF, CafeBiz, VnEconomy, VietnamBiz, Báo Đầu Tư, Vietstock |
| lifestyle | 8 | 5 | 13 | Kenh14, VnExpress Đời sống, Afamily, Eva |
| drama | 7 | 7 | 14 | Kenh14 Star, Zing Giải trí, Saostar, Tiin |
| health | 2 | 0 | 2 | VnExpress Sức khỏe, Sức khỏe Đời sống |
| entertainment | 1 | 0 | 1 | VnExpress Giải trí |
| sport | 2 | 1 | 3 | VnExpress Thể thao, Bóng Đá Plus, Thể Thao 247 |
| career | 1 | 3 | 4 | VnExpress Giáo dục, TopDev, TopCV, ITviec |
| insight | 1 | 1 | 2 | Medium Vietnam, Spiderum |

> New sources are auto-discovered weekly by the Resource Discovery Service (Google News VN scan + backlink mining). Discovered sources are stored with `is_active: false` for admin review.

## Resource Discovery (Auto)

Weekly cron (Sunday 3:00 AM) runs the discovery pipeline:

```
Google News VN RSS scan → extract popular VN domains
Backlink mining → scan recent articles for outbound VN domain links
    → merge + deduplicate (skip existing sources)
    → for each candidate:
        1. RSS auto-detect (<link rel="alternate"> + common paths)
        2. Quality probe (fetch 3 articles, score content quality)
        3. If quality ≥ 0.4 → store as rss_sources with is_active=false
    → admin reviews on dashboard → toggle is_active=true
```

Manual trigger: `POST /discover` on AI engine.

## Feed Personalization Algorithm

```
score = topicBoost + recencyScore + interactionPenalty

topicBoost:      +2.0 nếu article.topic ∈ user.interests
recencyScore:    1.0 → 0.0 linear decay trong 48 giờ
interactionPenalty: -5.0 nếu user đã xem bài

Sort: score DESC, created_at DESC (tiebreaker)
Cache: Redis key feed:{userId}:{topic}:{page}, TTL 300s
```

## Hybrid Deployment (Primary Target)

Kiến trúc hybrid cho giai đoạn MVP — AI engine chạy trên Local PC, services trên VPS $24.

- **VPS ($24/mo)**: trendbriefai-service + trendbriefai-ui + MongoDB + Redis
- **Local PC (16GB)**: trendbriefai-engine (Ollama + sentence-transformers + feedparser/newspaper3k)
- **Kết nối**: Cloudflare Tunnel (HTTPS, không cần IP tĩnh)
- **Fallback**: PC offline → extractive summary fallback (không cần AI model)
- **Cache**: Redis feed cache (VPS, TTL 300s)
- **Chi phí**: ~$26/tháng (~650,000đ)

Xem chi tiết: [Deploy Guide](./04-deploy.md) | [Network Diagram](./06-hybrid-network.md)

## Security

- JWT access token (15m) + refresh token (7d)
- Password hashed bcrypt (12 rounds)
- Rate limiting: 100 req/min (general), 5 req/min (auth)
- Zod schema validation cho tất cả request bodies
- CORS whitelist
- AI chạy local (Ollama) — không gửi data ra ngoài
