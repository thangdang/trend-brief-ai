import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateInterestsSchema } from '../types/schemas';
import { User } from '../models/User';
import { invalidateUserFeedCache } from '../services/feed.service';
import { getReadingHistory } from '../services/readingHistory.service';
import { getUserStats } from '../services/userStats.service';

const router = Router();

// GET /api/users/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-password_hash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({
      id: user._id,
      email: user.email,
      interests: user.interests,
      onboardingCompleted: user.onboarding_completed,
      notificationsEnabled: user.notifications_enabled,
      settings: user.settings,
      createdAt: user.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/users/interests
router.put('/interests', authMiddleware, validate(updateInterestsSchema), async (req: Request, res: Response) => {
  try {
    const { interests } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { interests },
      { new: true }
    ).select('-password_hash');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await invalidateUserFeedCache(req.user!.id);

    res.json({
      id: user._id,
      email: user.email,
      interests: user.interests,
      createdAt: user.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update interests' });
  }
});

// GET /api/users/me/history
router.get('/me/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
    const result = await getReadingHistory(req.user!.id, page, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reading history' });
  }
});

// GET /api/users/me/stats
router.get('/me/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await getUserStats(req.user!.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// POST /api/users/me/onboarding
router.post('/me/onboarding', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { interests } = req.body;
    if (!Array.isArray(interests) || interests.length === 0) {
      res.status(400).json({ error: 'At least one interest is required' });
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { interests, onboarding_completed: true },
      { new: true }
    ).select('-password_hash');

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await invalidateUserFeedCache(req.user!.id);

    res.json({
      id: user._id,
      email: user.email,
      interests: user.interests,
      onboardingCompleted: user.onboarding_completed,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save onboarding' });
  }
});

// PUT /api/users/me/settings
router.put('/me/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const updates: Record<string, unknown> = {};
    if (req.body.notifications_enabled !== undefined) {
      updates.notifications_enabled = req.body.notifications_enabled;
    }
    if (req.body.theme) {
      updates['settings.theme'] = req.body.theme;
    }

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: updates },
      { new: true }
    ).select('-password_hash');

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    res.json({
      notificationsEnabled: user.notifications_enabled,
      settings: user.settings,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
