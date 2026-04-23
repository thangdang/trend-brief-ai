import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { registerToken, unregisterToken, getNotificationLogs, markNotificationOpened } from '../services/notification.service';

const router = Router();

/**
 * @swagger
 * /notifications/register:
 *   post:
 *     tags: [Notifications]
 *     summary: Register a device push token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, platform]
 *             properties:
 *               token:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [ios, android]
 *     responses:
 *       200:
 *         description: Device token registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request body
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
 *         description: Failed to register token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { token, platform } = req.body;
    if (!token || !['ios', 'android'].includes(platform)) {
      res.status(400).json({ error: 'token and platform (ios|android) required' });
      return;
    }
    await registerToken(req.user!.id, token, platform);
    res.json({ message: 'Device token registered' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register token' });
  }
});

/**
 * @swagger
 * /notifications/unregister:
 *   delete:
 *     tags: [Notifications]
 *     summary: Unregister a device push token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device token unregistered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Token required
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
 *         description: Failed to unregister token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/unregister', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'token required' });
      return;
    }
    await unregisterToken(token);
    res.json({ message: 'Device token unregistered' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unregister token' });
  }
});

// GET /notifications/logs — user's notification history
router.get('/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
    const result = await getNotificationLogs(req.user!.id, page, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notification logs' });
  }
});

// POST /notifications/:logId/opened — mark notification as opened
router.post('/:logId/opened', authMiddleware, async (req: Request, res: Response) => {
  try {
    await markNotificationOpened(req.params.logId);
    res.json({ message: 'Notification marked as opened' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification opened' });
  }
});

export default router;
