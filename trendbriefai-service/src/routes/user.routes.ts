import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateInterestsSchema } from '../types/schemas';
import { User } from '../models/User';
import { invalidateUserFeedCache } from '../services/feed.service';

const router = Router();

// PUT /api/users/interests
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

export default router;
