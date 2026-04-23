import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { generateReferralCode, getReferralCode, getReferralStats } from '../services/referral.service';

const router = Router();

// GET /api/referral/code — get or generate referral code
router.get('/code', authMiddleware, async (req: Request, res: Response) => {
  try {
    let code = await getReferralCode(req.user!.id);
    if (!code) {
      code = await generateReferralCode(req.user!.id);
    }
    res.json({ code, link: `https://trendbriefai.vn/ref/${code}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

// GET /api/referral/stats — admin referral stats
router.get('/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await getReferralStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

export default router;
