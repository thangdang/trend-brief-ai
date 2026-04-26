import { Article, IArticle } from '../models/Article';
import { Interaction } from '../models/Interaction';
import { Topic, FeedItem } from '../types/api.types';
import { estimateReadingTimeSec } from './feed.service';

// Redis cache for trending (updated every 30 min by scheduler)
let _trendingCache: Map<string, { items: FeedItem[]; updatedAt: number }> = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export async function getTrendingArticles(limit: number, topic?: string): Promise<FeedItem[]> {
  limit = Math.min(Math.max(limit, 1), 20);

  // Check in-memory cache
  const cacheKey = topic || 'global';
  const cached = _trendingCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return cached.items.slice(0, limit);
  }

  const since = new Date(Date.now() - 24 * 3600_000);

  const matchStage: any = { created_at: { $gte: since } };

  const trending = await Interaction.aggregate([
    { $match: matchStage },
    { $group: { _id: '$article_id', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 50 }, // fetch more for cache
  ]);

  if (trending.length === 0) return [];

  const articleIds = trending.map((t) => t._id);
  const articleFilter: any = {
    _id: { $in: articleIds },
    processing_status: { $in: ['done', 'fallback', 'cached'] },
  };
  if (topic) articleFilter.topic = topic;

  const articles = await Article.find(articleFilter).lean();

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

  // Update cache
  _trendingCache.set(cacheKey, { items, updatedAt: Date.now() });

  return items.slice(0, limit);
}

/** Refresh trending cache for all topics (called by scheduler). */
export async function refreshTrendingCache(): Promise<void> {
  const topics = ['global', 'ai', 'finance', 'lifestyle', 'drama', 'career', 'technology', 'health', 'entertainment', 'sport'];
  for (const t of topics) {
    await getTrendingArticles(50, t === 'global' ? undefined : t);
  }
  console.log(`[Trending] Cache refreshed for ${topics.length} topics`);
}
