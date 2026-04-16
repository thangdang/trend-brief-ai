# TrendBrief AI – Deploy Guide

## Mục lục
1. [Deploy VPS (Docker Compose)](#1-deploy-vps)
2. [Deploy Hybrid: Local PC + VPS ⭐ RECOMMENDED](#2-deploy-hybrid)
3. [Deploy Mobile (Play Store / App Store)](#3-deploy-mobile)
4. [CI/CD Pipeline](#4-cicd)
5. [Monitoring](#5-monitoring)

---

## 1. Deploy VPS

### Yêu cầu VPS

| Spec | Minimum | Recommended |
|------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB (cho Ollama) |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04+ | Ubuntu 24.04 |

### Bước 1: Chuẩn bị VPS

```bash
ssh root@your-vps-ip
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin nginx certbot python3-certbot-nginx -y

adduser deploy
usermod -aG docker deploy
su - deploy
```

### Bước 2: Clone + config

```bash
git clone <your-repo> trend-brief-ai && cd trend-brief-ai
cp .env.example .env
nano .env
```

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://mongo:27017/trendbriefai
REDIS_URL=redis://redis:6379
AI_SERVICE_URL=http://trendbriefai-engine:8000
JWT_SECRET=<openssl rand -hex 32>
OLLAMA_URL=http://host.docker.internal:11434
```

### Bước 3: Cài Ollama trên VPS

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3
```

### Bước 4: Build + chạy

```bash
docker compose up -d --build
curl http://localhost:3000/health
curl http://localhost:8000/health
```

### Bước 5: Nginx + SSL

```nginx
server {
    listen 80;
    server_name api.trendbriefai.vn;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name app.trendbriefai.vn;
    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_set_header Host $host;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/trendbriefai /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d api.trendbriefai.vn -d app.trendbriefai.vn
```

### Bước 6: Firewall + Backup

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
```

MongoDB backup (cron hàng ngày 3:00 AM):
```bash
cat > /home/deploy/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d)
docker exec trendbriefai-mongo mongodump --out /dump
docker cp trendbriefai-mongo:/dump /home/deploy/backups/mongo_$DATE
find /home/deploy/backups -type d -mtime +30 -exec rm -rf {} +
EOF
chmod +x /home/deploy/backup.sh
crontab -l | { cat; echo "0 3 * * * /home/deploy/backup.sh"; } | crontab -
```

---

## 2. Deploy Hybrid: Local PC + VPS ⭐ RECOMMENDED

Chạy AI nặng (Ollama + sentence-transformers + crawl pipeline) trên máy cá nhân, phần còn lại trên VPS rẻ $24.

> Xem chi tiết network diagram: [06-hybrid-network.md](./06-hybrid-network.md)

### Phân chia workload

| Chạy ở đâu | Services | RAM cần |
|-------------|----------|---------|
| **Local PC** (Win 11, 16GB) | trendbriefai-engine (FastAPI + Ollama + sentence-transformers) | ~6–8 GB |
| **VPS $24** (2 vCPU, 4GB) | trendbriefai-service + trendbriefai-ui + MongoDB + Redis | ~2–3 GB |

### Bước 1: Trên Local PC (Windows 11)

```powershell
# Cài Ollama
# Download từ https://ollama.com/download/windows
ollama pull llama3

# Chạy trendbriefai-engine
cd trend-brief-ai\trendbriefai-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Start AI service
$env:OLLAMA_URL = "http://localhost:11434"
$env:MONGODB_URI = "mongodb://<vps-ip>:27017/trendbriefai"
uvicorn api:app --host 0.0.0.0 --port 8000
```

### Bước 2: Expose AI service (Cloudflare Tunnel)

```powershell
# Cài cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:8000
# → Nhận URL dạng: https://xxx-yyy-zzz.trycloudflare.com
```

### Bước 3: Trên VPS DigitalOcean

```bash
git clone <repo> trend-brief-ai && cd trend-brief-ai
cp .env.example .env
```

Sửa `.env`:

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://mongo:27017/trendbriefai
REDIS_URL=redis://redis:6379

# ═══ TRỎ VỀ LOCAL PC qua Cloudflare Tunnel ═══
AI_SERVICE_URL=https://xxx-yyy-zzz.trycloudflare.com

JWT_SECRET=<openssl rand -hex 32>
```

Sửa `docker-compose.yml` — bỏ trendbriefai-engine (chạy trên local PC):

```yaml
services:
  mongo:
    image: mongo:7
    container_name: trendbriefai-mongo
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: trendbriefai
    volumes:
      - mongo-data:/data/db
      - ./database:/docker-entrypoint-initdb.d:ro
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: trendbriefai-redis
    ports:
      - "6379:6379"
    restart: unless-stopped

  # ❌ BỎ trendbriefai-engine — chạy trên local PC
  # trendbriefai-engine:
  #   build: ./trendbriefai-engine
  #   ...

  trendbriefai-service:
    build: ./trendbriefai-service
    container_name: trendbriefai-service
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  trendbriefai-ui:
    build: ./trendbriefai-ui
    container_name: trendbriefai-ui
    ports:
      - "4200:80"
    depends_on:
      - trendbriefai-service
    restart: unless-stopped

volumes:
  mongo-data:
```

```bash
docker compose up -d --build
```

### Bước 4: Verify

```bash
# VPS
curl http://localhost:3000/health

# Local PC (từ VPS qua tunnel)
curl https://xxx-yyy-zzz.trycloudflare.com/health
```

### So sánh chất lượng

| | PC Online (Ollama) | PC Offline (Fallback) |
|---|---|---|
| AI Summary | ✅ Ollama LLM (title + 3 bullets + reason) | Extractive (câu đầu = title, 3 câu đầu = bullets) |
| Topic Classification | ✅ Keyword-based (luôn hoạt động) | ✅ Keyword-based (luôn hoạt động) |
| Dedup Embedding | ✅ sentence-transformers (384-dim) | ❌ Chỉ URL hash + title similarity |
| Tốc độ | ~3–8s per article | ~0.5s per article |
| Chi phí | $0 | $0 |

### Lưu ý quan trọng

| Vấn đề | Giải pháp |
|--------|-----------|
| PC tắt → crawl vẫn chạy? | BullMQ job fail → retry 3 lần → skip. Crawl lại khi PC bật |
| IP nhà thay đổi | Cloudflare Tunnel (không cần IP tĩnh) |
| Bảo mật | Tunnel HTTPS encrypted, không expose port trực tiếp |
| MongoDB access từ PC | Mở port 27017 trên VPS firewall cho IP nhà, hoặc dùng SSH tunnel |

---

## 3. Deploy Mobile

### 2.1 Android — Google Play

```bash
cd trendbriefai-mobile
```

Đổi API URL production:
```dart
// lib/config/api_config.dart
static const String baseUrl = 'https://api.trendbriefai.vn/api';
```

Tạo keystore:
```bash
keytool -genkey -v -keystore ~/trendbriefai-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias trendbriefai
```

Build:
```bash
flutter build appbundle --release
# Output: build/app/outputs/bundle/release/app-release.aab
```

Upload Google Play Console:
1. https://play.google.com/console → New app
2. Name: "TrendBrief AI - Tin tức AI"
3. Category: News & Magazines
4. Upload .aab → Submit review (1-3 ngày)

### 2.2 iOS — App Store

Dùng Codemagic CI/CD (free tier: 500 build minutes/tháng):

1. Apple Developer Account ($99/năm)
2. App Store Connect: Bundle ID `vn.trendbriefai.app`
3. Codemagic → kết nối repo → cấu hình iOS signing
4. Push code → Codemagic build → upload TestFlight
5. Submit review (1-7 ngày)

---

## 4. CI/CD

GitHub Actions workflow:

```
Push main → Build 3 Docker images → SSH deploy VPS
```

### GitHub Secrets cần thiết:

| Secret | Mô tả |
|--------|-------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub password |
| `VPS_HOST` | IP VPS |
| `VPS_SSH_KEY` | SSH private key |

---

## 5. Monitoring

### Health checks (cron 5 phút):
```bash
*/5 * * * * curl -sf http://localhost:3000/health || echo "trendbriefai-service DOWN"
*/5 * * * * curl -sf http://localhost:8000/health || echo "trendbriefai-engine DOWN"
```

### Docker logs:
```bash
docker compose logs -f trendbriefai-service
docker compose logs --tail=100 trendbriefai-engine
```

---

## Checklist Production

- [ ] JWT_SECRET đã đổi (random 64 chars)
- [ ] NODE_ENV=production
- [ ] SSL certificate (Let's Encrypt)
- [ ] Firewall (22, 80, 443)
- [ ] MongoDB backup cron
- [ ] Ollama + model đã cài
- [ ] RSS sources đã seed (12 sources: 8 RSS + 2 HTML scrape + 1 Medium RSS)
- [ ] API URL đã đổi trong mobile app
- [ ] Android keystore đã tạo
- [ ] Apple Developer account (cho iOS)
- [ ] DNS trỏ về VPS
- [ ] Health check monitoring
