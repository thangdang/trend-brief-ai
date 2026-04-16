// ═══════════════════════════════════════════
//  MongoDB — Create Collections + Indexes
//  TrendBrief AI Database Initialization
//  Run: mongosh trendbriefai 001_init_collections.js
// ═══════════════════════════════════════════

db = db.getSiblingDB('trendbriefai');

// ─── Drop existing (dev only) ───
const collections = [
  'users', 'articles', 'clusters', 'bookmarks', 'interactions', 'rss_sources'
];
collections.forEach(c => { try { db[c].drop(); } catch(e) {} });

// ─── 1. Users ───
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password_hash', 'created_at', 'updated_at'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$',
          description: 'Must be a valid email address'
        },
        password_hash: {
          bsonType: 'string',
          minLength: 1,
          description: 'Bcrypt hashed password'
        },
        interests: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            enum: ['ai', 'finance', 'lifestyle', 'drama']
          },
          description: 'Array of topic interest strings'
        },
        created_at: { bsonType: 'date' },
        updated_at: { bsonType: 'date' }
      }
    }
  }
});
db.users.createIndex({ email: 1 }, { unique: true });

// ─── 2. Articles ───
db.createCollection('articles', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['url', 'url_hash', 'title_original', 'source', 'processing_status', 'created_at'],
      properties: {
        url: {
          bsonType: 'string',
          minLength: 1,
          description: 'Original article URL'
        },
        url_hash: {
          bsonType: 'string',
          minLength: 32,
          maxLength: 32,
          description: 'MD5 hash of URL for fast dedup lookup'
        },
        title_original: {
          bsonType: 'string',
          minLength: 1,
          description: 'Original article title'
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
          description: 'Exactly 3 bullet summary strings'
        },
        reason: {
          bsonType: 'string',
          description: 'Why you should care sentence'
        },
        content_clean: {
          bsonType: 'string',
          description: 'Cleaned article text'
        },
        topic: {
          bsonType: 'string',
          enum: ['ai', 'finance', 'lifestyle', 'drama'],
          description: 'Article topic classification'
        },
        source: {
          bsonType: 'string',
          minLength: 1,
          description: 'Source identifier (vnexpress, tuoitre, etc.)'
        },
        published_at: { bsonType: 'date' },
        embedding: {
          bsonType: 'array',
          items: { bsonType: 'double' },
          description: '384-dimensional float array from all-MiniLM-L6-v2'
        },
        cluster_id: {
          bsonType: 'objectId',
          description: 'Reference to clusters collection'
        },
        processing_status: {
          bsonType: 'string',
          enum: ['pending', 'processing', 'done', 'failed', 'fallback'],
          description: 'Article processing pipeline status'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.articles.createIndex({ topic: 1 });
db.articles.createIndex({ created_at: -1 });
db.articles.createIndex({ url: 1 }, { unique: true });
db.articles.createIndex({ url_hash: 1 }, { unique: true });
db.articles.createIndex({ source: 1 });
db.articles.createIndex({ processing_status: 1 });

// ─── 3. Clusters ───
db.createCollection('clusters', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['article_count', 'created_at'],
      properties: {
        centroid_embedding: {
          bsonType: 'array',
          items: { bsonType: 'double' },
          description: 'Cluster centroid embedding vector'
        },
        representative_article_id: {
          bsonType: 'objectId',
          description: 'Reference to the representative article'
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

// ─── 4. Bookmarks ───
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

// ─── 5. Interactions ───
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
          enum: ['view', 'click_original', 'share', 'bookmark'],
          description: 'Type of user interaction'
        },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.interactions.createIndex({ user_id: 1, created_at: -1 });
db.interactions.createIndex({ article_id: 1 });

// ─── 6. RSS Sources ───
db.createCollection('rss_sources', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'url', 'is_active', 'crawl_interval_minutes', 'created_at'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          description: 'Source display name'
        },
        url: {
          bsonType: 'string',
          minLength: 1,
          description: 'RSS feed URL'
        },
        category: {
          bsonType: 'string',
          description: 'Maps to article topic'
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
        last_crawled_at: { bsonType: 'date' },
        created_at: { bsonType: 'date' }
      }
    }
  }
});
db.rss_sources.createIndex({ is_active: 1 });

print('✅ 6 collections created with JSON Schema validation and indexes');
print('Collections: ' + db.getCollectionNames().join(', '));
