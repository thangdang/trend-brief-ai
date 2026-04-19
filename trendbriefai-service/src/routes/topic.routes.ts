import { Router, Request, Response } from 'express';
import { getActiveTopics } from '../services/topic.service';

const router = Router();

/**
 * @swagger
 * /topics:
 *   get:
 *     tags: [Topics]
 *     summary: List all active topics
 *     responses:
 *       200:
 *         description: List of active topics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Topic'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
