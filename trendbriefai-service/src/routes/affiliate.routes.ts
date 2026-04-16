import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAffiliateLinkSchema } from '../types/schemas';
import { listAffiliateLinks, createAffiliateLink, trackAffiliateClick } from '../services/affiliate.service';

const router = Router();

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

router.post('/', authMiddleware, validate(createAffiliateLinkSchema), async (req: Request, res: Response) => {
  try {
    const link = await createAffiliateLink(req.body);
    res.status(201).json(link);
  } catch (err) {
    console.error('Create affiliate link error:', err);
    res.status(500).json({ error: 'Failed to create affiliate link' });
  }
});

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
