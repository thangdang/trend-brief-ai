import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getTrendingArticles } from '../services/trending.service';

const router = Router();

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
