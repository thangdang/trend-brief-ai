import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAdSchema, updateAdSchema } from '../types/schemas';
import { listAds, createAd, updateAd, trackAdClick } from '../services/ad.service';

const router = Router();

/**
 * @swagger
 * /ads:
 *   get:
 *     tags: [Ads]
 *     summary: List all ads
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ad'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to list ads
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Admin routes
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const ads = await listAds();
    res.json(ads);
  } catch (err) {
    console.error('List ads error:', err);
    res.status(500).json({ error: 'Failed to list ads' });
  }
});

/**
 * @swagger
 * /ads:
 *   post:
 *     tags: [Ads]
 *     summary: Create a new ad
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, image_url, target_url, placement]
 *             properties:
 *               title:
 *                 type: string
 *               image_url:
 *                 type: string
 *                 format: uri
 *               target_url:
 *                 type: string
 *                 format: uri
 *               placement:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Ad created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ad'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to create ad
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authMiddleware, validate(createAdSchema), async (req: Request, res: Response) => {
  try {
    const ad = await createAd(req.body);
    res.status(201).json(ad);
  } catch (err) {
    console.error('Create ad error:', err);
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

/**
 * @swagger
 * /ads/{id}:
 *   put:
 *     tags: [Ads]
 *     summary: Update an ad
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ad ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               image_url:
 *                 type: string
 *                 format: uri
 *               target_url:
 *                 type: string
 *                 format: uri
 *               placement:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ad updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ad'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to update ad
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', authMiddleware, validate(updateAdSchema), async (req: Request, res: Response) => {
  try {
    const ad = await updateAd(req.params.id, req.body);
    res.json(ad);
  } catch (err) {
    console.error('Update ad error:', err);
    res.status(500).json({ error: 'Failed to update ad' });
  }
});

/**
 * @swagger
 * /ads/{id}/click:
 *   post:
 *     tags: [Ads]
 *     summary: Track an ad click
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ad ID
 *     responses:
 *       200:
 *         description: Click tracked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       500:
 *         description: Failed to track click
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Public route
router.post('/:id/click', async (req: Request, res: Response) => {
  try {
    await trackAdClick(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Track ad click error:', err);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// POST /api/ads/viewable — track viewable ad impression
router.post('/viewable', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { ad_id, visible_duration_ms, viewport_percentage, article_position } = req.body;
    if (!ad_id) { res.status(400).json({ error: 'ad_id required' }); return; }

    const { Ad } = require('../models/Ad');
    await Ad.findByIdAndUpdate(ad_id, {
      $inc: { viewable_impressions: 1 },
      $push: {
        viewability_data: {
          $each: [{
            visible_duration_ms: visible_duration_ms || 0,
            viewport_percentage: viewport_percentage || 0,
            article_position: article_position || 0,
            tracked_at: new Date(),
          }],
          $slice: -1000, // keep last 1000 entries
        },
      },
    });

    res.json({ tracked: true });
  } catch (err) {
    res.status(500).json({ error: 'Viewability tracking failed' });
  }
});

export default router;
