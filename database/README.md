# TrendBrief AI — Database Setup

## Prerequisites

- MongoDB 6.0+ installed and running
- `mongosh` CLI available

## Quick Start

```bash
# 1. Create ALL 19 collections with validation, indexes, and TTL
mongosh trendbriefai database/000_init_all_collections.js

# 2. Seed RSS sources (86+ Vietnamese news sources)
mongosh trendbriefai database/002_seed_rss_sources.js

# 3. Seed topic categories (9 topics)
mongosh trendbriefai database/003_seed_topics.js
```

> **Note:** `000_init_all_collections.js` is the comprehensive script that replaces `001_init_collections.js`. It creates all 19 collections with full JSON Schema validation, indexes, and TTL policies.

## Collections (19 total)

### Core Content

| # | Collection | Purpose | Key Fields |
|---|-----------|---------|------------|
| 1 | `users` | User accounts (email + SSO) | email, password_hash, interests, provider, google_id, apple_id, onboarding_completed, notifications_enabled, notification_prefs, settings, referral_code, referred_by, referral_count, streak_count, last_active_date, premium_until, trial_used, is_banned, is_suspended |
| 2 | `articles` | Crawled & AI-processed articles | url, url_hash, title_original, title_ai, summary_bullets (3), reason, content_clean, topic, source, published_at, embedding (384-dim), cluster_id, processing_status, quality_score, feed_score, image_url, is_sponsored, report_count, ai_provider |
| 3 | `clusters` | Deduplication clusters (embedding centroids) | centroid_embedding, representative_article_id, article_count |
| 4 | `rss_sources` | RSS feed configurations for crawling | name, url, category, source_type, is_active, crawl_interval_minutes, last_crawled_at, health (sub-doc), scrape_link_selector, scrape_content_selector |
| 5 | `topics` | Dynamic topic categories (seeded) | key, label, icon, color, order, is_active |

### User Engagement

| # | Collection | Purpose | Key Fields |
|---|-----------|---------|------------|
| 6 | `bookmarks` | User bookmarks (unique per user+article) | user_id, article_id, created_at |
| 7 | `interactions` | User actions (TTL: 180 days) | user_id, article_id, action (view/click_original/share/bookmark/read), duration_seconds |
| 8 | `reactions` | Emoji reactions on articles | article_id, user_id, type (🔥/😮/😢/😡) |
| 9 | `user_feedbacks` | AI summary quality feedback | article_id, user_id, rating (up/down), reason, ip_hash |
| 10 | `article_reports` | User-submitted content reports | article_id, user_id, reason, status (pending/reviewed/dismissed) |

### Notifications

| # | Collection | Purpose | Key Fields |
|---|-----------|---------|------------|
| 11 | `device_tokens` | FCM push notification tokens | user_id, token, platform (android/ios) |
| 12 | `notification_logs` | Push delivery tracking (TTL: 90 days) | user_id, article_id, type (trending/daily_digest/weekly_digest/topic_update), sent_at, delivered_at, opened_at |

### Monetization

| # | Collection | Purpose | Key Fields |
|---|-----------|---------|------------|
| 13 | `ads` | Native ad placements | title, description, image_url, target_url, advertiser, topic, status, impressions, viewable_impressions, clicks, budget_cents, spent_cents |
| 14 | `affiliate_links` | Affiliate marketing links | title, url, topic, commission, provider, is_active, impressions, clicks, conversions |
| 15 | `payments` | Payment transactions | user_id, order_id, plan, amount, currency, method (momo/vnpay/stripe/apple_iap/google_play), status, provider_transaction_id |
| 16 | `subscriptions` | User subscription state | user_id, plan (free/pro_monthly/pro_yearly), status (active/expired/cancelled/trial), payment_method, starts_at, expires_at, auto_renew |

### Growth & Analytics

| # | Collection | Purpose | Key Fields |
|---|-----------|---------|------------|
| 17 | `referrals` | Referral tracking | referrer_id, referee_id, code, status (pending/activated/rewarded), reward_granted, activated_at |
| 18 | `analytics` | Daily aggregated analytics | date (YYYY-MM-DD), total_views, unique_users, total_clicks, total_shares, total_bookmarks, ad_impressions, ad_clicks, affiliate_impressions, affiliate_clicks |
| 19 | `user_activities` | Daily per-user activity tracking | user_id, date (YYYY-MM-DD), sessions, articles_viewed, first_seen_at, last_seen_at |

## Indexes

### Unique Indexes
- `users.email` — unique
- `users.google_id` — unique, sparse
- `users.apple_id` — unique, sparse
- `users.referral_code` — unique, sparse
- `articles.url` — unique
- `articles.url_hash` — unique (MD5 for O(1) dedup)
- `bookmarks(user_id, article_id)` — unique compound (idempotent toggle)
- `topics.key` — unique
- `device_tokens.token` — unique
- `article_reports(user_id, article_id)` — unique compound (1 report per user per article)
- `reactions(user_id, article_id)` — unique compound (1 reaction per user per article)
- `user_feedbacks(article_id, user_id)` — unique, sparse
- `user_feedbacks(article_id, ip_hash)` — unique, sparse
- `referrals.referee_id` — unique (1 referral per referee)
- `payments.order_id` — unique
- `analytics.date` — unique
- `user_activities(user_id, date)` — unique compound (1 record per user per day)

### Compound Indexes
- `articles(processing_status, topic, feed_score)` — feed query
- `articles(processing_status, feed_score)` — feed query (no topic filter)
- `articles(processing_status, topic, created_at)` — feed query (date sort)
- `articles(processing_status, created_at)` — feed query (date sort, no topic)
- `bookmarks(user_id, created_at)` — user bookmark listing
- `interactions(user_id, created_at)` — user interaction history
- `ads(status, topic)` — active ad lookup by topic
- `affiliate_links(topic, is_active)` — active affiliate lookup by topic
- `payments(user_id, status)` — user payment history
- `subscriptions(user_id, status)` — user subscription lookup
- `notification_logs(user_id, sent_at)` — rate limit queries

### TTL Indexes (Auto-Delete)
- `interactions.created_at` → **180 days** (15,552,000 seconds)
- `notification_logs.sent_at` → **90 days** (7,776,000 seconds)

### Text Indexes (Full-Text Search)
- `articles(title_original, title_ai)` — Vietnamese article search

## Validation

All collections use MongoDB JSON Schema validation (`$jsonSchema`):

- `articles.topic` accepts: `ai`, `finance`, `lifestyle`, `drama`, `technology`, `career`, `health`, `entertainment`, `sport`, `insight`
- `articles.summary_bullets` must be exactly 3 strings when present
- `articles.processing_status` accepts: `pending`, `processing`, `done`, `failed`, `fallback`
- `interactions.action` accepts: `view`, `click_original`, `share`, `bookmark`, `read`
- `users.email` validated with regex pattern
- `users.provider` accepts: `email`, `google`, `apple`
- `topics.color` validated with hex pattern `^#[0-9A-Fa-f]{6}$`
- `analytics.date` validated with pattern `^\d{4}-\d{2}-\d{2}$`
- `reactions.type` accepts: `🔥`, `😮`, `😢`, `😡`
- `payments.method` accepts: `momo`, `vnpay`, `stripe`, `apple_iap`, `google_play`
- `payments.status` accepts: `pending`, `completed`, `failed`, `refunded`
- `subscriptions.plan` accepts: `free`, `pro_monthly`, `pro_yearly`
- `subscriptions.status` accepts: `active`, `expired`, `cancelled`, `trial`

## Docker

If using Docker Compose, the scripts run automatically via the mongo init volume:

```yaml
mongo:
  image: mongo:7
  environment:
    MONGO_INITDB_DATABASE: trendbriefai
  volumes:
    - ./database:/docker-entrypoint-initdb.d
    - mongo_data:/data/db
  ports:
    - "27017:27017"
```

Files in `/docker-entrypoint-initdb.d/` are executed alphabetically on first container start:
1. `000_init_all_collections.js` — Create all 19 collections + indexes + TTL
2. `001_init_collections.js` — (Legacy) Original 6 collections — skipped if 000 runs first
3. `002_seed_rss_sources.js` — Seed 86+ Vietnamese RSS sources
4. `003_seed_topics.js` — Seed 9 topic categories
