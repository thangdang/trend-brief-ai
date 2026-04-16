// ═══════════════════════════════════════════
//  MongoDB — Seed RSS Sources
//  TrendBrief AI — Vietnam Content Sources
//  Run: mongosh trendbriefai 002_seed_rss_sources.js
// ═══════════════════════════════════════════

db = db.getSiblingDB('trendbriefai');

const now = new Date();

const sources = [
  // ─── Primary News (RSS) ───────────────────────────────────
  {
    name: 'VnExpress',
    url: 'https://vnexpress.net/rss/tin-moi-nhat.rss',
    category: 'general',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(10),
    last_crawled_at: null,
    created_at: now
  },
  {
    name: 'VnExpress Công nghệ',
    url: 'https://vnexpress.net/rss/so-hoa.rss',
    category: 'general',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(15),
    last_crawled_at: null,
    created_at: now
  },
  {
    name: 'VnExpress Kinh doanh',
    url: 'https://vnexpress.net/rss/kinh-doanh.rss',
    category: 'finance',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(15),
    last_crawled_at: null,
    created_at: now
  },
  {
    name: 'Tuổi Trẻ',
    url: 'https://tuoitre.vn/rss/tin-moi-nhat.rss',
    category: 'general',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(10),
    last_crawled_at: null,
    created_at: now
  },
  {
    name: 'Thanh Niên',
    url: 'https://thanhnien.vn/rss/home.rss',
    category: 'general',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(10),
    last_crawled_at: null,
    created_at: now
  },
  {
    name: 'Zing News',
    url: 'https://zingnews.vn/rss/tin-moi.rss',
    category: 'general',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(10),
    last_crawled_at: null,
    created_at: now
  },

  // ─── Business / Finance (RSS) ────────────────────────────
  {
    name: 'CafeBiz',
    url: 'https://cafebiz.vn/rss/home.rss',
    category: 'finance',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(10),
    last_crawled_at: null,
    created_at: now
  },
  {
    name: 'CafeF',
    url: 'https://cafef.vn/rss/home.rss',
    category: 'finance',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(10),
    last_crawled_at: null,
    created_at: now
  },

  // ─── Insight / Community (RSS) ───────────────────────────
  {
    name: 'Medium Vietnam',
    url: 'https://medium.com/feed/tag/vietnam',
    category: 'insight',
    source_type: 'rss',
    is_active: true,
    crawl_interval_minutes: NumberInt(30),
    last_crawled_at: null,
    created_at: now
  },

  // ─── Insight / Community (HTML scrape) ───────────────────
  {
    name: 'Spiderum',
    url: 'https://spiderum.com/bai-dang/moi',
    category: 'insight',
    source_type: 'html_scrape',
    is_active: true,
    crawl_interval_minutes: NumberInt(30),
    scrape_link_selector: 'a.post-title',
    scrape_content_selector: 'div.content-post',
    last_crawled_at: null,
    created_at: now
  },

  // ─── Niche / Career (HTML scrape) ────────────────────────
  {
    name: 'TopDev',
    url: 'https://topdev.vn/blog',
    category: 'career',
    source_type: 'html_scrape',
    is_active: true,
    crawl_interval_minutes: NumberInt(60),
    scrape_link_selector: 'h2.post-title a',
    scrape_content_selector: 'div.entry-content',
    last_crawled_at: null,
    created_at: now
  }
];

// Clear existing seed data
db.rss_sources.deleteMany({});

// Insert sources
const result = db.rss_sources.insertMany(sources);

print(`✅ Seeded ${result.insertedIds.length} RSS sources:`);
db.rss_sources.find({}, { name: 1, url: 1, category: 1, source_type: 1 }).forEach(s => {
  print(`   - ${s.name} [${s.source_type}] (${s.category}): ${s.url}`);
});
