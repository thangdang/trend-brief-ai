# ⚡ TrendBrief AI

> Vietnamese AI-summarized news for Gen Z. Đọc nhanh trong 30–60 giây, giảm overload thông tin.

## Architecture

```
trendbriefai-mobile (Flutter)  →  trendbriefai-service (Express.js)  →  trendbriefai-engine (FastAPI)
                                          ↓                                      ↓
                                       MongoDB                          Ollama + Embeddings
                                          ↑                             feedparser + newspaper3k
trendbriefai-ui (Angular 19+)  →  trendbriefai-service
                                          ↑
                                    Redis + BullMQ
```

## Project Structure

| Folder | Stack | Description |
|--------|-------|-------------|
| `trendbriefai-service/` | Express.js + TypeScript + Mongoose + BullMQ | REST API + auth + feed + scheduler |
| `trendbriefai-engine/` | Python 3.12 + FastAPI + Ollama | AI crawl + summarize + classify + dedup |
| `trendbriefai-ui/` | Angular 19+ + ArchitectUI + Bootstrap 5 | Web dashboard |
| `trendbriefai-mobile/` | Flutter 3.x + Dio + Provider | Mobile app (Android + iOS) |
| `docs/` | Markdown | Architecture, flows, setup, deploy, cost guides |
| `spec/` | Markdown | Product specs |
| `database/` | MongoDB scripts | Seeds, migrations |

## Features

- 📰 AI-summarized feed (title + 3 bullets + "why you should care")
- 🔍 Article search (MongoDB text search)
- 🔥 Trending articles (hot in last 24h)
- 🏷️ 9 topic filters (AI, Finance, Lifestyle, Drama, Technology, Career, Health, Entertainment, Sport)
- 👤 Personalized feed ranking (interests + recency + view penalty)
- 🔖 Bookmarks (idempotent)
- ⏱️ Reading time estimates (15–60s)
- ↗️ Share articles (Web Share API / clipboard)
- 📊 Native ads (injected every 5th item, impression + click tracking)
- 🔔 Push notifications (trending, topic updates, weekly digest)
- 📖 Reading history tracking
- 🔗 Affiliate links (topic-matched, impression + click tracking)
- 📈 Analytics (DAU, MAU, D7 retention, engagement, ad/affiliate metrics)
- 🏷️ Sponsored articles support
- 🔄 3-layer deduplication (URL hash → title similarity → embedding cosine)
- ⏰ Auto-crawl every 10 minutes (node-cron + BullMQ)
- 🌐 Auto-translate non-Vietnamese articles (langdetect + Ollama)
- 🔍 Auto-discover new VN sources weekly (Google News scan + backlink mining + RSS detect)

## Quick Start (Docker)

```bash
cp .env.example .env
docker compose up -d
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:4200 |
| Backend API | http://localhost:3000 |
| AI Engine | http://localhost:8000 |
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |

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

## API Endpoints

| Route | Description |
|-------|-------------|
| `POST /api/auth/register` | Đăng ký |
| `POST /api/auth/login` | Đăng nhập |
| `POST /api/auth/refresh` | Refresh token |
| `GET /api/feed` | Feed cá nhân hóa (topic, page, limit) — includes native ads + affiliate |
| `GET /api/articles/:id` | Chi tiết bài viết |
| `GET /api/search` | Tìm kiếm bài viết (q, topic, page, limit) |
| `GET /api/trending` | Bài viết đang hot |
| `POST /api/bookmarks` | Lưu bài (idempotent) |
| `DELETE /api/bookmarks/:id` | Bỏ lưu |
| `GET /api/bookmarks` | Danh sách đã lưu |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Engine | Python 3.12, FastAPI, Ollama, sentence-transformers, feedparser, newspaper3k, langdetect, lxml |
| Backend | Node.js 20, Express.js, TypeScript, Mongoose, BullMQ, ioredis, JWT |
| Web UI | Angular 19+, standalone components, ArchitectUI theme |
| Mobile | Flutter 3.x, Dio, Provider, flutter_secure_storage |
| Database | MongoDB 7 |
| Cache/Queue | Redis 7 + BullMQ |
| Container | Docker Compose |

## RSS Sources (38 Vietnamese — auto-expanding)

VnExpress · Tuổi Trẻ · Thanh Niên · Zing News · Dân Trí · VietnamNet · VietnamPlus · Lao Động · VOV · CafeF · CafeBiz · VnEconomy · VietnamBiz · Báo Đầu Tư · Kenh14 · Afamily · Genk · Tinhte · ICT News · Saostar · Bóng Đá Plus · TopDev · TopCV · ITviec · Spiderum · Medium Vietnam + more

> New sources auto-discovered weekly via Google News VN scan + backlink mining.

## Documentation

- [01 – Architecture](docs/01-architecture.md)
- [02 – Application Flow](docs/02-flow.md)
- [03 – Setup Guide](docs/03-setup-guide.md)
- [04 – Deploy Guide](docs/04-deploy.md)
- [05 – Cost Estimation](docs/05-cost.md)
- [06 – Hybrid Network](docs/06-hybrid-network.md)

## Design Principles

- Free-first: all AI runs locally with Ollama, no paid APIs required
- 3-layer dedup prevents duplicate articles across sources
- Personalized feed: topic boost + recency + interaction penalty
- Hybrid deployment: AI engine on local PC, services on VPS ($24/mo)
- Auto-translate: non-Vietnamese content detected and translated via Ollama
- Auto-discover: new VN sources found weekly via Google News + backlink mining
