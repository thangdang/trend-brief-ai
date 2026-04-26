#!/bin/bash
# ═══════════════════════════════════════════
#  TrendBrief AI — MongoDB Backup Script
#  Usage: ./scripts/backup.sh
#  Or: npm run backup
#
#  Backs up MongoDB to a compressed archive.
#  Upload to S3/R2 if AWS CLI is configured.
# ═══════════════════════════════════════════

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/trendbriefai-backup-$DATE"
ARCHIVE="$BACKUP_DIR.tar.gz"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/trendbriefai}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"

echo "📦 Starting backup at $DATE"
echo "   MongoDB: $MONGODB_URI"

# 1. Dump MongoDB
echo "🔄 Running mongodump..."
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR" --quiet

# 2. Compress
echo "🗜️  Compressing..."
tar -czf "$ARCHIVE" -C /tmp "trendbriefai-backup-$DATE"

FILESIZE=$(du -h "$ARCHIVE" | cut -f1)
echo "✅ Backup created: $ARCHIVE ($FILESIZE)"

# 3. Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ]; then
  echo "☁️  Uploading to s3://$S3_BUCKET/backups/daily/$DATE.tar.gz"
  aws s3 cp "$ARCHIVE" "s3://$S3_BUCKET/backups/daily/$DATE.tar.gz" --quiet
  echo "✅ Uploaded to S3"
else
  echo "ℹ️  S3 not configured (set BACKUP_S3_BUCKET to enable)"
fi

# 4. Cleanup local
rm -rf "$BACKUP_DIR"
echo "🧹 Cleaned up temp directory"

# Keep only last 7 local backups
LOCAL_BACKUPS=$(ls -t /tmp/trendbriefai-backup-*.tar.gz 2>/dev/null | tail -n +8)
if [ -n "$LOCAL_BACKUPS" ]; then
  echo "$LOCAL_BACKUPS" | xargs rm -f
  echo "🧹 Removed old local backups"
fi

echo "✅ Backup complete: $DATE"
