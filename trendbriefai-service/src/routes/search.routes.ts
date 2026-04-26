import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { searchArticles } from '../services/search.service';
import { Topic } from '../types/api.types';
import { validate } from '../middleware/validate';
import { searchSchema } from '../types/schemas';

const router = Router();

const VALID_TOPICS: Topic[] = ['ai', 'finance', 'lifestyle', 'drama'];

/**
 * @swagger
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Search articles by keyword
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *           enum: [ai, finance, lifestyle, drama]
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
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedResponse'
 *       400:
 *         description: Missing query parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to search articles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    if (!q) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const userId = req.user!.id;
    const topicParam = req.query.topic as string | undefined;
    const topic: Topic | null =
      topicParam && VALID_TOPICS.includes(topicParam as Topic)
        ? (topicParam as Topic)
        : null;
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);

    const result = await searchArticles(userId, q, topic, page, limit);
    res.json(result);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to search articles' });
  }
});

export default router;
