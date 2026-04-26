# TrendBrief AI — Backup & Restore Guide

## Backup

### Manual Backup
```bash
# Run backup script
./scripts/backup.sh

# Or via npm
npm run backup
```

### Automated Backup
The backup runs daily at 3 AM UTC via system crontab:
```bash
# Add to crontab
crontab -e
0 3 * * * /path/to/trend-brief-ai/scripts/backup.sh >> /var/log/trendbriefai-backup.log 2>&1
```

### S3 Upload (Optional)
Set `BACKUP_S3_BUCKET` environment variable to enable S3 upload:
```bash
export BACKUP_S3_BUCKET=trendbriefai-backups
./scripts/backup.sh
```

## Restore

### From Local Backup
```bash
# 1. Extract backup
tar -xzf /tmp/trendbriefai-backup-YYYYMMDD_HHMMSS.tar.gz -C /tmp

# 2. Restore to MongoDB
mongorestore --uri="mongodb://localhost:27017/trendbriefai" \
  --drop \
  /tmp/trendbriefai-backup-YYYYMMDD_HHMMSS/trendbriefai

# 3. Verify
mongosh mongodb://localhost:27017/trendbriefai --eval "db.articles.countDocuments()"
```

### From S3
```bash
# 1. Download from S3
aws s3 cp s3://trendbriefai-backups/backups/daily/YYYYMMDD_HHMMSS.tar.gz /tmp/

# 2. Extract and restore (same as above)
```

### Quick Verify (Post-Restore)

Run these checks immediately after any restore to confirm data integrity:

```bash
# 1. Check all 19 collections exist and have data
mongosh mongodb://localhost:27017/trendbriefai --eval "
  const expected = [
    'users', 'articles', 'clusters', 'bookmarks', 'interactions',
    'rss_sources', 'topics', 'device_tokens', 'notification_logs',
    'ads', 'affiliate_links', 'analytics', 'payments', 'subscriptions',
    'reactions', 'referrals', 'article_reports', 'user_activities',
    'summary_feedback'
  ];
  const actual = db.getCollectionNames();
  expected.forEach(c => {
    const count = db[c].countDocuments();
    print(actual.includes(c) ? '✅' : '❌', c + ':', count, 'docs');
  });
"

# 2. Verify indexes are intact
mongosh mongodb://localhost:27017/trendbriefai --eval "
  print('articles indexes:', JSON.stringify(db.articles.getIndexes().map(i => i.name)));
  print('users indexes:', JSON.stringify(db.users.getIndexes().map(i => i.name)));
  print('bookmarks indexes:', JSON.stringify(db.bookmarks.getIndexes().map(i => i.name)));
"

# 3. Verify services can connect
curl http://localhost:3000/health   # Backend
curl http://localhost:8000/health   # AI Engine
curl http://localhost:7700/health   # Meilisearch

# 4. Verify feed returns data
curl http://localhost:3000/api/public/feed?page=1&limit=5
```

## Retention Policy

| Type | Retention | Location |
|------|-----------|----------|
| Local | Last 7 backups | `/tmp/trendbriefai-backup-*.tar.gz` |
| S3 Daily | 7 days | `s3://bucket/backups/daily/` |
| S3 Weekly | 4 weeks | Configure via S3 Lifecycle Rules |
| S3 Monthly | 3 months | Configure via S3 Lifecycle Rules |

## S3 Lifecycle Rules
```json
{
  "Rules": [
    {
      "ID": "daily-cleanup",
      "Prefix": "backups/daily/",
      "Status": "Enabled",
      "Expiration": { "Days": 7 }
    }
  ]
}
```

## Meilisearch Data

Meilisearch stores its index data in the `meili-data` Docker volume. After a MongoDB restore, re-index articles into Meilisearch:

```bash
# Trigger a full re-index via the backend API (if available)
curl -X POST http://localhost:3000/api/admin/reindex-search

# Or manually dump/restore the Meilisearch volume:
docker exec trendbriefai-meili meilisearch --dump-dir /meili_data/dumps --create-dump
docker cp trendbriefai-meili:/meili_data/dumps/ ./meili-dumps/
```
