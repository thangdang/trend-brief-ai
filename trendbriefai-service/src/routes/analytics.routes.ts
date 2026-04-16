import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getDailyAnalytics, aggregateToday } from '../services/analytics.service';
import { getDAU, getMAU, getRetentionD7, getAvgSessionsPerUser, getAvgArticlesPerUser } from '../services/userActivity.service';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'startDate and endDate query params required' });
      return;
    }

    const analytics = await getDailyAnalytics(startDate, endDate);
    res.json(analytics);
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

router.post('/aggregate', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await aggregateToday();
    res.json(result);
  } catch (err) {
    console.error('Aggregate analytics error:', err);
    res.status(500).json({ error: 'Failed to aggregate analytics' });
  }
});

// GET /api/analytics/dau?date=2026-04-16
router.get('/dau', authMiddleware, async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const dau = await getDAU(date);
    res.json({ date, dau });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get DAU' });
  }
});

// GET /api/analytics/mau?month=2026-04
router.get('/mau', authMiddleware, async (req: Request, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const mau = await getMAU(month);
    res.json({ month, mau });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get MAU' });
  }
});

// GET /api/analytics/retention?cohortDate=2026-04-09
router.get('/retention', authMiddleware, async (req: Request, res: Response) => {
  try {
    const cohortDate = req.query.cohortDate as string;
    if (!cohortDate) {
      res.status(400).json({ error: 'cohortDate query param required' });
      return;
    }
    const retention = await getRetentionD7(cohortDate);
    res.json(retention);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get retention' });
  }
});

// GET /api/analytics/engagement?startDate=2026-04-01&endDate=2026-04-16
router.get('/engagement', authMiddleware, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'startDate and endDate required' });
      return;
    }
    const [avgSessions, avgArticles] = await Promise.all([
      getAvgSessionsPerUser(startDate, endDate),
      getAvgArticlesPerUser(startDate, endDate),
    ]);
    res.json({ startDate, endDate, avgSessionsPerUser: avgSessions, avgArticlesPerUser: avgArticles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get engagement metrics' });
  }
});

export default router;
