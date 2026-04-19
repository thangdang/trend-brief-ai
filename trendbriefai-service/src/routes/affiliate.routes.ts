import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAffiliateLinkSchema } from '../types/schemas';
import { listAffiliateLinks, createAffiliateLink, trackAffiliateClick } from '../services/affiliate.service';

const router = Router();

/**
 * @swagger
 * /affiliates:
 *   get:
 *     tags: [Affiliates]
 *     summary: List all affiliate links
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of affiliate links
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AffiliateLink'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to list affiliate links
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Admin routes
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const links = await listAffiliateLinks();
    res.json(links);
  } catch (err) {
    console.error('List affiliate links error:', err);
    res.status(500).json({ error: 'Failed to list affiliate links' });
  }
});

/**
 * @swagger
 * /affiliates:
 *   post:
 *     tags: [Affiliates]
 *     summary: Create a new affiliate link
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [article_id, url, label, provider]
 *             properties:
 *               article_id:
 *                 type: string
 *               url:
 *                 type: string
 *                 format: uri
 *               label:
 *                 type: string
 *               provider:
 *                 type: string
 *     responses:
 *       201:
 *         description: Affiliate link created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AffiliateLink'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to create affiliate link
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authMiddleware, validate(createAffiliateLinkSchema), async (req: Request, res: Response) => {
  try {
    const link = await createAffiliateLink(req.body);
    res.status(201).json(link);
  } catch (err) {
    console.error('Create affiliate link error:', err);
    res.status(500).json({ error: 'Failed to create affiliate link' });
  }
});

/**
 * @swagger
 * /affiliates/{id}/click:
 *   post:
 *     tags: [Affiliates]
 *     summary: Track an affiliate link click
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Affiliate link ID
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
    await trackAffiliateClick(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Track affiliate click error:', err);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

export default router;
