# TrendBrief AI – Setup Guide

## Yêu cầu hệ thống

| Tool | Version | Mục đích |
|------|---------|----------|
| Node.js | 20+ | Backend (trendbriefai-service) |
| Python | 3.12+ | AI Engine (trendbriefai-engine) |
| MongoDB | 7+ | Database |
| Redis | 7+ | Cache + Queue broker |
| Flutter | 3.x | Mobile app |
| Docker | 24+ | Container (optional) |
| Ollama | latest | Local LLM (optional) |

---

## Cách 1: Docker (Nhanh nhất)

```bash
cd trend-brief-ai
cp .env.example .env
docker compose up -d
```

Kết quả:
- Backend: http://localhost:3000/health
- AI Engine: http://localhost:8000/health
- Web UI: http://localhost:4200
- MongoDB: localhost:27017
- Redis: localhost:6379

Mobile app chạy riêng:
```bash
cd trendbriefai-mobile && flutter pub get && flutter run
```

---

## Cách 2: Chạy từng service

### Bước 1: Config

```bash
cd trend-brief-ai
cp .env.example .env
```

### Bước 2: MongoDB + Redis

```bash
# Init collections + seed RSS sources
docker run -d --name trendbriefai-mongo -p 27017:27017 \
  -v $(pwd)/database:/docker-entrypoint-initdb.d:ro mongo:7
docker run -d --name trendbriefai-redis -p 6379:6379 redis:7-alpine
```

Hoặc chạy init scripts thủ công:
```bash
mongosh trendbriefai database/001_init_collections.js
mongosh trendbriefai database/002_seed_rss_sources.js
# → Seeds 38 sources across 10 categories (general, ai, finance, lifestyle, drama, health, entertainment, sport, career, insight)
```

### Bước 3: AI Engine

```bash
cd trendbriefai-engine
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn api:app --port 8000 --reload
```
→ http://localhost:8000/health

### Bước 4: Cài Ollama (cho AI summarization thật)

```bash
# Windows: download từ https://ollama.com/download
# Linux:
curl -fsSL https://ollama.com/install.sh | sh

# Tải model
ollama pull llama3

# Verify
ollama run llama3 "Xin chào"
```

> Không cài Ollama → AI engine vẫn chạy (fallback extractive summary).

### Bước 5: Backend

```bash
cd trendbriefai-service
npm install
npm run dev
```
→ http://localhost:3000/health

### Bước 6: Web UI

```bash
cd trendbriefai-ui
npm install
npm start
```
→ http://localhost:4200

### Bước 7: Mobile App

```bash
cd trendbriefai-mobile
flutter pub get
flutter run
```

> Android emulator: API URL = `http://10.0.2.2:3000/api`
> Thiết bị thật: đổi `baseUrl` trong `lib/config/api_config.dart`

---

## Cấu hình .env

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/trendbriefai

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-jwt-secret-change-me
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# AI Service
AI_SERVICE_URL=http://localhost:8000
OLLAMA_URL=http://localhost:11434

# Express.js Backend
PORT=3000
NODE_ENV=development

# Crawl Schedule
CRAWL_INTERVAL_MINUTES=10
```

---

## Test API nhanh

```bash
# Health checks
curl http://localhost:3000/health
curl http://localhost:8000/health

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@trendbriefai.vn","password":"123456"}'

# Login → lấy token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@trendbriefai.vn","password":"123456"}'

# Get feed (thay TOKEN)
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/feed?topic=ai&page=1&limit=20"

# Search articles
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/search?q=AI&page=1"

# Trending articles
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/trending?limit=10"

# Bookmark
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"articleId":"ARTICLE_ID"}'

# Update interests
curl -X PUT http://localhost:3000/api/users/interests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"interests":["ai","finance","career"]}'

# Track interaction
curl -X POST http://localhost:3000/api/interactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"articleId":"ARTICLE_ID","action":"view"}'

# Trigger crawl — RSS source (AI service)
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{"source_url":"https://vnexpress.net/rss/tin-moi-nhat.rss","source_name":"vnexpress"}'

# Trigger crawl — HTML scrape source (AI service)
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{"source_url":"https://spiderum.com/bai-dang/moi","source_name":"Spiderum","source_type":"html_scrape","scrape_link_selector":"a.post-title"}'

# Available topics
curl http://localhost:3000/api/topics

# --- Translation (AI service) ---

# Detect language + translate
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"OpenAI released GPT-5 with major improvements","title":"GPT-5 Released"}'

# --- Resource Discovery (AI service) ---

# Discover new VN news sources (runs ~2-5 min)
curl -X POST http://localhost:8000/discover

# --- Monetization (Admin) ---

# Create native ad
curl -X POST http://localhost:3000/api/ads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"AI Course","description":"Học AI miễn phí","target_url":"https://example.com","advertiser":"EduTech","topic":"ai","start_date":"2026-04-01","end_date":"2026-12-31","budget_cents":100000}'

# Create affiliate link
curl -X POST http://localhost:3000/api/affiliates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"ChatGPT Plus","url":"https://affiliate.example.com/chatgpt","topic":"ai","commission":"10%","provider":"OpenAI"}'

# Track ad click
curl -X POST http://localhost:3000/api/ads/AD_ID/click

# Track affiliate click
curl -X POST http://localhost:3000/api/affiliates/LINK_ID/click

# --- Analytics ---

# DAU today
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/analytics/dau?date=2026-04-16"

# MAU this month
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/analytics/mau?month=2026-04"

# D7 retention
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/analytics/retention?cohortDate=2026-04-09"

# Engagement metrics
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/analytics/engagement?startDate=2026-04-01&endDate=2026-04-16"

# Aggregate today's stats
curl -X POST -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/analytics/aggregate

# Daily analytics range
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/analytics?startDate=2026-04-01&endDate=2026-04-16"
```

---

## Troubleshooting

| Lỗi | Fix |
|-----|-----|
| `ECONNREFUSED :27017` | `docker start trendbriefai-mongo` |
| `ECONNREFUSED :8000` | Chạy AI engine: `uvicorn api:app --port 8000` |
| AI trả lời fallback | Cài Ollama + pull model: `ollama pull llama3` |
| Flutter `SocketException` | Đổi `baseUrl` trong `lib/config/api_config.dart` |
| Feed trống | Trigger crawl thủ công qua POST /crawl. Seed data có 38 sources across 10 categories |
| Redis connection refused | `docker start trendbriefai-redis` |
| BullMQ jobs stuck | Check Redis: `redis-cli KEYS bull:*` |
