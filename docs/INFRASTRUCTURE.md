# TrendBrief AI — Infrastructure & Deployment Guide

> Complete infrastructure reference for TrendBrief AI — Vietnamese AI-summarized news platform.
> Last updated: 2025

---

## Table of Contents

1. [Architecture Diagram](#1-architecture-diagram)
2. [Service Details](#2-service-details)
3. [Network Deployment Options](#3-network-deployment-options)
4. [Data Flow Diagram](#4-data-flow-diagram)
5. [Setup Guide](#5-setup-guide)
6. [Deployment Guide](#6-deployment-guide)
7. [Cost Estimation](#7-cost-estimation)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [Monitoring & Health Checks](#9-monitoring--health-checks)
10. [Backup & Recovery](#10-backup--recovery)

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                            │
│                                                                                 │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐      │
│   │  trendbriefai-web │  │  trendbriefai-ui  │  │  trendbriefai-mobile     │      │
│   │  (Angular 21)     │  │  (Angular 21)     │  │  (Flutter 3.x)           │      │
│   │  Public Website   │  │  Admin Dashboard  │  │  Android / iOS App       │      │
│   │  Port: 4201→80    │  │  Port: 4200→80    │  │  Built locally           │      │
│   │  nginx reverse    │  │  nginx reverse    │  │  Dio HTTP client         │      │
│   │  proxy            │  │  proxy            │  │                          │      │
│   └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘      │
│            │ /api/*               │ /api/*                  │ REST API            │
│            └──────────┬───────────┘                         │                    │
│                       ▼                                     ▼                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                        │                                     │
                        ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND LAYER                                          │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────┐       │
│   │                    trendbriefai-service                              │       │
│   │                    (Express.js + TypeScript)                         │       │
│   │                    Port: 3000                                        │       │
│   │                                                                     │       │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐ │       │
│   │  │ Auth API │ │ Feed API │ │ Search   │ │ Bookmarks │ │ Trending│ │       │
│   │  │ JWT+Bcrypt│ │ Personal │ │ MongoDB  │ │ Idempotent│ │ Hot 24h │ │       │
│   │  └──────────┘ └──────────┘ │ TextSearch│ └───────────┘ └─────────┘ │       │
│   │  ┌──────────┐ ┌──────────┐ └──────────┘ ┌───────────┐ ┌─────────┐ │       │
│   │  │ Scheduler│ │ BullMQ   │              │ Analytics │ │ Ads/Aff │ │       │
│   │  │ node-cron│ │ Job Queue│              │ DAU/MAU   │ │ Tracking│ │       │
│   │  └──────────┘ └──────────┘              └───────────┘ └─────────┘ │       │
│   └──────────┬──────────────────────────┬───────────────────────────────┘       │
│              │                          │                                       │
│              ▼                          ▼                                       │
│   ┌──────────────────┐       ┌──────────────────┐                              │
│   │     MongoDB 7     │       │    Redis 7        │                              │
│   │   Port: 27017     │       │   Port: 6379      │                              │
│   │                   │       │                   │                              │
│   │ • users           │       │ • BullMQ queues   │                              │
│   │ • articles        │       │ • Rate limiting   │                              │
│   │ • bookmarks       │       │ • Session cache   │                              │
│   │ • interactions    │       │ • Crawl locks     │                              │
│   │ • rss_sources     │       │                   │                              │
│   │ • clusters        │       └───────────────────┘                              │
│   │ • topics          │                                                          │
│   │ • device_tokens   │       ┌───────────────────┐                              │
│   │ • notification_   │       │  Meilisearch v1.7  │                              │
│   │   logs            │       │   Port: 7700       │                              │
│   │ • ads             │       │                   │                              │
│   │ • affiliate_links │       │ • Full-text search │                              │
│   │ • analytics       │       │ • Typo-tolerant   │                              │
│   │ • payments        │       │ • Article indexing │                              │
│   │ • subscriptions   │       │                   │                              │
│   │ • reactions       │       └───────────────────┘                              │
│   │ • referrals       │                                                          │
│   │ • article_reports │                                                          │
│   │ • user_activities │                                                          │
│   │ • summary_feedback│                                                          │
│   │ (19 collections)  │                                                          │
│   └──────────────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                        │
                        │ HTTP (AI_SERVICE_URL)
                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AI LAYER                                             │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────┐       │
│   │                    trendbriefai-engine                               │       │
│   │                    (Python 3.12 + FastAPI)                           │       │
│   │                    Port: 8000                                        │       │
│   │                                                                     │       │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐ │       │
│   │  │ RSS Crawl│ │ HTML     │ │ Clean &  │ │ Summarize │ │ Classify│ │       │
│   │  │feedparser│ │ Scrape   │ │ Extract  │ │ Ollama LLM│ │ Topic   │ │       │
│   │  └──────────┘ │newspaper │ │ lxml/bs4 │ └───────────┘ │ Ollama  │ │       │
│   │               │ 3k       │ └──────────┘               └─────────┘ │       │
│   │  ┌──────────┐ └──────────┘ ┌──────────┐ ┌───────────┐ ┌─────────┐ │       │
│   │  │ Embedding│              │ 3-Layer  │ │ Translate │ │ Quality │ │       │
│   │  │ sentence │              │ Dedup    │ │ langdetect│ │ Score   │ │       │
│   │  │-transform│              │URL+Title │ │ + Ollama  │ │         │ │       │
│   │  │ ers      │              │+Embedding│ └───────────┘ └─────────┘ │       │
│   │  └──────────┘              └──────────┘                           │       │
│   └──────────────────────────────────┬────────────────────────────────┘       │
│                                      │                                        │
│                                      │ HTTP (OLLAMA_URL)                      │
│                                      ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐     │
│   │                    Ollama (Host Machine)                             │     │
│   │                    Port: 11434                                       │     │
│   │                    NOT in Docker — runs on host                      │     │
│   │                                                                     │     │
│   │  Models: gemma2:9b / llama3.1:8b / mistral:7b (configurable)       │     │
│   │  GPU: NVIDIA recommended (CPU fallback available)                   │     │
│   │  VRAM: 6–10 GB depending on model                                  │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Connection Summary

```
trendbriefai-web  ──nginx /api/──→  trendbriefai-service:3000
trendbriefai-ui   ──nginx /api/──→  trendbriefai-service:3000 (via backend:3000)
trendbriefai-mobile ──Dio HTTP──→   trendbriefai-service:3000
trendbriefai-service ──mongoose──→  MongoDB:27017
trendbriefai-service ──ioredis───→  Redis:6379
trendbriefai-service ──meilisearch-js→ Meilisearch:7700
trendbriefai-service ──axios─────→  trendbriefai-engine:8000
trendbriefai-engine  ──motor─────→  MongoDB:27017
trendbriefai-engine  ──redis─────→  Redis:6379
trendbriefai-engine  ──ollama────→  Ollama:11434 (host.docker.internal)
```

---

## 2. Service Details


| Service | Tech Stack | Port (Host→Container) | Dockerfile Base Image | Resource Needs | Health Check |
|---------|-----------|----------------------|----------------------|----------------|-------------|
| **trendbriefai-engine** | Python 3.12, FastAPI, Ollama SDK, sentence-transformers, feedparser, newspaper3k, langdetect, lxml, faiss-cpu | 8000:8000 | `python:3.12-slim` | CPU: 2 cores, RAM: 2–4 GB (sentence-transformers model loaded in memory) | `GET /health` — Python urllib check |
| **trendbriefai-service** | Node.js 22, Express.js, TypeScript, Mongoose, BullMQ, ioredis, JWT, Zod, node-cron | 3000:3000 | `node:22-alpine` (multi-stage build) | CPU: 1 core, RAM: 512 MB–1 GB | `GET /health` — wget spider check |
| **trendbriefai-web** | Angular 21, standalone components, nginx | 4201:80 | Build: `node:20-alpine`, Run: `nginx:alpine` | CPU: 0.25 core, RAM: 128 MB (static files only) | nginx default (port 80 open) |
| **trendbriefai-ui** | Angular 21, ArchitectUI, Bootstrap 5, nginx | 4200:80 | Build: `node:22-slim`, Run: `nginx:alpine` | CPU: 0.25 core, RAM: 128 MB (static files only) | nginx default (port 80 open) |
| **trendbriefai-mobile** | Flutter 3.x, Dio, Provider, firebase_messaging, hive | N/A (built locally) | N/A (no Dockerfile) | Local dev machine | N/A |
| **MongoDB** | MongoDB 7 | 27017:27017 | `mongo:7` | CPU: 1 core, RAM: 1–2 GB, Disk: 10+ GB | `mongosh db.adminCommand('ping')` |
| **Redis** | Redis 7 Alpine | 6379:6379 | `redis:7-alpine` | CPU: 0.5 core, RAM: 256 MB | `redis-cli ping` |
| **Ollama** | Ollama (host-native) | 11434 (host only) | N/A (not containerized) | GPU: 6–10 GB VRAM (or CPU: 8+ GB RAM) | `curl http://localhost:11434/api/tags` |
| **Meilisearch** | Meilisearch v1.7 | 7700:7700 | `getmeili/meilisearch:v1.7` | CPU: 0.5 core, RAM: 256 MB–1 GB | `wget --spider http://localhost:7700/health` |

### Dockerfile Build Details

**trendbriefai-engine** — Single-stage build:
- Installs system deps: `build-essential`, `libxml2-dev`, `libxslt1-dev` (for newspaper3k/lxml)
- Installs Python deps from `requirements.txt` (18 packages + dev deps)
- Runs: `uvicorn api:app --host 0.0.0.0 --port 8000`

**trendbriefai-service** — Multi-stage build:
- Stage 1 (`builder`): `node:22-alpine`, `npm ci`, `tsc` compile TypeScript
- Stage 2 (`runtime`): `node:22-alpine`, `npm ci --omit=dev`, copies `dist/`
- Runs: `node dist/index.js`

**trendbriefai-web** — Multi-stage build:
- Stage 1 (`build`): `node:20-alpine`, `npm ci`, `npm run build`
- Stage 2 (`runtime`): `nginx:alpine`, copies `dist/trendbriefai-web/browser/`
- Custom `nginx.conf` with API proxy, SPA fallback, gzip, security headers, asset caching

**trendbriefai-ui** — Multi-stage build:
- Stage 1 (`build`): `node:22-slim`, `npm ci`, `npx ng build --configuration production`
- Stage 2 (`runtime`): `nginx:alpine`, copies `dist/trend-brief-web-ui/browser/`
- Custom `nginx.conf` with API proxy to `backend:3000`, SPA fallback, gzip, security headers

---

## 3. Network Deployment Options

### Option A: All Local (Development)

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL MACHINE (16+ GB RAM)                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Docker Compose Network                      │   │
│  │              (trendbriefai bridge)                        │   │
│  │                                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  MongoDB  │ │  Redis   │ │  Engine  │ │ Service  │   │   │
│  │  │  :27017   │ │  :6379   │ │  :8000   │ │  :3000   │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  │                                                          │   │
│  │  ┌──────────────────┐  ┌──────────────────┐             │   │
│  │  │  trendbriefai-web │  │  trendbriefai-ui  │             │   │
│  │  │  :4201 → :80      │  │  :4200 → :80      │             │   │
│  │  └──────────────────┘  └──────────────────┘             │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Meilisearch  :7700  (full-text search)           │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Ollama (host-native, not in Docker)                     │   │
│  │  http://localhost:11434                                   │   │
│  │  Engine connects via: host.docker.internal:11434          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Access:                                                        │
│    Web:     http://localhost:4201                                │
│    Admin:   http://localhost:4200                                │
│    API:     http://localhost:3000                                │
│    Engine:  http://localhost:8000                                │
│    Swagger: http://localhost:3000/api-docs                      │
└─────────────────────────────────────────────────────────────────┘
```

### Option B: Hybrid (AI on Local PC, Services on VPS)

Best for: GPU-dependent AI on your local machine, web services on cheap VPS.

```
┌──────────────────────────────────┐         ┌──────────────────────────────────┐
│        LOCAL PC (GPU Machine)     │         │     DIGITALOCEAN VPS ($24/mo)    │
│        (Your home/office)         │         │     (4 vCPU, 8 GB RAM)           │
│                                   │         │                                   │
│  ┌─────────────────────────────┐ │         │  ┌─────────────────────────────┐ │
│  │  Ollama                      │ │         │  │  Docker Compose              │ │
│  │  http://localhost:11434      │ │         │  │                              │ │
│  │  Model: gemma2:9b            │ │         │  │  ┌────────┐  ┌────────┐    │ │
│  │  GPU: NVIDIA 8+ GB VRAM     │ │         │  │  │MongoDB │  │ Redis  │    │ │
│  └─────────────────────────────┘ │         │  │  │ :27017 │  │ :6379  │    │ │
│                                   │         │  │  └────────┘  └────────┘    │ │
│  ┌─────────────────────────────┐ │         │  │                              │ │
│  │  trendbriefai-engine         │ │  ◄═══════►│  ┌────────────────────────┐ │ │
│  │  http://localhost:8000       │ │ Cloudflare│  │  trendbriefai-service   │ │ │
│  │  Connects to Ollama locally  │ │  Tunnel   │  │  :3000                  │ │ │
│  │  Connects to VPS MongoDB     │ │   or      │  └────────────────────────┘ │ │
│  └─────────────────────────────┘ │ WireGuard │  │                              │ │
│                                   │  VPN      │  │  ┌──────────┐ ┌─────────┐│ │
│                                   │         │  │  │  Web      │ │  UI     ││ │
│                                   │         │  │  │  :80/443  │ │  :4200  ││ │
│                                   │         │  │  └──────────┘ └─────────┘│ │
│                                   │         │  └─────────────────────────────┘ │
│                                   │         │                                   │
│                                   │         │  ┌─────────────────────────────┐ │
│                                   │         │  │  Cloudflare (DNS + SSL)      │ │
│                                   │         │  │  trendbriefai.com → VPS:80   │ │
│                                   │         │  │  admin.trendbriefai.com      │ │
│                                   │         │  │  → VPS:4200                  │ │
│                                   │         │  │  api.trendbriefai.com        │ │
│                                   │         │  │  → VPS:3000                  │ │
│                                   │         │  └─────────────────────────────┘ │
└──────────────────────────────────┘         └──────────────────────────────────┘

Connection between Local PC ↔ VPS:
  Option 1: Cloudflare Tunnel (cloudflared) — free, no port forwarding needed
  Option 2: WireGuard VPN — private network, low latency
  
  VPS trendbriefai-service calls Local engine via tunnel:
    AI_SERVICE_URL=http://<tunnel-hostname>:8000
  
  Local engine connects to VPS MongoDB via tunnel:
    MONGODB_URI=mongodb://<tunnel-hostname>:27017/trendbriefai
```

### Option C: All VPS (Production)

Best for: No local GPU needed, uses smaller Ollama models or CPU inference.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DIGITALOCEAN VPS ($48–96/mo)                              │
│                    (8 vCPU, 16–32 GB RAM, 160+ GB SSD)                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    Docker Compose                                      │ │
│  │                                                                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐    │ │
│  │  │ MongoDB  │ │  Redis   │ │  Engine      │ │  Service          │    │ │
│  │  │  :27017  │ │  :6379   │ │  :8000       │ │  :3000            │    │ │
│  │  └──────────┘ └──────────┘ └──────────────┘ └──────────────────┘    │ │
│  │                                                                       │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │ │
│  │  │  trendbriefai-web │  │  trendbriefai-ui  │  │  Meilisearch     │   │ │
│  │  │  :80 (public)     │  │  :4200 (admin)    │  │  :7700 (search)  │   │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Ollama (installed on VPS, CPU inference)                              │ │
│  │  http://localhost:11434                                                │ │
│  │  Model: gemma2:2b or phi3:mini (smaller for CPU)                      │ │
│  │  RAM: 8–16 GB for inference                                           │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Cloudflare (DNS + SSL + CDN)                                         │ │
│  │  trendbriefai.com → :80    (Web)                                      │ │
│  │  admin.trendbriefai.com → :4200  (Admin UI)                           │ │
│  │  api.trendbriefai.com → :3000    (Backend API)                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  UFW Firewall:                                                              │
│    Allow: 22 (SSH), 80 (HTTP), 443 (HTTPS)                                 │
│    Deny: 27017, 6379, 8000, 4200 from public                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow Diagram

### Article Processing Pipeline

```
┌─────────────┐
│ RSS Sources  │  38+ Vietnamese news sources (VnExpress, Tuổi Trẻ, CafeF, Kenh14...)
│ (rss_sources │  Source types: RSS feeds + HTML scrape configs
│  collection) │  Crawl intervals: 10–60 minutes per source
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    trendbriefai-engine (FastAPI)                          │
│                                                                          │
│  Step 1: CRAWL                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  feedparser (RSS) / newspaper3k + BeautifulSoup4 (HTML scrape)  │    │
│  │  → Fetch articles from all active sources                        │    │
│  │  → Extract: url, title, content, published_at, source            │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 2: DEDUP (Layer 1 — URL Hash)                                      │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  MD5(url) → check articles.url_hash index                       │    │
│  │  If exists → SKIP (O(1) lookup)                                  │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 3: CLEAN & EXTRACT                                                 │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  newspaper3k + lxml + BeautifulSoup4                             │    │
│  │  → Remove ads, navigation, scripts                               │    │
│  │  → Extract clean article text → content_clean                    │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 4: CONTENT MODERATION                                              │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  Check source blocklist + content policy filters                 │    │
│  │  Flagged content → status: 'moderated', skip further processing  │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 5: QUALITY SCORE                                                   │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  Check: word count > threshold, has meaningful content           │    │
│  │  Low quality → status: 'failed', skip further processing         │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 6: LANGUAGE DETECT + TRANSLATE                                     │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  langdetect → check if Vietnamese                                │    │
│  │  If non-Vietnamese → Ollama translate to Vietnamese               │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 7: SUMMARIZE (Ollama LLM)                                         │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  Ollama API → Generate:                                          │    │
│  │    • title_ai: AI-rewritten title (≤12 Vietnamese words)         │    │
│  │    • summary_bullets: exactly 3 bullet points                    │    │
│  │    • reason: "why you should care" sentence                      │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 8: SUMMARY VALIDATION                                              │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  Validate summary structure: exactly 3 bullets, title ≤12 words  │    │
│  │  Check for hallucination / empty fields                          │    │
│  │  Invalid → retry or status: 'failed'                             │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 9: SENTIMENT ANALYSIS                                              │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  Analyze article sentiment (positive / neutral / negative)       │    │
│  │  Store sentiment score for feed ranking and analytics            │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 10: CLASSIFY (Ollama LLM)                                         │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  Ollama API → Classify into topic:                               │    │
│  │  ai | finance | lifestyle | drama | technology | career |        │    │
│  │  health | entertainment | sport                                  │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 11: EMBEDDING                                                      │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  sentence-transformers (all-MiniLM-L6-v2)                        │    │
│  │  → 384-dimensional float vector                                  │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 12: DEDUP (Layer 2 — Title Similarity)                             │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  Compare title against recent articles                           │    │
│  │  If similarity > threshold → mark as duplicate                   │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 13: DEDUP (Layer 3 — Embedding Cosine)                             │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  faiss-cpu → cosine similarity against cluster centroids         │    │
│  │  If cosine > threshold → assign to existing cluster              │    │
│  │  Else → create new cluster, set as representative                │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  Step 14: SAVE TO MONGODB + INDEX IN MEILISEARCH                         │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │  motor (async MongoDB driver)                                    │    │
│  │  → Insert article with processing_status: 'done'                 │    │
│  │  → Update cluster if needed                                      │    │
│  │  meilisearch-js → Index article for full-text search              │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    MongoDB (articles collection)                          │
│                    processing_status: 'done'                              │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    trendbriefai-service (Express.js)                      │
│                                                                          │
│  GET /api/feed?topic=ai&page=1&limit=20                                  │
│  → Personalized ranking: topic_boost + recency + view_penalty            │
│  → Inject native ads every 5th item                                      │
│  → Include affiliate links (topic-matched)                               │
│                                                                          │
│  GET /api/trending                                                        │
│  → Hot articles in last 24h (by interaction count)                        │
│                                                                          │
│  GET /api/search?q=keyword                                                │
│  → Meilisearch full-text search (typo-tolerant, fast)                     │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    CLIENTS                                                │
│                                                                          │
│  trendbriefai-web (Public)  — Browse, read, share                        │
│  trendbriefai-ui (Admin)    — Manage sources, view analytics, moderate   │
│  trendbriefai-mobile (App)  — Personalized feed, bookmarks, push notif   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Crawl Schedule

```
node-cron (trendbriefai-service)
  └── Every CRAWL_INTERVAL_MINUTES (default: 10 min)
       └── BullMQ job → POST trendbriefai-engine/crawl
            └── Engine fetches all active rss_sources
                 └── Per-source interval: 10–60 min (configurable)
```

---

## 5. Setup Guide


### Prerequisites

| Tool | Version | Required For | Install |
|------|---------|-------------|---------|
| Docker | 24+ | All services | [docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | v2+ | Orchestration | Included with Docker Desktop |
| Node.js | 20+ (22 recommended) | trendbriefai-service, trendbriefai-ui, trendbriefai-web | [nodejs.org](https://nodejs.org/) |
| Python | 3.12+ | trendbriefai-engine | [python.org](https://www.python.org/) |
| Ollama | Latest | AI inference (LLM) | [ollama.com](https://ollama.com/) |
| Flutter | 3.x (SDK ≥3.2.0) | trendbriefai-mobile | [flutter.dev](https://flutter.dev/) |
| Git | 2.x+ | Source control | [git-scm.com](https://git-scm.com/) |
| mongosh | 2.x+ | Database seeding (manual) | Included with MongoDB or [mongosh](https://www.mongodb.com/docs/mongodb-shell/) |

### Option A: All Local with Docker Compose (Recommended for Dev)

```bash
# 1. Clone the repository
git clone <repo-url> trend-brief-ai
cd trend-brief-ai

# 2. Copy environment file
cp .env.example .env
# Edit .env — set JWT_SECRET to a strong random string

# 3. Install and start Ollama (runs on host, NOT in Docker)
# Windows: Download from ollama.com and install
# Linux:
curl -fsSL https://ollama.com/install.sh | sh

# 4. Pull an AI model
ollama pull gemma2:9b
# Alternative smaller models:
#   ollama pull llama3.1:8b
#   ollama pull mistral:7b
#   ollama pull gemma2:2b    (for low-RAM machines)

# 5. Verify Ollama is running
curl http://localhost:11434/api/tags
# Should return JSON with your pulled models

# 6. Start all services with Docker Compose
docker compose up -d

# 7. Verify all services are healthy
docker compose ps
# All services should show "healthy" status

# 8. Database is auto-seeded on first start
# The database/ folder is mounted to /docker-entrypoint-initdb.d
# Scripts run alphabetically:
#   001_init_collections.js  — Creates 6 base collections with validation + indexes (19 total at runtime)
#   002_seed_rss_sources.js  — Seeds 86+ Vietnamese RSS sources
#   003_seed_topics.js       — Seeds 9 topic categories

# 9. Access the services
# Web UI:     http://localhost:4201
# Admin UI:   http://localhost:4200
# Backend:    http://localhost:3000
# AI Engine:  http://localhost:8000
# Swagger:    http://localhost:3000/api-docs
# MongoDB:    localhost:27017
# Redis:      localhost:6379
```

### Option A (Alternative): Manual Dev Mode (No Docker for app services)

Use `start-dev.bat` on Windows for a lighter dev experience:

```bash
# 1. Start infrastructure (MongoDB + Redis) with Docker
docker run -d --name trendbriefai-mongo -p 27017:27017 mongo:7
docker run -d --name trendbriefai-redis -p 6379:6379 redis:7-alpine

# 2. Seed the database manually
mongosh trendbriefai database/001_init_collections.js
mongosh trendbriefai database/002_seed_rss_sources.js
mongosh trendbriefai database/003_seed_topics.js

# 3. Start Ollama (if not already running)
ollama serve
ollama pull gemma2:9b

# 4. Setup Python AI Engine
cd trendbriefai-engine
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --port 8000 --reload

# 5. Setup Express.js Backend (new terminal)
cd trendbriefai-service
npm install
npm run dev

# 6. Setup Angular Admin UI (new terminal)
cd trendbriefai-ui
npm install
npm start

# 7. Setup Angular Public Web (new terminal)
cd trendbriefai-web
npm install
npm start

# Or on Windows, just run:
start-dev.bat
```

### Option A: Mobile App Setup

```bash
# 1. Install Flutter SDK (≥3.2.0)
flutter doctor  # Verify installation

# 2. Setup the mobile project
cd trendbriefai-mobile
flutter pub get

# 3. Configure API endpoint
# Edit lib/config.dart or equivalent:
#   API_BASE_URL = "http://10.0.2.2:3000"  (Android emulator → host)
#   API_BASE_URL = "http://localhost:3000"  (iOS simulator)

# 4. Run on device/emulator
flutter run

# 5. Build release APK (Android)
flutter build apk --release

# 6. Build release IPA (iOS — requires macOS + Xcode)
flutter build ipa --release
```

### Database Seeding Details

The `database/` folder contains initialization scripts that run automatically with Docker Compose (mounted to `/docker-entrypoint-initdb.d`):

| Script | What It Does |
|--------|-------------|
| `001_init_collections.js` | Creates 6 base collections (`users`, `articles`, `clusters`, `bookmarks`, `interactions`, `rss_sources`) with JSON Schema validation and indexes. Additional collections (`topics`, `device_tokens`, `notification_logs`, `ads`, `affiliate_links`, `analytics`, `payments`, `subscriptions`, `reactions`, `referrals`, `article_reports`, `user_activities`, `summary_feedback`) are created automatically by Mongoose models at runtime — 19 collections total |
| `002_seed_rss_sources.js` | Seeds 86+ Vietnamese news sources across 4 categories (AI: 22, Finance: 24, Lifestyle: 20, Drama: 20) with RSS and HTML scrape configs |
| `003_seed_topics.js` | Seeds 9 topic categories with keys, labels, Material icons, colors, and display order |

Key indexes created:
- `users.email` — unique
- `articles.url` — unique
- `articles.url_hash` — unique (MD5 for O(1) dedup)
- `articles(processing_status, topic, created_at)` — compound for feed queries
- `bookmarks(user_id, article_id)` — unique compound (idempotent)
- `interactions(user_id, created_at)` — user history

---

## 6. Deployment Guide

### Docker Compose Production

```bash
# 1. On the server, clone and configure
git clone <repo-url> trend-brief-ai
cd trend-brief-ai
cp .env.example .env

# 2. Edit .env for production
nano .env
```

Production `.env` changes:
```env
NODE_ENV=production
JWT_SECRET=<generate-strong-64-char-random-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
MONGODB_URI=mongodb://mongo:27017/trendbriefai
REDIS_URL=redis://redis:6379
OLLAMA_URL=http://host.docker.internal:11434
# or for Linux VPS without Docker Desktop:
# OLLAMA_URL=http://172.17.0.1:11434
```

```bash
# 3. Build and start in detached mode
docker compose up -d --build

# 4. Verify health
docker compose ps
docker compose logs -f --tail=50

# 5. Check individual service health
curl http://localhost:3000/health
curl http://localhost:8000/health
```

### DigitalOcean VPS Setup

#### Recommended Droplet Sizes

| Deployment | Droplet | vCPU | RAM | SSD | Monthly |
|-----------|---------|------|-----|-----|---------|
| Option B (services only) | Basic | 2 vCPU | 4 GB | 80 GB | $24/mo |
| Option C (all + small model) | CPU-Optimized | 4 vCPU | 8 GB | 160 GB | $48/mo |
| Option C (all + large model) | CPU-Optimized | 8 vCPU | 16 GB | 320 GB | $96/mo |

#### Step-by-Step VPS Setup

```bash
# 1. Create droplet (Ubuntu 22.04 LTS)
# Via DigitalOcean dashboard or CLI:
doctl compute droplet create trendbriefai \
  --image ubuntu-22-04-x64 \
  --size s-4vcpu-8gb \
  --region sgp1 \
  --ssh-keys <your-ssh-key-id>

# 2. SSH into the server
ssh root@<droplet-ip>

# 3. Update system
apt update && apt upgrade -y

# 4. Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 5. Install Docker Compose (v2 — included with Docker)
docker compose version

# 6. Configure UFW Firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable

# IMPORTANT: Do NOT expose 27017, 6379, 8000, 4200 to public
# These are internal services accessed via Docker network or nginx proxy

# 7. Install Ollama (Option C only)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull gemma2:2b  # Small model for CPU inference

# 8. Clone and deploy
git clone <repo-url> /opt/trendbriefai
cd /opt/trendbriefai
cp .env.example .env
nano .env  # Configure for production

# 9. Start services
docker compose up -d --build

# 10. Verify
docker compose ps
curl http://localhost:3000/health
```

#### Domain & SSL Setup (Cloudflare)

```
1. Add domain to Cloudflare (free plan)
2. Point DNS records:
   A  trendbriefai.com        → <droplet-ip>  (Proxied ☁️)
   A  api.trendbriefai.com    → <droplet-ip>  (Proxied ☁️)
   A  admin.trendbriefai.com  → <droplet-ip>  (Proxied ☁️)

3. Cloudflare SSL/TLS → Full (strict)
4. Enable "Always Use HTTPS"
5. Enable "Auto Minify" for JS/CSS/HTML
```

#### Nginx Reverse Proxy (on VPS)

Install nginx on the VPS to route domains to Docker containers:

```bash
apt install nginx -y
```

Create `/etc/nginx/sites-available/trendbriefai`:

```nginx
# Public website
server {
    listen 80;
    server_name trendbriefai.com www.trendbriefai.com;

    location / {
        proxy_pass http://127.0.0.1:4201;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API
server {
    listen 80;
    server_name api.trendbriefai.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Admin dashboard
server {
    listen 80;
    server_name admin.trendbriefai.com;

    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/trendbriefai /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Hybrid Deployment with Cloudflare Tunnel (Option B)

#### On Local PC (GPU Machine)

```bash
# 1. Install cloudflared
# Windows: winget install Cloudflare.cloudflared
# Linux: 
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# 2. Authenticate with Cloudflare
cloudflared tunnel login

# 3. Create a tunnel
cloudflared tunnel create trendbriefai-engine

# 4. Configure tunnel (config.yml)
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <tunnel-id>
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: engine.trendbriefai.com
    service: http://localhost:8000
  - service: http_status:404
EOF

# 5. Add DNS record in Cloudflare
cloudflared tunnel route dns trendbriefai-engine engine.trendbriefai.com

# 6. Start the tunnel
cloudflared tunnel run trendbriefai-engine

# 7. Start Ollama + Engine locally
ollama serve &
cd trendbriefai-engine
uvicorn api:app --host 0.0.0.0 --port 8000
```

#### On VPS

```bash
# Update docker-compose.yml environment for trendbriefai-service:
# AI_SERVICE_URL=https://engine.trendbriefai.com

# Update .env:
AI_SERVICE_URL=https://engine.trendbriefai.com

# Start services (without engine)
docker compose up -d mongo redis trendbriefai-service trendbriefai-web trendbriefai-ui
```

#### Alternative: WireGuard VPN

```bash
# On VPS (server)
apt install wireguard -y
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key

cat > /etc/wireguard/wg0.conf << 'EOF'
[Interface]
PrivateKey = <server-private-key>
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = <local-pc-public-key>
AllowedIPs = 10.0.0.2/32
EOF

systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
ufw allow 51820/udp

# On Local PC (client)
# Install WireGuard, configure with:
# Address = 10.0.0.2/24
# Endpoint = <vps-ip>:51820

# Then on VPS, set:
# AI_SERVICE_URL=http://10.0.0.2:8000
```

### Mobile App Build & Distribution

```bash
# Android APK
cd trendbriefai-mobile
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk

# Android App Bundle (for Play Store)
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab

# iOS (requires macOS + Xcode + Apple Developer Account)
flutter build ipa --release
# Output: build/ios/ipa/trend_brief_ai.ipa

# Distribution options:
# - Android: Google Play Store, direct APK download, Firebase App Distribution
# - iOS: Apple App Store, TestFlight
```

---

## 7. Cost Estimation


| Option | Infrastructure | Monthly Cost | One-Time Cost | Suitable For |
|--------|---------------|-------------|---------------|-------------|
| **A: All Local** | Your PC (16+ GB RAM, GPU recommended) | **$0/mo** | $0 (existing hardware) | Solo development, testing, prototyping |
| **B: Hybrid** | Local PC (GPU) + DigitalOcean 4GB VPS | **$24/mo** | $0 | Production with existing GPU machine, best cost/performance ratio |
| **B: Hybrid (upgraded)** | Local PC (GPU) + DigitalOcean 8GB VPS | **$48/mo** | $0 | Production with higher traffic |
| **C: All VPS (small)** | DigitalOcean 8GB CPU-Optimized | **$48/mo** | $0 | Small production, CPU inference with small models (gemma2:2b) |
| **C: All VPS (medium)** | DigitalOcean 16GB CPU-Optimized | **$96/mo** | $0 | Medium production, CPU inference with larger models (gemma2:9b) |
| **C: All VPS (GPU)** | Cloud GPU instance (Lambda, RunPod) | **$150–300/mo** | $0 | Production with fast GPU inference |

### Detailed Cost Breakdown (Option B — Recommended)

| Item | Cost | Notes |
|------|------|-------|
| DigitalOcean Droplet (4 vCPU, 8 GB) | $48/mo | Services + MongoDB + Redis |
| DigitalOcean Droplet (2 vCPU, 4 GB) | $24/mo | Budget option for low traffic |
| Cloudflare (DNS + SSL + CDN) | $0/mo | Free plan sufficient |
| Cloudflare Tunnel | $0/mo | Free for personal use |
| Domain name | ~$10–15/yr | .com domain |
| Ollama (local) | $0/mo | Runs on your GPU |
| MongoDB Atlas (alternative) | $0–57/mo | Free tier: 512 MB, M10: $57/mo |
| **Total (budget)** | **~$24/mo** | |
| **Total (comfortable)** | **~$48/mo** | |

### Free Tier Alternatives

| Service | Free Option | Limitation |
|---------|------------|-----------|
| MongoDB | Atlas M0 (512 MB) | 512 MB storage, shared cluster |
| Redis | Redis Cloud (30 MB) | 30 MB, 30 connections |
| Hosting | Oracle Cloud Free Tier | 4 ARM cores, 24 GB RAM (always free) |
| Hosting | Google Cloud Free Tier | e2-micro (1 vCPU, 1 GB) |
| AI | Ollama local | Requires your own GPU/CPU |
| CDN/SSL | Cloudflare Free | Unlimited bandwidth |
| Domain | Freenom (.tk/.ml) | Less professional |

---

## 8. Environment Variables Reference

| Variable | Description | Default | Required | Used By |
|----------|------------|---------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/trendbriefai` | ✅ Yes | service, engine |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | ✅ Yes | service, engine |
| `JWT_SECRET` | Secret key for JWT token signing. **Must change in production!** | `your-jwt-secret-change-me` | ✅ Yes | service |
| `JWT_ACCESS_EXPIRY` | Access token expiration time | `15m` | ❌ Optional | service |
| `JWT_REFRESH_EXPIRY` | Refresh token expiration time | `7d` | ❌ Optional | service |
| `AI_SERVICE_URL` | URL of the AI engine service | `http://localhost:8000` | ✅ Yes | service |
| `OLLAMA_URL` | URL of the Ollama LLM server | `http://localhost:11434` | ✅ Yes | engine |
| `PORT` | Express.js server port | `3000` | ❌ Optional | service |
| `NODE_ENV` | Node.js environment (`development` / `production`) | `development` | ❌ Optional | service |
| `CRAWL_INTERVAL_MINUTES` | How often the crawl scheduler runs | `10` | ❌ Optional | service |
| `MONGO_INITDB_DATABASE` | MongoDB initial database name (Docker only) | `trendbriefai` | ❌ Optional | mongo container |
| `API_URL` | Backend API URL for Angular UI (Docker only) | `http://trendbriefai-service:3000/api` | ❌ Optional | ui container |
| `MEILI_MASTER_KEY` | Meilisearch master API key | `dev-meili-key` | ✅ Yes (production) | service, meilisearch |
| `MEILI_URL` | Meilisearch connection URL | `http://localhost:7700` | ❌ Optional | service |

### Docker Compose Internal Variables

These are set in `docker-compose.yml` and override `.env` values inside containers:

| Variable | Container Value | Notes |
|----------|----------------|-------|
| `MONGODB_URI` | `mongodb://mongo:27017/trendbriefai` | Uses Docker service name `mongo` |
| `REDIS_URL` | `redis://redis:6379` | Uses Docker service name `redis` |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Reaches Ollama on host machine |
| `AI_SERVICE_URL` | `http://trendbriefai-engine:8000` | Docker service name |

### Production Security Checklist

- [ ] Change `JWT_SECRET` to a strong random string (64+ characters)
- [ ] Set `NODE_ENV=production`
- [ ] Use MongoDB authentication (`MONGODB_URI=mongodb://user:pass@host:27017/trendbriefai`)
- [ ] Use Redis password (`REDIS_URL=redis://:password@host:6379`)
- [ ] Never expose MongoDB (27017) or Redis (6379) ports to public internet
- [ ] Use HTTPS for all public-facing services
- [ ] Set appropriate `JWT_ACCESS_EXPIRY` (15m recommended)
- [ ] Set appropriate `JWT_REFRESH_EXPIRY` (7d recommended)

---

## 9. Monitoring & Health Checks

### Health Check Endpoints

| Service | Endpoint | Method | Expected Response | Docker Health Check |
|---------|----------|--------|-------------------|-------------------|
| **trendbriefai-service** | `http://localhost:3000/health` | GET | `200 OK` | `wget --spider http://localhost:3000/health` every 15s |
| **trendbriefai-engine** | `http://localhost:8000/health` | GET | `200 OK` | `python urllib.request.urlopen('http://localhost:8000/health')` every 15s |
| **MongoDB** | N/A (internal) | — | — | `mongosh --eval "db.adminCommand('ping')"` every 10s |
| **Redis** | N/A (internal) | — | — | `redis-cli ping` → `PONG` every 10s |
| **Ollama** | `http://localhost:11434/api/tags` | GET | JSON with model list | Manual check (not in Docker) |
| **Meilisearch** | `http://localhost:7700/health` | GET | `200 OK` | `wget --spider http://localhost:7700/health` every 15s |
| **trendbriefai-web** | `http://localhost:4201` | GET | `200 OK` (HTML) | nginx default (port 80 open) |
| **trendbriefai-ui** | `http://localhost:4200` | GET | `200 OK` (HTML) | nginx default (port 80 open) |

### Docker Health Check Configuration

From `docker-compose.yml`:

```yaml
# MongoDB
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s

# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 5s

# AI Engine
healthcheck:
  test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
  interval: 15s
  timeout: 10s
  retries: 5
  start_period: 20s

# Backend Service
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
  interval: 15s
  timeout: 10s
  retries: 5
  start_period: 15s
```

### What to Monitor

| Metric | Target | Alert Threshold | Tool |
|--------|--------|----------------|------|
| **CPU Usage** | < 70% sustained | > 85% for 5 min | `docker stats`, htop, DigitalOcean Monitoring |
| **Memory Usage** | < 80% | > 90% | `docker stats`, free -h |
| **Disk Usage** | < 70% | > 85% | `df -h`, DigitalOcean Monitoring |
| **MongoDB Disk** | Growing ~50 MB/day | > 80% volume capacity | `db.stats()`, `du -sh /data/db` |
| **Crawl Success Rate** | > 90% | < 70% | Check `articles.processing_status` distribution |
| **Crawl Latency** | < 30s per batch | > 60s | Engine logs, BullMQ dashboard |
| **API Response Time** | < 200ms (p95) | > 500ms | Express.js logs, nginx access logs |
| **Ollama Response Time** | < 10s per summary | > 30s | Engine logs |
| **BullMQ Queue Depth** | < 100 pending | > 500 pending | Redis `LLEN bull:*` |
| **Error Rate** | < 1% | > 5% | Application logs |
| **Active Connections** | < 80% of limit | > 90% | MongoDB `db.serverStatus().connections` |

### Quick Monitoring Commands

```bash
# Docker container status and resource usage
docker compose ps
docker stats --no-stream

# Check service logs
docker compose logs -f trendbriefai-engine --tail=100
docker compose logs -f trendbriefai-service --tail=100

# MongoDB stats
docker exec trendbriefai-mongo mongosh trendbriefai --eval "
  print('Articles: ' + db.articles.countDocuments());
  print('Done: ' + db.articles.countDocuments({processing_status: 'done'}));
  print('Failed: ' + db.articles.countDocuments({processing_status: 'failed'}));
  print('Pending: ' + db.articles.countDocuments({processing_status: 'pending'}));
  print('Sources: ' + db.rss_sources.countDocuments({is_active: true}));
  print('Users: ' + db.users.countDocuments());
  printjson(db.stats());
"

# Redis stats
docker exec trendbriefai-redis redis-cli info memory
docker exec trendbriefai-redis redis-cli info clients

# Check BullMQ queues
docker exec trendbriefai-redis redis-cli keys "bull:*"

# Disk usage
docker system df
du -sh /var/lib/docker/volumes/trend-brief-ai_mongo-data/

# Ollama status
curl -s http://localhost:11434/api/tags | python3 -m json.tool
```

### Uptime Monitoring (External)

Recommended free services to monitor public endpoints:

| Service | Free Tier | Check Interval |
|---------|----------|---------------|
| UptimeRobot | 50 monitors | 5 min |
| Freshping | 50 monitors | 1 min |
| Cloudflare Health Checks | Included with free plan | 1 min |

Monitor these URLs:
- `https://trendbriefai.com` — Public website
- `https://api.trendbriefai.com/health` — Backend API
- `https://admin.trendbriefai.com` — Admin dashboard

---

## 10. Backup & Recovery

### MongoDB Backup Strategy

#### Automated Daily Backup Script

Create `/opt/trendbriefai/backup.sh`:

```bash
#!/bin/bash
# ═══════════════════════════════════════
#  TrendBrief AI — MongoDB Backup Script
# ═══════════════════════════════════════

BACKUP_DIR="/opt/trendbriefai/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting MongoDB backup..."

# Dump database from Docker container
docker exec trendbriefai-mongo mongodump \
  --db trendbriefai \
  --archive="/data/backup_${DATE}.gz" \
  --gzip

# Copy from container to host
docker cp "trendbriefai-mongo:/data/backup_${DATE}.gz" "$BACKUP_DIR/trendbriefai_${DATE}.gz"

# Clean up inside container
docker exec trendbriefai-mongo rm "/data/backup_${DATE}.gz"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "trendbriefai_*.gz" -mtime +$RETENTION_DAYS -delete

# Show backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR/trendbriefai_${DATE}.gz" | cut -f1)
echo "[$(date)] Backup complete: trendbriefai_${DATE}.gz ($BACKUP_SIZE)"
echo "[$(date)] Backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"/trendbriefai_*.gz
```

```bash
# Make executable
chmod +x /opt/trendbriefai/backup.sh

# Schedule daily backup at 3 AM
crontab -e
# Add:
0 3 * * * /opt/trendbriefai/backup.sh >> /var/log/trendbriefai-backup.log 2>&1
```

#### Manual Backup

```bash
# Full database dump
docker exec trendbriefai-mongo mongodump \
  --db trendbriefai \
  --archive=/data/backup.gz \
  --gzip

docker cp trendbriefai-mongo:/data/backup.gz ./backup_$(date +%Y%m%d).gz

# Dump specific collection
docker exec trendbriefai-mongo mongodump \
  --db trendbriefai \
  --collection articles \
  --archive=/data/articles_backup.gz \
  --gzip
```

#### Restore from Backup

```bash
# Copy backup into container
docker cp ./backup_20250101.gz trendbriefai-mongo:/data/backup.gz

# Restore (drops existing data)
docker exec trendbriefai-mongo mongorestore \
  --db trendbriefai \
  --archive=/data/backup.gz \
  --gzip \
  --drop

# Restore specific collection only
docker exec trendbriefai-mongo mongorestore \
  --db trendbriefai \
  --collection articles \
  --archive=/data/articles_backup.gz \
  --gzip \
  --drop
```

#### Off-Site Backup (DigitalOcean Spaces / S3)

```bash
# Install s3cmd or aws-cli
apt install s3cmd -y

# Upload to DigitalOcean Spaces
s3cmd put "$BACKUP_DIR/trendbriefai_${DATE}.gz" \
  s3://trendbriefai-backups/mongodb/trendbriefai_${DATE}.gz

# Or use rclone for any cloud storage
rclone copy "$BACKUP_DIR/trendbriefai_${DATE}.gz" \
  remote:trendbriefai-backups/mongodb/
```

### Redis Persistence

Redis is used for BullMQ job queues, rate limiting, and caching. Data is ephemeral and can be rebuilt, but persistence prevents job loss on restart.

#### Current Configuration

The default `redis:7-alpine` image has:
- **RDB snapshots**: Enabled by default (saves every 60s if 1000+ keys changed)
- **AOF**: Disabled by default

#### Recommended Production Configuration

Add to `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: trendbriefai-redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  command: >
    redis-server
    --appendonly yes
    --appendfsync everysec
    --save 900 1
    --save 300 10
    --save 60 10000
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
  volumes:
    - redis-data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 5s
```

Add to volumes section:
```yaml
volumes:
  mongo-data:
  redis-data:
```

#### Redis Backup

```bash
# Trigger RDB snapshot
docker exec trendbriefai-redis redis-cli BGSAVE

# Copy RDB file
docker cp trendbriefai-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb

# Restore: copy RDB file back and restart
docker cp ./redis_backup.rdb trendbriefai-redis:/data/dump.rdb
docker restart trendbriefai-redis
```

### Disaster Recovery Checklist

| Scenario | Recovery Steps | RTO | RPO |
|----------|---------------|-----|-----|
| **Service crash** | Docker auto-restarts (`restart: unless-stopped`) | < 1 min | 0 (no data loss) |
| **VPS reboot** | Docker services auto-start | < 5 min | 0 (volumes persist) |
| **MongoDB corruption** | Restore from latest backup | < 30 min | Up to 24h (daily backup) |
| **VPS destroyed** | New droplet + restore backup + redeploy | < 2 hours | Up to 24h |
| **Full disaster** | New VPS + restore off-site backup + git clone + redeploy | < 4 hours | Up to 24h |

### Recovery Priority Order

1. **MongoDB** — Contains all articles, users, bookmarks (critical data)
2. **Redis** — BullMQ queues (can be rebuilt, but pending jobs lost)
3. **Application code** — Git clone (no data loss)
4. **Ollama models** — Re-pull from ollama.com (no data loss, just download time)
5. **Database seeds** — Re-run if needed (idempotent scripts)

---

## Quick Reference

### Common Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build

# View logs
docker compose logs -f

# Check health
docker compose ps

# Enter MongoDB shell
docker exec -it trendbriefai-mongo mongosh trendbriefai

# Enter Redis CLI
docker exec -it trendbriefai-redis redis-cli

# Restart single service
docker compose restart trendbriefai-service

# Scale (if needed)
docker compose up -d --scale trendbriefai-service=2
```

### Port Reference

| Port | Service | Access |
|------|---------|--------|
| 80/4201 | trendbriefai-web | Public website |
| 4200 | trendbriefai-ui | Admin dashboard (requires login) |
| 3000 | trendbriefai-service | Backend REST API |
| 8000 | trendbriefai-engine | AI engine (internal) |
| 27017 | MongoDB | Database (internal) |
| 6379 | Redis | Cache/Queue (internal) |
| 7700 | Meilisearch | Full-text search (internal) |
| 11434 | Ollama | LLM inference (host only) |

---

*Document generated for TrendBrief AI infrastructure. Keep this updated as the architecture evolves.*
