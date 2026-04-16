# ⚡ TrendBrief AI

Vietnamese AI-summarized news for Gen Z. Đọc nhanh trong 30–60 giây.

## Architecture

```
trendbriefai-engine  (Python/FastAPI)  — AI crawl + summarize + classify + dedup
trendbriefai-service (Express.js/TS)   — REST API + auth + feed + BullMQ scheduler
trendbriefai-ui      (Angular 19+)     — Web UI with ArchitectUI theme
trendbriefai-mobile  (Flutter)         — iOS + Android mobile app
```

## Quick Start (Docker)

```bash
cp .env.example .env
docker compose up -d
```

- API: http://localhost:3000/health
- AI Engine: http://localhost:8000/health
- Web UI: http://localhost:4200

## Quick Start (Manual)

```bash
# 1. MongoDB + Redis
docker run -d --name trendbriefai-mongo -p 27017:27017 mongo:7
docker run -d --name trendbriefai-redis -p 6379:6379 redis:7-alpine

# 2. AI Engine
cd trendbriefai-engine && pip install -r requirements.txt && uvicorn api:app --port 8000

# 3. Backend
cd trendbriefai-service && npm install && npm run dev

# 4. Web UI
cd trendbriefai-ui && npm install && npm start

# 5. Mobile
cd trendbriefai-mobile && flutter pub get && flutter run
```

## Features

- 📰 AI-summarized feed (title + 3 bullets + "why you should care")
- 🔍 Article search (MongoDB text search)
- 🔥 Trending articles (hot in last 24h)
- 🏷️ Topic filters (AI, Finance, Lifestyle, Drama)
- 🔖 Bookmarks (idempotent)
- 👤 Personalized feed ranking (interests + recency + view penalty)
- ⏱️ Reading time estimates (15–60s)
- ↗️ Share articles (Web Share API / clipboard)
- 📊 Native ads (injected every 5th item, impression + click tracking)
- 🔗 Affiliate links (topic-matched, impression + click tracking)
- 📈 Analytics (DAU, MAU, D7 retention, engagement, ad/affiliate metrics)
- 🏷️ Sponsored articles support

## Tech Stack

| Service | Tech |
|---------|------|
| AI Engine | Python 3.12, FastAPI, Ollama, sentence-transformers, feedparser, newspaper3k |
| Backend | Node.js 20, Express.js, TypeScript, Mongoose, BullMQ, ioredis, JWT |
| Web UI | Angular 19+, standalone components, ArchitectUI theme |
| Mobile | Flutter 3.x, Dio, Provider, flutter_secure_storage |
| Database | MongoDB 7 |
| Cache/Queue | Redis 7 |

## Docs

- [Architecture](docs/01-architecture.md)
- [Application Flow](docs/02-flow.md)
- [Setup Guide](docs/03-setup-guide.md)
- [Deploy Guide](docs/04-deploy.md)
- [Cost Estimation](docs/05-cost.md)
- [Hybrid Network](docs/06-hybrid-network.md)

## RSS Sources (6 Vietnamese)

VnExpress · Tuổi Trẻ · Thanh Niên · Zing News · CafeBiz · CafeF
