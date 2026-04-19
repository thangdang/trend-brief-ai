import { Router, Request, Response } from 'express';
import { getActiveTopics } from '../services/topic.service';

const router = Router();

// GET /api/topics
router.get('/', async (_req: Request, res: Response) => {
  try {
    const topics = await getActiveTopics();
    res.json(topics);
  } catch (error) {
    console.error('Failed to fetch topics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
