# 📱 TrendBrief – PRD & Technical Specification

## 1. Product Overview

**TrendBrief** là ứng dụng mobile giúp người trẻ cập nhật nhanh các xu hướng, tin tức và nội dung họ quan tâm thông qua AI tóm tắt.

### 🎯 Goals
- Đọc nhanh trong 30–60 giây
- Giảm overload thông tin
- Cá nhân hóa nội dung theo sở thích

---

## 2. User Personas

### Gen Z (18–30)
- Thích nội dung ngắn
- Lướt nhanh (TikTok-style)
- Quan tâm: AI, tiền, lifestyle, trend

### Young Professionals
- Muốn cập nhật nhanh nhưng có giá trị

---

## 3. Core Features (MVP)

### 3.1 Home Feed
- Title (AI rewrite)
- 3 bullet summary
- “Vì sao nên quan tâm”
- Button: Đọc full (link bài gốc)

### 3.2 Topic Selection
- AI, Finance, Lifestyle, Drama

### 3.3 Bookmark
- Lưu bài

### 3.4 Basic Personalization
- Rule-based theo hành vi user

---

## 4. AI System Design

### 4.1 Pipeline
```
RSS/API → Crawl → Clean → Summarize → Store → API → Mobile
```

### 4.2 Components

#### Text Cleaning
- newspaper3k
- BeautifulSoup

#### Summarization
- HuggingFace Transformers
- Models:
  - bart-large-cnn
  - Mistral 7B / LLaMA 3

#### Prompt
```
Tóm tắt bài viết thành:
- 1 tiêu đề ngắn (<=12 từ)
- 3 bullet chính
- 1 câu: Vì sao bạn nên quan tâm
Tone: trẻ, dễ hiểu
```

#### Classification
- Zero-shot classification
- Keyword-based

#### Recommendation (MVP)
- Rule-based scoring

---

## 5. Backend Architecture

### 5.1 Tech Stack
- FastAPI (Python)
- PostgreSQL / SQLite

### 5.2 API Endpoints
```
GET /feed
GET /article/:id
POST /bookmark
POST /interactions
```

### 5.3 Scheduler
- Cron / Celery

---

## 6. Database Schema

### articles
- id
- title_original
- title_ai
- summary
- reason
- url
- topic
- created_at

### users
- id
- interests

### interactions
- user_id
- article_id
- action

---

## 7. Mobile App

### Stack
- Flutter (recommended)

### Structure
```
Home
 ├── Feed
 ├── Topic Filter
 ├── Bookmark
 └── Profile
```

### UX Principles
- Scroll nhanh
- Hiểu nội dung < 5s
- UI tối giản

---

## 8. Deployment

### Backend
- Render / Railway

### Database
- Supabase

### AI Model
- Ollama (local)

---

## 9. Metrics

- DAU / MAU
- Time spent
- CTR
- Retention (D7)

---

## 10. Roadmap

### Phase 1
- RSS crawling
- Basic summarization
- Mobile MVP

### Phase 2
- Personalization
- Bookmark

### Phase 3
- Audio summary
- Advanced recommendation

---

## 11. Risks

- AI sai → fallback
- Content rác → whitelist
- Cost → batch processing

---

## 12. System Design (Senior-level Architecture)

### 12.1 High-level Architecture

```
                ┌────────────────────┐
                │   External Sources │
                │ RSS / APIs / Blogs │
                └─────────┬──────────┘
                          │
                   (Cron / Scheduler)
                          │
                ┌─────────▼──────────┐
                │   Crawler Service  │
                │ (Fetch raw content)│
                └─────────┬──────────┘
                          │
                ┌─────────▼──────────┐
                │  Processing Queue  │
                │   (Redis / Kafka)  │
                └─────────┬──────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼───────┐ ┌───────▼────────┐ ┌──────▼─────────┐
│ Cleaning Svc  │ │ AI Summarizer  │ │ Classification │
│ (HTML → text) │ │ (LLM Python)   │ │ (topic/tag)    │
└───────┬───────┘ └───────┬────────┘ └──────┬─────────┘
        │                 │                 │
        └──────────┬──────┴──────┬──────────┘
                   │             │
           ┌───────▼─────────────▼───────┐
           │        Database (DB)        │
           │  Articles / Users / Logs    │
           └───────────┬───────────────┘
                       │
               ┌───────▼────────┐
               │   API Backend  │
               │  (FastAPI)     │
               └───────┬────────┘
                       │
        ┌──────────────▼──────────────┐
        │     Mobile App (Flutter)    │
        └─────────────────────────────┘
```

---

### 12.2 Component Breakdown

#### 1. Crawler Service
- Fetch dữ liệu từ RSS/API
- Deduplicate articles
- Push job vào queue

Tech:
- Python + requests
- newspaper3k

---

#### 2. Queue Layer
- Tách async processing
- Tránh block hệ thống

Tech options:
- Redis Queue (RQ)
- Kafka (nếu scale lớn)

---

#### 3. AI Processing Services

##### a. Cleaning Service
- Remove HTML, ads

##### b. Summarization Service
- Load model local (Ollama / Transformers)
- Batch processing để tiết kiệm tài nguyên

##### c. Classification Service
- Gán topic
- Chuẩn bị cho recommendation

---

#### 4. Database Layer

**Primary DB:** PostgreSQL

**Optional:**
- Elasticsearch (search nhanh)
- Redis (cache feed)

---

#### 5. API Backend

Responsibilities:
- Serve feed
- Personalization logic
- Track user behavior

Tech:
- FastAPI
- JWT Auth

---

#### 6. Mobile Client

- Fetch feed
- Render card UI
- Track interaction

Tech:
- Flutter

---

### 12.3 Data Flow (End-to-End)

```
1. Cron trigger crawler
2. Crawl article → push queue
3. Worker xử lý:
   - Clean text
   - AI summarize
   - Classify topic
4. Save DB
5. User mở app → call /feed
6. Backend apply ranking
7. Return personalized feed
```

---

### 12.4 Scaling Strategy

#### Phase MVP
- Monolith FastAPI
- SQLite/Postgres
- Single AI worker

#### Phase Growth
- Split services:
  - crawler-service
  - ai-service
  - api-service

- Add:
  - Redis cache
  - Load balancer

#### Phase Scale
- Microservices
- Kafka streaming
- Distributed workers (Celery)
- GPU inference server

---

### 12.5 Performance Optimization

- Cache feed (Redis)
- Precompute summaries (offline)
- Batch AI inference
- Limit article length input

---

### 12.6 Reliability & Monitoring

- Logging: ELK stack
- Monitoring: Prometheus + Grafana
- Retry jobs (queue)
- Fallback nếu AI fail

---

### 12.7 Security

- Rate limiting API
- Validate input
- Secure API keys
- HTTPS

---

## 13. Vietnam Content Sources Strategy

### 13.1 Overview

Để tối ưu cho thị trường Việt Nam, cần kết hợp nhiều loại nguồn:
- Báo chí chính thống (độ tin cậy)
- Social / trend (độ viral)
- Career & finance (độ quan tâm cao)
- Insight / niche (độ khác biệt)

---

### 13.2 Core News Sources (Vietnam)

**Primary (RSS-ready):**
- VnExpress → https://vnexpress.net/rss
- Tuổi Trẻ → https://tuoitre.vn/rss.htm
- Thanh Niên → https://thanhnien.vn/rss/home.rss
- Zing News → https://zingnews.vn/rss.html

**Usage:**
- Tin chính thống
- Tech, đời sống, kinh doanh

**Filter:**
- Ưu tiên: Công nghệ, Kinh doanh, Đời sống
- Tránh: Chính trị nặng

---

### 13.3 Social & Trend Sources

**Platforms:**
- TikTok (trending videos)
- Facebook (groups, fanpages)
- YouTube (Shorts, trending)
- Threads (emerging VN trends)

**Collection Strategy:**
- Theo dõi hashtag
- Track viral posts
- Extract topic + keywords

**Processing:**
- Không crawl full content
- Chỉ lấy insight + trend summary

---

### 13.4 Career & Finance Sources

- CafeBiz
- CafeF
- LinkedIn (VN posts)

**Content Types:**
- Lương, việc làm
- Startup
- Kiếm tiền online

**Why important:**
- High engagement với Gen Z VN

---

### 13.5 Insight & Community Sources

- Spiderum
- Medium (Vietnam topics)
- Substack (selected)

**Strategy:**
- Select high-quality articles
- Rewrite theo góc nhìn Việt Nam

---

### 13.6 Niche Sources

- TopDev (tech jobs)
- Product Hunt (global → localize)

**Usage:**
- Trend mới
- Early signals

---

### 13.7 Content Mix Strategy

Recommended ratio:

- 40% → Báo chí
- 40% → Social / trend
- 20% → Career + insight

---

### 13.8 Topic Prioritization

High priority topics:
- AI & công nghệ
- Kiếm tiền / nghề nghiệp
- Lifestyle
- Trend xã hội

Low priority:
- Chính trị
- Nội dung dài, học thuật

---

### 13.9 Content Processing Layer

Add value via transformation:

**Rewrite format:**
- Title: ngắn, gây chú ý
- 3 bullet points
- “Vì sao bạn nên quan tâm”

**Example:**

Original:
- "Lãi suất FED tăng"

Rewritten:
- "Tiền bạn có thể mất giá vì điều này"

---

### 13.10 Quality Control

- Whitelist nguồn
- Deduplicate content
- Detect spam / low-quality
- Validate AI output

---

### 13.11 Legal Considerations

- Không lưu full bài
- Chỉ tóm tắt + link nguồn
- Respect copyright

---

## 14. Data Sources & Crawling Strategy (Vietnam)

### 14.1 Source Inventory (Production-ready)

#### A. News (RSS – ưu tiên)

```
VnExpress:
- https://vnexpress.net/rss

Tuổi Trẻ:
- https://tuoitre.vn/rss.htm

Thanh Niên:
- https://thanhnien.vn/rss/home.rss

Zing News:
- https://zingnews.vn/rss.html
```

---

#### B. Business / Finance

```
CafeBiz:
- https://cafebiz.vn/rss.chn

CafeF:
- https://cafef.vn/rss.chn
```

---

#### C. Community / Insight

```
Spiderum:
- (crawl HTML)

Medium:
- https://medium.com/feed/tag/vietnam
```

---

#### D. Social (API-based – optional)

- Reddit API
- YouTube Data API
- TikTok (3rd party / unofficial)

---

### 14.2 Crawling Architecture

```
Scheduler (cron)
    ↓
RSS Fetcher
    ↓
Queue (Redis)
    ↓
Worker (crawl + clean)
    ↓
AI Processing
    ↓
Database
```

---

### 14.3 RSS Crawling (Recommended)

#### Python Example

```python
import feedparser

url = "https://vnexpress.net/rss"
feed = feedparser.parse(url)

for entry in feed.entries:
    print(entry.title)
    print(entry.link)
```

#### Notes
- Fast, stable
- Structured data
- No parsing HTML needed

---

### 14.4 Full Article Crawling

#### Using newspaper3k

```python
from newspaper import Article

url = "https://vnexpress.net/..."
article = Article(url)
article.download()
article.parse()

print(article.text)
```

---

### 14.5 HTML Parsing (Fallback)

#### Using BeautifulSoup

```python
import requests
from bs4 import BeautifulSoup

res = requests.get(url)
soup = BeautifulSoup(res.text, "html.parser")

content = soup.find("article")
print(content.text)
```

---

### 14.6 Deduplication Logic

- Hash theo URL
- Hash theo title
- Similarity check (optional)

```python
import hashlib

hash_id = hashlib.md5(url.encode()).hexdigest()
```

---

### 14.7 Scheduling Strategy

- RSS crawl: mỗi 10–15 phút
- Full article: async queue

Tools:
- cron
- Celery

---

### 14.8 Rate Limiting & Politeness

- Delay requests (1–3s)
- User-Agent header
- Retry logic

```python
headers = {
    "User-Agent": "Mozilla/5.0"
}
```

---

### 14.9 Error Handling

- Timeout
- Broken HTML
- Missing content

Fallback:
- Store title only
- Retry later

---

### 14.10 Data Normalization

Standard format:

```
{
  title: string,
  content: string,
  url: string,
  source: string,
  published_at: datetime
}
```

---

### 14.11 Storage Strategy

- Raw content (optional)
- Cleaned text
- AI summary

---

### 14.12 Legal & Compliance

- Không lưu full HTML nếu không cần
- Chỉ hiển thị summary + link
- Respect robots.txt

---

## 15. Crawler Service (FastAPI + Celery + Redis)

### 15.1 Overview

Kiến trúc crawler production-ready gồm:

```
FastAPI (API)
   ↓
Redis (Broker + Cache)
   ↓
Celery Workers (Crawl + Process)
   ↓
PostgreSQL (Storage)
```

---

### 15.2 Tech Stack

- FastAPI → API layer
- Celery → background jobs
- Redis → message broker
- PostgreSQL → database
- feedparser → RSS
- newspaper3k → article parsing

---

### 15.3 Project Structure

```
app/
 ├── main.py
 ├── celery_app.py
 ├── tasks/
 │    ├── crawl.py
 │    └── process.py
 ├── services/
 │    ├── rss.py
 │    └── parser.py
 ├── models/
 └── db/
```

---

### 15.4 Celery Setup

#### celery_app.py

```python
from celery import Celery

celery_app = Celery(
    "worker",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1"
)

celery_app.conf.task_routes = {
    "tasks.crawl.*": {"queue": "crawl"},
    "tasks.process.*": {"queue": "process"},
}
```

---

### 15.5 RSS Fetch Task

#### tasks/crawl.py

```python
from app.celery_app import celery_app
import feedparser

@celery_app.task
def fetch_rss(url):
    feed = feedparser.parse(url)
    articles = []

    for entry in feed.entries:
        articles.append({
            "title": entry.title,
            "url": entry.link
        })

    return articles
```

---

### 15.6 Article Processing Task

#### tasks/process.py

```python
from app.celery_app import celery_app
from newspaper import Article

@celery_app.task
def process_article(url):
    article = Article(url)
    article.download()
    article.parse()

    return {
        "title": article.title,
        "content": article.text
    }
```

---

### 15.7 FastAPI Integration

#### main.py

```python
from fastapi import FastAPI
from app.tasks.crawl import fetch_rss

app = FastAPI()

@app.get("/crawl")
def crawl():
    task = fetch_rss.delay("https://vnexpress.net/rss")
    return {"task_id": task.id}
```

---

### 15.8 Workflow

```
1. API trigger / cron
2. fetch_rss task
3. push URLs → process_article
4. parse content
5. store DB
```

---

### 15.9 Scheduler (Celery Beat)

```python
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "crawl-every-10-min": {
        "task": "tasks.crawl.fetch_rss",
        "schedule": crontab(minute="*/10"),
        "args": ("https://vnexpress.net/rss",)
    }
}
```

---

### 15.10 Run Services

#### Start Redis
```
redis-server
```

#### Start Celery Worker
```
celery -A app.celery_app worker -Q crawl,process --loglevel=info
```

#### Start Celery Beat
```
celery -A app.celery_app beat
```

#### Start FastAPI
```
uvicorn app.main:app --reload
```

---

### 15.11 Scaling Strategy

- Multiple workers
- Separate queues (crawl vs process)
- Horizontal scaling via Docker

---

### 15.12 Improvements

- Add retry logic
- Add timeout handling
- Add logging
- Add deduplication layer

---

## 16. Deduplication Module (Plug into Celery Pipeline)

### 16.1 Goals
- Loại bỏ bài trùng theo URL, title, nội dung
- Gom nhóm (cluster) các bài cùng một tin
- Tối ưu hiệu năng (chỉ so sánh trong cửa sổ thời gian gần)

---

### 16.2 Dependencies

```bash
pip install sentence-transformers scikit-learn numpy
```

---

### 16.3 Data Model (simplified)

```sql
-- articles
id (pk)
url_hash (unique)
title
content
embedding (vector)
cluster_id
created_at

-- clusters
id (pk)
centroid_embedding (vector)
representative_article_id
created_at
```

---

### 16.4 Config

```python
# app/config/dedup.py
WINDOW_HOURS = 48
TITLE_SIM_THRESHOLD = 0.8
EMBED_SIM_THRESHOLD = 0.8
MAX_CANDIDATES = 200  # limit comparisons per article
```

---

### 16.5 Utilities

```python
# app/services/dedup/utils.py
import hashlib
from difflib import SequenceMatcher

def url_hash(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()


def title_sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a or "", b or "").ratio()
```

---

### 16.6 Embedding Service

```python
# app/services/dedup/embedding.py
from sentence_transformers import SentenceTransformer

_model = None


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model


def encode(text: str):
    model = get_model()
    return model.encode(text or "", normalize_embeddings=True)
```

---

### 16.7 Similarity (cosine)

```python
# app/services/dedup/similarity.py
import numpy as np


def cos_sim(a, b) -> float:
    # assume normalized vectors
    return float(np.dot(a, b))
```

---

### 16.8 Candidate Fetch (time-window)

```python
# app/services/dedup/repo.py
from datetime import datetime, timedelta


def fetch_recent_articles(db, hours: int, limit: int):
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    return db.get_articles(created_after=cutoff, limit=limit)


def get_by_url_hash(db, url_hash: str):
    return db.get_article_by_url_hash(url_hash)


def create_cluster(db, centroid, rep_id):
    return db.insert_cluster(centroid_embedding=centroid, representative_article_id=rep_id)


def update_cluster_centroid(db, cluster_id, new_centroid):
    return db.update_cluster(cluster_id, centroid_embedding=new_centroid)
```

---

### 16.9 Core Dedup Logic

```python
# app/services/dedup/core.py
from .utils import url_hash, title_sim
from .embedding import encode
from .similarity import cos_sim
from .repo import fetch_recent_articles, get_by_url_hash, create_cluster, update_cluster_centroid
from app.config.dedup import (
    WINDOW_HOURS, TITLE_SIM_THRESHOLD, EMBED_SIM_THRESHOLD, MAX_CANDIDATES
)


def dedup_and_cluster(db, article: dict):
    """
    article: {url, title, content}
    returns: {is_duplicate: bool, cluster_id: int | None, embedding}
    """
    # 1) URL check
    uhash = url_hash(article['url'])
    if get_by_url_hash(db, uhash):
        return {"is_duplicate": True, "cluster_id": None, "embedding": None}

    # 2) prepare embedding once
    emb = encode((article.get('title','') + '
' + article.get('content',''))[:4000])

    # 3) fetch candidates (recent window)
    candidates = fetch_recent_articles(db, WINDOW_HOURS, MAX_CANDIDATES)

    best_match = None
    best_score = 0.0

    for c in candidates:
        # quick title filter
        if title_sim(article.get('title',''), c.title) >= TITLE_SIM_THRESHOLD:
            return {"is_duplicate": True, "cluster_id": c.cluster_id, "embedding": emb}

        # embedding similarity
        if c.embedding is None:
            continue
        score = cos_sim(emb, c.embedding)
        if score > best_score:
            best_score = score
            best_match = c

    # 4) decide duplicate by embedding
    if best_match and best_score >= EMBED_SIM_THRESHOLD:
        return {"is_duplicate": True, "cluster_id": best_match.cluster_id, "embedding": emb}

    # 5) create new cluster (or attach to nearest if you prefer)
    cluster_id = create_cluster(db, centroid=emb, rep_id=None)
    return {"is_duplicate": False, "cluster_id": cluster_id, "embedding": emb}
```

---

### 16.10 Update Cluster (online centroid)

```python
# app/services/dedup/cluster.py
import numpy as np


def update_centroid(old_centroid, new_vec, n_items: int):
    # running average: C_new = (C_old*(n-1) + v) / n
    if old_centroid is None:
        return new_vec
    return (old_centroid * (n_items - 1) + new_vec) / n_items
```

---

### 16.11 Celery Integration

```python
# app/tasks/process.py
from app.celery_app import celery_app
from app.services.dedup.core import dedup_and_cluster
from app.services.dedup.cluster import update_centroid

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=5, max_retries=3)
def process_article(self, url):
    article = parse_article(url)  # existing parser

    # dedup
    result = dedup_and_cluster(db, article)

    if result['is_duplicate']:
        # optionally link to cluster only, skip storing full
        return {"status": "duplicate", "cluster_id": result['cluster_id']}

    # save new article
    article_id = db.insert_article(
        url=article['url'],
        title=article['title'],
        content=article['content'],
        url_hash=url_hash(article['url']),
        embedding=result['embedding'],
        cluster_id=result['cluster_id']
    )

    # update cluster centroid (optional)
    cluster = db.get_cluster(result['cluster_id'])
    n = db.count_articles_in_cluster(cluster.id) + 1
    new_centroid = update_centroid(cluster.centroid_embedding, result['embedding'], n)
    db.update_cluster(cluster.id, centroid_embedding=new_centroid, representative_article_id=cluster.representative_article_id or article_id)

    return {"status": "stored", "article_id": article_id, "cluster_id": result['cluster_id']}
```

---

### 16.12 Indexing & Performance

- Chỉ so sánh trong WINDOW_HOURS
- Giới hạn MAX_CANDIDATES
- Lưu embedding dạng float32
- Tùy chọn: dùng FAISS để tìm nearest neighbor nhanh

---

### 16.13 Testing

```python
# tests/test_dedup.py

def test_duplicate_same_content():
    a = {"url":"u1","title":"A","content":"hello world"}
    b = {"url":"u2","title":"B","content":"hello world"}
    r1 = dedup_and_cluster(db, a)
    assert not r1['is_duplicate']
    r2 = dedup_and_cluster(db, b)
    assert r2['is_duplicate']
```

---

### 16.14 Observability

- Log: decision (url/title/embedding)
- Metrics: duplicate_rate, avg_similarity, cluster_size

---

## 17. Monetization Strategy

### 17.1 Overview

Ứng dụng thuộc nhóm content + AI → kiếm tiền dựa trên:
- Attention (lượt đọc)
- Intent (nhu cầu học, kiếm tiền, mua sản phẩm)

---

### 17.2 Native Ads (Primary - Easy)

**Description:**
- Chèn quảng cáo vào feed dạng card (giống content)

**Implementation:**
- 1 ads / 5–7 bài
- Label: "Sponsored"

**Pros:**
- Dễ triển khai
- Scale tốt

**Cons:**
- CPM thấp tại VN

---

### 17.3 Affiliate Marketing (Main Revenue)

**Description:**
- Gắn link sản phẩm / khóa học / tool

**Use cases:**
- AI tools
- Khóa học online
- E-commerce

**Flow:**
```
User đọc content → thấy recommendation → click → mua → nhận commission
```

**Why effective:**
- User có intent cao
- Fit với nội dung app

---

### 17.4 Subscription (Premium)

**Free:**
- Summary ngắn

**Premium:**
- Phân tích sâu
- Multi-source
- AI insights

**Note:**
- Khó scale tại VN
- Triển khai sau khi có user base

---

### 17.5 Sponsored Content

**Description:**
- Brand trả tiền để xuất hiện như bài viết

**Requirements:**
- Label rõ "Sponsored"
- Giữ chất lượng content

---

### 17.6 Data Monetization (B2B)

**Assets:**
- Trend Gen Z
- Hành vi đọc

**Customers:**
- Agency
- Brand

**Products:**
- Trend reports
- Insight dashboards

---

### 17.7 Revenue Strategy by Stage

**Phase 1 (0–10k users):**
- No monetization / very light ads

**Phase 2 (10k–100k users):**
- Native ads
- Start affiliate

**Phase 3 (100k+ users):**
- Scale affiliate
- Sponsored content
- B2B data

---

### 17.8 Metrics to Track

- CTR (ads / affiliate)
- Conversion rate
- Revenue per user (ARPU)
- Retention vs ads density

---

### 17.9 Risks

- Over-monetization → mất user
- Low-quality ads → mất trust
- Sai target → low conversion

---

## 18. Unit Economics (Vietnam Market)

### 18.1 Assumptions

**User metrics:**
- DAU: 100,000
- Sessions per user/day: 2
- Articles per session: 5

→ Total views/day = 100,000 × 2 × 5 = 1,000,000 impressions

---

### 18.2 Revenue Streams Calculation

#### A. Native Ads

**Assumptions:**
- Ads frequency: 1 per 5 articles → 20% impressions
- Ad impressions/day = 200,000
- CPM (VN): $0.5 – $2

**Revenue:**
```
Low: 200,000 / 1000 × 0.5 = $100/day
High: 200,000 / 1000 × 2 = $400/day
```

→ Monthly: ~$3,000 – $12,000

---

#### B. Affiliate

**Assumptions:**
- CTR: 2%
- Conversion rate: 3%
- Commission: $2/order

**Calculation:**
```
Clicks = 1,000,000 × 2% = 20,000
Orders = 20,000 × 3% = 600
Revenue = 600 × $2 = $1,200/day
```

→ Monthly: ~$36,000

---

#### C. Sponsored Content

**Assumptions:**
- 2 deals/week
- $200–500 per post

→ Monthly: ~$1,600 – $4,000

---

### 18.3 Total Revenue Estimate

```
Ads:        $3k – $12k
Affiliate:  ~$36k
Sponsored:  $1.6k – $4k
-------------------------
Total:      ~$40k – $50k/month
```

---

### 18.4 Cost Structure

#### Fixed Costs

- Server (API + DB + Redis): $200 – $500
- AI inference (local/free): ~$0 – $300

#### Variable Costs

- Bandwidth: $100 – $300
- Monitoring/logging: $50 – $100

→ Total cost: ~$500 – $1,000/month

---

### 18.5 Profitability

```
Revenue: ~$40k
Cost:    ~$1k
----------------
Profit:  ~$39k/month
```

---

### 18.6 CAC & LTV

#### CAC (User Acquisition Cost)

- Paid ads VN: $0.2 – $1 / user

#### LTV (Lifetime Value)

Assume:
- ARPU: $0.3/month
- Lifetime: 6 months

```
LTV = $1.8
```

→ LTV > CAC → sustainable

---

### 18.7 Key Levers to Improve

- Increase CTR (better UI)
- Improve conversion (better targeting)
- Increase retention (more sessions)

---

### 18.8 Risks

- Overestimate affiliate conversion
- Low ad fill rate
- User churn

---

## 19. Conclusion

Trong thị trường Việt Nam, affiliate là nguồn revenue chính, ads đóng vai trò ổn định. Với chi phí thấp và scale user tốt, mô hình có thể đạt profitability cao nếu tối ưu retention và conversion.

