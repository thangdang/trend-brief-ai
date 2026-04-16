import { Router, Request, Response } from 'express';
import { Topic } from '../types/api.types';

const router = Router();

const AVAILABLE_TOPICS: Topic[] = ['ai', 'finance', 'lifestyle', 'drama'];

// GET /api/topics
router.get('/', (_req: Request, res: Response) => {
  res.json(AVAILABLE_TOPICS);
});

export default router;
