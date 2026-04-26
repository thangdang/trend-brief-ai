/**
 * Feed Score Worker — pre-compute feed_score for all recent articles.
 * Runs hourly via node-cron.
 *
 * feed_score = recency(0.4) + popularity(0.25) + quality(0.2) + source_quality(0.15)
 *
 * This eliminates in-memory ranking at query time — feed becomes a simple
 * sorted find() query.
 */

import cron from 'node-cron';
import { Article } from '../models/Article';
import { Interaction } from '../models/Interaction';

async function computeFeedScores(): Promise<{ updated: number }> {
  const now = Date.now();
  const seventyTwoHoursAgo = new Date(now - 72 * 60 * 60 * 1000);

  // Get articles from last 72 hours
  const articles = await Article.find({
    processing_status: { $in: ['done', 'fallback', 'cached'] },
    created_at: { $gte: seventyTwoHoursAgo },
  }).select('_id created_at topic quality_score').lean();

  if (articles.length === 0) return { updated: 0 };

  // Get view counts per article (for popularity)
  const viewCounts = await Interaction.aggregate([
    {
      $match: {
        article_id: { $in: articles.map((a: any) => a._id) },
        action: 'view',
      },
    },
    { $group: { _id: '$article_id', count: { $sum: 1 } } },
  ]);
  const viewMap = new Map(viewCounts.map((v: any) => [v._id.toString(), v.count]));

  // Compute scores
  const bulkOps = articles.map((article: any) => {
    const ageHours = (now - new Date(article.created_at).getTime()) / (1000 * 60 * 60);

    // Recency: 1.0 for new, decays to 0 over 72h
    const recency = Math.max(0, 1 - ageHours / 72);

    // Popularity: log scale of views
    const views = viewMap.get(article._id.toString()) || 0;
    const popularity = views > 0 ? Math.min(Math.log10(views + 1) / 4, 1.0) : 0;

    // Quality: from AI quality_score (0-1), default 0.5
    const quality = article.quality_score ?? 0.5;

    // Source quality: placeholder (would use source health data)
    const sourceQuality = 0.7;

    const feedScore = recency * 0.4 + popularity * 0.25 + quality * 0.2 + sourceQuality * 0.15;

    return {
      updateOne: {
        filter: { _id: article._id },
        update: { $set: { feed_score: Math.round(feedScore * 1000) / 1000 } },
      },
    };
  });

  if (bulkOps.length > 0) {
    await Article.bulkWrite(bulkOps);
  }

  console.log(`[FeedScore] Updated ${bulkOps.length} articles`);
  return { updated: bulkOps.length };
}

export function startFeedScoreScheduler(): void {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await computeFeedScores();
      console.log(`[FeedScore] Hourly update: ${result.updated} articles scored`);
    } catch (err: any) {
      console.error('[FeedScore] Failed:', err.message);
    }
  });

  // Run once on startup (after 30s delay to let DB connect)
  setTimeout(async () => {
    try {
      const result = await computeFeedScores();
      console.log(`[FeedScore] Initial scoring: ${result.updated} articles`);
    } catch (err: any) {
      console.error('[FeedScore] Initial scoring failed:', err.message);
    }
  }, 30000);

  console.log('[FeedScore] Scheduler started (hourly)');
}

export { computeFeedScores };
