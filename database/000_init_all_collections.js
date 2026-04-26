// ═══════════════════════════════════════════════════════════════════════════════
//  MongoDB — Create ALL Collections + Indexes + Validation
//  TrendBrief AI — Comprehensive Database Initialization (19 collections)
//  Run: mongosh trendbriefai database/000_init_all_collections.js
//  Or:  mongosh mongodb://localhost:27017/trendbriefai < database/000_init_all_collections.js
//
//  This script is idempotent — it drops and recreates all collections.
//  DO NOT run in production without backup!
// ═══════════════════════════════════════════════════════════════════════════════

db = db.getSiblingDB('trendbriefai');

// ─── Topic enum shared across collections ───
const TOPIC_ENUM = ['ai', 'finance', 'lifestyle', 'drama', 'technology', 'career', 'health', 'entertainment', 'sport', 'insight'];

// ─── Drop existing collections (dev only) ───
const ALL_COLLECTIONS = [
  'users', 'articles', 'clusters', 'bookmarks', 'interactions',
  'rss_sources', 'topics', 'device_tokens', 'notification_logs',
  'ads', 'affiliate_links', 'analytics', 'article_reports',
  'referrals', 'payments', 'subscriptions', 'reactions',
  'user_feedbacks', 'user_activities'
];
ALL_COLLECTIONS.forEach(c => { try { db[c].drop(); } catch(e) {} });

print('');
print('═══════════════════════════════════════════════════════════════');
print('  TrendBrief AI — Database Initialization');
print('═══════════════════════════════════════════════════════════════');
print('');

// ═══════════════════════════════════════════════════════════════════════════════
//  1. USERS
//  User accounts with email/SSO auth, interests, referral, streak, premium
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'created_at', 'updated_at'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$',
          description: 'Valid email address (unique)'
        },
        password_hash: {
          bsonType: ['string', 'null'],
          description: 'Bcrypt hashed password (null for SSO users)'
        },
        name: {
          bsonType: 'string',
          description: 'Display name'
        },
        provider: {
          bsonType: 'string',
          enum: ['email', 'google', 'apple'],
          description: 'Authentication provider'
        },
        google_id: {
          bsonType: ['string', 'null'],
          description: 'Google OAuth sub ID'
        },
        apple_id: {
          bsonType: ['string', 'null'],
          description: 'Apple Sign In sub ID'
        },
        avatar_url: {
          bsonType: ['string', 'null'],
          description: 'Profile avatar URL'
        },
        interests: {
          bsonType: 'array',
          items: { bsonType: 'string', enum: TOPIC_ENUM },
          description: 'Array of subscribed topic keys'
        },
        onboarding_completed: {
          bsonType: 'bool',
          description: 'Whether user finished onboarding flow'
        },
        notifications_enabled: {
          bsonType: 'bool',
          description: 'Global push notification toggle'
        },
        notification_prefs: {
          bsonType: 'object',
          properties: {
            trending: { bsonType: 'bool' },
            topic:    { bsonType: 'bool' },
            daily:    { bsonType: 'bool' },
            weekly:   { bsonType: 'bool' }
          },
          description: 'Per-type notification preferences'
        },
        settings: {
          bsonType: 'object',
          properties: {
            theme: { bsonType: 'string', enum: ['light', 'dark', 'system'] }
          },
          description: 'User settings (theme, etc.)'
        },
        is_banned: { bsonType: 'bool' },
        is_suspended: { bsonType: 'bool' },
        referral_code: {
          bsonType: ['string', 'null'],
          description: 'Unique referral code (e.g. NGUYENA_TB)'
        },
        referred_by: {
          bsonType: ['string', 'null'],
          description: 'Referral code used during signup'
        },
        referral_count: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of successful referrals'
        },
        premium_until: {
          bsonType: ['date', 'null'],
          description: 'Premium subscription expiry date'
        },
        trial_used: {
          bsonType: 'bool',
          description: 'Whether free trial has been used'
        },
        streak_count: {
          bsonType: 'int',
          minimum: 0,
          description: 'Consecutive daily active days'
        },
        last_active_date: {
          bsonType: ['date', 'null'],
          description: 'Last date user was active (for streak calc)'
        },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ google_id: 1 }, { unique: true, sparse: true });
db.users.createIndex({ apple_id: 1 }, { unique: true, sparse: true });
db.users.createIndex({ referral_code: 1 }, { unique: true, sparse: true });
print('  ✅ 1/19  users');


// ═══════════════════════════════════════════════════════════════════════════════
//  2. ARTICLES
//  Crawled & AI-processed news articles with summaries, embeddings, scores
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('articles', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['url', 'url_hash', 'title_original', 'source', 'processing_status', 'created_at'],
      properties: {
        url: {
          bsonType: 'string',
          minLength: 1,
          description: 'Original article URL (unique)'
        },
        url_hash: {
          bsonType: 'string',
          minLength: 32,
          maxLength: 32,
          description: 'MD5 hash of URL for O(1) dedup lookup'
        },
        title_original: {
          bsonType: 'string',
          minLength: 1,
          description: 'Original article title from source'
        },
        title_ai: {
          bsonType: 'string',
          description: 'AI-rewritten title (≤12 Vietnamese words)'
        },
        summary_bullets: {
          bsonType: 'array',
          minItems: 3,
          maxItems: 3,
          items: { bsonType: 'string' },
          description: 'Exactly 3 bullet-point summary strings'
        },
        reason: {
          bsonType: 'string',
          description: '"Why you should care" sentence'
        },
        content_clean: {
          bsonType: 'string',
          description: 'Cleaned article text (newspaper3k + BeautifulSoup)'
        },
        topic: {
          bsonType: 'string',
          enum: TOPIC_ENUM,
          description: 'AI-classified topic category'
        },
        source: {
          bsonType: 'string',
          minLength: 1,
          description: 'Source identifier (vnexpress, tuoitre, etc.)'
        },
        published_at: {
          bsonType: 'date',
          description: 'Original publication date from RSS/HTML'
        },
        embedding: {
          bsonType: 'array',
          items: { bsonType: 'double' },
          description: '384-dim float vector from all-MiniLM-L6-v2'
        },
        cluster_id: {
          bsonType: 'objectId',
          description: 'Reference to clusters collection (dedup group)'
        },
        processing_status: {
          bsonType: 'string',
          enum: ['pending', 'processing', 'done', 'failed', 'fallback'],
          description: 'Pipeline processing status'
        },
        quality_score: {
          bsonType: 'double',
          description: 'Content quality score [0.0–1.0]'
        },
        feed_score: {
          bsonType: 'double',
          description: 'Computed feed ranking score'
        },
        image_url: {
          bsonType: 'string',
          description: 'Article thumbnail/hero image URL'
        },
        is_sponsored: {
          bsonType: 'bool',
          description: 'Whether this is a sponsored article'
        },
        sponsor_name: { bsonType: 'string' },
        sponsor_url: { bsonType: 'string' },
        report_count: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of user reports (auto-hide at 3+)'
        },
        ai_provider: {
          bsonType: 'string',
          description: 'AI model used for summarization (ollama, etc.)'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.articles.createIndex({ url: 1 }, { unique: true });
db.articles.createIndex({ url_hash: 1 }, { unique: true });
db.articles.createIndex({ topic: 1 });
db.articles.createIndex({ created_at: -1 });
db.articles.createIndex({ source: 1 });
db.articles.createIndex({ processing_status: 1 });
db.articles.createIndex({ feed_score: -1 });
// Compound indexes for feed queries
db.articles.createIndex({ processing_status: 1, topic: 1, feed_score: -1 });
db.articles.createIndex({ processing_status: 1, feed_score: -1 });
db.articles.createIndex({ processing_status: 1, topic: 1, created_at: -1 });
db.articles.createIndex({ processing_status: 1, created_at: -1 });
// Text index for full-text search (Vietnamese)
db.articles.createIndex({ title_original: 'text', title_ai: 'text' }, { name: 'articles_text_search' });
print('  ✅ 2/19  articles');

// ═══════════════════════════════════════════════════════════════════════════════
//  3. CLUSTERS
//  Deduplication clusters — groups of similar articles by embedding cosine
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('clusters', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['article_count', 'created_at'],
      properties: {
        centroid_embedding: {
          bsonType: 'array',
          items: { bsonType: 'double' },
          description: 'Cluster centroid embedding vector (384-dim)'
        },
        representative_article_id: {
          bsonType: 'objectId',
          description: 'Reference to the best article in this cluster'
        },
        article_count: {
          bsonType: 'int',
          minimum: 1,
          description: 'Number of articles in this cluster'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
print('  ✅ 3/19  clusters');

// ═══════════════════════════════════════════════════════════════════════════════
//  4. BOOKMARKS
//  User bookmarks — unique per user+article pair, idempotent toggle
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('bookmarks', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'article_id', 'created_at'],
      properties: {
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        article_id: {
          bsonType: 'objectId',
          description: 'Reference to articles collection'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.bookmarks.createIndex({ user_id: 1, article_id: 1 }, { unique: true });
db.bookmarks.createIndex({ user_id: 1, created_at: -1 });
print('  ✅ 4/19  bookmarks');


// ═══════════════════════════════════════════════════════════════════════════════
//  5. INTERACTIONS
//  User actions: view, click_original, share, bookmark, read
//  TTL: 180 days — auto-delete old interaction data
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('interactions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'article_id', 'action', 'created_at'],
      properties: {
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        article_id: {
          bsonType: 'objectId',
          description: 'Reference to articles collection'
        },
        action: {
          bsonType: 'string',
          enum: ['view', 'click_original', 'share', 'bookmark', 'read'],
          description: 'Type of user interaction'
        },
        duration_seconds: {
          bsonType: 'int',
          minimum: 0,
          description: 'Time spent reading (seconds)'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.interactions.createIndex({ user_id: 1, created_at: -1 });
db.interactions.createIndex({ article_id: 1 });
// TTL index: auto-delete interactions older than 180 days
db.interactions.createIndex({ created_at: 1 }, { expireAfterSeconds: NumberInt(15552000), name: 'interactions_ttl_180d' });
print('  ✅ 5/19  interactions (TTL: 180 days)');

// ═══════════════════════════════════════════════════════════════════════════════
//  6. RSS_SOURCES
//  RSS feed configurations for crawling — 38+ Vietnamese news sources
//  Includes health tracking sub-document for auto-disable on failures
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('rss_sources', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'url', 'source_type', 'is_active', 'crawl_interval_minutes', 'created_at'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          description: 'Source display name (e.g. VnExpress Khoa học)'
        },
        url: {
          bsonType: 'string',
          minLength: 1,
          description: 'RSS feed URL or HTML page URL'
        },
        category: {
          bsonType: 'string',
          description: 'Maps to article topic (ai, finance, lifestyle, drama, etc.)'
        },
        source_type: {
          bsonType: 'string',
          enum: ['rss', 'html_scrape', 'api'],
          description: 'How to crawl this source'
        },
        is_active: {
          bsonType: 'bool',
          description: 'Whether this source is actively crawled'
        },
        crawl_interval_minutes: {
          bsonType: 'int',
          minimum: 1,
          description: 'Crawl frequency in minutes'
        },
        last_crawled_at: {
          bsonType: 'date',
          description: 'Last successful crawl timestamp'
        },
        scrape_link_selector: {
          bsonType: 'string',
          description: 'CSS selector for article links (html_scrape only)'
        },
        scrape_content_selector: {
          bsonType: 'string',
          description: 'CSS selector for article content (html_scrape only)'
        },
        health: {
          bsonType: 'object',
          properties: {
            success_count_24h:     { bsonType: 'int', minimum: 0 },
            total_count_24h:       { bsonType: 'int', minimum: 0 },
            success_rate:          { bsonType: 'double' },
            consecutive_failures:  { bsonType: 'int', minimum: 0 },
            last_successful_at:    { bsonType: 'date' },
            last_error:            { bsonType: 'string' },
            auto_disabled:         { bsonType: 'bool' },
            disabled_until:        { bsonType: 'date' }
          },
          description: 'Health tracking for auto-disable on repeated failures'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.rss_sources.createIndex({ is_active: 1 });
db.rss_sources.createIndex({ source_type: 1 });
print('  ✅ 6/19  rss_sources');

// ═══════════════════════════════════════════════════════════════════════════════
//  7. TOPICS
//  Dynamic topic categories — seeded via 003_seed_topics.js
//  key, label, icon (Material), color (hex), order, is_active
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('topics', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['key', 'label', 'icon', 'color', 'order', 'created_at'],
      properties: {
        key: {
          bsonType: 'string',
          minLength: 1,
          description: 'Unique topic key (lowercase, e.g. ai, finance)'
        },
        label: {
          bsonType: 'string',
          minLength: 1,
          description: 'Display label (Vietnamese, e.g. Tài chính)'
        },
        icon: {
          bsonType: 'string',
          minLength: 1,
          description: 'Material icon name (e.g. smart_toy)'
        },
        color: {
          bsonType: 'string',
          pattern: '^#[0-9A-Fa-f]{6}$',
          description: 'Hex color code (e.g. #2196F3)'
        },
        order: {
          bsonType: 'int',
          minimum: 1,
          description: 'Display order (1-based)'
        },
        is_active: {
          bsonType: 'bool',
          description: 'Whether topic is visible to users'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.topics.createIndex({ key: 1 }, { unique: true });
db.topics.createIndex({ order: 1 });
db.topics.createIndex({ is_active: 1 });
print('  ✅ 7/19  topics');


// ═══════════════════════════════════════════════════════════════════════════════
//  8. DEVICE_TOKENS
//  FCM push notification device tokens — one token per device
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('device_tokens', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'token', 'platform', 'created_at'],
      properties: {
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        token: {
          bsonType: 'string',
          minLength: 1,
          description: 'Firebase Cloud Messaging device token'
        },
        platform: {
          bsonType: 'string',
          enum: ['android', 'ios'],
          description: 'Device platform'
        },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});
db.device_tokens.createIndex({ user_id: 1 });
db.device_tokens.createIndex({ token: 1 }, { unique: true });
print('  ✅ 8/19  device_tokens');

// ═══════════════════════════════════════════════════════════════════════════════
//  9. NOTIFICATION_LOGS
//  Push notification delivery tracking — trending, daily/weekly digest, topic
//  TTL: 90 days — auto-delete old notification logs
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('notification_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'article_id', 'type', 'sent_at'],
      properties: {
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        article_id: {
          bsonType: 'objectId',
          description: 'Reference to articles collection'
        },
        type: {
          bsonType: 'string',
          enum: ['trending', 'daily_digest', 'weekly_digest', 'topic_update'],
          description: 'Notification type'
        },
        sent_at: {
          bsonType: 'date',
          description: 'When notification was sent'
        },
        delivered_at: {
          bsonType: 'date',
          description: 'When notification was delivered to device'
        },
        opened_at: {
          bsonType: 'date',
          description: 'When user opened the notification'
        }
      }
    }
  }
});
db.notification_logs.createIndex({ user_id: 1, sent_at: -1 });
db.notification_logs.createIndex({ user_id: 1, sent_at: 1 });  // For daily rate limit queries
// TTL index: auto-delete notification logs older than 90 days
db.notification_logs.createIndex({ sent_at: 1 }, { expireAfterSeconds: NumberInt(7776000), name: 'notification_logs_ttl_90d' });
print('  ✅ 9/19  notification_logs (TTL: 90 days)');

// ═══════════════════════════════════════════════════════════════════════════════
//  10. ADS
//  Native ad placements — injected every 5th position in feed
//  Tracks impressions, clicks, viewability, budget
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('ads', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'description', 'target_url', 'advertiser', 'topic', 'status', 'start_date', 'end_date', 'budget_cents', 'created_at'],
      properties: {
        title: {
          bsonType: 'string',
          minLength: 1,
          description: 'Ad headline'
        },
        description: {
          bsonType: 'string',
          minLength: 1,
          description: 'Ad body text'
        },
        image_url: {
          bsonType: 'string',
          description: 'Ad creative image URL'
        },
        target_url: {
          bsonType: 'string',
          minLength: 1,
          description: 'Click-through destination URL'
        },
        advertiser: {
          bsonType: 'string',
          minLength: 1,
          description: 'Advertiser name'
        },
        topic: {
          bsonType: 'string',
          enum: TOPIC_ENUM,
          description: 'Target topic for ad placement'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'paused', 'expired'],
          description: 'Ad campaign status'
        },
        start_date: { bsonType: 'date', description: 'Campaign start date' },
        end_date: { bsonType: 'date', description: 'Campaign end date' },
        impressions: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total impression count'
        },
        viewable_impressions: {
          bsonType: 'int',
          minimum: 0,
          description: 'Viewable impression count (IAB standard)'
        },
        clicks: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total click count'
        },
        budget_cents: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total budget in cents (VND)'
        },
        spent_cents: {
          bsonType: 'int',
          minimum: 0,
          description: 'Amount spent in cents (VND)'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.ads.createIndex({ status: 1, topic: 1 });
db.ads.createIndex({ end_date: 1 });
print('  ✅ 10/19 ads');


// ═══════════════════════════════════════════════════════════════════════════════
//  11. AFFILIATE_LINKS
//  Affiliate marketing links — topic-matched, injected into feed (max 2)
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('affiliate_links', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'url', 'topic', 'commission', 'provider', 'created_at'],
      properties: {
        title: {
          bsonType: 'string',
          minLength: 1,
          description: 'Affiliate link display title'
        },
        url: {
          bsonType: 'string',
          minLength: 1,
          description: 'Affiliate tracking URL'
        },
        topic: {
          bsonType: 'string',
          enum: TOPIC_ENUM,
          description: 'Target topic for link placement'
        },
        commission: {
          bsonType: 'string',
          description: 'Commission rate description (e.g. "5%", "50k/sale")'
        },
        provider: {
          bsonType: 'string',
          minLength: 1,
          description: 'Affiliate platform (Shopee, Lazada, Tiki, etc.)'
        },
        is_active: {
          bsonType: 'bool',
          description: 'Whether link is currently active'
        },
        impressions: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total impression count'
        },
        clicks: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total click count'
        },
        conversions: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total conversion count'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.affiliate_links.createIndex({ topic: 1, is_active: 1 });
print('  ✅ 11/19 affiliate_links');

// ═══════════════════════════════════════════════════════════════════════════════
//  12. ANALYTICS
//  Daily aggregated analytics — DAU, views, clicks, shares, ad/affiliate stats
//  One document per day (date string YYYY-MM-DD, unique)
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('analytics', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['date', 'created_at'],
      properties: {
        date: {
          bsonType: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'Date string YYYY-MM-DD (unique per day)'
        },
        total_views: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total article views for the day'
        },
        unique_users: {
          bsonType: 'int',
          minimum: 0,
          description: 'Daily active users (DAU)'
        },
        total_clicks: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total click_original actions'
        },
        total_shares: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total share actions'
        },
        total_bookmarks: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total bookmark actions'
        },
        ad_impressions: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total ad impressions for the day'
        },
        ad_clicks: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total ad clicks for the day'
        },
        affiliate_impressions: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total affiliate link impressions'
        },
        affiliate_clicks: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total affiliate link clicks'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.analytics.createIndex({ date: 1 }, { unique: true });
print('  ✅ 12/19 analytics');

// ═══════════════════════════════════════════════════════════════════════════════
//  13. ARTICLE_REPORTS
//  User-submitted article reports — 3+ reports = auto-hide for admin review
//  One report per user per article (unique compound)
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('article_reports', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['article_id', 'user_id', 'reason', 'created_at'],
      properties: {
        article_id: {
          bsonType: 'objectId',
          description: 'Reference to articles collection'
        },
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        reason: {
          bsonType: 'string',
          minLength: 1,
          description: 'Report reason text'
        },
        status: {
          bsonType: 'string',
          enum: ['pending', 'reviewed', 'dismissed'],
          description: 'Moderation review status'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.article_reports.createIndex({ article_id: 1 });
db.article_reports.createIndex({ user_id: 1, article_id: 1 }, { unique: true });
print('  ✅ 13/19 article_reports');


// ═══════════════════════════════════════════════════════════════════════════════
//  14. REFERRALS
//  Referral tracking — referrer invites referee, both get 7 days Premium
//  Cap: max 10 referrals/user/month
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('referrals', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['referrer_id', 'referee_id', 'code', 'created_at'],
      properties: {
        referrer_id: {
          bsonType: 'objectId',
          description: 'User who shared the referral code'
        },
        referee_id: {
          bsonType: 'objectId',
          description: 'User who signed up with the code'
        },
        code: {
          bsonType: 'string',
          minLength: 1,
          description: 'Referral code used (e.g. NGUYENA_TB)'
        },
        status: {
          bsonType: 'string',
          enum: ['pending', 'activated', 'rewarded'],
          description: 'Referral lifecycle status'
        },
        reward_granted: {
          bsonType: 'bool',
          description: 'Whether premium reward has been granted to both users'
        },
        activated_at: {
          bsonType: 'date',
          description: 'When referee completed signup'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.referrals.createIndex({ referrer_id: 1 });
db.referrals.createIndex({ referee_id: 1 }, { unique: true });  // One referral per referee
db.referrals.createIndex({ code: 1 });
print('  ✅ 14/19 referrals');

// ═══════════════════════════════════════════════════════════════════════════════
//  15. PAYMENTS
//  Payment transactions — MoMo, VNPay, Stripe, Apple IAP, Google Play
//  Tracks order lifecycle: pending → completed/failed/refunded
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('payments', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'order_id', 'amount', 'method', 'plan', 'created_at'],
      properties: {
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        order_id: {
          bsonType: 'string',
          minLength: 1,
          description: 'Unique order identifier (for payment provider reconciliation)'
        },
        plan: {
          bsonType: 'string',
          enum: ['pro_monthly', 'pro_yearly'],
          description: 'Subscription plan purchased'
        },
        amount: {
          bsonType: 'int',
          minimum: 0,
          description: 'Payment amount (in smallest currency unit)'
        },
        currency: {
          bsonType: 'string',
          description: 'Currency code (VND, USD, etc.)'
        },
        method: {
          bsonType: 'string',
          enum: ['momo', 'vnpay', 'stripe', 'apple_iap', 'google_play'],
          description: 'Payment method/provider'
        },
        status: {
          bsonType: 'string',
          enum: ['pending', 'completed', 'failed', 'refunded'],
          description: 'Payment status'
        },
        provider_transaction_id: {
          bsonType: ['string', 'null'],
          description: 'Transaction ID from payment provider'
        },
        metadata: {
          bsonType: 'object',
          description: 'Provider-specific metadata (webhook data, etc.)'
        },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});
db.payments.createIndex({ order_id: 1 }, { unique: true });
db.payments.createIndex({ user_id: 1 });
db.payments.createIndex({ user_id: 1, status: 1 });
print('  ✅ 15/19 payments');

// ═══════════════════════════════════════════════════════════════════════════════
//  16. SUBSCRIPTIONS
//  User subscription state — free, pro_monthly, pro_yearly
//  Tracks active/expired/cancelled/trial status with date ranges
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('subscriptions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'plan', 'starts_at', 'expires_at', 'created_at'],
      properties: {
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        plan: {
          bsonType: 'string',
          enum: ['free', 'pro_monthly', 'pro_yearly'],
          description: 'Subscription plan'
        },
        price: {
          bsonType: 'int',
          minimum: 0,
          description: 'Plan price (in smallest currency unit)'
        },
        payment_method: {
          bsonType: 'string',
          enum: ['momo', 'vnpay', 'apple_iap', 'google_play', 'stripe', 'referral', 'streak'],
          description: 'How this subscription was paid for'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'expired', 'cancelled', 'trial'],
          description: 'Subscription status'
        },
        trial_used: {
          bsonType: 'bool',
          description: 'Whether trial period has been used'
        },
        auto_renew: {
          bsonType: 'bool',
          description: 'Whether subscription auto-renews'
        },
        starts_at: {
          bsonType: 'date',
          description: 'Subscription start date'
        },
        expires_at: {
          bsonType: 'date',
          description: 'Subscription expiry date'
        },
        cancelled_at: {
          bsonType: ['date', 'null'],
          description: 'When subscription was cancelled (null if active)'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.subscriptions.createIndex({ user_id: 1, status: 1 });
print('  ✅ 16/19 subscriptions');


// ═══════════════════════════════════════════════════════════════════════════════
//  17. REACTIONS
//  Emoji reactions on articles — one reaction per user per article
//  Types: 🔥 (fire/hot), 😮 (wow), 😢 (sad), 😡 (angry)
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('reactions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['article_id', 'user_id', 'type', 'created_at'],
      properties: {
        article_id: {
          bsonType: 'objectId',
          description: 'Reference to articles collection'
        },
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        type: {
          bsonType: 'string',
          enum: ['🔥', '😮', '😢', '😡'],
          description: 'Emoji reaction type'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.reactions.createIndex({ article_id: 1 });
db.reactions.createIndex({ user_id: 1, article_id: 1 }, { unique: true });
print('  ✅ 17/19 reactions');

// ═══════════════════════════════════════════════════════════════════════════════
//  18. USER_FEEDBACKS
//  AI summary quality feedback — thumbs up/down per article
//  Supports both logged-in users (user_id) and anonymous (ip_hash)
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('user_feedbacks', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['article_id', 'rating', 'created_at'],
      properties: {
        article_id: {
          bsonType: 'objectId',
          description: 'Reference to articles collection'
        },
        user_id: {
          bsonType: ['objectId', 'null'],
          description: 'Reference to users collection (null for anonymous)'
        },
        rating: {
          bsonType: 'string',
          enum: ['up', 'down'],
          description: 'Feedback rating (thumbs up/down)'
        },
        reason: {
          bsonType: 'string',
          description: 'Optional reason for the rating'
        },
        ip_hash: {
          bsonType: 'string',
          description: 'SHA-256 hash of IP for anonymous dedup'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.user_feedbacks.createIndex({ article_id: 1, user_id: 1 }, { unique: true, sparse: true });
db.user_feedbacks.createIndex({ article_id: 1, ip_hash: 1 }, { unique: true, sparse: true });
db.user_feedbacks.createIndex({ created_at: -1 });
print('  ✅ 18/19 user_feedbacks');

// ═══════════════════════════════════════════════════════════════════════════════
//  19. USER_ACTIVITIES
//  Daily user activity tracking — one document per user per day
//  Used for DAU/MAU calculations, retention cohorts, streak tracking
// ═══════════════════════════════════════════════════════════════════════════════
db.createCollection('user_activities', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'date', 'first_seen_at', 'last_seen_at', 'created_at'],
      properties: {
        user_id: {
          bsonType: 'objectId',
          description: 'Reference to users collection'
        },
        date: {
          bsonType: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          description: 'Date string YYYY-MM-DD'
        },
        sessions: {
          bsonType: 'int',
          minimum: 1,
          description: 'Number of sessions on this day'
        },
        articles_viewed: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of articles viewed on this day'
        },
        first_seen_at: {
          bsonType: 'date',
          description: 'First activity timestamp of the day'
        },
        last_seen_at: {
          bsonType: 'date',
          description: 'Last activity timestamp of the day'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.user_activities.createIndex({ user_id: 1, date: 1 }, { unique: true });
db.user_activities.createIndex({ date: 1 });                    // For DAU/MAU queries
db.user_activities.createIndex({ user_id: 1, created_at: 1 }); // For retention cohort queries
print('  ✅ 19/19 user_activities');

// ═══════════════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════════════
print('');
print('═══════════════════════════════════════════════════════════════');
print('  ✅ All 19 collections created with JSON Schema validation');
print('═══════════════════════════════════════════════════════════════');
print('');
print('  Collections: ' + db.getCollectionNames().sort().join(', '));
print('');
print('  TTL Indexes:');
print('    • interactions.created_at    → 180 days (15,552,000s)');
print('    • notification_logs.sent_at  → 90 days  (7,776,000s)');
print('');
print('  Text Indexes:');
print('    • articles (title_original, title_ai) → full-text search');
print('');
print('  Next steps:');
print('    1. mongosh trendbriefai database/002_seed_rss_sources.js');
print('    2. mongosh trendbriefai database/003_seed_topics.js');
print('');
