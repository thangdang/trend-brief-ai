import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAdSchema, updateAdSchema } from '../types/schemas';
import { listAds, createAd, updateAd, trackAdClick } from '../services/ad.service';

const router = Router();

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

router.post('/', authMiddleware, validate(createAdSchema), async (req: Request, res: Response) => {
  try {
    const ad = await createAd(req.body);
    res.status(201).json(ad);
  } catch (err) {
    console.error('Create ad error:', err);
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

router.put('/:id', authMiddleware, validate(updateAdSchema), async (req: Request, res: Response) => {
  try {
    const ad = await updateAd(req.params.id, req.body);
    res.json(ad);
  } catch (err) {
    console.error('Update ad error:', err);
    res.status(500).json({ error: 'Failed to update ad' });
  }
});

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

export default router;
