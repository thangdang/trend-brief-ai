import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { interactionSchema } from '../types/schemas';
import { trackInteraction } from '../services/interaction.service';

const router = Router();

// POST /api/interactions
router.post('/', authMiddleware, validate(interactionSchema), async (req: Request, res: Response) => {
  try {
    const { articleId, action } = req.body;
    const interaction = await trackInteraction(req.user!.id, articleId, action);
    res.status(201).json(interaction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to track interaction' });
  }
});

export default router;
