import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getDailyAnalytics, aggregateToday } from '../services/analytics.service';
import { getDAU, getMAU, getRetentionD7, getAvgSessionsPerUser, getAvgArticlesPerUser } from '../services/userActivity.service';

const router = Router();

/**
 * @swagger
 * /analytics:
 *   get:
 *     tags: [Analytics]
 *     summary: Get daily analytics for a date range
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           example: '2026-04-01'
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           example: '2026-04-15'
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Daily analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Analytics'
 *       400:
 *         description: Missing required query params
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
 *         description: Failed to get analytics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /analytics/aggregate:
 *   post:
 *     tags: [Analytics]
 *     summary: Trigger today's analytics aggregation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Analytics'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to aggregate analytics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/aggregate', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await aggregateToday();
    res.json(result);
  } catch (err) {
    console.error('Aggregate analytics error:', err);
    res.status(500).json({ error: 'Failed to aggregate analytics' });
  }
});

/**
 * @swagger
 * /analytics/dau:
 *   get:
 *     tags: [Analytics]
 *     summary: Get daily active users count
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           example: '2026-04-16'
 *         description: Date (YYYY-MM-DD), defaults to today
 *     responses:
 *       200:
 *         description: DAU count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                 dau:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get DAU
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /analytics/mau:
 *   get:
 *     tags: [Analytics]
 *     summary: Get monthly active users count
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: '2026-04'
 *         description: Month (YYYY-MM), defaults to current month
 *     responses:
 *       200:
 *         description: MAU count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 month:
 *                   type: string
 *                 mau:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get MAU
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /analytics/retention:
 *   get:
 *     tags: [Analytics]
 *     summary: Get D7 retention for a cohort date
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cohortDate
 *         required: true
 *         schema:
 *           type: string
 *           example: '2026-04-09'
 *         description: Cohort date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Retention data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing cohortDate param
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
 *         description: Failed to get retention
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /analytics/engagement:
 *   get:
 *     tags: [Analytics]
 *     summary: Get engagement metrics for a date range
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           example: '2026-04-01'
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           example: '2026-04-16'
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Engagement metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 startDate:
 *                   type: string
 *                 endDate:
 *                   type: string
 *                 avgSessionsPerUser:
 *                   type: number
 *                 avgArticlesPerUser:
 *                   type: number
 *       400:
 *         description: Missing required query params
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
 *         description: Failed to get engagement metrics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
