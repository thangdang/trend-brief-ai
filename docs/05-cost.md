# TrendBrief AI – Chi phí Deploy (Cost Estimation)

## 1. Option A — VPS đơn giản (Startup / MVP)

Phù hợp: < 1,000 users, giai đoạn test + launch đầu tiên.

| Hạng mục | Dịch vụ | Chi phí/tháng |
|----------|---------|---------------|
| VPS (4 vCPU, 8GB RAM, 80GB SSD) | DigitalOcean / Vultr / Linode | $48 (~1,200,000đ) |
| Domain `.vn` | VNNIC | ~30,000đ/tháng |
| SSL Certificate | Let's Encrypt | **Miễn phí** |
| Ollama LLM (LLaMA 3) | Chạy local trên VPS | **Miễn phí** |
| sentence-transformers (embedding) | Chạy local trên VPS | **Miễn phí** |
| MongoDB 7 | Docker trên VPS | **Miễn phí** |
| Redis 7 | Docker trên VPS | **Miễn phí** |
| Docker Hub (public repo) | Docker Hub Free | **Miễn phí** |
| GitHub Actions CI/CD | GitHub Free (2,000 min/tháng) | **Miễn phí** |
| **Tổng Option A** | | **~$50/tháng (~1,250,000đ)** |

> VPS 4 vCPU / 8GB RAM là mức tối thiểu để chạy Ollama + tất cả services. Nếu chỉ test, VPS 2 vCPU / 4GB ($24/tháng) cũng chạy được nhưng AI summarization sẽ chậm.

---

## 2. Option B — Hybrid: Local PC (AI) + VPS $24 ⭐ RECOMMENDED

Chạy AI nặng trên máy cá nhân (16GB RAM), phần còn lại trên VPS rẻ.

**Phân chia workload:**

| Chạy ở đâu | Services | RAM cần |
|-------------|----------|---------|
| **Local PC** (16GB) | trendbriefai-engine (Ollama + sentence-transformers) | ~6–8 GB |
| **VPS $24** (2 vCPU, 4GB) | trendbriefai-service + trendbriefai-ui + MongoDB + Redis | ~2–3 GB |

**Chi phí:**

| Hạng mục | Dịch vụ | Chi phí/tháng |
|----------|---------|---------------|
| VPS (2 vCPU, 4GB RAM, 80GB SSD) | DigitalOcean Basic | **$24 (~600,000đ)** |
| Domain `.vn` | VNNIC | ~30,000đ/tháng |
| SSL | Let's Encrypt | **Miễn phí** |
| Ollama + sentence-transformers | Chạy trên PC cá nhân | **Miễn phí** |
| Điện + Internet (PC chạy khi cần) | Nhà bạn | ~50,000–100,000đ |
| **Tổng Option B** | | **~$26/tháng (~650,000đ)** |

**Kết nối Local PC ↔ VPS:**
- Cloudflare Tunnel (HTTPS, không cần IP tĩnh)
- VPS trỏ `AI_SERVICE_URL` về tunnel URL

**Kiến trúc Hybrid:**

```
┌─────────────────────────────────────────────┐
│          LOCAL PC (Windows/Mac, 16GB)        │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │    trendbriefai-engine (FastAPI)      │    │
│  │    sentence-transformers (~500MB)     │    │
│  │    Port: 8000                         │    │
│  └──────────────┬───────────────────────┘    │
│                 │                             │
│  ┌──────────────▼───────────────────────┐    │
│  │         Ollama (LLaMA 3)              │    │
│  │         ~4.7GB RAM                    │    │
│  │         Port: 11434                   │    │
│  └──────────────────────────────────────┘    │
└──────────────────────┬───────────────────────┘
                       │ Cloudflare Tunnel (HTTPS)
                       │
┌──────────────────────▼───────────────────────┐
│          VPS DigitalOcean ($24/mo)            │
│          2 vCPU, 4GB RAM, 80GB SSD           │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │    trendbriefai-service (Express.js)  │    │
│  │    BullMQ + node-cron scheduler       │    │
│  │    Port: 3000                         │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────┐  ┌───────┐  ┌──────────────┐  │
│  │ MongoDB   │  │ Redis │  │trendbriefai- │  │
│  │  :27017   │  │ :6379 │  │ui (Nginx:80) │  │
│  └──────────┘  └───────┘  └──────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 3. Option C — VPS nâng cao (1,000–10,000 users)

| Hạng mục | Dịch vụ | Chi phí/tháng |
|----------|---------|---------------|
| VPS chính (8 vCPU, 16GB RAM, 160GB SSD) | DigitalOcean Premium | $96 (~2,400,000đ) |
| Managed MongoDB (tùy chọn) | MongoDB Atlas M10 | $57 (~1,425,000đ) |
| Domain `.vn` | VNNIC | ~30,000đ/tháng |
| SSL | Let's Encrypt | **Miễn phí** |
| Backup storage (S3-compatible) | DigitalOcean Spaces 250GB | $5 (~125,000đ) |
| **Tổng Option C** | | **~$100–$160/tháng (~2,500,000–4,000,000đ)** |

---

## 4. Chi phí Mobile App

| Hạng mục | Chi phí | Ghi chú |
|----------|---------|---------|
| Google Play Developer | $25 (một lần) | Lifetime |
| Apple Developer Program | $99/năm (~2,475,000đ/năm) | Bắt buộc cho iOS |
| Codemagic CI/CD (build iOS từ Windows) | **Miễn phí** | Free tier: 500 min/tháng |
| **Tổng Mobile/năm** | **~$124 năm đầu, $99/năm sau** | |

---

## 5. Chi phí ẩn cần lưu ý

| Hạng mục | Chi phí | Ghi chú |
|----------|---------|---------|
| Bandwidth overage | $0.01/GB sau free tier | VPS thường free 1–5TB/tháng |
| Ollama model storage | ~4.7GB (LLaMA 3) | Nằm trong disk VPS |
| sentence-transformers model | ~90MB (all-MiniLM-L6-v2) | Nằm trong disk |
| Article data (MongoDB) | ~2–10GB | Tùy số bài crawl |
| Redis cache | ~100MB–1GB | Feed cache + BullMQ jobs |

---

## 6. Tổng hợp so sánh

| | Option A (All VPS) | Option B (Hybrid) ⭐ | Option C (Growth) |
|---|---|---|---|
| Users | < 1,000 | < 1,000 | 1,000–10,000 |
| Chi phí/tháng | ~$50 | **~$26** | ~$100–$160 |
| Chi phí/năm | ~$600 | **~$312** | ~$1,200–$1,920 |
| VNĐ/tháng | ~1,250,000đ | **~650,000đ** | ~2,500,000–4,000,000đ |
| VPS cần | 8GB RAM | **4GB RAM ($24)** | 16GB RAM |
| AI quality | Ollama local | Ollama local (PC) | Ollama local |
| 24/7 AI | ✅ | ⚠️ Cần PC bật | ✅ |
| Phù hợp | Test, MVP | **MVP, launch đầu tiên** | Có users thật |

> Điểm mạnh: toàn bộ AI stack (Ollama + sentence-transformers) chạy local, **không tốn phí API** cho OpenAI/Claude/Gemini. Chi phí chủ yếu là VPS hosting.

---

## 7. Revenue vs Cost (Unit Economics)

Dựa trên PRD spec (100,000 DAU target):

| Nguồn thu | Ước tính/tháng |
|-----------|----------------|
| Native Ads (CPM $0.5–$2) | $3,000–$12,000 |
| Affiliate Marketing | ~$36,000 |
| Sponsored Content | $1,600–$4,000 |
| **Tổng Revenue** | **~$40,000–$50,000** |

| Chi phí | Ước tính/tháng |
|---------|----------------|
| Server + DB + Redis | $200–$500 |
| AI inference (local/free) | $0–$300 |
| Bandwidth + Monitoring | $150–$400 |
| **Tổng Cost** | **~$500–$1,000** |

**Profit margin: ~97–98%** (do AI chạy local, không tốn API costs)

> Lưu ý: Revenue estimates dựa trên 100K DAU — cần thời gian để đạt được. Giai đoạn MVP focus vào user growth, chưa monetize.
