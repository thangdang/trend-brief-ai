# TrendBrief AI — Release 1 Unified Design

---

## 1. System Architecture Overview

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
│  API only — serves feed, auth, payments, notifications    │
│  Calls engine via HTTP for AI (related, summarize-url)    │
│  CRAWL_MODE=engine → no crawl trigger from service        │
├──────────────────────────────────────────────────────────┤
│                  trendbriefai-engine                       │
│                  (FastAPI / Python)                        │
│  api.py:       AI endpoints (/related, /summarize-url,    │
│                /process, /dedup, /personalize, /briefing) │
│  scheduler.py: Independent crawl scheduler (every 10min)  │
│                Reads RSS sources from MongoDB              │
│                Crawl → Clean → Summarize → Classify →     │
│                Embed → Dedup → Store (all local AI)       │
├──────────────────────────────────────────────────────────┤
│  MongoDB    Redis    Ollama (LLaMA 3/Mistral)             │
│  (shared)   (cache)  (local AI inference)                  │
├──────────────────────────────────────────────────────────┤
│  Meilisearch (full-text search, Vietnamese tokenizer)     │
├──────────────────────────────────────────────────────────┤
│  Firebase (FCM + Crashlytics + Analytics)                 │
└──────────────────────────────────────────────────────────┘
```

### Docker Services

```yaml
meilisearch:
  image: getmeili/meilisearch:v1.7
  ports:
    - "7700:7700"
  environment:
    MEILI_MASTER_KEY: ${MEILI_MASTER_KEY:-dev-key}
  volumes:
    - meili-data:/meili_data
```

---

## 2. AI Engine Design (Python/FastAPI)

### 2.1 Pipeline Flow (Concurrent)

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
[6] Summary quality validation (retry up to 2× if score < 0.6)
[7] Hybrid classify (keyword + zero-shot if low confidence)
[8] FAISS dedup (embedding cosine ≥ 0.8, top-k=10)
[9] Store in MongoDB
```

### 2.2 Two-Level Cache

```
Request → LRU (in-memory, max 1000) → Redis (TTL 24h) → Ollama
                                                          ↓
                                              Store in both caches
```

Keys: `ai:summary:{sha256}`, `ai:classify:{sha256}`

### 2.3 Hybrid Classifier

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

### 2.4 Fast Topic Classifier

```
[Article Text + Title]
    │
    ▼
[Keyword Classifier] ── confidence ≥ 0.8? → return topic (≤5ms)
    │
    └─ confidence < 0.8
    │
    ▼
[Redis Cache] ── cached? → return cached topic
    │
    └─ miss
    │
    ▼
[Ollama LLM Classifier] → cache result → return topic
```

```python
TOPIC_KEYWORDS = {
    "ai": ["AI", "trí tuệ nhân tạo", "machine learning", "ChatGPT", "GPT", "LLM", ...],
    "finance": ["chứng khoán", "lãi suất", "ngân hàng", "bitcoin", "crypto", ...],
    "drama": ["sao Việt", "scandal", "hot girl", "showbiz", "MV", ...],
    ...
}

class FastClassifier:
    def classify(self, text: str, title: str) -> tuple[str, float]:
        # Count keyword matches per topic
        # Return (topic, confidence)
```

### 2.5 FAISS Dedup

- IndexFlatIP (inner product on L2-normalized 384-dim vectors = cosine similarity)
- Top-k=10 nearest neighbors per query
- Rebuild every 6h (remove articles outside 48h window)
- Fallback: brute-force scan when index empty

### 2.6 Content Quality Scorer

```python
overall = 0.3×length + 0.25×structure + 0.25×vn_ratio + 0.2×(1−spam)
# length: 0 if <100 chars, 1.0 if ≥800
# structure: based on paragraph count (≥3 = 1.0)
# vn_ratio: Vietnamese chars / total alpha chars
# spam: URLs, repeats, all-caps blocks
```

### 2.7 Summary Quality Validator

```
[LLM Output]
    │
    ▼
[SummaryValidator]
    ├─ title_ai length ≤ 15 words? (0.2)
    ├─ summary_bullets count == 3? (0.3)
    ├─ each bullet 10-50 words?
    ├─ reason ≠ generic fallback? (0.3)
    └─ no hallucinated URLs/names? (0.2)
    │
    ▼
quality_score (0.0 - 1.0)
    │
    ├─ ≥ 0.6 → accept
    └─ < 0.6 → retry with adjusted prompt (max 2)
```

```python
class SummaryValidator:
    GENERIC_REASONS = [
        "Đây là tin tức đáng chú ý mà bạn nên biết.",
        "Bạn nên biết điều này.",
    ]

    def validate(self, summary: dict, original_text: str) -> dict:
        scores = {}
        scores["title_length"] = 1.0 if len(summary.get("title_ai","").split()) <= 15 else 0.0
        scores["bullet_count"] = 1.0 if len(summary.get("summary_bullets",[])) == 3 else 0.0
        scores["reason_quality"] = 0.0 if summary.get("reason","") in self.GENERIC_REASONS else 1.0
        scores["no_hallucination"] = self._check_hallucination(summary, original_text)
        overall = (scores["title_length"]*0.2 + scores["bullet_count"]*0.3
                   + scores["reason_quality"]*0.3 + scores["no_hallucination"]*0.2)
        return {"scores": scores, "overall": round(overall, 3), "valid": overall >= 0.6}
```

### 2.8 Multi-Model LLM Fallback

```
[Summarize Request]
    │
    ▼
[ProviderChain]
    ├─ 1. Ollama (local) ── success? → return
    │     └─ fail → check health → mark degraded
    ├─ 2. Groq (free API) ── success? → return
    │     └─ fail → check health
    └─ 3. Gemini (free API) ── success? → return
          └─ fail → use varied fallback reason
```

```python
class LLMProvider:
    name: str
    def summarize(self, text: str, topic: str) -> dict: ...
    def classify(self, text: str) -> str: ...

class OllamaProvider(LLMProvider): ...
class GroqProvider(LLMProvider): ...
class GeminiProvider(LLMProvider): ...

class ProviderChain:
    providers: list[LLMProvider]
    health: dict[str, ProviderHealth]

    async def summarize(self, text, topic) -> dict:
        for provider in self.providers:
            if self.health[provider.name].is_healthy():
                try:
                    result = await provider.summarize(text, topic)
                    self.health[provider.name].record_success()
                    return result
                except:
                    self.health[provider.name].record_failure()
        return self._varied_fallback()
```

### 2.9 Prompt Templates (Topic-Specific)

```python
PROMPTS = {
    "finance": """Tóm tắt bài viết tài chính/kinh tế:
- Tiêu đề: ngắn gọn, focus số liệu quan trọng (≤12 từ)
- 3 bullet: tập trung vào con số, tỷ giá, tác động đến ví tiền người đọc
- Lý do quan tâm: liên hệ trực tiếp đến tài chính cá nhân
Tone: chuyên nghiệp nhưng dễ hiểu""",

    "drama": """Tóm tắt tin giải trí/drama:
- Tiêu đề: gây tò mò, mention nhân vật chính (≤12 từ)
- 3 bullet: ai, chuyện gì, phản ứng cộng đồng
- Lý do quan tâm: vì sao đây là hot topic
Tone: trẻ trung, hóng hớt nhẹ""",

    "ai": """Tóm tắt tin AI/công nghệ:
- Tiêu đề: focus ứng dụng thực tế hoặc breakthrough (≤12 từ)
- 3 bullet: công nghệ gì, ai phát triển, ảnh hưởng thế nào
- Lý do quan tâm: tác động đến công việc/cuộc sống
Tone: tech-savvy nhưng accessible""",
}
```

### 2.10 Content Moderation Pipeline

```
New article crawled
    → [1] Keyword blocklist (Vietnamese spam/NSFW)
    → [2] Source whitelist/blacklist check
    → [3] Quality score gate (< 0.3 = skip)
    → [4] AI classification confidence check (< 0.5 = flag)
    → [5] Published to feed
    → [6] User reports → 3+ reports = auto-hide → admin review
```

Moderation Config (Dynamic):
```json
{
  "block_keywords": ["cá cược", "casino", "18+", "cá độ", "slot game"],
  "flag_keywords": ["quảng cáo", "tài trợ", "sponsored"],
  "block_domains": ["spam-news.vn"]
}
```

### 2.11 Health Endpoint (`GET /health`)

```json
{
  "status": "ok",
  "models": { "sentence_transformer": "ready", "ollama": "ready" },
  "cache": { "lru_size": 42, "redis": "connected" },
  "faiss_index_size": 12500
}
```

---

## 3. Crawler Design

### 3.1 Source Health Tracking

```
[Crawl Job Completes]
    │
    ▼
[Update Source Health]
    ├─ success_count++
    ├─ total_count++
    ├─ success_rate = success / total (rolling 24h)
    ├─ last_successful_at = now (if success)
    └─ consecutive_failures = 0 (if success) or ++ (if fail)
    │
    ▼
[Health Check]
    ├─ success_rate < 10% → auto_disabled = true, disabled_until = now + 24h
    ├─ consecutive_failures ≥ 5 → log alert
    └─ disabled_until < now → auto_disabled = false (re-enable)
```

Updated `rss_sources` Schema:

```javascript
{
  // existing fields...
  health: {
    success_count_24h: Number,
    total_count_24h: Number,
    success_rate: Number,        // 0.0 - 1.0
    consecutive_failures: Number,
    last_successful_at: Date,
    last_error: String,
    auto_disabled: Boolean,
    disabled_until: Date,
  }
}
```

### 3.2 Pre-computed Feed Scores

```
[Hourly Background Job]
    │
    ▼
[For each article (last 72h)]
    │
    ├─ recency = max(0, 1 - age_hours / 72)
    ├─ popularity = log10(views + 1) / 5
    ├─ source_quality = source.success_rate
    ├─ quality = article.quality_score or 0.5
    │
    ▼
    feed_score = recency * 0.4 + popularity * 0.25 + quality * 0.2 + source_quality * 0.15
    │
    ▼
[Update article.feed_score]
    │
    ▼
[Feed API: db.articles.find({status:"done"}).sort({feed_score:-1}).limit(20)]
```

Personalization Boost (per-user, at query time):

```
user_score = feed_score
    + (topic in user.interests ? 2.0 : 0)
    + (article_id in user.viewed ? -5.0 : 0)
```

### 3.3 Trending Cache (Redis)

```
[Every 30 min — Background Job]
    │
    ▼
[Aggregate: articles with most views in last 24h]
    │
    ▼
[Store in Redis]
    trending:global → ZADD article_id score (top 50)
    trending:ai → ZADD article_id score (top 20 per topic)
    trending:finance → ...
    │
    ▼
[Trending API]
    GET /api/trending?topic=ai
    → ZREVRANGE trending:ai 0 19
    → Batch fetch article details from MongoDB
    → Return (≤10ms total)
```

### 3.4 Meilisearch Integration

```
[Article Inserted/Updated in MongoDB]
    │
    ▼
[Post-save Hook]
    │
    ▼
[Sync to Meilisearch]
    index: "articles"
    document: { id, title_ai, title_original, summary_bullets, topic, source, created_at }
    │
    ▼
[Search API]
    GET /api/search?q=bitcoin
    → Meilisearch query (Vietnamese tokenizer, typo tolerance)
    → Return highlighted results (≤50ms)
    │
    Fallback: MongoDB $text search if Meilisearch down
```

### 3.5 Image Proxy

```
[Client requests /api/img/:articleId]
    │
    ▼
[Check Redis cache: img:{articleId}:{width}]
    ├─ HIT → serve cached buffer (Content-Type: image/webp)
    └─ MISS
        │
        ▼
    [Fetch original image URL from article]
        │
        ▼
    [Download + resize (sharp: max 800px width) + convert WebP]
        │
        ▼
    [Cache in Redis (1h TTL)]
        │
        ▼
    [Serve response]
```

### 3.6 Rate Limiting

Per-domain crawl delay enforcement (1.5s default), configurable per source. `asyncio.Semaphore` limits concurrency to 5 parallel crawls.

---

## 4. Backend API Design (Express.js / TypeScript)

### 4.1 API Versioning

```
Current:  /api/feed, /api/auth/login, /api/search
New:      /api/v1/feed, /api/v1/auth/login, /api/v1/search

Backward compat:
  app.use('/api', (req, res, next) => {
    if (!req.path.startsWith('/v1/')) {
      res.setHeader('Deprecation', 'true');
    }
    next();
  });
  app.use('/api/v1', v1Router);
  app.use('/api', v1Router); // backward compat
```

### 4.2 Validation Middleware (Zod)

```typescript
// src/middleware/validate.ts
import { z } from 'zod';

export function validate(schema: { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType }) {
  return (req, res, next) => {
    const errors = [];
    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) errors.push(...result.error.issues);
    }
    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) errors.push(...result.error.issues);
    }
    if (errors.length) return res.status(400).json({ errors });
    next();
  };
}

// Usage:
router.get('/feed', validate({ query: feedQuerySchema }), authMiddleware, feedHandler);
```

### 4.3 Circuit Breaker

```
[Service → Engine Call]
    │
    ▼
[CircuitBreaker]
    ├─ CLOSED (normal) → forward request
    │     └─ 5 consecutive failures → OPEN
    ├─ OPEN (blocking) → return cached/fallback immediately
    │     └─ after 30s → HALF_OPEN
    └─ HALF_OPEN (testing) → forward 1 request
          ├─ success → CLOSED
          └─ fail → OPEN
```

Uses `opossum` library for Express.js circuit breaker pattern.

### 4.4 Structured Logging

```typescript
// src/middleware/requestLogger.ts
import { v4 as uuid } from 'uuid';

export function requestLogger(req, res, next) {
  const requestId = uuid();
  const start = Date.now();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user_id: req.user?.id || null,
    };
    if (duration > 1000) {
      console.warn('SLOW_REQUEST', log);
    } else {
      console.info('REQUEST', log);
    }
  });
  next();
}
```

### 4.5 Request Deduplication (Angular Client)

```typescript
// api.service.ts
private pendingGets = new Map<string, Observable<any>>();

deduplicatedGet<T>(url: string, options?: any): Observable<T> {
  const key = url + JSON.stringify(options?.params || {});
  if (this.pendingGets.has(key)) return this.pendingGets.get(key)!;
  const req$ = this.http.get<T>(url, options).pipe(
    shareReplay(1),
    finalize(() => this.pendingGets.delete(key)),
  );
  this.pendingGets.set(key, req$);
  return req$;
}
```

### 4.6 Referral Flow

```
[User A] → shares referral link → [User B clicks]
    │                                    │
    ▼                                    ▼
referral_code stored              registers account
in localStorage                   referral_code linked
    │                                    │
    ▼                                    ▼
                              reads 5 articles (activation)
                                         │
                                         ▼
                              [Reward: User A gets 7 days premium]
                              [Notification: "Bạn được thưởng!"]
```

Cap: max 10 referrals/user/month. Both users get 7 days Premium (ad-free, unlimited AI, exclusive "Insight" topic).

### 4.7 Ad Viewability

```typescript
// Client-side (web/mobile) — IntersectionObserver on ad cards
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
      const timer = setTimeout(() => {
        // 50%+ visible for 1s+ → report viewable impression
        api.post('/api/ads/viewable', {
          ad_id: entry.target.dataset.adId,
          visible_duration: 1000,
          viewport_percentage: Math.round(entry.intersectionRatio * 100),
        });
      }, 1000);
      entry.target._viewTimer = timer;
    } else {
      clearTimeout(entry.target._viewTimer);
    }
  });
}, { threshold: 0.5 });
```

### 4.8 Dynamic Affiliate Matching

```
[Article Summarized] → extract top 5 keywords
    │
    ▼
[Search Affiliate APIs]
    ├─ Shopee API: search(keywords) → products[]
    └─ Lazada API: search(keywords) → products[]
    │
    ▼
[Rank by match_score]
    keyword_overlap × 0.5
    + category_match × 0.3
    + commission_rate × 0.2
    │
    ▼
[Cache results (24h TTL)]
    │
    ▼
[Attach top 2 to article in feed]
```

### 4.9 User Feedback on Summaries

```typescript
// API: POST /api/v1/feedback
interface SummaryFeedback {
  articleId: string;
  userId: string;
  rating: 'up' | 'down';
  reason?: string;  // optional: "too short", "inaccurate", "not relevant"
}

// MongoDB collection: userfeedbacks
// Index: { articleId: 1, userId: 1 } unique
```

### 4.10 Related Articles

```
GET /api/articles/:id/related?limit=5
    │
    ▼
[Check Redis cache: related:{articleId}]
    ├─ HIT → return cached
    └─ MISS
        │
        ▼
    [Call AI engine: POST /related { article_id, limit }]
        │
        ▼
    [Engine: load embedding → find candidates → numpy cosine similarity → return top N]
        │
        ▼
    [Cache in Redis (1h TTL)]
        │
        ▼
    [Return related articles]
    
    Fallback (engine offline): same-topic recent articles from MongoDB
```

Service delegates ALL similarity computation to the AI engine. No cosine similarity in Node.js.

### 4.11 Rich Share Cards

```
GET /api/public/share-image/{articleId}
    → Generate OG image (sharp + canvas)
    → Cache in Redis (24h)
    → Return PNG/WebP
```

Per-article OG meta tags:
```html
<meta property="og:title" content="{titleAi}" />
<meta property="og:description" content="{summaryBullets[0]}" />
<meta property="og:image" content="https://trendbriefai.vn/api/public/share-image/{id}" />
<meta property="og:type" content="article" />
<meta property="article:published_time" content="{publishedAt}" />
```

### 4.12 Database Backup

```bash
#!/bin/bash
# scripts/backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/trendbriefai-backup-$DATE"

mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR"
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"

# Upload to S3/R2
aws s3 cp "$BACKUP_DIR.tar.gz" "s3://trendbriefai-backups/daily/$DATE.tar.gz"

# Cleanup local
rm -rf "$BACKUP_DIR" "$BACKUP_DIR.tar.gz"

# Retention: keep 7 daily, 4 weekly, 3 monthly (S3 lifecycle rules)
```

### 4.13 API Endpoints

#### Public (no auth)
- `GET /api/public/feed` — paginated feed with topic filter
- `GET /api/public/articles/{id}` — article detail
- `GET /api/public/search?q=` — full-text search
- `GET /api/public/trending` — top articles
- `GET /api/public/topics` — dynamic topic list
- `GET /api/public/share-image/{id}` — OG image for sharing

#### Auth Required
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
- `POST /api/v1/feedback` — summary feedback (up/down)
- `GET /api/articles/{id}/related` — related articles

#### Admin
- `GET /api/admin/analytics` — DAU, MAU, retention, engagement
- `GET/POST/PUT/DELETE /api/admin/sources` — RSS source CRUD
- `GET /api/admin/moderation` — reported + auto-hidden articles
- `POST /api/admin/moderation/{id}/restore|hide|delete`
- `GET/POST/PUT /api/admin/ads` — native ad CRUD
- `GET/POST/PUT /api/admin/affiliates` — affiliate link CRUD
- `POST /api/admin/notifications/send` — manual push
- `GET /api/admin/notifications/logs` — delivery logs
- `GET /api/admin/users` — user list with activity
- `GET /api/admin/metrics` — crawl metrics dashboard

---

## 5. Web App Design (Angular 21 — trendbriefai-web)

### 5.1 Dark Mode

```css
/* design-system.css — dark theme */
[data-theme="dark"] {
  --bg: #0f172a;
  --bg-card: #1e293b;
  --bg-hover: #334155;
  --border: #334155;
  --border-hover: #475569;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.4);
}

/* Auto-detect system preference */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* apply dark values */
  }
}
```

Toggle Component:
```typescript
toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}
```

### 5.2 Infinite Scroll

```typescript
// IntersectionObserver on sentinel element at bottom of feed
const observer = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && !loading && hasMore) {
    loadNextPage();
  }
}, { rootMargin: '200px' }); // trigger 200px before reaching bottom

observer.observe(sentinelElement);
```

### 5.3 Onboarding Flow (Web)

Topic selection on first visit, saved via `POST /api/users/me/onboarding`. Show only once per account.

### 5.4 "Tóm tắt cho tôi" Page (`/summarize`)

```
┌─────────────────────────────────────────┐
│  🔗 Tóm tắt cho tôi                    │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Paste URL bài viết bất kỳ...      │  │
│  └────────────────────────────────────┘  │
│  [ 🚀 Tóm tắt ]                        │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 📰 AI-generated title              │  │
│  │                                    │  │
│  │ • Bullet 1                         │  │
│  │ • Bullet 2                         │  │
│  │ • Bullet 3                         │  │
│  │                                    │  │
│  │ 💡 Vì sao bạn nên quan tâm:       │  │
│  │ Reason text here                   │  │
│  │                                    │  │
│  │ 🏷️ Topic: AI                       │  │
│  │                                    │  │
│  │ [📋 Copy] [↗ Share] [🔗 Original]  │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 5.5 Reading Progress Bar

```css
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: var(--accent);
  z-index: 9999;
  transition: width 100ms linear;
}
```

```typescript
@HostListener('window:scroll')
onScroll() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  this.progress = Math.min(100, (scrollTop / docHeight) * 100);
}
```

### 5.6 Article Hover Preview (Desktop)

```
[Mouse enters card] → start 500ms timer
    │
    ├─ Mouse leaves before 500ms → cancel timer
    └─ 500ms elapsed → show tooltip
        │
        ▼
    [Tooltip: 3 bullet summary, bg-card, shadow-lg, max-width 320px]
    │
    ▼
[Mouse leaves card] → hide tooltip (200ms fade-out)
```

```css
.card-tooltip {
  position: absolute;
  z-index: 100;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-3);
  box-shadow: var(--shadow-lg);
  max-width: 320px;
  opacity: 0;
  transition: opacity 200ms ease;
  pointer-events: none;
}
.card-tooltip.visible { opacity: 1; }

/* Disable on touch devices */
@media (pointer: coarse) {
  .card-tooltip { display: none; }
}
```

### 5.7 Social Share Buttons

Styled `.social-share` container with brand-colored pill buttons:
- `.share-btn.zalo` — Zalo blue (#0068FF)
- `.share-btn.fb` — Facebook blue (#1877F2)
- `.share-btn.copy` — neutral style, "Đã copy!" feedback state

### 5.8 UX Error Retry Pattern

```html
<div *ngIf="error()" class="text-center py-5">
  <i class="fa fa-exclamation-circle text-danger" style="font-size: 2rem;"></i>
  <h5 class="mt-3">Không thể tải bài viết</h5>
  <p class="text-muted">Kiểm tra kết nối mạng và thử lại.</p>
  <button class="btn btn-primary" (click)="loadFeed()">Thử lại</button>
</div>
```

### 5.9 Summary Feedback UI

```html
<!-- article-card in feed -->
<div class="feedback-buttons">
  <button (click)="rateSummary(article._id, 'up')" title="Tóm tắt tốt">👍</button>
  <button (click)="rateSummary(article._id, 'down')" title="Tóm tắt chưa tốt">👎</button>
</div>
```

### 5.10 PWA & SEO

- Dynamic meta tags per page (SeoService — title, description, canonical, OG, Twitter Card)
- JSON-LD Article schema on article detail pages
- Dynamic sitemap from article catalog + Google News sitemap format
- robots.txt allowing `/`, disallowing `/api/`
- Noscript fallback content for crawlers
- Preconnect + preload for fonts
- nginx: gzip, 1y cache for JS/CSS, 30d for images, security headers

### 5.11 .css → .scss Migration

All component styles migrated from `.css` to `.scss` for nesting and variable support.

trendbriefai-web — 12 components:
```
pages/feed, article, login, onboarding, payment, privacy,
referral, search, summarize, terms
layout/layout
components/newsletter
```

trendbriefai-ui — 16 components:
```
pages/bookmarks, feed, login, profile, register
pages/admin/ads, affiliates, analytics, moderation, notifications, sources, users
layout/layout, header, sidebar
```

---

## 6. Admin Dashboard Design (Angular 21 — trendbriefai-ui)

### 6.1 Dashboard Pages

| Page | Features |
|------|----------|
| Analytics | DAU/MAU/D7 retention chart, article views by topic, top 10 articles, ad/affiliate stats |
| Sources | List RSS sources + health status, add/edit/delete, manual "Crawl Now" |
| Moderation | Reported articles queue, auto-hidden list, restore/confirm/delete, blocklist editor |
| Ads | CRUD native ads, impressions/clicks/CTR |
| Affiliates | CRUD links, clicks/conversions |
| Notifications | Send manual push, delivery logs |
| Users | View users, ban/suspend, activity |

### 6.2 Crawl Metrics Dashboard

```
GET /api/admin/metrics
    │
    ▼
{
  "articles": {
    "processed_24h": 450,
    "success_rate": 0.87,
    "avg_processing_time_ms": 3200,
    "by_status": { "done": 390, "fallback": 35, "failed": 25 },
    "by_provider": { "ollama": 350, "groq": 30, "gemini": 10, "fallback": 60 }
  },
  "sources": {
    "total": 38,
    "active": 35,
    "degraded": 2,
    "disabled": 1
  },
  "queue": {
    "waiting": 5,
    "active": 2,
    "completed_24h": 144,
    "failed_24h": 3
  }
}
```

### 6.3 Source Management

Source list with health indicators (success rate, consecutive failures, auto-disabled status). Manual "Crawl Now" trigger per source. Add/edit/delete with URL validation.

---

## 7. Mobile App Design (Flutter)

### 7.1 Screen Flow

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

### 7.2 Design System

| Token | Light | Dark |
|-------|-------|------|
| Primary | #6366f1 (Indigo) | #818cf8 |
| Surface | #ffffff | #1e1e2e |
| On Surface | #1e293b | #e2e8f0 |
| Error | #ef4444 | #f87171 |

Typography: Inter (Vietnamese-friendly), 5 scales: headline/title/body/label/caption

### 7.3 Onboarding Flow

```
Screen 1: Welcome — value proposition, "Bắt đầu" button
Screen 2: Topic Selection — dynamic chips from API, ≥1 required
Screen 3: Completion — "Khám phá ngay →"
    → POST /api/users/me/onboarding → Navigate to Feed
    → Show only once per account
```

### 7.4 Enhanced Feed Card

```
┌─────────────────────────────────┐
│ [Thumbnail 16:9 or gradient]    │
├─────────────────────────────────┤
│ 🔥 Trending  ·  AI  ·  2h      │
│                                  │
│ Samsung ra mắt Galaxy S25        │
│ Ultra — giá từ 33 triệu         │
│                                  │
│ • Camera 200MP cải tiến          │
│ • Pin 5000mAh, sạc 45W          │
│ • AI tích hợp Galaxy AI 2.0     │
│                                  │
│ 💡 Đáng chú ý vì...             │
│                                  │
│ ⏱ 30s  ☆ Bookmark  ↗ Share      │
└─────────────────────────────────┘
```

### 7.5 Offline Strategy

- Cache last feed page in Hive (SQLite-like, Flutter-native)
- Show cached data with "Dữ liệu cũ" badge when offline
- "Không có kết nối mạng" banner via connectivity_plus
- Disable search + share when offline

SQLite-based offline reading with sync:

```dart
class CacheService {
  late Database _db;
  
  Future<void> init() async {
    _db = await openDatabase('trendbriefai.db', version: 1,
      onCreate: (db, version) {
        db.execute('''CREATE TABLE articles (
          id TEXT PRIMARY KEY, title_ai TEXT, summary TEXT,
          topic TEXT, source TEXT, image_url TEXT, cached_at INTEGER
        )''');
        db.execute('''CREATE TABLE pending_bookmarks (
          article_id TEXT PRIMARY KEY, action TEXT, created_at INTEGER
        )''');
      });
  }
  
  Future<void> cacheArticles(List<Article> articles) async {
    final batch = _db.batch();
    for (final a in articles.take(50)) {
      batch.insert('articles', a.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
    }
    await batch.commit();
  }
  
  Future<List<Article>> getCachedArticles() async {
    final rows = await _db.query('articles', orderBy: 'cached_at DESC', limit: 50);
    return rows.map(Article.fromMap).toList();
  }
  
  Future<void> syncPendingBookmarks(ApiService api) async {
    final pending = await _db.query('pending_bookmarks');
    for (final p in pending) {
      await api.addBookmark(p['article_id'] as String);
      await _db.delete('pending_bookmarks', where: 'article_id = ?', whereArgs: [p['article_id']]);
    }
  }
}
```

### 7.6 Local Storage (Hive)

| Box | Key | Value |
|-----|-----|-------|
| feed_cache | last_feed_page | List\<FeedItem\> JSON |
| settings | theme_mode | "light" / "dark" / "system" |
| settings | onboarding_completed | bool |
| settings | review_last_prompt_date | ISO date string |
| settings | review_articles_viewed | int |

### 7.7 ASO (App Store Optimization)

- **Title:** TrendBrief AI - Đọc Tin Nhanh
- **Subtitle:** Tin tức AI tóm tắt 30 giây
- **Keywords:** đọc tin nhanh, tin tức AI, tóm tắt tin tức, tin tức Việt Nam, đọc báo, tin nóng hôm nay
- **Screenshots:** Feed + trending, article detail + AI bullets, onboarding topics, search, push notification
- **Category:** News → News Aggregator

---

## 8. Database Design

All collections are initialized via `database/001_init_collections.js`.

### 8.1 Core Collections

| Collection | Purpose |
|-----------|---------|
| `articles` | Crawled + processed articles (title, summary, embedding, quality, feed_score) |
| `rss_sources` | RSS feed sources with health tracking |
| `topics` | Dynamic topic list (key, label, icon, color, order, is_active) |
| `users` | User accounts with preferences, referral, streak |
| `bookmarks` | User bookmarks (user_id, article_id) |
| `interactions` | User interactions (view, click, share, bookmark) |
| `device_tokens` | FCM tokens (user_id, token, platform) |
| `notification_logs` | Push delivery tracking (user_id, article_id, sent_at, type) |
| `article_reports` | User reports (article_id, user_id, reason) |
| `referrals` | Referral tracking (referrer_id, referee_id, code, reward_granted) |
| `userfeedbacks` | Summary feedback (articleId, userId, rating, reason) |
| `ads` | Native ad campaigns |
| `affiliates` | Affiliate links |

### 8.2 User Model

```json
{
  "email": "string",
  "password_hash": "string",
  "name": "string",
  "interests": ["ai", "finance"],
  "onboarding_completed": true,
  "notifications_enabled": true,
  "notification_prefs": {
    "trending": true,
    "topic": true,
    "daily": true,
    "weekly": true
  },
  "settings": { "theme": "dark" },
  "referral_code": "NGUYENA_TB",
  "referred_by": "FRIEND_TB",
  "referral_count": 5,
  "streak_count": 12,
  "last_active_date": "Date",
  "premium_until": "Date",
  "role": "user | admin",
  "created_at": "Date",
  "updated_at": "Date"
}
```

### 8.3 Article Model Additions

```json
{
  "thumbnailUrl": "string",
  "isTrending": true,
  "imageUrl": "string",
  "feed_score": 0.85,
  "quality_score": 0.72,
  "embedding": [384-dim float array]
}
```

### 8.4 RSS Source Health Schema

```javascript
{
  url: String,
  name: String,
  category: String,
  is_active: Boolean,
  health: {
    success_count_24h: Number,
    total_count_24h: Number,
    success_rate: Number,        // 0.0 - 1.0
    consecutive_failures: Number,
    last_successful_at: Date,
    last_error: String,
    auto_disabled: Boolean,
    disabled_until: Date,
  }
}
```

### 8.5 Feedback Collection

```javascript
// Index: { articleId: 1, userId: 1 } unique
{
  articleId: ObjectId,
  userId: ObjectId,
  rating: "up" | "down",
  reason: String,  // optional
  created_at: Date
}
```

---

## 9. Push Notification Architecture

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

### Frequency Caps

| Type | Frequency Cap | Deep Link |
|------|--------------|-----------|
| trending | 3/day | `/article/{id}` |
| topic_update | 1/topic/day | `/feed?topic={t}` |
| daily_digest | 1/day | `/feed` |
| weekly_digest | 1/week | `/feed` |

---

## 10. Testing Strategy

### 10.1 Correctness Properties — AI Engine (Hypothesis — Python)

| ID | Property |
|----|----------|
| P1 | Summarizer output structure invariant (title ≤12 words, 3 bullets, 1 reason) |
| P2 | Batch grouping correctness (ceil(N/B) batches, no duplicates) |
| P3 | Batch failure isolation (one failure doesn't affect others) |
| P4 | Two-level cache round-trip (identical result with from_cache=True) |
| P5 | LRU eviction invariant (size never exceeds max) |
| P6 | Hybrid classifier threshold dispatch |
| P7 | Score combination formula (0.4×kw + 0.6×zs) |
| P8 | FAISS search equivalence to brute-force |
| P9 | FAISS IP = cosine similarity on normalized vectors |
| P10 | FAISS rebuild removes expired entries |
| P11 | Batch embedding equivalence |
| P12 | Pipeline concurrency limit |
| P13 | Pipeline failure isolation |
| P14 | Pipeline stats invariant (new + dup + failed == N) |
| P15 | Vietnamese NFC idempotence |
| P16 | Vietnamese cleaning completeness |
| P17 | Quality score range [0.0, 1.0] |
| P18 | Quality threshold gate |
| P19 | Redis key namespace invariant |

### 10.2 Correctness Properties — Mobile (dart_check — Flutter)

| ID | Property |
|----|----------|
| P1 | Theme preference round-trip |
| P2 | Onboarding topic selection validation (≥1) |
| P3 | FeedCard thumbnail vs placeholder |
| P4 | Relative time formatting (Vietnamese) |
| P5 | Trending badge conditional rendering |
| P6 | ArticleDetailView field completeness |
| P7 | Search query minimum length (≥2) |
| P9 | Share content formatting |
| P10 | Review prompt eligibility |
| P11 | Review tracking state round-trip |
| P12 | Feed cache round-trip |
| P13 | Dynamic topic chips count |

### 10.3 Correctness Properties — Backend (fast-check — TypeScript)

| ID | Property |
|----|----------|
| P8 | Trending limit enforcement |
| P14 | Reading history ordering |
| P15 | Notification targeting by topic |
| P16 | Notification daily rate limit (max 3) |

### 10.4 Unit Tests (Python — trendbriefai-engine)

- `test_cleaner.py`: trafilatura extraction, image validation, date parsing
- `test_rate_limiter.py`: per-domain delay enforcement
- `test_summary_validator.py`: summary validation (25 tests)

### 10.5 Integration Tests (Node.js — trendbriefai-service)

- Source health: auto-disable at <10%, re-enable after cooldown
- Feed scores: pre-computed scores match expected ranking
- Meilisearch: search returns Vietnamese results, fallback to MongoDB
- Referral: activation after 5 reads, reward applied, anti-abuse

### 10.6 E2E Tests (Web — trendbriefai-web)

- Dark mode: toggle works, persists, contrast ratios pass
- Infinite scroll: loads next page, shows end message
- Onboarding: shows once, saves topics, skip works
- Summarize URL: input → loading → result → copy/share

---

## 11. UI/UX Design System

### 11.1 Design Tokens

#### Colors

| Token | Light | Dark |
|-------|-------|------|
| `--accent` | #6366f1 (Indigo) | #818cf8 |
| `--bg` | #ffffff | #0f172a |
| `--bg-card` | #ffffff | #1e293b |
| `--bg-hover` | #f8fafc | #334155 |
| `--border` | #e2e8f0 | #334155 |
| `--text-primary` | #0f172a | #f1f5f9 |
| `--text-secondary` | #475569 | #94a3b8 |
| `--text-muted` | #94a3b8 | #64748b |

Unified accent: `#6366f1` (indigo) for both web and admin — replaces conflicting `#e94560` (coral).

#### Typography Scale

| Token | Size |
|-------|------|
| `--text-xs` | 11px |
| `--text-sm` | 13px |
| `--text-base` | 15px |
| `--text-lg` | 18px |
| `--text-xl` | 22px |
| `--text-2xl` | 28px |

Font: Inter (Vietnamese-friendly)

#### Spacing Scale

`--space-1` (4px) through `--space-8` (64px)

#### Shadows

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.15)` |

#### Border Radius

- Cards: 16px
- Nested elements: 12px
- Buttons/chips: pill (9999px) or 8px

### 11.2 Card Redesign

- Layered shadow system: `shadow-sm` (rest), `shadow-md` (hover), `shadow-lg` (active)
- Subtle scale transform on hover: `transform: translateY(-2px)`
- Stagger fade-in animation when cards appear (50ms delay between cards)
- Border-radius: 16px for main cards, 12px for nested elements
- Image placeholder with gradient while loading
- Smooth image loading with fade-in when loaded

### 11.3 Skeleton Loading States

- Feed page: 3 skeleton cards with shimmer animation on first load
- Article detail: skeleton for title, image, summary box
- Search results: skeleton cards while searching
- Trending section: skeleton for trending cards
- Fade transition from skeleton to content (200ms ease-out)

### 11.4 Responsive Breakpoints

| Breakpoint | Target |
|-----------|--------|
| 480px | Small phone |
| 768px | Tablet portrait |
| 1024px | Tablet landscape |

- Mobile navbar: search expands full-width on focus, collapses on blur
- Topic bar: scroll indicator dots or fade edges on mobile
- Article image: responsive height (`aspect-ratio: 16/9` instead of fixed max-height)
- Admin sidebar: collapsible on tablet (220px), overlay on mobile
- Feed cards: full-bleed (no padding) on small phone for immersive feel

### 11.5 Empty & Error States

- Empty feed: illustration icon + "Chưa có bài viết" + suggest topics CTA
- Empty search: search icon + "Không tìm thấy" + suggest keywords
- Empty bookmarks: bookmark icon + "Lưu bài viết yêu thích" + link to feed

### 11.6 Animations & Transitions

- Page transition: fade-in (200ms) on route navigation
- Card entrance: stagger fadeInUp animation
- Button press: subtle scale down (0.97) on active
- Topic chip selection: smooth background/color transition (200ms)
- "Tải thêm": loading spinner instead of text "Đang tải..."
- "Đọc chi tiết →": hover underline animation (slide-in from left)

### 11.7 Trending Section Upgrade

- Ranking number overlay (1, 2, 3...) on each trending card
- Gradient background for top 3 cards (gold → silver → bronze subtle)
- Scroll snap on mobile for smooth horizontal scrolling
- Fade edges (left/right) to indicate scrollable content
- Larger card size with better typography hierarchy

### 11.8 Accessibility

- Color contrast ratio ≥ 4.5:1 for all text (`--text-primary` #0f172a on white = 16.75:1)
- Touch targets ≥ 44x44px for mobile
- Proper `aria-labels` for all interactive elements
- `prefers-reduced-motion` media query: disable all animations
- All interactive elements: consistent `focus-visible` ring

### 11.9 Performance Optimizations

- Image lazy loading with native `loading="lazy"` + CSS fade-in animation
- Font display swap + critical CSS inline to avoid FOIT

### 11.10 Admin Dashboard Polish

- Sidebar active state: background highlight + left border accent (unified indigo)
- Admin cards/tables: consistent styling with design system
- Sidebar collapse on tablet (220px), overlay on mobile

### 11.11 Button & Interactive Element Polish

- "Tải thêm" button: larger, more prominent, pill shape, hover glow
- All interactive elements: consistent `focus-visible` ring
- "Đọc chi tiết →": hover underline animation (slide-in from left)

---

## Files Affected

### trendbriefai-web (Public)
- `src/styles.css` — global tokens, animations, skeleton classes
- `src/design-system.css` — shared design tokens
- `src/app/layout/layout.component.html` + `.scss` — navbar, topic bar, footer responsive
- `src/app/pages/feed/feed.component.html` + `.scss` — cards, trending, skeleton, empty state
- `src/app/pages/article/article.component.html` + `.scss` — social share, skeleton, responsive
- `src/app/pages/search/search.component.html` + `.scss` — skeleton, empty state

### trendbriefai-ui (Admin)
- `src/styles.scss` — global tokens, sidebar, header
- `src/app/layout/sidebar/sidebar.component.html` + `.ts` — collapse, active state
- `src/app/layout/header/header.component.html` + `.ts` — breadcrumb
- `src/app/pages/feed/feed.component.html` + `.scss` — cards, skeleton, empty state
- `src/app/pages/bookmarks/bookmarks.component.html` + `.scss` — empty state

### trendbriefai-engine (Python)
- `services/summary_validator.py` — summary quality validation
- `services/llm_providers.py` — multi-model fallback chain
- `services/fast_classifier.py` — keyword-first classification

### trendbriefai-service (Node.js)
- `src/middleware/validate.ts` — Zod validation
- `src/middleware/requestLogger.ts` — structured logging
- `src/middleware/circuitBreaker.ts` — circuit breaker (opossum)
- `src/services/related.service.ts` — related articles
