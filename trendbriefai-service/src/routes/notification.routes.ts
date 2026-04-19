import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { registerToken, unregisterToken } from '../services/notification.service';

const router = Router();

// POST /api/notifications/register
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

// DELETE /api/notifications/unregister
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

export default router;
