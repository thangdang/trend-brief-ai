# TrendBrief AI — Database Setup

## Prerequisites

- MongoDB 6.0+ installed and running
- `mongosh` CLI available

## Quick Start

```bash
# 1. Create collections with validation and indexes
mongosh trendbriefai database/001_init_collections.js

# 2. Seed RSS sources (38 Vietnamese news sources)
mongosh trendbriefai database/002_seed_rss_sources.js

# 3. Seed topic categories (9 topics)
mongosh trendbriefai database/003_seed_topics.js
```

## Collections

| Collection     | Description                                  |
| -------------- | -------------------------------------------- |
| users          | User accounts with email, interests          |
| articles       | Crawled & AI-processed articles              |
| clusters       | Deduplication clusters (embedding centroids) |
| bookmarks      | User bookmarks (unique per user+article)     |
| interactions   | User actions: view, click, share, bookmark   |
| rss_sources    | RSS feed configurations for crawling         |
| device_tokens  | Push notification device tokens (FCM)        |
| notification_logs | Notification delivery history             |
| topics         | Dynamic topic categories (seeded)            |

## Indexes

- `users.email` — unique
- `articles.url` — unique
- `articles.url_hash` — unique (MD5 for O(1) dedup)
- `articles.topic`, `articles.source`, `articles.processing_status` — filter queries
- `articles.created_at` — descending sort for feed
- `bookmarks(user_id, article_id)` — unique compound (idempotent bookmarks)
- `bookmarks(user_id, created_at)` — user bookmark listing
- `interactions(user_id, created_at)` — user interaction history
- `interactions(article_id)` — article interaction lookup

## Validation

All collections use JSON Schema validation:

- `articles.topic` only accepts: `ai`, `finance`, `lifestyle`, `drama`, `technology`, `career`, `health`, `entertainment`, `sport`, `insight`
- `articles.summary_bullets` must be exactly 3 strings
- `articles.processing_status` only accepts: `pending`, `processing`, `done`, `failed`, `fallback`
- `interactions.action` only accepts: `view`, `click_original`, `share`, `bookmark`
- `users.email` validated with regex pattern

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

Files in `/docker-entrypoint-initdb.d/` are executed alphabetically on first container start.
