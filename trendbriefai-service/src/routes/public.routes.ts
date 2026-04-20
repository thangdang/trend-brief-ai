/**
 * Public routes — no authentication required.
 * Used by the public user website (trendbriefai-web).
 * Read-only access to articles, search, trending, topics.
 */

import { Router, Request, Response } from 'express';
import { Article } from '../models/Article';
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch article' });
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

export default router;
