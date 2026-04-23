# TrendBrief AI — Unified Requirements

## Overview
TrendBrief AI là ứng dụng tin tức AI cho Gen Z Việt Nam (18-30). AI tóm tắt tin tức trong 30-60 giây, cá nhân hóa theo sở thích. Mục tiêu: 1K DAU tháng 1, 30% D7 retention tháng 2, $1K/month revenue tháng 3.

## Actors
- **Visitor**: Đọc tin trên web, không cần đăng nhập
- **User**: Đăng nhập, cá nhân hóa feed, bookmarks, alerts, share
- **Admin**: Quản lý sources, ads, affiliates, moderation, analytics
- **AI Engine**: Crawl → clean → summarize → classify → dedup → store

---

## 1. AI Engine Performance (Python/FastAPI)

### AI-1: Summarization
- AI-1.1: Batch processing — group articles into batches of 5 for single Ollama call
- AI-1.2: Batch failure fallback — retry individually, extractive fallback per article
- AI-1.3: Output structure invariant — title_ai (≤12 Vietnamese words), exactly 3 summary_bullets, 1 reason
- AI-1.4: Two-level cache — LRU in-memory (max 1000) + Redis (TTL 24h), `from_cache` metadata flag

### AI-2: Classification
- AI-2.1: Hybrid mode — keyword matching + zero-shot classifier (xlm-roberta-large-xnli)
- AI-2.2: Zero-shot invoked only when keyword hits ≤ 2 (configurable threshold)
- AI-2.3: Vietnamese-compatible candidate labels for 9 topics
- AI-2.4: Weighted combination — 0.4 keyword + 0.6 zero-shot (configurable)
- AI-2.5: Fallback to keyword-only if zero-shot model fails

### AI-3: Deduplication
- AI-3.1: FAISS IndexFlatIP for nearest-neighbor embedding search (384-dim, top-k=10)
- AI-3.2: 3-layer dedup — URL hash → title similarity (≥0.8) → embedding cosine (≥0.8)
- AI-3.3: FAISS rebuild every 6h to remove expired articles (48h window)
- AI-3.4: Fallback to brute-force scan when FAISS empty/unavailable

### AI-4: Batch Embedding
- AI-4.1: Single `model.encode()` call for multiple texts
- AI-4.2: 384-dim L2-normalized vectors, identical to individual encoding
- AI-4.3: Truncate each text to 4000 chars before encoding

### AI-5: Pipeline Concurrency
- AI-5.1: asyncio.Semaphore — configurable concurrency limit (default 5)
- AI-5.2: Per-source rate limit delay (default 1.5s) between HTTP requests
- AI-5.3: Individual article failure doesn't affect batch
- AI-5.4: Stats invariant: new + duplicate + failed == total entries

### AI-6: Vietnamese Text Processing
- AI-6.1: Unicode NFC normalization before all processing
- AI-6.2: Strip Vietnamese web artifacts (Đọc thêm, Xem thêm, Tin liên quan, ©, social sharing)
- AI-6.3: Preserve Vietnamese diacritical marks throughout pipeline
- AI-6.4: Detect and remove repeated paragraphs

### AI-7: Content Quality Scoring
- AI-7.1: Score 0.0-1.0 per article — length, structure, Vietnamese ratio, spam indicators
- AI-7.2: Quality < 0.3 → skip AI summarization, mark as "failed"
- AI-7.3: Execute in < 50ms per article

### AI-8: Model Warm-Up
- AI-8.1: Pre-load sentence-transformer at startup
- AI-8.2: Verify Ollama connectivity with test prompt
- AI-8.3: Graceful fallback if models fail to load
- AI-8.4: `/health` endpoint — model readiness, cache status, FAISS index size

### AI-9: Redis AI Cache
- AI-9.1: Cache summaries (`ai:summary:{hash}`) and classifications (`ai:classify:{hash}`)
- AI-9.2: TTL 24h, graceful degradation if Redis unavailable

---

## 2. UX & Mobile App (Flutter)

### UX-1: Design System & Theming
- UX-1.1: Custom color palette (light + dark) with Material 3
- UX-1.2: Typography scale (5 styles) with Vietnamese-friendly font
- UX-1.3: Dark mode toggle — switch within 300ms, persist across restarts

### UX-2: Onboarding Flow
- UX-2.1: 3 screens — welcome → topic selection (≥1 required) → completion
- UX-2.2: Save interests to backend, navigate to feed
- UX-2.3: Show only once per user account

### UX-3: Enhanced Feed Card
- UX-3.1: Thumbnail image (16:9) or gradient placeholder with topic icon
- UX-3.2: Relative time ("2 giờ trước"), reading time badge
- UX-3.3: "🔥 Trending" badge for top 5 articles
- UX-3.4: Fade-in/slide-up entry animation, press-down scale on tap

### UX-4: Article Detail View
- UX-4.1: In-app display — AI title, source, date, topic, reading time, bullets, reason
- UX-4.2: "Đọc bài gốc" button → in-app browser
- UX-4.3: Bookmark + share buttons in app bar
- UX-4.4: Record "view" interaction on open

### UX-5: Search
- UX-5.1: Auto-focused text input, trigger on ≥2 chars
- UX-5.2: Infinite scroll pagination
- UX-5.3: Empty state + error state with retry

### UX-6: Trending Section
- UX-6.1: Horizontal scrollable carousel above feed (up to 10 articles)
- UX-6.2: Refresh on pull-to-refresh, hide silently on failure

### UX-7: Share
- UX-7.1: Platform share sheet — "{title}\n\nĐọc thêm: {url}\n\nvia TrendBrief AI"
- UX-7.2: Record "share" interaction via API

### UX-8: In-App Review
- UX-8.1: Trigger when daysOpened ≥ 5 AND articlesViewed ≥ 20
- UX-8.2: Max 1 prompt per 90 days, platform-native API
- UX-8.3: Skip silently if API unavailable

### UX-9: Skeleton Loaders
- UX-9.1: 3 skeleton cards on feed first load
- UX-9.2: Skeleton on search + article detail while loading
- UX-9.3: Fade transition to content within 200ms

### UX-10: Error & Offline Handling
- UX-10.1: ErrorStateView with "Thử lại" on all screens
- UX-10.2: "Không có kết nối mạng" banner when offline
- UX-10.3: Cache last feed page locally, show while offline

### UX-11: Micro-Interactions
- UX-11.1: Cross-fade tab transitions (250ms)
- UX-11.2: Haptic feedback on bookmark + pull-to-refresh

### UX-12: Dynamic Topics
- UX-12.1: 9+ topics from backend (not hardcoded)
- UX-12.2: New topics appear without app update

### UX-13: Reading History
- UX-13.1: Paginated list of viewed articles, sorted by most recent
- UX-13.2: Accessible from profile screen

### UX-14: Push Notifications
- UX-14.1: Request permission on first launch
- UX-14.2: Trending article push (top 3 in 6h window, max 3/day)
- UX-14.3: Tap notification → navigate to article detail
- UX-14.4: Toggle notifications in profile settings

### UX-15: Enhanced Profile
- UX-15.1: Reading stats — articles read, bookmarks, days active
- UX-15.2: Reading history link, dark mode toggle, notification toggle, app version

---

## 3. Launch Readiness

### LR-1: App Store Legal & Assets
- LR-1.1: Privacy Policy + Terms of Service (Vietnamese, hosted on web)
- LR-1.2: App icon (1024x1024 + 512x512)
- LR-1.3: Splash screen, 5 localized screenshots
- LR-1.4: Vietnamese app store listing (title, subtitle, description, keywords)
- LR-1.5: Category: News → News Aggregator

### LR-2: Crash Reporting & Analytics
- LR-2.1: Firebase Crashlytics (mobile)
- LR-2.2: Firebase Analytics (mobile) — screen_view, article_view, article_share, bookmark_add
- LR-2.3: Google Analytics (web)

### LR-3: Push Notifications (End-to-End)
- LR-3.1: FCM — send push from backend to mobile
- LR-3.2: Notification types — trending (1000+ views/1h), topic update (5+ new articles), daily digest (8 AM), weekly digest (Sunday 9 AM)
- LR-3.3: BullMQ cron scheduling, frequency caps, dedup (Redis 24h)
- LR-3.4: User notification preferences toggle per type

### LR-4: Admin Dashboard
- LR-4.1: Analytics — DAU, MAU, D7 retention, article views, shares, ad/affiliate stats
- LR-4.2: Source management — CRUD RSS sources, crawl status, manual crawl
- LR-4.3: Content moderation — reported articles queue, auto-hide at 3 reports
- LR-4.4: Ad management — CRUD native ads, impressions/clicks/CTR
- LR-4.5: Affiliate management — CRUD links, clicks/conversions
- LR-4.6: Notification management — send manual push, delivery logs
- LR-4.7: User management — view, ban/suspend

### LR-5: Content Moderation
- LR-5.1: Keyword blocklist (Vietnamese spam/NSFW)
- LR-5.2: Source whitelist/blacklist
- LR-5.3: User report button — "Báo cáo bài viết"
- LR-5.4: Auto-hide at 3+ reports, admin review queue

---

## 4. Growth & Retention (Post-Launch)

### GR-1: Viral Growth
- GR-1.1: Social login (Google OAuth)
- GR-1.2: Rich share cards — OG image with article title + summary + branding
- GR-1.3: Zalo share deep link
- GR-1.4: Referral system — unique code, 7-day Premium reward, max 10/month
- GR-1.5: "Mời bạn bè" button in profile

### GR-2: Retention
- GR-2.1: "Tin nổi bật hôm nay" daily push at 8 AM
- GR-2.2: Reading streak — consecutive days, display in profile
- GR-2.3: In-app review prompt tuning
- GR-2.4: "Đọc tiếp" section — articles started but not finished
- GR-2.5: Related articles at bottom of article detail

### GR-3: Web PWA & SEO
- GR-3.1: Service worker for offline support
- GR-3.2: Web app manifest with install prompt
- GR-3.3: JSON-LD Article schema
- GR-3.4: Dynamic sitemap + Google News sitemap
- GR-3.5: Newsletter signup

### GR-4: ASO (App Store Optimization)
- GR-4.1: Vietnamese keywords — "đọc tin nhanh", "tin tức AI", "tóm tắt tin tức"
- GR-4.2: Title: "TrendBrief AI - Đọc Tin Nhanh", Subtitle: "Tin tức AI tóm tắt 30 giây"
- GR-4.3: 5 screenshots, optimized description

---

## 5. Phase 2 Features

### P2-1: Monetization
- P2-1.1: AdMob banner ads
- P2-1.2: Premium subscription — ad-free, unlimited AI, exclusive topics
- P2-1.3: Payment integration (Momo, VNPay)

### P2-2: Social Features
- P2-2.1: Article reactions (🔥 😮 😢 😡)
- P2-2.2: Comment section (moderated)
- P2-2.3: Follow topics with custom notification frequency

### P2-3: Advanced AI
- P2-3.1: "Tóm tắt cho tôi" — user pastes any URL, AI summarizes
- P2-3.2: Daily AI briefing — personalized 2-minute audio summary (TTS)
- P2-3.3: ML-based feed personalization (replace topic boost with learned preferences)
