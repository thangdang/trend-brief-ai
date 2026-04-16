# TrendBrief AI — Hybrid Network Diagram

## 1. Tổng quan

Hybrid deployment cho giai đoạn MVP:
- **Local PC** (16GB RAM): chạy AI engine nặng (Ollama + sentence-transformers + crawl pipeline)
- **VPS $24** (4GB RAM): chạy backend API, web UI, MongoDB, Redis
- **Kết nối**: Cloudflare Tunnel (HTTPS, không cần IP tĩnh, miễn phí)

Khác với legal-ai (cần real-time chat), TrendBrief xử lý articles **offline** (batch crawl mỗi 10 phút). Khi PC tắt, crawl tạm dừng nhưng feed vẫn hoạt động bình thường từ articles đã có trong DB.

## 2. Network Diagram

```
                    ┌──────────────────────────────────────┐
                    │           INTERNET                    │
                    └──────────┬───────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────┐   ┌──────────────┐   ┌──────────────┐
     │ Mobile App │   │ Web Browser  │   │ Content      │
     │ (Flutter)  │   │ (Angular UI) │   │ Sources      │
     │ iOS+Android│   │              │   │ RSS+Scrape   │
     └─────┬──────┘   └──────┬───────┘   └──────┬───────┘
           │                  │                   │
    ═══════╪══════════════════╪═══════════════════╪════════
    VPS    │ ($24/mo, 4GB)    │                   │
    ═══════╪══════════════════╪═══════════════════╪════════
           │                  │                   │
           ▼                  ▼                   │
    ┌─────────────────────────────────────────┐   │
    │  trendbriefai-service (Express.js :3000) │   │
    │                                          │   │
    │  ┌────────────────────────────────────┐  │   │
    │  │         BullMQ + node-cron          │  │   │
    │  │                                     │  │   │
    │  │  Every 10 min:                      │  │   │
    │  │  1. Fetch active sources (RSS+scrape) │  │   │
    │  │  2. POST tunnel-url/crawl ──────────│──│───┘
    │  │     per source                      │  │
    │  │  3. Update last_crawled_at          │  │
    │  │                                     │  │
    │  │  If AI engine offline:              │  │
    │  │  → Job fails → retry 3x → skip     │  │
    │  │  → Next crawl cycle retries         │  │
    │  └────────────────────────────────────┘  │
    │                                          │
    │  ┌────────────────────────────────────┐  │
    │  │         Feed Service                │  │
    │  │                                     │  │
    │  │  GET /api/feed                      │  │
    │  │  1. Redis cache check               │  │
    │  │  2. Query articles from MongoDB     │  │
    │  │  3. Apply ranking algorithm         │  │
    │  │  4. Cache result (TTL 300s)         │  │
    │  │  → Always works (no AI dependency)  │  │
    │  └────────────────────────────────────┘  │
    │                                          │
    │  Auth │ Bookmarks │ Interactions │ Topics │
    └──────┬──────────┬────────────────────────┘
           │          │
     ┌─────▼──┐  ┌────▼───────────────────┐
     │MongoDB │  │ Redis                   │
     │ :27017 │  │ :6379                   │
     │        │  │ ├─ feed:* (cache, 300s) │
     │articles│  │ ├─ bull:crawl:* (jobs)  │
     │users   │  │ └─ rate-limit:*         │
     │clusters│  └─────────────────────────┘
     │bookmarks│
     │interactions│
     │rss_sources │
     └────────┘
           │
    ┌──────▼──────────────────────────────────┐
    │  trendbriefai-ui (Angular, Nginx :80)    │
    │  → Proxy to trendbriefai-service :3000   │
    └─────────────────────────────────────────┘
                      │
    ══════════════════╪════════════════════════════════════
                      │ Cloudflare Tunnel (HTTPS)
    ══════════════════╪════════════════════════════════════
    LOCAL PC (Win 11) │  16GB RAM
    ══════════════════╪════════════════════════════════════
                      │
           ┌──────────▼──────────────────────────────────┐
           │   trendbriefai-engine (FastAPI :8000)         │
           │                                               │
           │  ┌─────────────────────────────────────────┐  │
           │  │  POST /crawl                            │  │
           │  │  1. Dispatch by source_type:             │  │
           │  │     rss → feedparser.parse(rss_url)      │  │
           │  │     html_scrape → httpx + BeautifulSoup  │  │
           │  │  2. newspaper3k download + parse         │  │
           │  │  3. BeautifulSoup clean                  │  │
           │  │  4. Ollama summarize (title + bullets)   │  │
           │  │  5. Keyword classify (6 topics)          │  │
           │  │  6. 3-layer dedup:                       │  │
           │  │     - URL hash (O(1))                    │  │
           │  │     - Title similarity ≥0.8              │  │
           │  │     - Embedding cosine ≥0.8              │  │
           │  │  7. Insert article → MongoDB (VPS)       │  │
           │  └─────────────────────────────────────────┘  │
           │                                               │
           │  ┌──────────────────┐  ┌──────────────────┐   │
           │  │ sentence-         │  │ feedparser +     │   │
           │  │ transformers      │  │ newspaper3k +    │   │
           │  │ all-MiniLM-L6-v2 │  │ BeautifulSoup +  │   │
           │  │ ~90MB model       │  │ httpx (scraper)  │   │
           │  └──────────────────┘  └──────────────────┘   │
           └──────────────┬───────────────────────────────┘
                          │ localhost:11434
           ┌──────────────▼───────────────────────────────┐
           │         Ollama (LLaMA 3, ~4.7GB RAM)          │
           │         Summarization model                    │
           └──────────────────────────────────────────────┘
```

## 3. Data Flow — Article Ingestion (Hybrid)

```
node-cron (VPS, every 10 min)
    │
    ▼
┌─ VPS ──────────────────────────────────────────────────────┐
│  BullMQ enqueue crawl job                                   │
│  Worker: fetch active sources from MongoDB (RSS + HTML)     │
│  For each source:                                           │
│    POST https://tunnel-url/crawl                            │
│         { source_url, source_name, source_type,             │
│           scrape_link_selector }                            │
│                                                             │
│  ┌─ PC ONLINE ──────────────────────────────────────┐       │
│  │ trendbriefai-engine receives POST /crawl          │       │
│  │                                                   │       │
│  │ Dispatch by source_type:                          │       │
│  │   rss → feedparser.parse(rss_url)                 │       │
│  │   html_scrape → httpx fetch + CSS selector        │       │
│  │                                                   │       │
│  │ For each entry:                                   │       │
│  │   1. URL hash check → MongoDB (VPS) via pymongo   │       │
│  │      → duplicate? skip                            │       │
│  │   2. newspaper3k fetch full article               │       │
│  │   3. BeautifulSoup clean HTML                     │       │
│  │   4. Ollama summarize (~3-8s per article)         │       │
│  │      → fail? extractive fallback (~0.1s)          │       │
│  │   5. Keyword classify topic                       │       │
│  │   6. sentence-transformers encode (384-dim)       │       │
│  │   7. Dedup: title sim + embedding cosine          │       │
│  │   8. Insert article → MongoDB (VPS)               │       │
│  │                                                   │       │
│  │ Return { new: 5, duplicate: 12, failed: 1 }      │       │
│  └───────────────────────────────────────────────────┘       │
│                                                              │
│  Update rss_sources.last_crawled_at                          │
│                                                              │
│  ┌─ PC OFFLINE ─────────────────────────────────────┐        │
│  │ POST tunnel-url/crawl → timeout/connection error  │        │
│  │ BullMQ retry (exponential backoff, max 3)         │        │
│  │ After 3 retries → job failed, skip this cycle     │        │
│  │ Next cron cycle (10 min) → try again              │        │
│  │                                                   │        │
│  │ Feed vẫn hoạt động bình thường!                   │        │
│  │ (serve articles đã có trong MongoDB)              │        │
│  └───────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

## 4. Data Flow — User Feed Request (Always Works)

```
User mở app
    │
    ▼
GET /api/feed?topic=ai&page=1
    │
    ▼
┌─ VPS (không cần PC online) ─────────────────────────────┐
│  trendbriefai-service:                                    │
│                                                           │
│  1. Verify JWT token                                      │
│  2. Redis cache check → feed:{userId}:{topic}:{page}     │
│     HIT → return cached (~1ms)                            │
│     MISS ↓                                                │
│  3. Query articles from MongoDB                           │
│     (processing_status: done/fallback)                    │
│  4. Fetch user interests + viewed articles                │
│  5. Apply ranking:                                        │
│     score = topicBoost(+2.0) + recency(1.0→0.0/48h)     │
│             + viewPenalty(-5.0)                            │
│  6. Paginate + check bookmarks                            │
│  7. Cache result (Redis, TTL 300s)                        │
│  8. Return FeedResponse                                   │
│                                                           │
│  ✅ 100% independent of AI engine / Local PC              │
└───────────────────────────────────────────────────────────┘
```

## 5. Port Map

| Location | Service | Port | Access |
|----------|---------|------|--------|
| VPS | Nginx (SSL) | 443 | Public |
| VPS | trendbriefai-service | 3000 | Internal (Nginx proxy) |
| VPS | trendbriefai-ui | 80 (Docker) | Internal (Nginx proxy) |
| VPS | MongoDB | 27017 | Internal + Local PC (SSH tunnel) |
| VPS | Redis | 6379 | Internal only |
| Local PC | trendbriefai-engine | 8000 | Via Cloudflare Tunnel |
| Local PC | Ollama | 11434 | localhost only |

## 6. RAM Usage

| Location | Component | RAM |
|----------|-----------|-----|
| **VPS (4GB total)** | | |
| | trendbriefai-service (Express.js + BullMQ) | ~300 MB |
| | trendbriefai-ui (Nginx) | ~50 MB |
| | MongoDB 7 | ~500 MB |
| | Redis 7 (feed cache + BullMQ) | ~150 MB |
| | OS + Docker | ~500 MB |
| | **Tổng VPS** | **~1.5 GB** (dư ~2.5GB) |
| **Local PC (16GB total)** | | |
| | trendbriefai-engine (FastAPI) | ~200 MB |
| | sentence-transformers (all-MiniLM-L6-v2) | ~300 MB |
| | feedparser + newspaper3k + BeautifulSoup + httpx | ~100 MB |
| | Ollama (LLaMA 3) | ~4,700 MB |
| | cloudflared | ~50 MB |
| | **Tổng AI** | **~5.4 GB** (dư ~10.6GB) |

## 7. Khác biệt so với Legal AI Hybrid

| | Legal AI | TrendBrief AI |
|---|---|---|
| **Tính chất** | Real-time chat (user hỏi → AI trả lời ngay) | Batch processing (crawl mỗi 10 phút) |
| **Khi PC offline** | Cần fallback Groq/Gemini (user đang chờ) | Crawl tạm dừng, feed vẫn hoạt động |
| **Fallback cần thiết?** | ✅ Bắt buộc (UX bị ảnh hưởng) | ⚠️ Không bắt buộc (articles đã có trong DB) |
| **Pending queue** | ✅ Cần (reprocess khi PC online) | ❌ Không cần (BullMQ tự retry) |
| **Cache strategy** | Two-layer (Redis + LRU) | Single-layer (Redis feed cache) |
| **AI dependency** | Mỗi request cần AI | Chỉ crawl cần AI, feed không cần |

**Lợi thế TrendBrief**: Feed luôn hoạt động 24/7 bất kể PC online hay offline. AI chỉ cần chạy khi crawl articles mới.

## 8. Graceful Degradation

| Tình huống | Feed | Crawl | Bookmark/Auth |
|------------|------|-------|---------------|
| PC online, VPS online | ✅ Full AI summaries | ✅ Ollama + dedup | ✅ |
| PC offline, VPS online | ✅ Serve existing articles | ❌ Tạm dừng (retry next cycle) | ✅ |
| PC online, VPS offline | ❌ | ❌ (no MongoDB) | ❌ |

## 9. Setup Cloudflare Tunnel (Chi tiết)

### Cách 1: Quick Tunnel (dev/test, URL thay đổi mỗi lần)

```powershell
cloudflared tunnel --url http://localhost:8000
# → https://random-words.trycloudflare.com
```

### Cách 2: Named Tunnel (production, URL cố định)

```powershell
# Login
cloudflared tunnel login

# Tạo tunnel
cloudflared tunnel create trendbriefai-engine

# Config
# ~/.cloudflared/config.yml
tunnel: <TUNNEL_ID>
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: ai.trendbriefai.vn
    service: http://localhost:8000
  - service: http_status:404

# DNS
cloudflared tunnel route dns trendbriefai-engine ai.trendbriefai.vn

# Run
cloudflared tunnel run trendbriefai-engine
```

Sau đó trên VPS `.env`:
```env
AI_SERVICE_URL=https://ai.trendbriefai.vn
```

## 10. Chi phí Hybrid

| Hạng mục | Chi phí/tháng |
|----------|---------------|
| VPS (2 vCPU, 4GB RAM) | $24 (~600,000đ) |
| Domain `.vn` | ~30,000đ/tháng |
| SSL (Let's Encrypt) | Miễn phí |
| Cloudflare Tunnel | Miễn phí |
| Ollama + models (Local PC) | Miễn phí |
| sentence-transformers (Local PC) | Miễn phí |
| Điện + Internet | ~50,000–100,000đ |
| **Tổng** | **~$26/tháng (~650,000đ)** |
