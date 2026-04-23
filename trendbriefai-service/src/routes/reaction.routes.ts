import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Reaction, ReactionType } from '../models/Reaction';

const router = Router();
const VALID_REACTIONS: ReactionType[] = ['🔥', '😮', '😢', '😡'];

// POST /api/reactions — add/update reaction (Task 34.1)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { articleId, type } = req.body;
    if (!articleId || !VALID_REACTIONS.includes(type)) {
      res.status(400).json({ error: 'articleId and valid type required' });
      return;
    }
    await Reaction.findOneAndUpdate(
      { article_id: articleId, user_id: req.user!.id },
      { type },
      { upsert: true, new: true },
    );
    res.json({ message: 'Reaction saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save reaction' });
  }
});

// DELETE /api/reactions/:articleId — remove reaction
router.delete('/:articleId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await Reaction.deleteOne({ article_id: req.params.articleId, user_id: req.user!.id });
    res.json({ message: 'Reaction removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// GET /api/reactions/:articleId/counts — reaction counts (Task 34.2)
router.get('/:articleId/counts', async (req: Request, res: Response) => {
  try {
    const counts = await Reaction.aggregate([
      { $match: { article_id: req.params.articleId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const result: Record<string, number> = {};
    for (const c of counts) result[c._id] = c.count;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get reaction counts' });
  }
});

// GET /api/reactions/popular — most reacted articles (Task 34.3)
router.get('/popular', async (_req: Request, res: Response) => {
  try {
    const popular = await Reaction.aggregate([
      { $group: { _id: '$article_id', totalReactions: { $sum: 1 } } },
      { $sort: { totalReactions: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'articles', localField: '_id', foreignField: '_id', as: 'article' } },
      { $unwind: '$article' },
      { $project: {
        id: '$article._id',
        titleAi: '$article.title_ai',
        titleOriginal: '$article.title_original',
        topic: '$article.topic',
        totalReactions: 1,
      }},
    ]);
    res.json({ items: popular });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get popular articles' });
  }
});

export default router;
