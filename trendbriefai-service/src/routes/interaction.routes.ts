import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { interactionSchema } from '../types/schemas';
import { trackInteraction } from '../services/interaction.service';

const router = Router();

/**
 * @swagger
 * /interactions:
 *   post:
 *     tags: [Interactions]
 *     summary: Track a user interaction with an article
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [articleId, action]
 *             properties:
 *               articleId:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [view, like, share, read]
 *     responses:
 *       201:
 *         description: Interaction tracked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Interaction'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to track interaction
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
