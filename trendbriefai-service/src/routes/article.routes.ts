import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ArticleReport } from '../models/ArticleReport';
import { Article } from '../models/Article';

const router = Router();

// POST /api/articles/:id/report — "Báo cáo bài viết" (Task 28.3)
router.post('/:id/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const articleId = req.params.id;
    const userId = req.user!.id;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    // Sanitize user input (strip HTML tags)
    const sanitizedReason = reason.replace(/<[^>]*>/g, '').trim().slice(0, 500);

    // Check if already reported by this user
    const existing = await ArticleReport.findOne({ article_id: articleId, user_id: userId });
    if (existing) {
      res.status(409).json({ error: 'Bạn đã báo cáo bài viết này rồi' });
      return;
    }

    // Create report
    await ArticleReport.create({ article_id: articleId, user_id: userId, reason: sanitizedReason });

    // Increment report count on article
    const updated = await Article.findByIdAndUpdate(
      articleId,
      { $inc: { report_count: 1 } },
      { new: true },
    );

    // Task 28.5: Auto-hide at 3+ reports
    if (updated && (updated as any).report_count >= 3) {
      await Article.findByIdAndUpdate(articleId, { processing_status: 'hidden' });
    }

    res.status(201).json({ message: 'Báo cáo đã được ghi nhận' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to report article' });
  }
});

// GET /api/articles/:id — article detail (auth)
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.id).lean();
    if (!article) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({
      id: article._id.toString(),
      titleOriginal: article.title_original,
      titleAi: article.title_ai || '',
      summaryBullets: article.summary_bullets || [],
      reason: article.reason || '',
      url: article.url,
      topic: article.topic || 'ai',
      source: article.source,
      publishedAt: article.published_at || article.created_at,
      imageUrl: (article as any).image_url || null,
      feedScore: (article as any).feed_score || null,
      qualityScore: (article as any).quality_score || null,
      aiProvider: (article as any).ai_provider || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// GET /api/articles/:id/related — related articles by embedding similarity
router.get('/:id/related', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { getRelatedArticles } = require('../services/related.service');
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
    const related = await getRelatedArticles(req.params.id, limit);
    res.json(related);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch related articles' });
  }
});

export default router;
