import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getFeed } from '../services/feed.service';
import { Topic } from '../types/api.types';

const router = Router();

const VALID_TOPICS: Topic[] = ['ai', 'finance', 'lifestyle', 'drama', 'career', 'insight', 'technology', 'health', 'entertainment'];

/**
 * @swagger
 * /feed:
 *   get:
 *     tags: [Feed]
 *     summary: Get personalized article feed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *           enum: [ai, finance, lifestyle, drama, career, insight, technology, health, entertainment]
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
 *     responses:
 *       200:
 *         description: Paginated feed of articles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedResponse'
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
    res.json(feed);
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

export default router;
