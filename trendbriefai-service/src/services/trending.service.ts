import { Article, IArticle } from '../models/Article';
import { Interaction } from '../models/Interaction';
import { Topic, FeedItem } from '../types/api.types';
import { estimateReadingTimeSec } from './feed.service';

export async function getTrendingArticles(limit: number): Promise<FeedItem[]> {
  limit = Math.min(Math.max(limit, 1), 20);

  const since = new Date(Date.now() - 24 * 3600_000);

  const trending = await Interaction.aggregate([
    { $match: { created_at: { $gte: since } } },
    { $group: { _id: '$article_id', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  if (trending.length === 0) {
    return [];
  }

  const articleIds = trending.map((t) => t._id);
  const articles = await Article.find({
    _id: { $in: articleIds },
    processing_status: { $in: ['done', 'fallback'] },
  }).lean();

  // Preserve trending order
  const articleMap = new Map<string, IArticle>();
  for (const a of articles as IArticle[]) {
    articleMap.set(a._id.toString(), a);
  }

  const items: FeedItem[] = [];
  for (const t of trending) {
    const a = articleMap.get(t._id.toString());
    if (!a) continue;
    items.push({
      id: a._id.toString(),
      titleOriginal: a.title_original,
      titleAi: a.title_ai ?? '',
      summaryBullets: a.summary_bullets ?? [],
      reason: a.reason ?? '',
      url: a.url,
      topic: a.topic ?? ('ai' as Topic),
      source: a.source,
      publishedAt: a.published_at?.toISOString() ?? '',
      isBookmarked: false,
      createdAt: a.created_at.toISOString(),
      readingTimeSec: estimateReadingTimeSec(a),
      isSponsored: false,
      isTrending: true,
    });
  }

  return items;
}
