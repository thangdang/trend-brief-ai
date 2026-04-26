# TrendBrief AI — Architecture Documentation

> Vietnamese AI-summarized news for Gen Z. Đọc nhanh trong 30–60 giây, giảm overload thông tin.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Application Flow](#2-application-flow)
3. [Setup Guide](#3-setup-guide)
4. [Network Diagram](#4-network-diagram)
5. [Deployment Guide](#5-deployment-guide)
6. [Code Estimate](#6-code-estimate)

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Clients
        WEB["trendbriefai-web<br/>(Angular 21, port 4201)<br/>Public Website"]
        UI["trendbriefai-ui<br/>(Angular 21, port 4200)<br/>Admin Dashboard"]
        MOB["trendbriefai-mobile<br/>(Flutter 3.x)<br/>Android + iOS"]
    end

    subgraph Backend
        SVC["trendbriefai-service<br/>(Express.js + TypeScript, port 3000)<br/>REST API + Auth + Scheduler"]
    end

    subgraph AI Layer
        ENG["trendbriefai-engine<br/>(FastAPI + Python 3.12, port 8000)<br/>AI Pipeline"]
    end

    subgraph Data Layer
        MONGO[("MongoDB 7<br/>port 27017<br/>19 collections")]
        REDIS[("Redis 7<br/>port 6379<br/>BullMQ + node-cron + Cache")]
        MEILI[("Meilisearch v1.7<br/>port 7700<br/>Full-text search")]
    end

    subgraph AI Models
        OLLAMA["Ollama<br/>(LLM — summarization,<br/>translation, classification)"]
        ST["sentence-transformers<br/>(all-MiniLM-L6-v2)"]
        FAISS["FAISS<br/>(vector similarity<br/>dedup index)"]
    end

    subgraph Crawl Stack
        FP["feedparser<br/>(RSS parsing)"]
        NP["newspaper3k + lxml<br/>(article extraction)"]
        BS4["BeautifulSoup4<br/>(HTML cleaning)"]
    end

    subgraph External Services
        GSSO["Google OAuth 2.0"]
        ASSO["Apple Sign In"]
        MOMO["MoMo Payment"]
        VNPAY["VNPay Payment"]
        STRIPE["Stripe Payment"]
        RSS["38+ Vietnamese<br/>RSS Sources"]
    end

    WEB -->|"HTTP /api/public/*"| SVC
    UI -->|"HTTP /api/*<br/>(auth required)"| SVC
    MOB -->|"HTTP /api/*<br/>(auth required)"| SVC

    SVC -->|"Mongoose"| MONGO
    SVC -->|"ioredis + BullMQ"| REDIS
    SVC -->|"HTTP POST /crawl,<br/>/process, /dedup/check,<br/>/personalize, /discover"| ENG

    ENG -->|"ollama SDK"| OLLAMA
    ENG -->|"embedding model"| ST
    ENG -->|"vector search"| FAISS
    ENG -->|"RSS crawl"| FP
    ENG -->|"article scrape"| NP
    ENG -->|"HTML clean"| BS4
    ENG -->|"motor (async)"| MONGO
    ENG -->|"redis-py"| REDIS

    SVC -->|"meilisearch-js"| MEILI

    SVC -.->|"OAuth verify"| GSSO
    SVC -.->|"Token verify"| ASSO
    SVC -.->|"Payment API"| MOMO
    SVC -.->|"Payment API"| VNPAY
    SVC -.->|"Checkout API"| STRIPE

    ENG -->|"crawl entries"| RSS

    style WEB fill:#4FC3F7,stroke:#0288D1,color:#000
    style UI fill:#4FC3F7,stroke:#0288D1,color:#000
    style MOB fill:#81C784,stroke:#388E3C,color:#000
    style SVC fill:#FFB74D,stroke:#F57C00,color:#000
    style ENG fill:#CE93D8,stroke:#7B1FA2,color:#000
    style MONGO fill:#66BB6A,stroke:#2E7D32,color:#000
    style REDIS fill:#EF5350,stroke:#C62828,color:#fff
    style MEILI fill:#FF8A65,stroke:#E64A19,color:#000
    style OLLAMA fill:#FFF176,stroke:#F9A825,color:#000
```


### Component Summary

| Component | Stack | Port | Role |
|-----------|-------|------|------|
| `trendbriefai-service` | Express.js + TypeScript + Mongoose + BullMQ | 3000 | REST API, auth, feed ranking, scheduler, payments |
| `trendbriefai-engine` | Python 3.12 + FastAPI + Ollama + FAISS | 8000 | AI crawl, summarize, classify, dedup, translate, discover |
| `trendbriefai-ui` | Angular 21 + ArchitectUI + Bootstrap 5 | 4200 | Admin dashboard (login required) |
| `trendbriefai-web` | Angular 21 + standalone components | 4201 | Public website (no login required) |
| `trendbriefai-mobile` | Flutter 3.x + Dio + Provider | — | Mobile app (Android + iOS) |
| MongoDB 7 | Document database | 27017 | Articles, users, interactions, payments, subscriptions |
| Redis 7 | Cache + message queue | 6379 | BullMQ job queues, feed cache (5min TTL), rate limiting |
| Meilisearch v1.7 | Full-text search engine | 7700 | Fast article search, typo-tolerant queries |

---

## 2. Application Flow

### 2.1 News Ingestion Pipeline

```mermaid
sequenceDiagram
    participant CRON as node-cron<br/>(every 10 min)
    participant BULL as BullMQ<br/>crawl queue
    participant SVC as trendbriefai-service
    participant ENG as trendbriefai-engine
    participant RSS as RSS Sources<br/>(38+ VN)
    participant OLLAMA as Ollama LLM
    participant FAISS as FAISS Index
    participant DB as MongoDB

    CRON->>BULL: Enqueue scheduled-crawl job
    BULL->>SVC: Worker picks up job
    SVC->>DB: Find active RSS sources
    DB-->>SVC: sources[]

    loop For each active source
        SVC->>ENG: POST /crawl {source_url, source_name, source_type}
        ENG->>RSS: feedparser.parse(url)
        RSS-->>ENG: RSS entries[]

        par Concurrent processing (semaphore-controlled)
            ENG->>ENG: 1. URL hash dedup (O(1) skip)
            ENG->>ENG: 2. Content moderation — source blocklist
            ENG->>ENG: 3. newspaper3k extract + BeautifulSoup clean
            ENG->>ENG: 4. langdetect → language check
            alt Non-Vietnamese content
                ENG->>OLLAMA: Translate to Vietnamese
                OLLAMA-->>ENG: Vietnamese text
            end
            ENG->>ENG: 5. Quality scoring gate (threshold check)
            ENG->>OLLAMA: 6. Summarize (title_ai + 3 bullets + reason)
            OLLAMA-->>ENG: AI summary
            ENG->>ENG: 7. Classify topic (9 categories)
            ENG->>FAISS: 8. 3-layer dedup (URL hash → title sim → embedding cosine)
            FAISS-->>ENG: is_duplicate? cluster_id?
            alt New article
                ENG->>DB: Insert article document
            end
        end

        ENG-->>SVC: {new, duplicate, failed}
        SVC->>DB: Update source.last_crawled_at
    end
```

### 2.2 Personalized Feed

```mermaid
sequenceDiagram
    participant APP as Mobile / Web
    participant SVC as trendbriefai-service
    participant REDIS as Redis Cache
    participant DB as MongoDB

    APP->>SVC: GET /api/feed?topic=ai&page=1&limit=20
    SVC->>REDIS: Check cache key feed:{userId}:{topic}:{page}:{limit}

    alt Cache HIT
        REDIS-->>SVC: Cached feed response
        SVC-->>APP: 200 OK (with ETag)
    else Cache MISS
        SVC->>DB: Find user.interests
        DB-->>SVC: interests[] (e.g. [ai, finance, tech])

        SVC->>DB: Find recent viewed article IDs (limit 500)
        DB-->>SVC: viewedArticleIds Set

        SVC->>DB: Find articles (processing_status=done, limit 200)<br/>with PROJECTION (no content_clean, no embedding)
        DB-->>SVC: candidate articles[]

        SVC->>SVC: Rank in memory:<br/>① Topic boost (+2.0 if matches interests)<br/>② Recency decay (48h window)<br/>③ View penalty (-5.0 if already viewed)<br/>④ Sort by score, then by created_at

        SVC->>DB: Batch bookmark lookup
        DB-->>SVC: bookmarkedIds Set

        SVC->>DB: Fetch active ads + affiliate links
        DB-->>SVC: ads[], affiliateLinks[]

        SVC->>SVC: Build feed items:<br/>• Inject native ad every 5th position<br/>• Attach topic-matched affiliate links (max 2)<br/>• Calculate reading time (15–60s)

        SVC->>REDIS: Cache response (TTL 5 min)
        SVC-->>APP: 200 OK {items[], page, totalPages, hasMore, etag}
    end
```

### 2.3 Article Search

```mermaid
sequenceDiagram
    participant APP as Mobile / Web
    participant SVC as trendbriefai-service
    participant MEILI as Meilisearch
    participant DB as MongoDB

    APP->>SVC: GET /api/search?q=bitcoin&topic=finance&page=1&limit=20
    SVC->>SVC: Validate + sanitize query (Zod)
    SVC->>MEILI: meilisearch-js search<br/>index: "articles", query: "bitcoin"<br/>+ topic filter + pagination
    MEILI-->>SVC: Matched article IDs + relevance scores
    SVC->>DB: Fetch full article documents by IDs
    DB-->>SVC: Article documents
    SVC-->>APP: 200 OK {items[], page, totalPages}
```

### 2.4 User Authentication

```mermaid
sequenceDiagram
    participant APP as Mobile / Web
    participant SVC as trendbriefai-service
    participant GOOGLE as Google OAuth
    participant APPLE as Apple Sign In
    participant DB as MongoDB

    rect rgb(240, 248, 255)
        Note over APP,DB: Email Registration
        APP->>SVC: POST /api/auth/register {email, password}
        SVC->>SVC: bcrypt.hash(password, cost=12)
        SVC->>DB: Create user document
        DB-->>SVC: user
        SVC->>SVC: Sign JWT (access 15m + refresh 7d)
        SVC-->>APP: {accessToken, refreshToken}
    end

    rect rgb(255, 248, 240)
        Note over APP,DB: Google SSO
        APP->>SVC: POST /api/auth/google {idToken}
        SVC->>GOOGLE: GET /tokeninfo?id_token=...
        GOOGLE-->>SVC: {email, name, sub, picture}
        SVC->>DB: findOrCreate user (link google_id)
        SVC->>SVC: Sign JWT tokens
        SVC-->>APP: {accessToken, refreshToken, isNew}
    end

    rect rgb(248, 240, 255)
        Note over APP,DB: Apple SSO
        APP->>SVC: POST /api/auth/apple {idToken}
        SVC->>APPLE: Fetch Apple public keys
        APPLE-->>SVC: JWKS keys
        SVC->>SVC: Verify token signature + issuer
        SVC->>DB: findOrCreate user (link apple_id)
        SVC->>SVC: Sign JWT tokens
        SVC-->>APP: {accessToken, refreshToken, isNew}
    end

    rect rgb(240, 255, 240)
        Note over APP,DB: Token Refresh
        APP->>SVC: POST /api/auth/refresh {refreshToken}
        SVC->>SVC: jwt.verify(refreshToken)
        SVC->>DB: Verify user exists
        SVC->>SVC: Sign new accessToken (15m)
        SVC-->>APP: {accessToken}
    end
```

### 2.5 Payment / Subscription Flow

```mermaid
sequenceDiagram
    participant APP as Mobile / Web
    participant SVC as trendbriefai-service
    participant MOMO as MoMo API
    participant VNPAY as VNPay API
    participant STRIPE as Stripe API
    participant DB as MongoDB

    APP->>SVC: GET /api/payment/plans
    SVC-->>APP: [{id: "pro_monthly", price: 49000, currency: "VND"},<br/>{id: "pro_yearly", price: 399000, currency: "VND"}]

    rect rgb(255, 240, 245)
        Note over APP,MOMO: MoMo Payment
        APP->>SVC: POST /api/payment/momo {plan: "pro_monthly"}
        SVC->>SVC: Generate orderId, HMAC-SHA256 signature
        SVC->>MOMO: POST /create (signed request)
        MOMO-->>SVC: {payUrl}
        SVC->>DB: Create Payment (status: pending)
        SVC-->>APP: {payUrl, orderId}
        APP->>MOMO: Redirect user to payUrl
        MOMO->>SVC: POST /api/payment/webhook/momo (IPN callback)
        SVC->>SVC: Verify resultCode === 0
        SVC->>DB: Update Payment → completed
        SVC->>DB: Create Subscription (active, 30d)
        SVC->>DB: Update User.premium_until
    end

    rect rgb(240, 245, 255)
        Note over APP,VNPAY: VNPay Payment
        APP->>SVC: POST /api/payment/vnpay {plan: "pro_yearly"}
        SVC->>SVC: Generate orderId, HMAC-SHA512 signature
        SVC-->>APP: {payUrl, orderId}
        APP->>VNPAY: Redirect user to payUrl
        VNPAY->>SVC: GET /api/payment/vnpay/return (query params)
        SVC->>SVC: Verify HMAC signature + responseCode
        SVC->>DB: Update Payment → completed
        SVC->>DB: Create Subscription (active, 365d)
    end

    rect rgb(245, 255, 240)
        Note over APP,STRIPE: Stripe Payment (international)
        APP->>SVC: POST /api/payment/stripe {plan: "pro_monthly"}
        SVC->>STRIPE: Create Checkout Session
        STRIPE-->>SVC: {sessionId, url}
        SVC->>DB: Create Payment (status: pending)
        SVC-->>APP: {sessionId, url, orderId}
        APP->>STRIPE: Redirect to Stripe Checkout
        STRIPE->>SVC: POST /api/payment/webhook/stripe (event)
        SVC->>SVC: Verify webhook signature
        SVC->>DB: Update Payment → completed
        SVC->>DB: Create Subscription (active)
    end
```


### 2.6 Push Notification Flow

```mermaid
sequenceDiagram
    participant CRON as node-cron Schedulers
    participant BULL as BullMQ<br/>notifications queue
    participant WORKER as Notification Worker
    participant DB as MongoDB
    participant REDIS as Redis
    participant FCM as Firebase Cloud Messaging
    participant APP as Mobile App

    rect rgb(255, 245, 238)
        Note over CRON,APP: Trending (every 30 min)
        CRON->>BULL: Enqueue trending_check
        BULL->>WORKER: Process job
        WORKER->>DB: Aggregate views in last 1h<br/>(articles with 1000+ views)
        DB-->>WORKER: trending articles[]
        WORKER->>DB: Find users with trending notifs enabled
        loop For each user × article
            WORKER->>REDIS: Check frequency cap + dedup
            REDIS-->>WORKER: allowed?
            alt Allowed
                WORKER->>FCM: sendPush("🔥 Đang hot", title_ai)
                FCM->>APP: Push notification
                WORKER->>DB: Log notification
                WORKER->>REDIS: Mark sent (dedup + cap)
            end
        end
    end

    rect rgb(238, 245, 255)
        Note over CRON,APP: Topic Update (every 2h)
        CRON->>BULL: Enqueue topic_update
        BULL->>WORKER: Process job
        WORKER->>DB: Aggregate topics with 5+ new articles in 2h
        DB-->>WORKER: active topics[]
        loop For each topic
            WORKER->>DB: Find users subscribed to topic
            loop For each user
                WORKER->>REDIS: Check per-topic cap
                alt Allowed
                    WORKER->>FCM: sendPush("📌 N bài mới về {topic}", title)
                    FCM->>APP: Push notification
                end
            end
        end
    end

    rect rgb(245, 255, 238)
        Note over CRON,APP: Daily Digest (8 AM daily)
        CRON->>BULL: Enqueue daily_digest
        BULL->>WORKER: Process job
        WORKER->>DB: Find top article by views in last 24h
        WORKER->>DB: Find users with daily notifs enabled
        WORKER->>FCM: sendPush("📰 Tin nổi bật hôm nay", title)
        FCM->>APP: Push notification
    end

    rect rgb(255, 238, 255)
        Note over CRON,APP: Weekly Digest (Sunday 9 AM)
        CRON->>BULL: Enqueue weekly_digest
        BULL->>WORKER: Process job
        WORKER->>DB: Find top 5 articles by views in last 7d
        WORKER->>DB: Find users with weekly notifs enabled
        WORKER->>FCM: sendPush("📋 Tổng hợp tuần này", top 3 titles)
        FCM->>APP: Push notification
    end
```

### Notification Schedule Summary

| Type | Schedule | Trigger Condition | Content |
|------|----------|-------------------|---------|
| `trending` | Every 30 min | Article with 1000+ views in 1h | "🔥 Đang hot" + title |
| `topic_update` | Every 2h | 5+ new articles in subscribed topic | "📌 N bài mới về {topic}" |
| `daily_digest` | 8 AM daily | Top article by views in 24h | "📰 Tin nổi bật hôm nay" |
| `weekly_digest` | Sunday 9 AM | Top 5 articles by views in 7d | "📋 Tổng hợp tuần này" |

---

## 3. Setup Guide

### 3.1 Prerequisites

- Docker + Docker Compose
- Node.js 20+ (for local dev)
- Python 3.12+ (for local dev)
- Flutter 3.x (for mobile dev)
- Ollama installed with a model (e.g. `ollama pull llama3.2`)

### 3.2 Docker Setup (Recommended)

7 containers orchestrated via `docker-compose.yml`:

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your secrets (JWT, OAuth, payment keys)

# 2. Start all services
docker compose up -d

# 3. Verify health
docker compose ps
curl http://localhost:3000/health   # → {"status":"ok"}
curl http://localhost:8000/health   # → {"status":"ok","models":{...}}
```

| Container | Image | Port | Healthcheck |
|-----------|-------|------|-------------|
| `trendbriefai-mongo` | mongo:7 | 27017 | `mongosh --eval "db.adminCommand('ping')"` |
| `trendbriefai-redis` | redis:7-alpine | 6379 | `redis-cli ping` |
| `trendbriefai-engine` | ./trendbriefai-engine | 8000 | `urllib.request.urlopen('http://localhost:8000/health')` |
| `trendbriefai-service` | ./trendbriefai-service | 3000 | `wget --spider http://localhost:3000/health` |
| `trendbriefai-ui` | ./trendbriefai-ui | 4200 | nginx serves static |
| `trendbriefai-web` | ./trendbriefai-web | 4201 | nginx serves static |
| `trendbriefai-meili` | getmeili/meilisearch:v1.7 | 7700 | `wget --spider http://localhost:7700/health` |

### 3.3 Manual Setup

```bash
# 1. Start MongoDB + Redis
docker run -d --name trendbriefai-mongo -p 27017:27017 mongo:7
docker run -d --name trendbriefai-redis -p 6379:6379 redis:7-alpine

# 2. Seed database
mongosh mongodb://localhost:27017/trendbriefai < database/001_init_collections.js
mongosh mongodb://localhost:27017/trendbriefai < database/002_seed_rss_sources.js
mongosh mongodb://localhost:27017/trendbriefai < database/003_seed_topics.js

# 3. Start AI Engine
cd trendbriefai-engine
pip install -r requirements.txt
uvicorn api:app --host 0.0.0.0 --port 8000

# 4. Start Backend
cd trendbriefai-service
npm install
npm run dev

# 5. Start Admin UI
cd trendbriefai-ui
npm install && ng serve --port 4200

# 6. Start Public Website
cd trendbriefai-web
npm install && ng serve --port 4201

# 7. Start Mobile
cd trendbriefai-mobile
flutter pub get && flutter run
```

### 3.4 Seed Data

The `database/` folder contains initialization scripts that run automatically on first Docker start:

| Script | Purpose |
|--------|---------|
| `001_init_collections.js` | Create collections + indexes (text, compound, TTL) |
| `002_seed_rss_sources.js` | Seed 38+ Vietnamese RSS sources |
| `003_seed_topics.js` | Seed 9 topic categories |

---

## 4. Network Diagram

```mermaid
graph TB
    subgraph "Docker Network: trendbriefai (bridge)"
        subgraph "Data Tier"
            MONGO["trendbriefai-mongo<br/>mongo:7<br/>:27017<br/>✅ healthcheck: mongosh ping<br/>📦 volume: mongo-data"]
            REDIS["trendbriefai-redis<br/>redis:7-alpine<br/>:6379<br/>✅ healthcheck: redis-cli ping"]
            MEILI["trendbriefai-meili<br/>meilisearch:v1.7<br/>:7700<br/>✅ healthcheck: wget /health<br/>📦 volume: meili-data"]
        end

        subgraph "AI Tier"
            ENGINE["trendbriefai-engine<br/>FastAPI + Python 3.12<br/>:8000<br/>✅ healthcheck: /health<br/>⏱ interval: 15s, retries: 5<br/>🔗 depends: mongo ✅, redis ✅"]
        end

        subgraph "API Tier"
            SERVICE["trendbriefai-service<br/>Express.js + TypeScript<br/>:3000<br/>✅ healthcheck: wget /health<br/>⏱ interval: 15s, retries: 5<br/>🔗 depends: mongo ✅, redis ✅, engine ✅"]
        end

        subgraph "Frontend Tier"
            UI["trendbriefai-ui<br/>Angular 21 (nginx)<br/>:4200 → :80<br/>🔗 depends: service ✅"]
            WEB["trendbriefai-web<br/>Angular 21 (nginx)<br/>:4201 → :80<br/>🔗 depends: service ✅"]
        end
    end

    subgraph "Host Machine"
        OLLAMA["Ollama LLM<br/>host.docker.internal:11434"]
    end

    ENGINE -->|"MONGODB_URI"| MONGO
    ENGINE -->|"REDIS_URL"| REDIS
    ENGINE -->|"OLLAMA_URL"| OLLAMA
    SERVICE -->|"MONGODB_URI"| MONGO
    SERVICE -->|"REDIS_URL"| REDIS
    SERVICE -->|"AI_SERVICE_URL"| ENGINE
    SERVICE -->|"meilisearch-js"| MEILI
    UI -->|"API_URL"| SERVICE
    WEB -->|"proxy"| SERVICE

    style MONGO fill:#66BB6A,stroke:#2E7D32,color:#000
    style REDIS fill:#EF5350,stroke:#C62828,color:#fff
    style MEILI fill:#FF8A65,stroke:#E64A19,color:#000
    style ENGINE fill:#CE93D8,stroke:#7B1FA2,color:#000
    style SERVICE fill:#FFB74D,stroke:#F57C00,color:#000
    style UI fill:#4FC3F7,stroke:#0288D1,color:#000
    style WEB fill:#4FC3F7,stroke:#0288D1,color:#000
    style OLLAMA fill:#FFF176,stroke:#F9A825,color:#000
```

### Dependency Chain

```
mongo (healthy) ──┐
                  ├──→ trendbriefai-engine (healthy) ──→ trendbriefai-service (healthy) ──┬──→ trendbriefai-ui
redis (healthy) ──┘                                                                       └──→ trendbriefai-web
meilisearch (healthy) ──→ trendbriefai-service
```

All containers use `restart: unless-stopped` and health-dependent startup ordering.

---

## 5. Deployment Guide

### 5.1 Development (Docker Compose)

```bash
docker compose up -d
# All 7 containers (service, engine, web, ui, MongoDB, Redis, Meilisearch) on localhost
# Ollama runs on host machine (host.docker.internal:11434)
```

### 5.2 Production (VPS — ~$24/month)

Recommended: 4 vCPU, 8 GB RAM VPS (Vultr/DigitalOcean/Hetzner).

```mermaid
graph LR
    subgraph "VPS ($24/mo)"
        NGINX["Nginx Reverse Proxy<br/>:80 / :443 (SSL)"]
        SVC["trendbriefai-service<br/>:3000"]
        MONGO["MongoDB 7<br/>:27017"]
        REDIS["Redis 7<br/>:6379"]
        UI["trendbriefai-ui<br/>:4200"]
        WEB["trendbriefai-web<br/>:4201"]
    end

    subgraph "Local PC (GPU optional)"
        ENG["trendbriefai-engine<br/>:8000"]
        OLLAMA["Ollama LLM"]
    end

    INTERNET["Internet"] --> NGINX
    NGINX --> SVC
    NGINX --> UI
    NGINX --> WEB
    SVC -->|"WireGuard VPN"| ENG
    ENG --> OLLAMA

    style NGINX fill:#90A4AE,stroke:#546E7A,color:#000
```

Production checklist:
- Set `NODE_ENV=production` and strong `JWT_SECRET`
- Enable SSL via Let's Encrypt + Nginx
- Configure firewall (only 80/443 open)
- Set up MongoDB authentication
- Use PM2 or systemd for process management
- Configure log rotation

### 5.3 Hybrid Deployment (AI on Local PC)

The AI engine is the most resource-intensive component (Ollama LLM + sentence-transformers + FAISS). Run it on a local PC with GPU while keeping lightweight services on VPS.

Connection: WireGuard VPN tunnel between VPS and local PC.

```bash
# On VPS: point AI_SERVICE_URL to local PC via VPN
AI_SERVICE_URL=http://10.0.0.2:8000  # WireGuard IP of local PC

# On Local PC: run AI engine
cd trendbriefai-engine
OLLAMA_URL=http://localhost:11434 uvicorn api:app --host 0.0.0.0 --port 8000
```

Cost breakdown:
| Component | Location | Cost |
|-----------|----------|------|
| VPS (4 vCPU, 8 GB) | Cloud | ~$24/mo |
| AI Engine + Ollama | Local PC | $0 (electricity only) |
| Domain + SSL | Cloudflare | Free |
| MongoDB Atlas (optional) | Cloud | Free tier / $9/mo |

### 5.4 Mobile Deployment

```bash
# Android
cd trendbriefai-mobile
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk

# iOS
flutter build ios --release
# Then archive via Xcode → App Store Connect

# Update API base URL for production
# lib/config/api_config.dart → https://api.trendbriefai.com
```

---

## 6. Code Estimate

### trendbriefai-service (Express.js + TypeScript)

| Category | Count | Files |
|----------|-------|-------|
| Routes | 20 | auth, feed, bookmark, interaction, topic, user, search, trending, ad, affiliate, analytics, notification, public, source, admin, article, referral, reaction, payment, image |
| Models | 19 | User, Article, Bookmark, Interaction, Topic, RssSource, Ad, AffiliateLink, Analytics, Cluster, DeviceToken, NotificationLog, Payment, Reaction, Referral, Subscription, ArticleReport, UserActivity, SummaryFeedback |
| Services | 20 | auth, sso, feed, bookmark, interaction, search, trending, ad, affiliate, affiliateSearch, analytics, notification, payment, referral, readingHistory, related, topic, userActivity, userStats, meiliSearch |
| Workers | 2 | crawl.worker, notification.scheduler |
| Middleware | 3 | auth, rateLimit, validate |
| Config | 2 | index, swagger |
| Types | 2 | api.types, schemas |
| DB | 1 | connection |
| Entry | 1 | index.ts |
| **Total** | **68 files** | ~**6,800 lines** |

### trendbriefai-engine (Python 3.12 + FastAPI)

| Category | Count | Files |
|----------|-------|-------|
| API | 1 | api.py (endpoints: /health, /crawl, /process, /dedup/check, /translate, /discover, /summarize-url, /briefing, /personalize) |
| Pipeline | 1 | pipeline.py |
| Services | 10 | crawler, scraper, cleaner, summarizer, classifier, translator, discovery, quality_scorer, content_moderator, __init__ |
| Dedup | 6 | core, embedding, faiss_index, similarity, utils, __init__ |
| Cache | 3 | redis_cache, summarizer_cache, __init__ |
| Models | 3 | article, source, __init__ |
| Config | 1 | config.py |
| DB | 2 | connection, __init__ |
| Tests | 11 | test_classifier, test_cleaner, test_crawler, test_embedding, test_faiss, test_pipeline, test_quality_scorer, test_redis_cache, test_summarizer_cache, test_summarizer, __init__ |
| **Total** | **38 files** | ~**3,800 lines** |

### trendbriefai-ui (Angular 21 — Admin Dashboard)

| Category | Count | Files |
|----------|-------|-------|
| Pages | 13 | feed, bookmarks, login, register, profile, admin/sources, admin/analytics, admin/ads, admin/affiliates, admin/users, admin/notifications, admin/moderation |
| Layout | 3 | layout, header, sidebar |
| Services | 2 | api, auth |
| Guards | 1 | auth.guard |
| Interceptors | 1 | auth.interceptor |
| Types | 1 | api.types |
| Config | 4 | app.component, app.config, app.routes, environments (×2) |
| **Total** | **~25 files** | ~**3,000 lines** |

### trendbriefai-web (Angular 21 — Public Website)

| Category | Count | Files |
|----------|-------|-------|
| Pages | 8 | feed, article, search, login, payment, privacy, terms, referral |
| Layout | 1 | layout (header + footer) |
| Components | 1 | newsletter |
| Services | 4 | api, auth, analytics, seo |
| Config | 4 | app.component, app.config, app.routes, environments (×2) |
| Assets | 3 | styles.css, design-system.css, sw.js |
| **Total** | **~21 files** | ~**2,500 lines** |

### trendbriefai-mobile (Flutter 3.x)

| Category | Count | Files |
|----------|-------|-------|
| Screens | 11 | home, feed, article_detail, search, bookmarks, login, register, onboarding, profile, premium, reading_history |
| Services | 9 | api, auth, notification, analytics, cache, share, admob, crash_reporting, review_prompt |
| Models | 5 | feed_item, user_profile, auth_tokens, topic_model, user_stats |
| Widgets | 8 | feed_card, enhanced_feed_card, skeleton_card, skeleton_detail_view, topic_chips, dynamic_topic_chips, trending_carousel, error_state_view |
| Providers | 2 | onboarding, theme |
| Config | 3 | api_config, app_theme, firebase_options |
| Utils | 2 | time_formatter, validators |
| Entry | 1 | main.dart |
| **Total** | **~41 files** | ~**5,200 lines** |

### Grand Total

| Module | Files | Est. Lines |
|--------|-------|------------|
| trendbriefai-service | 68 | ~6,800 |
| trendbriefai-engine | 38 | ~3,800 |
| trendbriefai-ui | 25 | ~3,000 |
| trendbriefai-web | 21 | ~2,500 |
| trendbriefai-mobile | 41 | ~5,200 |
| database (seeds) | 4 | ~400 |
| docker + config | 5 | ~200 |
| **Total** | **~202 files** | **~22,700 lines** |
