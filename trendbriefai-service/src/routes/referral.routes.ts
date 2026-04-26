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

// GET /api/referral/stats — referral stats for current user
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await getReferralStats(req.user!.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

// POST /api/referral/check-activation — check if referee qualifies for reward
router.post('/check-activation', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { Interaction } = require('../models/Interaction');
    const { Referral } = require('../models/Referral');
    const { User } = require('../models/User');

    // Count user's article views
    const viewCount = await Interaction.countDocuments({ user_id: userId, action: 'view' });

    if (viewCount < 5) {
      res.json({ activated: false, views: viewCount, needed: 5 });
      return;
    }

    // Find referral where this user is the referee
    const referral = await Referral.findOne({ referee_id: userId, status: 'registered' });
    if (!referral) {
      res.json({ activated: false, reason: 'no_referral' });
      return;
    }

    // Check anti-abuse: max 50 rewards per referrer
    const referrerRewardCount = await Referral.countDocuments({
      referrer_id: referral.referrer_id,
      status: 'activated',
    });
    if (referrerRewardCount >= 50) {
      res.json({ activated: false, reason: 'referrer_limit_reached' });
      return;
    }

    // Activate: give referrer 7 days premium
    const referrer = await User.findById(referral.referrer_id);
    if (referrer) {
      const currentPremium = referrer.premium_until ? new Date(referrer.premium_until) : new Date();
      const newPremium = new Date(Math.max(currentPremium.getTime(), Date.now()) + 7 * 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(referral.referrer_id, { premium_until: newPremium });

      // Send notification to referrer
      try {
        const { NotificationLog } = require('../models/NotificationLog');
        const { DeviceToken } = require('../models/DeviceToken');
        await NotificationLog.create({
          user_id: referral.referrer_id,
          type: 'referral_reward',
          title: '🎉 Bạn được thưởng 7 ngày Premium!',
          body: 'Bạn bè đã đọc 5 bài viết — phần thưởng đã được kích hoạt.',
          data: { referee_id: userId },
        });

        // Push notification via FCM (if device token exists)
        const deviceToken = await DeviceToken.findOne({ user_id: referral.referrer_id });
        if (deviceToken?.token) {
          const admin = require('firebase-admin');
          await admin.messaging().send({
            token: deviceToken.token,
            notification: {
              title: '🎉 Bạn được thưởng 7 ngày Premium!',
              body: 'Bạn bè đã đọc 5 bài viết — phần thưởng đã được kích hoạt.',
            },
          }).catch(() => {});
        }
      } catch (notifErr: any) {
        console.warn('Referral notification failed:', notifErr.message);
      }
    }

    // Update referral status
    referral.status = 'activated';
    referral.activated_at = new Date();
    await referral.save();

    res.json({ activated: true, reward: '7 days premium for referrer' });
  } catch (err) {
    res.status(500).json({ error: 'Activation check failed' });
  }
});

export default router;
