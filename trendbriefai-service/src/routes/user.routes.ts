import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateInterestsSchema } from '../types/schemas';
import { User } from '../models/User';
import { invalidateUserFeedCache } from '../services/feed.service';
import { getReadingHistory, getContinueReading } from '../services/readingHistory.service';
import { getUserStats } from '../services/userStats.service';

const router = Router();

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *                 interests:
 *                   type: array
 *                   items:
 *                     type: string
 *                 onboardingCompleted:
 *                   type: boolean
 *                 notificationsEnabled:
 *                   type: boolean
 *                 settings:
 *                   type: object
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: User not found
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
 *         description: Failed to fetch profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
      notificationPrefs: user.notification_prefs,
      settings: user.settings,
      createdAt: user.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * @swagger
 * /users/interests:
 *   put:
 *     tags: [Users]
 *     summary: Update user interests
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [interests]
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 interests:
 *                   type: array
 *                   items:
 *                     type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: User not found
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
 *         description: Failed to update interests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /users/me/history:
 *   get:
 *     tags: [Users]
 *     summary: Get reading history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Paginated reading history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to fetch reading history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /users/me/stats:
 *   get:
 *     tags: [Users]
 *     summary: Get user statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to fetch user stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/me/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await getUserStats(req.user!.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

/**
 * @swagger
 * /users/me/onboarding:
 *   post:
 *     tags: [Users]
 *     summary: Complete user onboarding with interests
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [interests]
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Onboarding completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 interests:
 *                   type: array
 *                   items:
 *                     type: string
 *                 onboardingCompleted:
 *                   type: boolean
 *       400:
 *         description: At least one interest is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
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
 *         description: Failed to save onboarding
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /users/me/settings:
 *   put:
 *     tags: [Users]
 *     summary: Update user settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications_enabled:
 *                 type: boolean
 *               theme:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notificationsEnabled:
 *                   type: boolean
 *                 settings:
 *                   type: object
 *       404:
 *         description: User not found
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
 *         description: Failed to update settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/me/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const updates: Record<string, unknown> = {};
    if (req.body.notifications_enabled !== undefined) {
      updates.notifications_enabled = req.body.notifications_enabled;
    }
    if (req.body.theme) {
      updates['settings.theme'] = req.body.theme;
    }
    // Per-type notification preferences (Task 26.5)
    if (req.body.notification_prefs && typeof req.body.notification_prefs === 'object') {
      const validKeys = ['trending', 'topic', 'daily', 'weekly'];
      for (const key of validKeys) {
        if (typeof req.body.notification_prefs[key] === 'boolean') {
          updates[`notification_prefs.${key}`] = req.body.notification_prefs[key];
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: updates },
      { new: true }
    ).select('-password_hash');

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    res.json({
      notificationsEnabled: user.notifications_enabled,
      notificationPrefs: user.notification_prefs,
      settings: user.settings,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/users/me/continue-reading — articles viewed briefly (Task 31.3)
router.get('/me/continue-reading', authMiddleware, async (req: Request, res: Response) => {
  try {
    const items = await getContinueReading(req.user!.id);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch continue reading' });
  }
});

export default router;
