import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getTrendingArticles } from '../services/trending.service';

const router = Router();

/**
 * @swagger
 * /trending:
 *   get:
 *     tags: [Trending]
 *     summary: Get trending articles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 20
 *         description: Number of trending items to return
 *     responses:
 *       200:
 *         description: List of trending articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Article'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to fetch trending articles
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 20);
    const items = await getTrendingArticles(limit);
    res.json({ items });
  } catch (err) {
    console.error('Trending error:', err);
    res.status(500).json({ error: 'Failed to fetch trending articles' });
  }
});

export default router;
