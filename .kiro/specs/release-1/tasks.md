# TrendBrief AI — Release 1 Unified Tasks

---

## Phase 1: AI Engine (Python/FastAPI)

- [x] 1.1 Add settings to `config.py` — summarizer_batch_size, lru_cache_max_size, redis_ai_cache_ttl, classifier thresholds, faiss_top_k, pipeline_concurrency_limit, quality_score_threshold
- [x] 1.2 Update `requirements.txt` — add faiss-cpu, hypothesis (dev), ensure transformers supports zero-shot
- [x] 1.3 Create `services/quality_scorer.py` — QualitySignals dataclass, score() with length/structure/vn_ratio/spam signals, weighted overall (0.3/0.25/0.25/0.2), clamped [0.0, 1.0]
- [x] 1.4 Quality gate in pipeline — score < 0.3 → skip AI, mark "failed"
- [x] 1.5 Add Vietnamese artifact removal to `services/cleaner.py` — "Đọc thêm:", "Xem thêm:", "Tin liên quan:", ©, social sharing, repeated paragraphs
- [x] 1.6 Unicode NFC normalization, preserve diacritical marks
- [x] 1.7 Create `services/cache/redis_cache.py` — RedisAICache with get/put for summaries (`ai:summary:{hash}`) and classifications (`ai:classify:{hash}`), TTL 24h, graceful degradation
- [x] 1.8 Create `services/cache/summarizer_cache.py` — two-level LRU (max 1000) + Redis, content hash key, `from_cache` metadata flag
- [x] 1.9 Add `generate_summary_batch()` — group into batches of 5, single Ollama call per batch
- [x] 1.10 Batch failure fallback → individual processing → extractive fallback
- [x] 1.11 Enhance `generate_summary()` with cache integration
- [x] 1.12 Create HybridClassifier — keyword + zero-shot (xlm-roberta-large-xnli), Vietnamese labels, weighted combination (0.4 kw + 0.6 zs), invoke zero-shot only when keyword hits ≤ 2, fallback to keyword-only on failure
- [x] 1.13 Create `services/dedup/faiss_index.py` — FAISSIndex with IndexFlatIP (384-dim), add/search (top-k=10)/rebuild (48h window)
- [x] 1.14 Integrate FAISS into dedup core — replace brute-force with FAISS, fallback when empty
- [x] 1.15 Add `encode_texts_batch()` to `services/dedup/embedding.py` — single model.encode() call, truncate to 4000 chars, 384-dim L2-normalized
- [x] 1.16 Enhance FastAPI lifespan — pre-load sentence-transformer, verify Ollama, graceful fallback
- [x] 1.17 Enhanced `/health` — model status, cache info, FAISS index size
- [x] 1.18 Refactor `pipeline.py` — asyncio.Semaphore (concurrency=5), rate limiter (1.5s), integrate quality scorer + cache + FAISS + batch embedding
- [x] 1.19 Stats invariant: new + duplicate + failed == total
- [x] 1.20 Create `services/summary_validator.py` — SummaryValidator class: validate title length (≤15 words), bullet count (==3), bullet length (10-50 words each), reason not generic, no hallucinated URLs. Return quality_score 0-1
- [x] 1.21 Create fallback reason pool — `services/data/fallback_reasons.json` with ≥20 varied Vietnamese reasons. Random select when LLM fails
- [x] 1.22 Integrate validator into `pipeline.py` — after generate_summary(), validate output. If quality_score < 0.6 → retry with adjusted prompt (max 2 retries). Store quality_score in article document
- [x] 1.23 Create `/health/ai-quality` endpoint — report avg quality_score (last 24h), fallback_rate, retry_rate, provider distribution
- [x] 1.24 Create `services/llm_providers.py` — base class LLMProvider (summarize, classify), ProviderHealth (success_rate, avg_latency, last_error, is_healthy)
- [x] 1.25 Implement OllamaProvider — wrap existing Ollama summarization logic into provider interface
- [x] 1.26 Implement GroqProvider — Groq API (free tier, llama-3.1-70b-versatile, 30 RPM), summarize + classify endpoints
- [x] 1.27 Implement GeminiProvider — Google Gemini API (free tier, gemini-1.5-flash, 15 RPM), summarize + classify
- [x] 1.28 Create ProviderChain — ordered fallback: Ollama → Groq → Gemini. Auto-skip unhealthy providers (success_rate < 50% in last 10 min). Record provider used in article metadata
- [x] 1.29 Update `services/summarizer.py` — replace direct Ollama call with ProviderChain.summarize(). Keep cache integration
- [x] 1.30 Create `services/fast_classifier.py` — FastClassifier class: keyword dictionary per topic (≥50 keywords each for 9 topics), count matches, return (topic, confidence)
- [x] 1.31 Create `services/data/topic_keywords.json` — keyword dictionaries for all 9 topics (ai, finance, drama, lifestyle, career, health, entertainment, sport, insight)
- [x] 1.32 Update `services/classifier.py` — 2-tier: FastClassifier first (≤5ms), if confidence ≥ 0.8 → return. Else → LLM classify. Add Redis cache by content_hash
- [x] 1.33 Add classifier metrics: track fast_classifier_hit_rate, llm_classifier_call_rate. Target: ≥60% articles classified by keyword only
- [x] 1.34 Create `services/data/prompt_templates.json` — prompt per topic (9 topics): finance, drama, ai, lifestyle, career, health, entertainment, sport, insight
- [x] 1.35 Update summarizer — load prompt template based on article topic. Fallback to generic prompt if topic unknown
- [x] 1.36 Add prompt_version field in article metadata — enable A/B testing of prompt variants
- [x] 1.37 Create `services/sentiment.py` — keyword-based sentiment analysis (Vietnamese + English). Integrate into pipeline. Add `sentiment` field to article docs
- [x] 1.38 Add `RateLimitTracker` class to `llm_providers.py` — Groq (30 RPM) and Gemini (15 RPM) log warnings at 80% capacity. Health endpoint includes rate limit stats


## Phase 2: Crawler & Performance

- [x] 2.1 Update `rss_sources` schema — add health sub-document: success_count_24h, total_count_24h, success_rate, consecutive_failures, last_successful_at, last_error, auto_disabled, disabled_until
- [x] 2.2 Update crawl worker — after each source crawl, update health metrics. Reset consecutive_failures on success, increment on failure. Calculate rolling 24h success_rate
- [x] 2.3 Add auto-disable logic — skip sources where auto_disabled=true AND disabled_until > now. Re-enable when disabled_until expires
- [x] 2.4 Add source health API — `GET /api/admin/sources/health` returns all sources with health metrics, sorted by success_rate ascending
- [x] 2.5 Add admin UI source health page — table with source name, status, success_rate bar, last crawl time, consecutive failures, enable/disable toggle
- [x] 2.6 Replace newspaper3k with trafilatura — update `services/cleaner.py` to use `trafilatura.extract()` as primary, newspaper3k as fallback
- [x] 2.7 Add trafilatura to requirements.txt — `trafilatura>=1.8.0`
- [x] 2.8 Implement per-domain rate limiting — `services/rate_limiter.py`: track last_request_at per domain, enforce min 1.5s gap per domain
- [x] 2.9 Add image validation — check image URL responds with image content-type, dimensions ≥ 200×200, fallback to OG image meta tag
- [x] 2.10 Improve published_at parsing — try multiple date formats (ISO 8601, Vietnamese date strings, RSS pubDate), fallback to crawl time. Store parse_method in metadata
- [x] 2.11 Add `feed_score` field to articles schema — Number, default 0, indexed descending
- [x] 2.12 Create background job `computeFeedScores` — runs hourly. For articles in last 72h: feed_score = recency(0.4) + popularity(0.25) + quality(0.2) + source_quality(0.15)
- [x] 2.13 Update feed service — replace in-memory ranking with MongoDB query sorted by feed_score. Apply per-user personalization boost at query time
- [x] 2.14 Add feed_score to article API response — for debugging/transparency
- [x] 2.15 Create background job `updateTrendingCache` — runs every 30 min. Aggregate articles by views in last 24h. Store top 50 global + top 20 per topic in Redis sorted sets
- [x] 2.16 Update trending service — read from Redis ZREVRANGE instead of MongoDB aggregation. Fallback to MongoDB if Redis unavailable
- [x] 2.17 Add trending cache stats to health endpoint — cache_age, article_count per topic
- [x] 2.18 Add Meilisearch to docker-compose.yml — `getmeili/meilisearch:v1.7`, port 7700, volume for data persistence
- [x] 2.19 Create `services/search.service.ts` — MeilisearchService: connect, createIndex, addDocuments, search. Fallback to MongoDB $text
- [x] 2.20 Add article sync hook — on article insert/update (processing_status=done), sync to Meilisearch index
- [x] 2.21 Update search route — use MeilisearchService.search() with highlighted snippets, topic filter, date range filter
- [x] 2.22 Add initial index sync script — bulk index all existing articles on first startup
- [x] 2.23 Create image proxy — `GET /api/img/:articleId` endpoint: fetch → resize (max 800px via sharp) → convert to WebP → cache in Redis (1h TTL) → serve
- [x] 2.24 Add image proxy cache layer — check Redis `img:{articleId}` before downloading
- [x] 2.25 Update web/mobile clients — replace direct image URLs with `/api/img/:articleId` proxy URLs. Add `loading="lazy"` attribute


## Phase 3: Backend Services (Express.js)

- [x] 3.1 Create Topic model + seed 9 topics (AI, Finance, Lifestyle, Drama, Technology, Career, Health, Entertainment, Sport)
- [x] 3.2 Create `GET /api/topics` route (replace hardcoded list)
- [x] 3.3 Create `readingHistory.service.ts` — query Interaction for views, paginated, sorted by most recent
- [x] 3.4 Create `GET /api/users/me/history` route
- [x] 3.5 Create `userStats.service.ts` — total articles read, bookmarks, days active
- [x] 3.6 Create `GET /api/users/me/stats` route
- [x] 3.7 Create DeviceToken + NotificationLog models
- [x] 3.8 Create `notification.service.ts` — FCM token management, push sending, daily rate limit (max 3/user/day), topic targeting, dedup (Redis 24h)
- [x] 3.9 Create `POST /api/notifications/register` + `DELETE /api/notifications/unregister`
- [x] 3.10 Create `POST /api/users/me/onboarding` — save interests, set onboarding_completed
- [x] 3.11 Create `PUT /api/users/me/settings` — notifications_enabled, theme
- [x] 3.12 Extend User model — onboarding_completed, notifications_enabled, settings.theme, interests as string[]
- [x] 3.13 Add thumbnailUrl + isTrending to FeedItem type and feed/trending responses
- [x] 3.14 Create `src/routes/v1/` directory — move all existing route files into v1 subfolder
- [x] 3.15 Create v1 router — `src/routes/v1/index.ts` that mounts all route modules under `/v1/`
- [x] 3.16 Update `index.ts` — mount v1Router at `/api/v1/`, keep backward compat at `/api/` with Deprecation header
- [x] 3.17 Add `X-API-Version: 1` response header middleware
- [x] 3.18 Create Zod schemas for all route inputs — `src/types/schemas.ts`: feedQuery, searchQuery, bookmarkBody, interactionBody, authRegister, authLogin, etc.
- [x] 3.19 Create validation middleware — `src/middleware/validate.ts`: validate body/query/params against Zod schemas, return 400 with field-level errors
- [x] 3.20 Apply validation middleware to all routes — feed, search, bookmarks, interactions, auth, admin, public
- [x] 3.21 Add HTML sanitization — sanitize user-provided strings using `sanitize-html` package
- [x] 3.22 Create backup script — `scripts/backup.sh`: mongodump → tar.gz → upload to S3/R2 → cleanup local
- [x] 3.23 Add backup npm script — `npm run backup` runs the backup script
- [x] 3.24 Add backup cron job — daily at 3 AM UTC via node-cron or system crontab
- [x] 3.25 Document backup/restore procedure in `docs/BACKUP.md`
- [x] 3.26 Create request logger middleware — `src/middleware/requestLogger.ts`: generate request_id (UUID), log method/path/status/duration/user_id as JSON, warn on slow requests (>1s)
- [x] 3.27 Add request_id to all responses — `X-Request-Id` header
- [x] 3.28 Create crawl metrics endpoint — `GET /api/admin/metrics`: articles_processed_24h, success_rate, avg_processing_time, provider_distribution, queue_depth
- [x] 3.29 Add error rate tracking — count 5xx responses per 5-min window, log alert if >5%
- [x] 3.30 Install `opossum` package. Create `src/middleware/circuitBreaker.ts` — wrap AI engine HTTP calls with circuit breaker (threshold: 5 failures, timeout: 30s, resetTimeout: 30s)
- [x] 3.31 Implement fallback behavior when circuit open: return cached articles for feed, skip summarization for new crawls, queue for retry when circuit closes
- [x] 3.32 Add circuit breaker status to `/health` endpoint — state (closed/open/half-open), failure_count, last_failure_at
- [x] 3.33 Add circuit breaker alert: log warning when circuit opens, log info when circuit closes
- [x] 3.34 Add viewability tracking endpoint — `POST /api/ads/viewable`: ad_id, visible_duration_ms, viewport_percentage, article_position
- [x] 3.35 Update Ad model — add viewable_impressions, avg_viewability_rate, viewability_data fields
- [x] 3.36 Create affiliate product search service — `src/services/affiliate.search.ts`: search Shopee/Lazada APIs by keywords, cache results (24h TTL)
- [x] 3.37 Update affiliate matching — after article summarized, extract top 5 keywords → search affiliate products → rank by match_score → attach top 2 to article
- [x] 3.38 A/B test setup — 50% articles get static affiliate links, 50% get dynamic. Track CTR per group
- [x] 3.39 Implement referral activation logic — when referee reads 5 articles, trigger reward: add 7 days to referrer's premium_until
- [x] 3.40 Add referral dashboard API — `GET /api/referral/stats`: total_referrals, activated, rewards_given, conversion_rate
- [x] 3.41 Add referral anti-abuse — max 50 rewards per user, check IP uniqueness of referees, rate limit referral code generation
- [x] 3.42 Add referral notification — notify referrer when reward earned via FCM + in-app notification
- [x] 3.43 Create `SummaryFeedback` model, `POST /api/public/feedback` route (idempotent by IP hash), thumbs up/down on feed cards
- [x] 3.44 Create proxy route `POST /api/public/summarize-url` — forward to AI engine `/summarize-url`, rate limit 10/hour per IP
- [x] 3.45 Create `src/services/related.service.ts` — getRelated(articleId, limit): load article embedding → find candidates → compute cosine similarity → sort → return top N. Fallback: recent articles same topic
- [x] 3.46 Create route `GET /api/articles/:id/related` — call related service, cache in Redis (1h TTL)


## Phase 4: Web App (Angular)

- [x] 4.1 Add dark theme CSS variables to `design-system.css` — `[data-theme="dark"]` with dark bg, dark cards, light text, adjusted shadows
- [x] 4.2 Add theme toggle component — button in navbar (sun/moon icon), persist in localStorage, auto-detect system preference via `prefers-color-scheme`
- [x] 4.3 Update web `styles.css` — ensure all components use CSS variables (no hardcoded colors)
- [x] 4.4 Update feed component — replace "Tải thêm" button with IntersectionObserver sentinel element at bottom
- [x] 4.5 Use cursor pagination API (`/api/public/feed/cursor`) — pass last article ID as cursor
- [x] 4.6 Add loading spinner at bottom while fetching
- [x] 4.7 Add "Hết bài viết" message when hasMore=false
- [x] 4.8 Add scroll-to-top button — appears after scrolling 2 viewport heights, smooth scroll to top on click
- [x] 4.9 Create OnboardingComponent — 3-step flow: topic selection (min 3) → notification prompt (optional) → redirect to feed
- [x] 4.10 Store selected topics in localStorage — feed page reads from localStorage to apply topic boost
- [x] 4.11 Show onboarding only once — check `onboarding_completed` flag in localStorage, skip if true
- [x] 4.12 Add skip button on each onboarding step
- [x] 4.13 Create web page `/summarize` — SummarizeComponent: input field for URL, "Tóm tắt" button, loading skeleton, result card
- [x] 4.14 Add share buttons on summarize result card — copy summary to clipboard, share via Web Share API
- [x] 4.15 Add summarize route to web app.routes.ts, add link in navbar
- [x] 4.16 Add reading progress bar component — fixed top, 3px height, accent color, width based on scroll position
- [x] 4.17 Track actual reading time — start timer on article page mount, stop on unmount, store in interactions collection
- [x] 4.18 Add "Đã đọc" badge on feed cards — for articles user has viewed
- [x] 4.19 Add hover tooltip — show 3 bullet summary on card hover (desktop only, 500ms delay)
- [x] 4.20 Position tooltip above/below based on viewport space. Max-width 320px
- [x] 4.21 Disable hover tooltip on mobile (touch devices)
- [x] 4.22 Update article detail page — add "Bài viết liên quan" section below content, show 5 related article cards
- [x] 4.23 Service worker — cache last 50 articles for offline (stale-while-revalidate)
- [x] 4.24 Web app manifest with install prompt
- [x] 4.25 JSON-LD Article schema on article detail pages
- [x] 4.26 Dynamic sitemap from article catalog
- [x] 4.27 Google News sitemap format
- [x] 4.28 Newsletter signup form
- [x] 4.29 Social sharing buttons (Zalo, Facebook, copy link)
- [x] 4.30 Add IntersectionObserver on web ad cards — report viewable impression when 50%+ visible for 1s+
- [x] 4.31 Error retry UI on feed — `error` signal, retry button with `retryLoad()`, styled `.error-state`
- [x] 4.32 Add `deduplicatedGet()` to API service — request deduplication
- [x] 4.33 Add sentiment badge (😊/😟) in feed cards


## Phase 5: Admin Dashboard (Angular)

- [x] 5.1 Analytics page — DAU/MAU/D7 retention chart, views by topic, top 10 articles, ad/affiliate stats
- [x] 5.2 Source management — list sources + status, add/edit/delete, manual "Crawl Now"
- [x] 5.3 Content moderation — reported queue, auto-hidden list, restore/confirm/delete, blocklist editor
- [x] 5.4 Ad management — CRUD native ads, impressions/clicks/CTR
- [x] 5.5 Affiliate management — CRUD links, clicks/conversions
- [x] 5.6 Notification management — send manual push, delivery logs
- [x] 5.7 User management — view, ban/suspend, activity
- [x] 5.8 Add viewability report in admin analytics — viewability_rate (viewable/total impressions), avg_visible_duration
- [x] 5.9 Add dark mode to admin UI `styles.scss` — `[data-theme="dark"]` variables, theme toggle in sidebar


## Phase 6: Mobile App (Flutter)

- [x] 6.1 Create `lib/config/app_theme.dart` — light + dark ThemeData, Material 3, Vietnamese font
- [x] 6.2 Create `lib/providers/theme_provider.dart` — ChangeNotifier, persist to SharedPreferences
- [x] 6.3 Wire ThemeProvider into main.dart
- [x] 6.4 Update FeedItem model — add thumbnailUrl, isTrending
- [x] 6.5 Create TopicModel, UserStats models
- [x] 6.6 Create CacheService (Hive) — cacheFeedPage, getCachedFeedPage
- [x] 6.7 Create ShareService — formatShareText, shareArticle
- [x] 6.8 Create ReviewPromptService — track daysOpened, articlesViewed, eligibility (≥5 days + ≥20 articles + 90-day cooldown)
- [x] 6.9 Create NotificationService — FCM token, permission, tap navigation
- [x] 6.10 Extend ApiService — getTopics, getUserStats, getReadingHistory, saveOnboarding, registerDeviceToken, updateSettings, trackShare
- [x] 6.11 Create `lib/utils/time_formatter.dart` — formatRelativeTime (Vietnamese: "vừa xong", "X phút trước", etc.)
- [x] 6.12 Create `lib/utils/validators.dart` — isValidSearchQuery (≥2 chars)
- [x] 6.13 Create SkeletonCard — shimmer placeholder mimicking FeedCard
- [x] 6.14 Create SkeletonDetailView — shimmer for article detail
- [x] 6.15 Create ErrorStateView — error illustration, "Thử lại" button, offline banner
- [x] 6.16 Create EnhancedFeedCard — thumbnail/gradient, relative time, reading time badge, trending badge, animations, haptic on bookmark
- [x] 6.17 Create DynamicTopicChips — fetch from API, ChoiceChip per topic
- [x] 6.18 Create TrendingCarousel — horizontal scrollable trending cards
- [x] 6.19 Create OnboardingScreen — 3-step PageView (welcome → topics ≥1 → done), save via API, show once
- [x] 6.20 Create ArticleDetailScreen — AI title, source, date, topic, reading time, bullets, reason, "Đọc bài gốc" in-app browser, bookmark + share, record view
- [x] 6.21 Create SearchScreen — auto-focus, ≥2 chars trigger, infinite scroll, empty state, error state
- [x] 6.22 Create ReadingHistoryScreen — paginated viewed articles
- [x] 6.23 FeedScreen — add TrendingCarousel, EnhancedFeedCard, DynamicTopicChips, skeleton loaders, error/offline handling, search icon, haptic on pull-to-refresh
- [x] 6.24 HomeScreen — AnimatedSwitcher for cross-fade tab transitions (250ms)
- [x] 6.25 ProfileScreen — reading stats, reading history link, dark mode toggle, notification toggle, app version
- [x] 6.26 BookmarksScreen — ErrorStateView with retry
- [x] 6.27 Update main.dart — ThemeProvider, OnboardingProvider, routes, Firebase init, Hive init, onboarding gate
- [x] 6.28 Wire ShareService to EnhancedFeedCard + ArticleDetailScreen
- [x] 6.29 Wire ReviewPromptService — increment on article view, check after detail close
- [x] 6.30 Add SQLite local database (sqflite + connectivity_plus) — cache last 50 articles with full content
- [x] 6.31 Auto-cache bookmarked articles for offline access
- [x] 6.32 Add offline indicator banner — "Đang offline — hiển thị bài đã lưu" when no internet
- [x] 6.33 Sync bookmarks on reconnect — merge local bookmarks with server
- [x] 6.34 Update article detail screen — add related articles horizontal scroll below content
- [x] 6.35 Follow system theme via `MediaQuery.platformBrightnessOf(context)`, update AppTheme


## Phase 7: Launch Readiness

- [x] 7.1 Write Privacy Policy (Vietnamese) — host at trendbriefai.vn/privacy
- [x] 7.2 Write Terms of Service (Vietnamese) — host at trendbriefai.vn/terms
- [x] 7.3 Create app icon (1024x1024 + 512x512)
- [x] 7.4 Create splash screen
- [x] 7.5 Create 5 app store screenshots (Vietnamese, real data)
- [x] 7.6 Write Vietnamese app store listing (title, subtitle, description, keywords)
- [x] 7.7 Add privacy + ToS links in mobile settings
- [x] 7.8 Setup Firebase project (Android + iOS)
- [x] 7.9 Integrate Crashlytics — crash reports, ANR tracking
- [x] 7.10 Integrate Analytics — screen_view, article_view, article_share, bookmark_add
- [x] 7.11 Integrate Google Analytics on web
- [x] 7.12 Test on real devices
- [x] 7.13 Complete FCM in Flutter — permission, foreground/background/terminated handling
- [x] 7.14 Backend notification scheduler (BullMQ cron): trending_check (30 min), daily_digest (8 AM), weekly_digest (Sunday 9 AM), topic_update (every 2h)
- [x] 7.15 Frequency caps — trending 3/day, topic 1/topic/day, daily 1/day
- [x] 7.16 Deep links — tap opens article detail or feed
- [x] 7.17 User notification preferences toggle per type
- [x] 7.18 Notification log — track sent/delivered/opened

## Phase 8: Growth & Monetization

- [x] 8.1 Rich share card API (`GET /api/public/share-image/{articleId}`) — OG image with title + summary + branding
- [x] 8.2 Per-article OG meta tags on web
- [x] 8.3 Zalo share deep link
- [x] 8.4 Improve mobile share — OG URL for rich preview
- [x] 8.5 Track share events in analytics
- [x] 8.6 Generate unique referral code per user
- [x] 8.7 "Mời bạn bè" button in profile — copy referral link
- [x] 8.8 Referral landing page (web) → app store redirect
- [x] 8.9 On signup, store referred_by, grant 7-day Premium to both
- [x] 8.10 Referral cap: max 10/user/month
- [x] 8.11 Admin referral stats
- [x] 8.12 Reading streak — track consecutive days, display in profile (🔥 12 ngày)
- [x] 8.13 In-app review prompt tuning (trigger after 7th article view)
- [x] 8.14 "Đọc tiếp" section — articles viewed < 10 seconds
- [x] 8.15 Related articles at bottom of article detail
- [x] 8.16 AdMob banner (bottom of article detail)
- [x] 8.17 Premium subscription UI — paywall, feature comparison
- [x] 8.18 Payment integration (Momo + VNPay)
- [x] 8.19 Premium features: ad-free, unlimited AI, exclusive "Insight" topic
- [x] 8.20 Article reactions (🔥 😮 😢 😡)
- [x] 8.21 Reaction counts on article cards
- [x] 8.22 "Bài viết được yêu thích nhất" section
- [x] 8.23 Daily AI briefing — personalized 2-minute audio summary (TTS)
- [x] 8.24 ML-based feed personalization (replace topic boost with learned preferences)


## Phase 9: UI/UX Polish

- [x] 9.1 Skeleton loaders — full skeleton cards on web and mobile (already implemented, verified)
- [x] 9.2 End-of-feed state — "🎉 Bạn đã đọc hết bài viết" message
- [x] 9.3 Image lazy loading — `loading="lazy"` on all images
- [x] 9.4 Cache-Control headers — trending (2min) and topics (1h)
- [x] 9.5 MAX_CANDIDATES increased from 200 to 500 for feed ranking
- [x] 9.6 Content moderation pipeline — keyword blocklist in crawl pipeline (Vietnamese spam/NSFW)
- [x] 9.7 Source whitelist/blacklist in dynamic config
- [x] 9.8 User report button — "Báo cáo bài viết" with reason
- [x] 9.9 article_reports collection
- [x] 9.10 Auto-hide at 3+ reports, notify admin
- [x] 9.11 Admin moderation queue

## Phase 10: Code Quality & Review

- [x] 10.1 Rename 12 `.css` → `.scss` files in trendbriefai-web. Update `.ts` to `styleUrl` singular
- [x] 10.2 Rename 15 `.css` → `.scss` files in trendbriefai-ui. Update `.ts` to `styleUrl` singular
- [x] 10.3 ARIA labels — added to article links, bullet lists, search, theme toggle
- [x] 10.4 Alt text — improved with fallback string
- [x] 10.5 Keyboard navigation — arrow keys (↑↓ or j/k) to navigate articles, Enter to open. Visual focus ring on `.kb-focus` card
- [x] 10.6 Test related articles: verify cosine similarity ranking, verify fallback, verify cache
- [x] 10.7 Test summarize URL: verify rate limiting, verify error handling for invalid URLs
- [x] 10.8 Test dark mode: verify all components render correctly in dark theme, verify contrast ratios
- [x] 10.9 Test infinite scroll: verify cursor pagination, verify loading states, verify end-of-feed
- [x] 10.10 Test source health: verify auto-disable at <10% success rate, verify re-enable after cooldown
- [x] 10.11 Test feed scores: verify pre-computed scores match expected ranking, verify personalization boost
- [x] 10.12 Test trending cache: verify Redis cache populated, verify API reads from cache
- [x] 10.13 Test search: verify Meilisearch returns Vietnamese results with typo tolerance
- [x] 10.14 Test API versioning: verify /api/v1/ works, verify /api/ backward compat with Deprecation header
- [x] 10.15 Test validation: verify 400 errors with field-level messages for invalid inputs
- [x] 10.16 Test backup: verify mongodump + restore cycle, verify data integrity
- [x] 10.17 Test referral: verify activation after 5 reads, verify reward applied, verify anti-abuse limits
- [x] 10.18 Test summary validator: verify scoring accuracy on 20 sample summaries (good + bad)
- [x] 10.19 Test provider chain: verify fallback order, verify health tracking, verify auto-skip unhealthy
- [x] 10.20 Test fast classifier: verify keyword accuracy on 50 sample articles, verify ≥60% hit rate
- [x] 10.21 Test circuit breaker: verify open/close transitions, verify fallback behavior
- [x] 10.22 All test files created (Python engine + Node.js service + Web E2E)

## Phase 11: AI Independence (3 tasks)

- [x] 11.1 Create `scheduler.py` in engine — independent crawl scheduler that reads RSS sources from MongoDB, crawls every 10min, runs full AI pipeline locally, writes results back. Also handles weekly discovery + FAISS rebuild every 6h
- [x] 11.2 Move related articles cosine similarity to engine — new `POST /related` endpoint using numpy vectorized cosine similarity. Service calls engine via HTTP, falls back to same-topic recency when engine offline
- [x] 11.3 Add `CRAWL_MODE` config to service — default `engine` (engine runs own scheduler), optional `service` (legacy HTTP trigger). Service only starts crawl scheduler when `CRAWL_MODE=service`

---

## Summary

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| 1 | AI Engine | 38 | ✅ Complete |
| 2 | Crawler & Performance | 25 | ✅ Complete |
| 3 | Backend Services | 46 | ✅ Complete |
| 4 | Web App | 33 | ✅ Complete |
| 5 | Admin Dashboard | 9 | ✅ Complete |
| 6 | Mobile App | 35 | ✅ Complete |
| 7 | Launch Readiness | 18 | ✅ Complete |
| 8 | Growth & Monetization | 24 | ✅ Complete |
| 9 | UI/UX Polish | 11 | ✅ Complete |
| 10 | Code Quality & Review | 22 | ✅ Complete |
| 11 | AI Independence | 3 | ✅ Complete |
| **Total** | | **264** | **✅ All Complete** |
