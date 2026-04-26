/**
 * Public routes — no authentication required.
 * Used by the public user website (trendbriefai-web).
 * Read-only access to articles, search, trending, topics.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Article } from '../models/Article';
import { SummaryFeedback } from '../models/SummaryFeedback';
import { Topic } from '../types/api.types';
import { getTrendingArticles } from '../services/trending.service';
import { getActiveTopics } from '../services/topic.service';

const router = Router();

const VALID_TOPICS = ['ai', 'finance', 'lifestyle', 'drama', 'career', 'insight', 'technology', 'health', 'entertainment', 'sport'];

const FEED_PROJECTION = {
  title_original: 1,
  title_ai: 1,
  summary_bullets: 1,
  reason: 1,
  url: 1,
  topic: 1,
  source: 1,
  published_at: 1,
  created_at: 1,
  source_lang: 1,
  was_translated: 1,
  image_url: 1,
};

/**
 * @swagger
 * /public/feed:
 *   get:
 *     tags: [Public]
 *     summary: Public article feed (no auth required)
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Last article ID for cursor pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Article feed
 */
router.get('/feed', async (req: Request, res: Response) => {
  try {
    const topicParam = req.query.topic as string | undefined;
    const topic = topicParam && VALID_TOPICS.includes(topicParam) ? topicParam : null;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const filter: any = { processing_status: { $in: ['done', 'fallback'] } };
    if (topic) filter.topic = topic;
    if (cursor) filter._id = { $lt: cursor };

    const articles = await Article.find(filter)
      .select(FEED_PROJECTION)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = articles.length > limit;
    const items = hasMore ? articles.slice(0, limit) : articles;
    const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;

    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({
      items: items.map(a => ({
        id: a._id.toString(),
        titleOriginal: a.title_original,
        titleAi: a.title_ai || '',
        summaryBullets: a.summary_bullets || [],
        reason: a.reason || '',
        url: a.url,
        topic: a.topic || 'ai',
        source: a.source,
        publishedAt: a.published_at || a.created_at,
        createdAt: a.created_at,
        sourceLang: a.source_lang,
        wasTranslated: a.was_translated,
        imageUrl: (a as any).image_url || null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

/**
 * @swagger
 * /public/articles/{id}:
 *   get:
 *     tags: [Public]
 *     summary: Get single article detail (no auth)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Article detail
 *       404:
 *         description: Not found
 */
router.get('/articles/:id', async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.id)
      .select({ ...FEED_PROJECTION, content_clean: 1 })
      .lean();
    if (!article) { res.status(404).json({ error: 'Not found' }); return; }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      id: article._id.toString(),
      titleOriginal: article.title_original,
      titleAi: article.title_ai || '',
      summaryBullets: article.summary_bullets || [],
      reason: article.reason || '',
      contentClean: article.content_clean || '',
      url: article.url,
      topic: article.topic || 'ai',
      source: article.source,
      publishedAt: article.published_at || article.created_at,
      createdAt: article.created_at,
      sourceLang: article.source_lang,
      wasTranslated: article.was_translated,
      imageUrl: (article as any).image_url || null,
    });

    // Note: Related articles are fetched separately via /api/public/articles/:id/related
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// GET /api/public/articles/:id/related — related articles by same topic (Task 31.4)
router.get('/articles/:id/related', async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.id).select('topic').lean();
    if (!article) { res.status(404).json({ error: 'Not found' }); return; }

    const related = await Article.find({
      _id: { $ne: req.params.id },
      topic: article.topic,
      processing_status: { $in: ['done', 'fallback'] },
    })
      .select(FEED_PROJECTION)
      .sort({ created_at: -1 })
      .limit(5)
      .lean();

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      items: related.map(a => ({
        id: a._id.toString(),
        titleOriginal: a.title_original,
        titleAi: a.title_ai || '',
        summaryBullets: a.summary_bullets || [],
        url: a.url,
        topic: a.topic || 'ai',
        source: a.source,
        publishedAt: a.published_at || a.created_at,
        imageUrl: (a as any).image_url || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch related articles' });
  }
});

/**
 * @swagger
 * /public/search:
 *   get:
 *     tags: [Public]
 *     summary: Search articles (no auth)
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) { res.status(400).json({ error: 'q is required' }); return; }

    const topic = req.query.topic as string | undefined;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const filter: any = {
      processing_status: { $in: ['done', 'fallback'] },
      $text: { $search: q },
    };
    if (topic && VALID_TOPICS.includes(topic)) filter.topic = topic;

    const [items, total] = await Promise.all([
      Article.find(filter)
        .select({ ...FEED_PROJECTION, score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Article.countDocuments(filter),
    ]);

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      items: items.map(a => ({
        id: a._id.toString(),
        titleOriginal: a.title_original,
        titleAi: a.title_ai || '',
        summaryBullets: a.summary_bullets || [],
        reason: a.reason || '',
        url: a.url,
        topic: a.topic || 'ai',
        source: a.source,
        publishedAt: a.published_at || a.created_at,
        createdAt: a.created_at,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * @swagger
 * /public/trending:
 *   get:
 *     tags: [Public]
 *     summary: Trending articles (no auth)
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Trending articles
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    const items = await getTrendingArticles(limit);
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// GET /api/public/sitemap.xml — dynamic sitemap from article catalog (Task 32.4)
router.get('/sitemap.xml', async (_req: Request, res: Response) => {
  try {
    const articles = await Article.find({ processing_status: { $in: ['done', 'fallback'] } })
      .select('_id created_at topic')
      .sort({ created_at: -1 })
      .limit(1000)
      .lean();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += '  <url><loc>https://trendbriefai.vn/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>\n';

    for (const a of articles) {
      const date = new Date(a.created_at).toISOString().slice(0, 10);
      xml += `  <url><loc>https://trendbriefai.vn/article/${a._id}</loc><lastmod>${date}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
    }

    xml += '</urlset>';
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate sitemap' });
  }
});

// GET /api/public/news-sitemap.xml — Google News sitemap (Task 32.5)
router.get('/news-sitemap.xml', async (_req: Request, res: Response) => {
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const articles = await Article.find({
      processing_status: { $in: ['done', 'fallback'] },
      created_at: { $gte: twoDaysAgo },
    })
      .select('_id title_ai title_original created_at topic')
      .sort({ created_at: -1 })
      .limit(1000)
      .lean();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

    for (const a of articles) {
      const title = (a.title_ai || a.title_original).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const pubDate = new Date(a.created_at).toISOString();
      xml += `  <url>\n`;
      xml += `    <loc>https://trendbriefai.vn/article/${a._id}</loc>\n`;
      xml += `    <news:news>\n`;
      xml += `      <news:publication><news:name>TrendBrief AI</news:name><news:language>vi</news:language></news:publication>\n`;
      xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
      xml += `      <news:title>${title}</news:title>\n`;
      xml += `    </news:news>\n`;
      xml += `  </url>\n`;
    }

    xml += '</urlset>';
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate news sitemap' });
  }
});

// GET /api/public/share-image/:id — OG image for sharing (Task 29.1)
router.get('/share-image/:id', async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.id)
      .select('title_ai title_original summary_bullets topic')
      .lean();
    if (!article) { res.status(404).json({ error: 'Not found' }); return; }

    const title = article.title_ai || article.title_original;
    const bullet = article.summary_bullets?.[0] || '';
    const topic = article.topic || 'ai';

    // Generate a simple SVG-based OG image (no sharp/canvas dependency needed)
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="630" fill="#1a1a2e"/>
        <rect x="0" y="0" width="1200" height="8" fill="#6366f1"/>
        <text x="60" y="80" font-family="sans-serif" font-size="24" fill="#818cf8" font-weight="600">${topic.toUpperCase()}</text>
        <text x="60" y="160" font-family="sans-serif" font-size="48" fill="#ffffff" font-weight="700">
          ${escapeXml(title.slice(0, 60))}
        </text>
        ${title.length > 60 ? `<text x="60" y="220" font-family="sans-serif" font-size="48" fill="#ffffff" font-weight="700">${escapeXml(title.slice(60, 120))}</text>` : ''}
        <text x="60" y="320" font-family="sans-serif" font-size="28" fill="#94a3b8">${escapeXml(bullet.slice(0, 80))}</text>
        <text x="60" y="560" font-family="sans-serif" font-size="28" fill="#6366f1" font-weight="600">⚡ TrendBrief AI</text>
        <text x="60" y="595" font-family="sans-serif" font-size="20" fill="#64748b">trendbriefai.vn</text>
      </svg>
    `;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate share image' });
  }
});

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * @swagger
 * /public/topics:
 *   get:
 *     tags: [Public]
 *     summary: List active topics (no auth)
 *     responses:
 *       200:
 *         description: Topic list
 */
router.get('/topics', async (_req: Request, res: Response) => {
  try {
    const topics = await getActiveTopics();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// POST /api/public/summarize-url — "Tóm tắt cho tôi" (paste any URL)
// Rate limited: 10 requests/hour per IP
const summarizeRateLimit: Map<string, { count: number; resetAt: number }> = new Map();

router.post('/summarize-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'url is required' });
      return;
    }

    // Rate limit by IP
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const limit = summarizeRateLimit.get(ip);
    if (limit && limit.resetAt > now && limit.count >= 10) {
      res.status(429).json({ error: 'Bạn đã dùng hết lượt tóm tắt. Thử lại sau 1 giờ.' });
      return;
    }
    if (!limit || limit.resetAt <= now) {
      summarizeRateLimit.set(ip, { count: 1, resetAt: now + 3600000 });
    } else {
      limit.count++;
    }

    // Forward to AI engine
    const axios = require('axios');
    const { config } = require('../config');
    const { data } = await axios.post(
      `${config.aiServiceUrl}/summarize-url`,
      { url },
      { timeout: 60000 },
    );

    res.json(data);
  } catch (err: any) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.detail || 'Không thể tóm tắt URL này';
    res.status(status).json({ error: message });
  }
});

// POST /api/public/feedback — rate a summary (thumbs up/down, anonymous)
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { articleId, rating, reason } = req.body;
    if (!articleId || !['up', 'down'].includes(rating)) {
      res.status(400).json({ error: 'articleId and rating (up/down) required' });
      return;
    }
    const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex').slice(0, 16);
    await SummaryFeedback.findOneAndUpdate(
      { article_id: articleId, ip_hash: ipHash },
      { rating, reason, ip_hash: ipHash },
      { upsert: true, new: true },
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export default router;
