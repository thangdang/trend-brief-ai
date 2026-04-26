# TrendBrief AI — Release 1: Unified Requirements

## Overview

TrendBrief AI là ứng dụng tin tức AI cho Gen Z Việt Nam (18-30 tuổi). AI tự động crawl, tóm tắt tin tức trong 30-60 giây, cá nhân hóa theo sở thích người dùng. Hệ thống bao gồm: AI Engine (Python/FastAPI), Backend API (Node.js), Web App (Angular), Admin Dashboard (Angular), và Mobile App (Flutter).

**Mục tiêu**: 1K DAU tháng 1, 30% D7 retention tháng 2, $1K/month revenue tháng 3.

**Actors**:
- **Visitor**: Đọc tin trên web, không cần đăng nhập
- **User**: Đăng nhập, cá nhân hóa feed, bookmarks, alerts, share
- **Admin**: Quản lý sources, ads, affiliates, moderation, analytics
- **AI Engine**: Crawl → clean → summarize → classify → dedup → store

---

## 1. AI Engine (REQ-1.x)

### REQ-1.1: Summarization ✅
- REQ-1.1.1: Batch processing — group articles into batches of 5 for single Ollama call ✅
- REQ-1.1.2: Batch failure fallback — retry individually, extractive fallback per article ✅
- REQ-1.1.3: Output structure invariant — title_ai (≤12 Vietnamese words), exactly 3 summary_bullets, 1 reason ✅
- REQ-1.1.4: Two-level cache — LRU in-memory (max 1000) + Redis (TTL 24h), `from_cache` metadata flag ✅

### REQ-1.2: Classification ✅
- REQ-1.2.1: Hybrid mode — keyword matching + zero-shot classifier (xlm-roberta-large-xnli) ✅
- REQ-1.2.2: Zero-shot invoked only when keyword hits ≤ 2 (configurable threshold) ✅
- REQ-1.2.3: Vietnamese-compatible candidate labels for 9 topics ✅
- REQ-1.2.4: Weighted combination — 0.4 keyword + 0.6 zero-shot (configurable) ✅
- REQ-1.2.5: Fallback to keyword-only if zero-shot model fails ✅

### REQ-1.3: Deduplication ✅
- REQ-1.3.1: FAISS IndexFlatIP for nearest-neighbor embedding search (384-dim, top-k=10) ✅
- REQ-1.3.2: 3-layer dedup — URL hash → title similarity (≥0.8) → embedding cosine (≥0.8) ✅
- REQ-1.3.3: FAISS rebuild every 6h to remove expired articles (48h window) ✅
- REQ-1.3.4: Fallback to brute-force scan when FAISS empty/unavailable ✅

### REQ-1.4: Batch Embedding ✅
- REQ-1.4.1: Single `model.encode()` call for multiple texts ✅
- REQ-1.4.2: 384-dim L2-normalized vectors, identical to individual encoding ✅
- REQ-1.4.3: Truncate each text to 4000 chars before encoding ✅

### REQ-1.5: Pipeline Concurrency ✅
- REQ-1.5.1: asyncio.Semaphore — configurable concurrency limit (default 5) ✅
- REQ-1.5.2: Per-source rate limit delay (default 1.5s) between HTTP requests ✅
- REQ-1.5.3: Individual article failure doesn't affect batch ✅
- REQ-1.5.4: Stats invariant: new + duplicate + failed == total entries ✅

### REQ-1.6: Vietnamese Text Processing ✅
- REQ-1.6.1: Unicode NFC normalization before all processing ✅
- REQ-1.6.2: Strip Vietnamese web artifacts (Đọc thêm, Xem thêm, Tin liên quan, ©, social sharing) ✅
- REQ-1.6.3: Preserve Vietnamese diacritical marks throughout pipeline ✅
- REQ-1.6.4: Detect and remove repeated paragraphs ✅

### REQ-1.7: Content Quality Scoring ✅
- REQ-1.7.1: Score 0.0-1.0 per article — length, structure, Vietnamese ratio, spam indicators ✅
- REQ-1.7.2: Quality < 0.3 → skip AI summarization, mark as "failed" ✅
- REQ-1.7.3: Execute in < 50ms per article ✅

### REQ-1.8: Model Warm-Up ✅
- REQ-1.8.1: Pre-load sentence-transformer at startup ✅
- REQ-1.8.2: Verify Ollama connectivity with test prompt ✅
- REQ-1.8.3: Graceful fallback if models fail to load ✅
- REQ-1.8.4: `/health` endpoint — model readiness, cache status, FAISS index size ✅

### REQ-1.9: Redis AI Cache ✅
- REQ-1.9.1: Cache summaries (`ai:summary:{hash}`) and classifications (`ai:classify:{hash}`) ✅
- REQ-1.9.2: TTL 24h, graceful degradation if Redis unavailable ✅

### REQ-1.10: Summary Quality Validation ✅
- REQ-1.10.1: Validate summary output: title_ai ≤ 15 từ, summary_bullets = exactly 3 items, mỗi bullet 10-50 từ, reason ≠ generic fallback ✅
- REQ-1.10.2: Detect hallucination: check summary không chứa URLs/tên người/tổ chức không có trong original ✅
- REQ-1.10.3: Quality score per summary: 0-1 based on (bullet_count_valid × 0.3 + title_length_valid × 0.2 + reason_not_generic × 0.3 + no_hallucination × 0.2) ✅
- REQ-1.10.4: Auto-retry with different prompt nếu quality_score < 0.6 (max 2 retries) ✅
- REQ-1.10.5: Store quality_score in article document cho analytics ✅
- REQ-1.10.6: Raise summarizer quality threshold from 0.3 to 0.5 ✅

### REQ-1.11: Multi-Model LLM Fallback ✅
- REQ-1.11.1: Fallback chain: Ollama (local, free) → Groq (free tier, 30 RPM) → Gemini (free tier, 15 RPM) ✅
- REQ-1.11.2: Mỗi provider implement chung interface: `summarize(text) → {title_ai, summary_bullets, reason}` ✅
- REQ-1.11.3: Provider health tracking: success_rate, avg_latency, last_error. Auto-skip provider nếu success_rate < 50% trong 10 phút gần nhất ✅
- REQ-1.11.4: Cost tracking per provider: Ollama = $0, Groq = $0, Gemini = $0 (free tier) ✅
- REQ-1.11.5: Fallback reason pool: ≥20 varied Vietnamese reasons thay vì 1 generic sentence ✅
- REQ-1.11.6: Groq/Gemini rate limit monitoring — track usage per 10-min window, log warnings at 80% capacity ✅

### REQ-1.12: Fast Topic Classifier ✅
- REQ-1.12.1: 2-tier classification: keyword/regex fast pass (≤5ms) → Ollama LLM (chỉ khi ambiguous) ✅
- REQ-1.12.2: Keyword dictionary per topic: ≥50 keywords/phrases cho mỗi 9 topics ✅
- REQ-1.12.3: Confidence threshold: nếu keyword match confidence ≥ 0.8 → skip LLM, dùng keyword result ✅
- REQ-1.12.4: Classification cache: Redis cache by content_hash (24h TTL) ✅
- REQ-1.12.5: Giảm ≥60% LLM calls cho classification ✅

### REQ-1.13: Prompt Templates Per Topic ✅
- REQ-1.13.1: Prompt template system: mỗi topic có prompt riêng (tone, focus, vocabulary) ✅
- REQ-1.13.2: Finance prompt: focus số liệu, tỷ giá, tác động đến ví tiền ✅
- REQ-1.13.3: Drama prompt: focus nhân vật, drama timeline, reaction cộng đồng ✅
- REQ-1.13.4: AI/Tech prompt: focus ứng dụng thực tế, so sánh, tác động tương lai ✅
- REQ-1.13.5: Prompt versioning: store prompt version in article metadata cho A/B testing ✅

### REQ-1.14: User Feedback on Summaries ✅
- REQ-1.14.1: Thumbs up/down buttons on each article card ✅
- REQ-1.14.2: Store feedback in `userfeedbacks` collection ✅
- REQ-1.14.3: Use feedback data for prompt improvement ✅

### REQ-1.15: Sentiment Analysis ✅
- REQ-1.15.1: Add sentiment analysis tag (positive/negative/neutral) to articles ✅
- REQ-1.15.2: Display sentiment as badge in feed ✅

---

## 2. Crawler & Data Pipeline (REQ-2.x)

### REQ-2.1: Crawler Source Health Tracking ✅
- REQ-2.1.1: Per-source metrics: success_rate (last 24h), avg_articles_per_crawl, consecutive_failures, last_successful_at ✅
- REQ-2.1.2: Auto-disable sources với success_rate < 10% for 24h, auto-re-enable after cooldown ✅
- REQ-2.1.3: Source health dashboard trong admin UI: list all sources with health status, success rate, last crawl time ✅
- REQ-2.1.4: Alert khi source fails 5 consecutive times ✅
- REQ-2.1.5: RSS feed validation on startup: detect broken/moved feeds, report in health endpoint ✅

### REQ-2.2: Better Article Extraction ✅
- REQ-2.2.1: Replace newspaper3k với trafilatura (actively maintained, better quality) ✅
- REQ-2.2.2: Per-domain rate limiting thay vì global delay (1.5s per domain, not global) ✅
- REQ-2.2.3: Image validation: check dimensions (min 200×200), content-type, fallback to OG image ✅
- REQ-2.2.4: Playwright fallback cho JS-heavy sites (Genk, Tinhte, Báo Mới) — configurable per source ✅
- REQ-2.2.5: Extract published_at more reliably: parse multiple date formats, fallback to crawl time ✅

### REQ-2.3: Pre-computed Feed Scores ✅
- REQ-2.3.1: Background job (hourly): compute feed_score per article = topic_relevance + recency_decay + popularity_boost ✅
- REQ-2.3.2: Store feed_score as indexed field on articles collection ✅
- REQ-2.3.3: Feed query becomes simple: `find({processing_status: "done", topic}).sort({feed_score: -1}).limit(20)` ✅
- REQ-2.3.4: Personalization layer: adjust feed_score per user based on interests (additive boost) ✅

### REQ-2.4: Trending Cache ✅
- REQ-2.4.1: Materialized trending: background job every 30 min, compute top 50 trending articles (views in last 24h) ✅
- REQ-2.4.2: Store in Redis as sorted set: `trending:{topic}` → article IDs with scores ✅
- REQ-2.4.3: Trending API reads from Redis (≤5ms) instead of MongoDB aggregation ✅
- REQ-2.4.4: Trending per topic + global trending ✅

### REQ-2.5: Search Upgrade ✅
- REQ-2.5.1: Integrate Meilisearch for article search (Vietnamese tokenization, typo tolerance, instant results) ✅
- REQ-2.5.2: Sync articles to Meilisearch index on insert/update (via change stream or post-save hook) ✅
- REQ-2.5.3: Search API: query Meilisearch instead of MongoDB $text, return highlighted snippets ✅
- REQ-2.5.4: Fallback to MongoDB $text if Meilisearch unavailable ✅

### REQ-2.6: Image CDN ✅
- REQ-2.6.1: Image proxy endpoint: `/api/img/:articleId` → fetch → resize (max 800px) → cache → serve ✅
- REQ-2.6.2: Cache resized images in Redis (1h TTL) or local disk ✅
- REQ-2.6.3: Lazy loading: all article images use `loading="lazy"` + proxy URL ✅
- REQ-2.6.4: WebP conversion for supported browsers (Accept header check) ✅

---

## 3. Backend API & Services (REQ-3.x)

### REQ-3.1: Dynamic Topics ✅
- REQ-3.1.1: 9+ topics from backend (not hardcoded) ✅
- REQ-3.1.2: New topics appear without app update ✅

### REQ-3.2: Feed API ✅
- REQ-3.2.1: Cursor-based pagination (`/feed/cursor`) ✅
- REQ-3.2.2: Pre-computed feed_score ranking (no in-memory sort) ✅
- REQ-3.2.3: MAX_CANDIDATES increased from 200 to 500 for users with many topic interests ✅

### REQ-3.3: Search API ✅
- REQ-3.3.1: Meilisearch-backed search with Vietnamese tokenization ✅
- REQ-3.3.2: Fallback to MongoDB $text if Meilisearch unavailable ✅

### REQ-3.4: Trending API ✅
- REQ-3.4.1: Redis-backed trending (≤5ms response) ✅
- REQ-3.4.2: Per-topic + global trending ✅

### REQ-3.5: Related Articles ✅
- REQ-3.5.1: `GET /api/articles/:id/related?limit=5` — 5 articles cùng topic, sorted by embedding cosine similarity ✅
- REQ-3.5.2: Sử dụng existing embeddings (all-MiniLM-L6-v2) ✅
- REQ-3.5.3: Fallback: nếu không có embeddings → return 5 most recent articles cùng topic ✅
- REQ-3.5.4: Cache related articles in Redis (1h TTL) ✅

### REQ-3.6: Notifications ✅
- REQ-3.6.1: FCM push from backend to mobile ✅
- REQ-3.6.2: Notification types: trending (1000+ views/1h), topic update (5+ new articles), daily digest (8 AM), weekly digest (Sunday 9 AM) ✅
- REQ-3.6.3: BullMQ cron scheduling, frequency caps, dedup (Redis 24h) ✅
- REQ-3.6.4: User notification preferences toggle per type ✅
- REQ-3.6.5: Referral notification: "🎉 Bạn được thưởng 7 ngày Premium!" ✅

### REQ-3.7: Payments ✅
- REQ-3.7.1: Premium subscription — ad-free, unlimited AI, exclusive topics ✅
- REQ-3.7.2: Payment integration (Momo, VNPay) ✅

### REQ-3.8: Referral System ✅
- REQ-3.8.1: Unique referral code per user ✅
- REQ-3.8.2: Referral reward: 7 days premium for referrer when referee registers + reads 5 articles ✅
- REQ-3.8.3: Referral tracking: clicks → registrations → activations ✅
- REQ-3.8.4: Anti-abuse: max 50 referral rewards per user, IP-based duplicate detection ✅

### REQ-3.9: Content Moderation ✅
- REQ-3.9.1: Keyword blocklist (Vietnamese spam/NSFW) ✅
- REQ-3.9.2: Source whitelist/blacklist ✅
- REQ-3.9.3: User report button — "Báo cáo bài viết" ✅
- REQ-3.9.4: Auto-hide at 3+ reports, admin review queue ✅

### REQ-3.10: "Tóm tắt cho tôi" API ✅
- REQ-3.10.1: User paste bất kỳ URL → AI summarize → return title_ai + 3 bullets + reason + topic ✅
- REQ-3.10.2: Sử dụng existing `/summarize-url` endpoint từ AI engine ✅
- REQ-3.10.3: Rate limit: 10 requests/hour per IP ✅

### REQ-3.11: Social Login ✅
- REQ-3.11.1: Google OAuth login ✅

---

## 4. Web App (REQ-4.x)

### REQ-4.1: Dark Mode ✅
- REQ-4.1.1: Toggle dark/light mode, persist preference in localStorage ✅
- REQ-4.1.2: CSS variables with alternate dark values ✅
- REQ-4.1.3: Auto-detect system preference via `prefers-color-scheme` media query ✅

### REQ-4.2: Infinite Scroll ✅
- REQ-4.2.1: IntersectionObserver-based infinite scroll (replace "Tải thêm" button) ✅
- REQ-4.2.2: Use existing cursor pagination API (`/feed/cursor`) ✅
- REQ-4.2.3: Loading spinner at bottom while fetching next page ✅
- REQ-4.2.4: "Hết bài viết" message when no more content ✅
- REQ-4.2.5: Scroll-to-top button appears after scrolling 2 screens ✅

### REQ-4.3: Web Onboarding ✅
- REQ-4.3.1: First-time visitor: 3-step onboarding flow (chọn chủ đề → bật thông báo → bắt đầu đọc) ✅
- REQ-4.3.2: Store preferences in localStorage (no login required) ✅
- REQ-4.3.3: Skip button available on each step ✅
- REQ-4.3.4: Show onboarding only once (flag in localStorage) ✅

### REQ-4.4: "Tóm tắt cho tôi" Web Page ✅
- REQ-4.4.1: UI: input field + "Tóm tắt" button + loading skeleton + result card ✅
- REQ-4.4.2: Share result: copy summary to clipboard, share via social ✅

### REQ-4.5: Reading Progress ✅
- REQ-4.5.1: Article detail: scroll progress bar ở top of page (thin, accent color) ✅
- REQ-4.5.2: Track actual reading time (time spent on article page) ✅
- REQ-4.5.3: Store reading_time in interactions collection ✅
- REQ-4.5.4: Show "Đã đọc X%" badge on feed cards for partially-read articles ✅

### REQ-4.6: Article Hover Preview (Desktop) ✅
- REQ-4.6.1: Hover over article card → show tooltip with 3 bullet summary (500ms delay) ✅
- REQ-4.6.2: Tooltip positioned above/below card based on viewport space ✅
- REQ-4.6.3: Mobile: no tooltip (touch devices detected via pointer media query) ✅

### REQ-4.7: PWA & SEO ✅
- REQ-4.7.1: Service worker for offline support ✅
- REQ-4.7.2: Web app manifest with install prompt ✅
- REQ-4.7.3: JSON-LD Article schema ✅
- REQ-4.7.4: Dynamic sitemap + Google News sitemap ✅
- REQ-4.7.5: Newsletter signup ✅

### REQ-4.8: Rich Share Cards ✅
- REQ-4.8.1: OG image with article title + summary + branding ✅
- REQ-4.8.2: Zalo share deep link ✅

### REQ-4.9: Error & UX Improvements ✅
- REQ-4.9.1: Error retry UI: "Không thể tải dữ liệu. Thử lại?" with retry button ✅
- REQ-4.9.2: Skeleton loader placeholders during feed loading ✅
- REQ-4.9.3: Image lazy loading on feed thumbnails ✅
- REQ-4.9.4: Request deduplication in Angular API service ✅

### REQ-4.10: .css → .scss Migration ✅
- REQ-4.10.1: Rename all `.component.css` to `.component.scss` in trendbriefai-web ✅
- REQ-4.10.2: Rename all `.component.css` to `.component.scss` in trendbriefai-ui ✅
- REQ-4.10.3: Update all `styleUrls` to `styleUrl` (Angular 17+ singular syntax) ✅

---

## 5. Admin Dashboard (REQ-5.x)

### REQ-5.1: Analytics ✅
- REQ-5.1.1: DAU, MAU, D7 retention, article views, shares ✅
- REQ-5.1.2: Ad/affiliate stats ✅
- REQ-5.1.3: Crawl pipeline metrics: articles/hour, success_rate, avg_processing_time ✅
- REQ-5.1.4: `GET /api/admin/metrics` endpoint: articles_processed_24h, success_rate, avg_processing_time, provider_distribution, queue_depth ✅

### REQ-5.2: Source Management ✅
- REQ-5.2.1: CRUD RSS sources, crawl status, manual crawl ✅
- REQ-5.2.2: Source health dashboard: list all sources with health status, success rate, last crawl time ✅

### REQ-5.3: Content Moderation ✅
- REQ-5.3.1: Reported articles queue, auto-hide at 3 reports ✅
- REQ-5.3.2: Admin review queue ✅

### REQ-5.4: Ad Management ✅
- REQ-5.4.1: CRUD native ads, impressions/clicks/CTR ✅
- REQ-5.4.2: Viewability report: viewability_rate, avg_visible_duration per ad ✅
- REQ-5.4.3: Ad viewability client-side: IntersectionObserver, 50%+ visible for 1s+ ✅

### REQ-5.5: Affiliate Management ✅
- REQ-5.5.1: CRUD affiliate links, clicks/conversions ✅
- REQ-5.5.2: Dynamic affiliate matching: article keywords → Shopee/Lazada API search ✅
- REQ-5.5.3: Match score: keyword_overlap × 0.5 + category_match × 0.3 + commission_rate × 0.2 ✅
- REQ-5.5.4: Cache product search results (24h TTL) ✅
- REQ-5.5.5: A/B test: static vs dynamic affiliate links — track CTR difference ✅

### REQ-5.6: Notification Management ✅
- REQ-5.6.1: Send manual push, delivery logs ✅

### REQ-5.7: User Management ✅
- REQ-5.7.1: View users, ban/suspend ✅

### REQ-5.8: Referral Dashboard ✅
- REQ-5.8.1: Total referrals, conversion rate, rewards given ✅

### REQ-5.9: AI Health Dashboard ✅
- REQ-5.9.1: Circuit state, provider health, queue depth ✅

### REQ-5.10: Admin Dark Mode ✅
- REQ-5.10.1: Admin UI dark mode support — same CSS variables as web ✅

---

## 6. Mobile App — Flutter (REQ-6.x)

### REQ-6.1: Design System & Theming ✅
- REQ-6.1.1: Custom color palette (light + dark) with Material 3 ✅
- REQ-6.1.2: Typography scale (5 styles) with Vietnamese-friendly font ✅
- REQ-6.1.3: Dark mode toggle — switch within 300ms, persist across restarts ✅
- REQ-6.1.4: Follow system theme via MediaQuery.platformBrightnessOf ✅

### REQ-6.2: Onboarding Flow ✅
- REQ-6.2.1: 3 screens — welcome → topic selection (≥1 required) → completion ✅
- REQ-6.2.2: Save interests to backend, navigate to feed ✅
- REQ-6.2.3: Show only once per user account ✅

### REQ-6.3: Enhanced Feed Card ✅
- REQ-6.3.1: Thumbnail image (16:9) or gradient placeholder with topic icon ✅
- REQ-6.3.2: Relative time ("2 giờ trước"), reading time badge ✅
- REQ-6.3.3: "🔥 Trending" badge for top 5 articles ✅
- REQ-6.3.4: Fade-in/slide-up entry animation, press-down scale on tap ✅

### REQ-6.4: Article Detail View ✅
- REQ-6.4.1: In-app display — AI title, source, date, topic, reading time, bullets, reason ✅
- REQ-6.4.2: "Đọc bài gốc" button → in-app browser ✅
- REQ-6.4.3: Bookmark + share buttons in app bar ✅
- REQ-6.4.4: Record "view" interaction on open ✅
- REQ-6.4.5: Related articles at bottom of article detail ✅

### REQ-6.5: Search ✅
- REQ-6.5.1: Auto-focused text input, trigger on ≥2 chars ✅
- REQ-6.5.2: Infinite scroll pagination ✅
- REQ-6.5.3: Empty state + error state with retry ✅

### REQ-6.6: Bookmarks & Reading History ✅
- REQ-6.6.1: Paginated list of viewed articles, sorted by most recent ✅
- REQ-6.6.2: Accessible from profile screen ✅

### REQ-6.7: Offline Reading ✅
- REQ-6.7.1: Cache last 50 articles in local SQLite database (sqflite) ✅
- REQ-6.7.2: Bookmarked articles always available offline — auto-download on bookmark ✅
- REQ-6.7.3: Offline indicator banner: "Đang offline — hiển thị bài đã lưu" ✅
- REQ-6.7.4: Sync bookmarks khi reconnect — merge local changes with server ✅
- REQ-6.7.5: Cache article images locally (max 100 MB) ✅

### REQ-6.8: Push Notifications ✅
- REQ-6.8.1: Request permission on first launch ✅
- REQ-6.8.2: Trending article push (top 3 in 6h window, max 3/day) ✅
- REQ-6.8.3: Tap notification → navigate to article detail ✅
- REQ-6.8.4: Toggle notifications in profile settings ✅

### REQ-6.9: Enhanced Profile ✅
- REQ-6.9.1: Reading stats — articles read, bookmarks, days active ✅
- REQ-6.9.2: Reading history link, dark mode toggle, notification toggle, app version ✅
- REQ-6.9.3: "Mời bạn bè" referral button ✅

### REQ-6.10: Trending Section ✅
- REQ-6.10.1: Horizontal scrollable carousel above feed (up to 10 articles) ✅
- REQ-6.10.2: Refresh on pull-to-refresh, hide silently on failure ✅

### REQ-6.11: Share ✅
- REQ-6.11.1: Platform share sheet — "{title}\n\nĐọc thêm: {url}\n\nvia TrendBrief AI" ✅
- REQ-6.11.2: Record "share" interaction via API ✅

### REQ-6.12: Skeleton Loaders ✅
- REQ-6.12.1: 3 skeleton cards on feed first load ✅
- REQ-6.12.2: Skeleton on search + article detail while loading ✅
- REQ-6.12.3: Fade transition to content within 200ms ✅

### REQ-6.13: Error & Offline Handling ✅
- REQ-6.13.1: ErrorStateView with "Thử lại" on all screens ✅
- REQ-6.13.2: "Không có kết nối mạng" banner when offline ✅
- REQ-6.13.3: Cache last feed page locally, show while offline ✅

### REQ-6.14: Micro-Interactions ✅
- REQ-6.14.1: Cross-fade tab transitions (250ms) ✅
- REQ-6.14.2: Haptic feedback on bookmark + pull-to-refresh ✅

### REQ-6.15: In-App Review ✅
- REQ-6.15.1: Trigger when daysOpened ≥ 5 AND articlesViewed ≥ 20 ✅
- REQ-6.15.2: Max 1 prompt per 90 days, platform-native API ✅
- REQ-6.15.3: Skip silently if API unavailable ✅

### REQ-6.16: Reading Streak ✅
- REQ-6.16.1: Track consecutive reading days, display in profile ✅
- REQ-6.16.2: "Đọc tiếp" section — articles started but not finished ✅

---

## 7. Security & Infrastructure (REQ-7.x)

### REQ-7.1: API Versioning ✅
- REQ-7.1.1: Add `/api/v1/` prefix cho tất cả routes — backward compatible, old `/api/` routes redirect ✅
- REQ-7.1.2: Version header: `X-API-Version: 1` in all responses ✅
- REQ-7.1.3: Deprecation header khi old routes used: `Deprecation: true` ✅

### REQ-7.2: Input Validation ✅
- REQ-7.2.1: Zod validation schemas cho tất cả route inputs (body, query, params) ✅
- REQ-7.2.2: Validation middleware: auto-return 400 with field-level errors ✅
- REQ-7.2.3: Sanitize HTML in user inputs (XSS prevention) via sanitize-html or DOMPurify ✅

### REQ-7.3: Database Backup ✅
- REQ-7.3.1: Automated daily backup via mongodump → compress → upload to S3/R2 ✅
- REQ-7.3.2: Backup retention: 7 daily + 4 weekly + 3 monthly ✅
- REQ-7.3.3: Backup verification: monthly restore test to staging ✅
- REQ-7.3.4: Backup script runnable via `npm run backup` ✅
- REQ-7.3.5: Backup documentation: `docs/BACKUP.md` with restore procedure ✅

### REQ-7.4: Monitoring & Logging ✅
- REQ-7.4.1: Structured logging (JSON format) with request_id, user_id, duration ✅
- REQ-7.4.2: Request duration tracking middleware — log slow requests (>1s) ✅
- REQ-7.4.3: Error rate monitoring — alert if error_rate > 5% in 5 min window ✅

### REQ-7.5: Circuit Breaker & Resilience ✅
- REQ-7.5.1: Circuit breaker cho AI engine calls: open after 5 consecutive failures, half-open after 30s, close after 3 successes ✅
- REQ-7.5.2: Khi circuit open: serve cached summaries (last 24h), skip new summarization, mark articles as "pending" ✅
- REQ-7.5.3: Graceful degradation: nếu tất cả LLM providers down → store article with title_original only, retry khi recover ✅

### REQ-7.6: CDN & Caching ✅
- REQ-7.6.1: CDN headers for static assets: `Cache-Control: public, max-age=86400` ✅

### REQ-7.7: Crash Reporting & Analytics ✅
- REQ-7.7.1: Firebase Crashlytics (mobile) ✅
- REQ-7.7.2: Firebase Analytics (mobile) — screen_view, article_view, article_share, bookmark_add ✅
- REQ-7.7.3: Google Analytics (web) ✅

---

## 8. Growth & Monetization (REQ-8.x)

### REQ-8.1: Referral System ✅
- REQ-8.1.1: Unique referral code per user, 7-day Premium reward, max 10/month ✅
- REQ-8.1.2: "Mời bạn bè" button in profile ✅
- REQ-8.1.3: Referral dashboard in admin ✅

### REQ-8.2: Social Sharing ✅
- REQ-8.2.1: Rich share cards — OG image with article title + summary + branding ✅
- REQ-8.2.2: Zalo share deep link ✅
- REQ-8.2.3: Platform share sheet integration ✅

### REQ-8.3: Ads ✅
- REQ-8.3.1: AdMob banner ads ✅
- REQ-8.3.2: Native ads with viewability tracking ✅

### REQ-8.4: Affiliate ✅
- REQ-8.4.1: Dynamic affiliate matching via Shopee/Lazada APIs ✅
- REQ-8.4.2: A/B test: static vs dynamic affiliate links ✅

### REQ-8.5: Premium Subscription ✅
- REQ-8.5.1: Ad-free, unlimited AI, exclusive topics ✅
- REQ-8.5.2: Payment integration (Momo, VNPay) ✅

### REQ-8.6: ASO (App Store Optimization) ✅
- REQ-8.6.1: Vietnamese keywords — "đọc tin nhanh", "tin tức AI", "tóm tắt tin tức" ✅
- REQ-8.6.2: Title: "TrendBrief AI - Đọc Tin Nhanh", Subtitle: "Tin tức AI tóm tắt 30 giây" ✅
- REQ-8.6.3: 5 screenshots, optimized description ✅

### REQ-8.7: Retention Features ✅
- REQ-8.7.1: "Tin nổi bật hôm nay" daily push at 8 AM ✅
- REQ-8.7.2: Reading streak — consecutive days, display in profile ✅
- REQ-8.7.3: In-app review prompt tuning ✅
- REQ-8.7.4: Newsletter signup ✅

### REQ-8.8: App Store Legal & Assets ✅
- REQ-8.8.1: Privacy Policy + Terms of Service (Vietnamese, hosted on web) ✅
- REQ-8.8.2: App icon (1024x1024 + 512x512), splash screen ✅
- REQ-8.8.3: 5 localized screenshots, Vietnamese app store listing ✅
- REQ-8.8.4: Category: News → News Aggregator ✅

### REQ-8.9: Social Features ✅
- REQ-8.9.1: Article reactions (🔥 😮 😢 😡) ✅
- REQ-8.9.2: Comment section (moderated) ✅
- REQ-8.9.3: Follow topics with custom notification frequency ✅

---

## 9. Non-Functional Requirements (REQ-9.x)

### REQ-9.1: Performance ✅
- REQ-9.1.1: Feed API response ≤ 100ms (p95) with pre-computed scores ✅
- REQ-9.1.2: Trending API response ≤ 10ms from Redis cache ✅
- REQ-9.1.3: Search response ≤ 50ms via Meilisearch ✅
- REQ-9.1.4: Related articles API ≤ 200ms ✅
- REQ-9.1.5: Dark mode toggle ≤ 50ms (no page reload) ✅
- REQ-9.1.6: Infinite scroll: next page loads within 500ms of trigger ✅
- REQ-9.1.7: Fast classifier ≤ 5ms per article (keyword pass) ✅
- REQ-9.1.8: Full summarization ≤ 30s per article (including retries) ✅
- REQ-9.1.9: Content quality scoring < 50ms per article ✅
- REQ-9.1.10: Hover preview tooltip render ≤ 50ms ✅
- REQ-9.1.11: Ad viewability tracking ≤ 10ms overhead per ad ✅

### REQ-9.2: Reliability ✅
- REQ-9.2.1: Pipeline uptime ≥ 99% (circuit breaker prevents cascade failures) ✅
- REQ-9.2.2: Zero data loss: articles always stored, summarization retried later ✅
- REQ-9.2.3: Crawler uptime ≥ 99% — unhealthy sources auto-disabled, not blocking ✅
- REQ-9.2.4: Database recoverable within 1 hour from backup ✅
- REQ-9.2.5: Offline cache ≤ 50 MB storage, sync on reconnect ≤ 5s ✅

### REQ-9.3: Quality ✅
- REQ-9.3.1: Summary quality_score trung bình ≥ 0.75 ✅
- REQ-9.3.2: Fallback rate (generic reason) ≤ 5% of articles ✅
- REQ-9.3.3: All user inputs validated before processing ✅
- REQ-9.3.4: No SQL/NoSQL injection possible (parameterized queries via Mongoose) ✅
- REQ-9.3.5: JWT secret rotated monthly in production ✅
- REQ-9.3.6: Test coverage for all new features ✅

### REQ-9.4: Accessibility ✅
- REQ-9.4.1: Dark mode meets WCAG AA contrast ratios ✅
- REQ-9.4.2: Onboarding flow keyboard-navigable ✅
- REQ-9.4.3: ARIA labels on all interactive elements (buttons, links, inputs) ✅
- REQ-9.4.4: Keyboard navigation support for feed (arrow keys, Enter to open) ✅
- REQ-9.4.5: Focus management on route changes ✅
- REQ-9.4.6: Alt text on all article thumbnail images ✅

---

## Source Specs Reference

| Section | Original Specs |
|---------|---------------|
| 1. AI Engine | trendbriefai-unified (AI-1→AI-9), ai-quality-reliability (AIQ-1→AIQ-5), review-improvements (RV-3) |
| 2. Crawler & Data Pipeline | crawler-performance (CRP-1→CRP-6) |
| 3. Backend API & Services | trendbriefai-unified (LR-3, LR-5, GR-1), feature-enhancements (FE-1, FE-2), security-infrastructure (SI-6, SI-7), remaining-improvements (REM-7, REM-8) |
| 4. Web App | feature-enhancements (FE-2→FE-8), review-improvements (RV-1, RV-2, RV-4), trendbriefai-unified (GR-3) |
| 5. Admin Dashboard | trendbriefai-unified (LR-4), security-infrastructure (SI-5), remaining-improvements (REM-5, REM-6), crawler-performance (CRP-1.3) |
| 6. Mobile App | trendbriefai-unified (UX-1→UX-15), feature-enhancements (FE-4), remaining-improvements (REM-1) |
| 7. Security & Infrastructure | security-infrastructure (SI-1→SI-4), ai-quality-reliability (AIQ-5), trendbriefai-unified (LR-2), remaining-improvements (REM-4), review-improvements (RV-4.3) |
| 8. Growth & Monetization | trendbriefai-unified (GR-1→GR-4, LR-1, P2-1, P2-2), security-infrastructure (SI-6, SI-7) |
| 9. Non-Functional | All specs NFR sections consolidated |
