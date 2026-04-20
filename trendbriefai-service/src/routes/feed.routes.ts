import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getFeed, getFeedCursor } from '../services/feed.service';
import { Topic } from '../types/api.types';

const router = Router();

const VALID_TOPICS: Topic[] = ['ai', 'finance', 'lifestyle', 'drama', 'career', 'insight', 'technology', 'health', 'entertainment', 'sport'];

/**
 * @swagger
 * /feed:
 *   get:
 *     tags: [Feed]
 *     summary: Get personalized article feed (offset pagination)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *           enum: [ai, finance, lifestyle, drama, career, insight, technology, health, entertainment, sport]
 *         description: Filter by topic
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         description: Items per page
 *       - in: header
 *         name: If-None-Match
 *         schema:
 *           type: string
 *         description: ETag from previous response (returns 304 if unchanged)
 *     responses:
 *       200:
 *         description: Paginated feed of articles
 *         headers:
 *           ETag:
 *             schema:
 *               type: string
 *             description: Content hash for caching
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedResponse'
 *       304:
 *         description: Not Modified (content unchanged since last request)
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to fetch feed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const topicParam = req.query.topic as string | undefined;
    const topic: Topic | null =
      topicParam && VALID_TOPICS.includes(topicParam as Topic)
        ? (topicParam as Topic)
        : null;
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);

    const feed = await getFeed(userId, topic, page, limit);

    // ETag support — return 304 if content unchanged
    if (feed.etag) {
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag === feed.etag) {
        res.status(304).end();
        return;
      }
      res.setHeader('ETag', feed.etag);
    }

    // Cache headers for mobile
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json(feed);
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

/**
 * @swagger
 * /feed/cursor:
 *   get:
 *     tags: [Feed]
 *     summary: Get feed with cursor-based pagination (for infinite scroll)
 *     description: More efficient than offset pagination for mobile infinite scroll. Pass `cursor` from previous response's `nextCursor`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *           enum: [ai, finance, lifestyle, drama, career, insight, technology, health, entertainment, sport]
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Last article ID from previous page (null for first page)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *       - in: header
 *         name: If-None-Match
 *         schema:
 *           type: string
 *         description: ETag from previous response
 *     responses:
 *       200:
 *         description: Feed items with next cursor
 *         headers:
 *           ETag:
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Article'
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *                   description: Pass this as `cursor` param for next page. Null = no more data.
 *       304:
 *         description: Not Modified
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch feed
 */
router.get('/cursor', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const topicParam = req.query.topic as string | undefined;
    const topic: Topic | null =
      topicParam && VALID_TOPICS.includes(topicParam as Topic)
        ? (topicParam as Topic)
        : null;
    const cursor = (req.query.cursor as string) || null;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);

    const result = await getFeedCursor(userId, topic, cursor, limit);

    // ETag support
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag === result.etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('ETag', result.etag);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json(result);
  } catch (err) {
    console.error('Feed cursor error:', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

export default router;
