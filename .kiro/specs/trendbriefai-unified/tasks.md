# TrendBrief AI — Unified Implementation Tasks

## Phase 1: AI Engine Performance (Python/FastAPI)

### Task 1: Config & Dependencies
- [x] 1.1: Add settings to `config.py` — summarizer_batch_size, lru_cache_max_size, redis_ai_cache_ttl, classifier thresholds, faiss_top_k, pipeline_concurrency_limit, quality_score_threshold
- [x] 1.2: Update `requirements.txt` — add faiss-cpu, hypothesis (dev), ensure transformers supports zero-shot

### Task 2: Content Quality Scorer
- [x] 2.1: Create `services/quality_scorer.py` — QualitySignals dataclass, score() with length/structure/vn_ratio/spam signals, weighted overall (0.3/0.25/0.25/0.2), clamped [0.0, 1.0]
- [x] 2.2: Quality gate in pipeline — score < 0.3 → skip AI, mark "failed"

### Task 3: Vietnamese Text Cleaning
- [x] 3.1: Add Vietnamese artifact removal to `services/cleaner.py` — "Đọc thêm:", "Xem thêm:", "Tin liên quan:", ©, social sharing, repeated paragraphs
- [x] 3.2: Unicode NFC normalization, preserve diacritical marks

### Task 4: Redis AI Cache
- [x] 4.1: Create `services/cache/redis_cache.py` — RedisAICache with get/put for summaries (`ai:summary:{hash}`) and classifications (`ai:classify:{hash}`), TTL 24h, graceful degradation

### Task 5: Summarizer Cache
- [x] 5.1: Create `services/cache/summarizer_cache.py` — two-level LRU (max 1000) + Redis, content hash key, `from_cache` metadata flag

### Task 6: Batch Summarizer
- [x] 6.1: Add `generate_summary_batch()` — group into batches of 5, single Ollama call per batch
- [x] 6.2: Batch failure fallback → individual processing → extractive fallback
- [x] 6.3: Enhance `generate_summary()` with cache integration

### Task 7: Hybrid Classifier
- [x] 7.1: Create HybridClassifier — keyword + zero-shot (xlm-roberta-large-xnli), Vietnamese labels, weighted combination (0.4 kw + 0.6 zs), invoke zero-shot only when keyword hits ≤ 2, fallback to keyword-only on failure

### Task 8: FAISS Dedup
- [x] 8.1: Create `services/dedup/faiss_index.py` — FAISSIndex with IndexFlatIP (384-dim), add/search (top-k=10)/rebuild (48h window)
- [x] 8.2: Integrate into dedup core — replace brute-force with FAISS, fallback when empty

### Task 9: Batch Embedding
- [x] 9.1: Add `encode_texts_batch()` to `services/dedup/embedding.py` — single model.encode() call, truncate to 4000 chars, 384-dim L2-normalized

### Task 10: Model Warm-Up & Health
- [x] 10.1: Enhance FastAPI lifespan — pre-load sentence-transformer, verify Ollama, graceful fallback
- [x] 10.2: Enhanced `/health` — model status, cache info, FAISS index size

### Task 11: Concurrent Pipeline
- [x] 11.1: Refactor `pipeline.py` — asyncio.Semaphore (concurrency=5), rate limiter (1.5s), integrate quality scorer + cache + FAISS + batch embedding
- [x] 11.2: Stats invariant: new + duplicate + failed == total

## Phase 2: Backend — New Endpoints & Services (Express.js)

### Task 12: Dynamic Topics
- [x] 12.1: Create Topic model + seed 9 topics (AI, Finance, Lifestyle, Drama, Technology, Career, Health, Entertainment, Sport)
- [x] 12.2: Create `GET /api/topics` route (replace hardcoded list)

### Task 13: Reading History & User Stats
- [x] 13.1: Create `readingHistory.service.ts` — query Interaction for views, paginated, sorted by most recent
- [x] 13.2: Create `GET /api/users/me/history` route
- [x] 13.3: Create `userStats.service.ts` — total articles read, bookmarks, days active
- [x] 13.4: Create `GET /api/users/me/stats` route

### Task 14: Notification Service
- [x] 14.1: Create DeviceToken + NotificationLog models
- [x] 14.2: Create `notification.service.ts` — FCM token management, push sending, daily rate limit (max 3/user/day), topic targeting, dedup (Redis 24h)
- [x] 14.3: Create `POST /api/notifications/register` + `DELETE /api/notifications/unregister`

### Task 15: Onboarding & Settings Endpoints
- [x] 15.1: Create `POST /api/users/me/onboarding` — save interests, set onboarding_completed
- [x] 15.2: Create `PUT /api/users/me/settings` — notifications_enabled, theme
- [x] 15.3: Extend User model — onboarding_completed, notifications_enabled, settings.theme, interests as string[]

### Task 16: Feed Enhancements
- [x] 16.1: Add thumbnailUrl + isTrending to FeedItem type and feed/trending responses

## Phase 3: Mobile — Design System & Core (Flutter)

### Task 17: Design System & Theme
- [x] 17.1: Create `lib/config/app_theme.dart` — light + dark ThemeData, Material 3, Vietnamese font
- [x] 17.2: Create `lib/providers/theme_provider.dart` — ChangeNotifier, persist to SharedPreferences
- [x] 17.3: Wire ThemeProvider into main.dart

### Task 18: Models & Services
- [x] 18.1: Update FeedItem model — add thumbnailUrl, isTrending
- [x] 18.2: Create TopicModel, UserStats models
- [x] 18.3: Create CacheService (Hive) — cacheFeedPage, getCachedFeedPage
- [x] 18.4: Create ShareService — formatShareText, shareArticle
- [x] 18.5: Create ReviewPromptService — track daysOpened, articlesViewed, eligibility (≥5 days + ≥20 articles + 90-day cooldown)
- [x] 18.6: Create NotificationService — FCM token, permission, tap navigation
- [x] 18.7: Extend ApiService — getTopics, getUserStats, getReadingHistory, saveOnboarding, registerDeviceToken, updateSettings, trackShare

### Task 19: Utility Functions
- [x] 19.1: Create `lib/utils/time_formatter.dart` — formatRelativeTime (Vietnamese: "vừa xong", "X phút trước", etc.)
- [x] 19.2: Create `lib/utils/validators.dart` — isValidSearchQuery (≥2 chars)

### Task 20: Reusable Widgets
- [x] 20.1: Create SkeletonCard — shimmer placeholder mimicking FeedCard
- [x] 20.2: Create SkeletonDetailView — shimmer for article detail
- [x] 20.3: Create ErrorStateView — error illustration, "Thử lại" button, offline banner
- [x] 20.4: Create EnhancedFeedCard — thumbnail/gradient, relative time, reading time badge, trending badge, animations, haptic on bookmark
- [x] 20.5: Create DynamicTopicChips — fetch from API, ChoiceChip per topic
- [x] 20.6: Create TrendingCarousel — horizontal scrollable trending cards

## Phase 4: Mobile — Screens (Flutter)

### Task 21: New Screens
- [x] 21.1: Create OnboardingScreen — 3-step PageView (welcome → topics ≥1 → done), save via API, show once
- [x] 21.2: Create ArticleDetailScreen — AI title, source, date, topic, reading time, bullets, reason, "Đọc bài gốc" in-app browser, bookmark + share, record view
- [x] 21.3: Create SearchScreen — auto-focus, ≥2 chars trigger, infinite scroll, empty state, error state
- [x] 21.4: Create ReadingHistoryScreen — paginated viewed articles

### Task 22: Enhance Existing Screens
- [x] 22.1: FeedScreen — add TrendingCarousel, EnhancedFeedCard, DynamicTopicChips, skeleton loaders, error/offline handling, search icon, haptic on pull-to-refresh
- [x] 22.2: HomeScreen — AnimatedSwitcher for cross-fade tab transitions (250ms)
- [x] 22.3: ProfileScreen — reading stats, reading history link, dark mode toggle, notification toggle, app version
- [x] 22.4: BookmarksScreen — ErrorStateView with retry

### Task 23: Routing & Integration
- [x] 23.1: Update main.dart — ThemeProvider, OnboardingProvider, routes, Firebase init, Hive init, onboarding gate
- [x] 23.2: Wire ShareService to EnhancedFeedCard + ArticleDetailScreen
- [x] 23.3: Wire ReviewPromptService — increment on article view, check after detail close

## Phase 5: Launch Readiness

### Task 24: Legal & Store Assets
- [x] 24.1: Write Privacy Policy (Vietnamese) — host at trendbriefai.vn/privacy
- [x] 24.2: Write Terms of Service (Vietnamese) — host at trendbriefai.vn/terms
- [x] 24.3: Create app icon (1024x1024 + 512x512)
- [x] 24.4: Create splash screen
- [x] 24.5: Create 5 app store screenshots (Vietnamese, real data)
- [x] 24.6: Write Vietnamese app store listing (title, subtitle, description, keywords)
- [x] 24.7: Add privacy + ToS links in mobile settings

### Task 25: Firebase Integration
- [x] 25.1: Setup Firebase project (Android + iOS)
- [x] 25.2: Integrate Crashlytics — crash reports, ANR tracking
- [x] 25.3: Integrate Analytics — screen_view, article_view, article_share, bookmark_add
- [x] 25.4: Integrate Google Analytics on web
- [x] 25.5: Test on real devices

### Task 26: Push Notifications (End-to-End)
- [x] 26.1: Complete FCM in Flutter — permission, foreground/background/terminated handling
- [x] 26.2: Backend notification scheduler (BullMQ cron):
  - trending_check: every 30 min (1000+ views in 1h)
  - daily_digest: 8 AM (top article)
  - weekly_digest: Sunday 9 AM (top 5)
  - topic_update: every 2h (5+ new in subscribed topic)
- [x] 26.3: Frequency caps — trending 3/day, topic 1/topic/day, daily 1/day
- [x] 26.4: Deep links — tap opens article detail or feed
- [x] 26.5: User notification preferences toggle per type
- [x] 26.6: Notification log — track sent/delivered/opened

## Phase 6: Admin Dashboard

### Task 27: Admin Pages
- [x] 27.1: Analytics page — DAU/MAU/D7 retention chart, views by topic, top 10 articles, ad/affiliate stats
- [x] 27.2: Source management — list sources + status, add/edit/delete, manual "Crawl Now"
- [x] 27.3: Content moderation — reported queue, auto-hidden list, restore/confirm/delete, blocklist editor
- [x] 27.4: Ad management — CRUD native ads, impressions/clicks/CTR
- [x] 27.5: Affiliate management — CRUD links, clicks/conversions
- [x] 27.6: Notification management — send manual push, delivery logs
- [x] 27.7: User management — view, ban/suspend, activity

### Task 28: Content Moderation Pipeline
- [x] 28.1: Keyword blocklist in crawl pipeline (Vietnamese spam/NSFW)
- [x] 28.2: Source whitelist/blacklist in dynamic config
- [x] 28.3: User report button — "Báo cáo bài viết" with reason
- [x] 28.4: article_reports collection
- [x] 28.5: Auto-hide at 3+ reports, notify admin
- [x] 28.6: Admin moderation queue

## Phase 7: Viral Growth & Retention

### Task 29: Social Sharing
- [x] 29.1: Rich share card API (`GET /api/public/share-image/{articleId}`) — OG image with title + summary + branding
- [x] 29.2: Per-article OG meta tags on web
- [x] 29.3: Zalo share deep link
- [x] 29.4: Improve mobile share — OG URL for rich preview
- [x] 29.5: Track share events in analytics

### Task 30: Referral System
- [x] 30.1: Generate unique referral code per user
- [x] 30.2: "Mời bạn bè" button in profile — copy referral link
- [x] 30.3: Referral landing page (web) → app store redirect
- [x] 30.4: On signup, store referred_by, grant 7-day Premium to both
- [x] 30.5: Cap: max 10/user/month
- [x] 30.6: Admin referral stats

### Task 31: Retention Features
- [x] 31.1: Reading streak — track consecutive days, display in profile (🔥 12 ngày)
- [x] 31.2: In-app review prompt tuning (trigger after 7th article view)
- [x] 31.3: "Đọc tiếp" section — articles viewed < 10 seconds
- [x] 31.4: Related articles at bottom of article detail

## Phase 8: Web PWA & SEO

### Task 32: Web Improvements
- [x] 32.1: Service worker — cache last 20 articles for offline
- [x] 32.2: Web app manifest with install prompt
- [x] 32.3: JSON-LD Article schema on article detail pages
- [x] 32.4: Dynamic sitemap from article catalog
- [x] 32.5: Google News sitemap format
- [x] 32.6: Newsletter signup form
- [x] 32.7: Social sharing buttons (Zalo, Facebook, copy link)

## Phase 9: Monetization & Advanced (Phase 2)

### Task 33: Monetization
- [x] 33.1: AdMob banner (bottom of article detail)
- [x] 33.2: Premium subscription UI — paywall, feature comparison
- [x] 33.3: Payment integration (Momo + VNPay)
- [x] 33.4: Premium features: ad-free, unlimited AI, exclusive "Insight" topic

### Task 34: Social Features
- [x] 34.1: Article reactions (🔥 😮 😢 😡)
- [x] 34.2: Reaction counts on article cards
- [x] 34.3: "Bài viết được yêu thích nhất" section

### Task 35: Advanced AI
- [x] 35.1: "Tóm tắt cho tôi" — user pastes any URL, AI summarizes
- [x] 35.2: Daily AI briefing — personalized 2-minute audio summary (TTS)
- [x] 35.3: ML-based feed personalization (replace topic boost with learned preferences)
