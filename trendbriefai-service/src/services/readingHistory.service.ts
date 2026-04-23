import { Interaction } from '../models/Interaction';
import { Article, IArticle } from '../models/Article';
import { Bookmark } from '../models/Bookmark';
import { Topic, FeedItem } from '../types/api.types';
import { estimateReadingTimeSec } from './feed.service';

export interface ReadingHistoryResponse {
  items: FeedItem[];
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export async function getReadingHistory(
  userId: string,
  page: number,
  limit: number,
): Promise<ReadingHistoryResponse> {
  limit = Math.min(Math.max(limit, 1), 50);
  page = Math.max(page, 1);

  // Get distinct article views sorted by most recent view date
  const viewAgg = await Interaction.aggregate([
    { $match: { user_id: userId, action: 'view' } },
    { $sort: { created_at: -1 } },
    { $group: { _id: '$article_id', lastViewed: { $first: '$created_at' } } },
    { $sort: { lastViewed: -1 } },
  ]);

  const totalItems = viewAgg.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit;
  const pageViews = viewAgg.slice(start, start + limit);

  if (pageViews.length === 0) {
    return { items: [], page, totalPages, hasMore: false };
  }

  const articleIds = pageViews.map((v) => v._id);
  const articles = await Article.find({ _id: { $in: articleIds } }).lean();
  const articleMap = new Map<string, IArticle>();
  for (const a of articles as IArticle[]) {
    articleMap.set(a._id.toString(), a);
  }

  const bookmarks = await Bookmark.find({
    user_id: userId,
    article_id: { $in: articleIds },
  }).select('article_id').lean();
  const bookmarkedIds = new Set(bookmarks.map((b) => b.article_id.toString()));

  const items: FeedItem[] = [];
  for (const v of pageViews) {
    const a = articleMap.get(v._id.toString());
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
      isBookmarked: bookmarkedIds.has(a._id.toString()),
      createdAt: a.created_at.toISOString(),
      readingTimeSec: estimateReadingTimeSec(a),
      isSponsored: false,
      isTrending: false,
    });
  }

  return { items, page, totalPages, hasMore: page < totalPages };
}


/**
 * Get articles the user viewed for less than 10 seconds ("Đọc tiếp" — Task 31.3).
 * Uses view interactions with short duration between view and next action.
 */
export async function getContinueReading(
  userId: string,
  limit = 5,
): Promise<FeedItem[]> {
  // Find articles viewed only once (no click_original or extended view)
  // Heuristic: articles with a view but no click_original interaction
  const viewedArticles = await Interaction.aggregate([
    { $match: { user_id: userId, action: 'view' } },
    { $sort: { created_at: -1 } },
    { $group: { _id: '$article_id', viewCount: { $sum: 1 }, lastViewed: { $first: '$created_at' } } },
    { $match: { viewCount: 1 } }, // Only viewed once (likely bounced)
    { $sort: { lastViewed: -1 } },
    { $limit: limit },
  ]);

  if (viewedArticles.length === 0) return [];

  // Exclude articles where user clicked original (they actually read it)
  const articleIds = viewedArticles.map((v) => v._id);
  const clickedArticles = await Interaction.distinct('article_id', {
    user_id: userId,
    article_id: { $in: articleIds },
    action: 'click_original',
  });
  const clickedSet = new Set(clickedArticles.map((id: any) => id.toString()));

  const filteredIds = articleIds.filter((id: any) => !clickedSet.has(id.toString()));
  if (filteredIds.length === 0) return [];

  const articles = await Article.find({ _id: { $in: filteredIds }, processing_status: 'done' }).lean();

  return articles.map((a: any) => ({
    id: a._id.toString(),
    titleOriginal: a.title_original,
    titleAi: a.title_ai ?? '',
    summaryBullets: a.summary_bullets ?? [],
    reason: a.reason ?? '',
    url: a.url,
    topic: a.topic ?? 'ai',
    source: a.source,
    publishedAt: a.published_at?.toISOString() ?? '',
    isBookmarked: false,
    createdAt: a.created_at.toISOString(),
    readingTimeSec: estimateReadingTimeSec(a),
    isSponsored: false,
    isTrending: false,
  }));
}
