import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Article } from '../models/Article';
import { User } from '../models/User';
import { NotificationLog } from '../models/NotificationLog';
import { DeviceToken } from '../models/DeviceToken';
import { sendPush, getUserTokens } from '../services/notification.service';

const router = Router();

// ── Moderation ───────────────────────────────────────────────────────────────

// GET /api/admin/moderation — reported + auto-hidden articles
router.get('/moderation', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    // Find articles that are hidden or have reports
    const items = await Article.find({
      $or: [
        { processing_status: 'hidden' },
        { report_count: { $gte: 1 } },
      ],
    })
      .sort({ report_count: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Article.countDocuments({
      $or: [{ processing_status: 'hidden' }, { report_count: { $gte: 1 } }],
    });

    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch moderation queue' });
  }
});

// POST /api/admin/moderation/:id/restore
router.post('/moderation/:id/restore', authMiddleware, async (req: Request, res: Response) => {
  try {
    await Article.findByIdAndUpdate(req.params.id, { processing_status: 'done', report_count: 0 });
    res.json({ message: 'Article restored' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore article' });
  }
});

// POST /api/admin/moderation/:id/hide
router.post('/moderation/:id/hide', authMiddleware, async (req: Request, res: Response) => {
  try {
    await Article.findByIdAndUpdate(req.params.id, { processing_status: 'hidden' });
    res.json({ message: 'Article hidden' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to hide article' });
  }
});

// POST /api/admin/moderation/:id/delete
router.post('/moderation/:id/delete', authMiddleware, async (req: Request, res: Response) => {
  try {
    await Article.findByIdAndDelete(req.params.id);
    res.json({ message: 'Article deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// ── Notifications ────────────────────────────────────────────────────────────

// POST /api/admin/notifications/send — send manual push to all users
router.post('/notifications/send', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, body, topic } = req.body;
    if (!title || !body) { res.status(400).json({ error: 'title and body required' }); return; }

    // Get all device tokens (optionally filter by topic subscribers)
    let userFilter: any = { notifications_enabled: true };
    if (topic) userFilter.interests = topic;

    const users = await User.find(userFilter).select('_id').lean();
    let sent = 0;

    for (const user of users) {
      const tokens = await getUserTokens(user._id.toString());
      for (const dt of tokens) {
        const ok = await sendPush(dt.token, { title, body, data: { type: 'manual', deepLink: '/feed' } });
        if (ok) sent++;
      }
    }

    res.json({ message: `Push sent to ${sent} devices`, sent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send push' });
  }
});

// GET /api/admin/notifications/logs — delivery logs
router.get('/notifications/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      NotificationLog.find()
        .sort({ sent_at: -1 })
        .skip(skip)
        .limit(limit)
        .populate('article_id', 'title_ai title_original')
        .lean(),
      NotificationLog.countDocuments(),
    ]);

    res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notification logs' });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

// GET /api/admin/users — list users with pagination
router.get('/users', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select('-password_hash').sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(),
    ]);

    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', authMiddleware, async (req: Request, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { is_banned: true, notifications_enabled: false });
    // Remove all device tokens
    await DeviceToken.deleteMany({ user_id: req.params.id });
    res.json({ message: 'User banned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// POST /api/admin/users/:id/suspend
router.post('/users/:id/suspend', authMiddleware, async (req: Request, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { is_suspended: true });
    res.json({ message: 'User suspended' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

export default router;
