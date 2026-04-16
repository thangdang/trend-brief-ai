import { Article, IArticle } from '../models/Article';
import { Bookmark } from '../models/Bookmark';
import { Topic, FeedItem, FeedResponse } from '../types/api.types';
import { estimateReadingTimeSec } from './feed.service';

function mapArticleToFeedItem(a: IArticle, bookmarkedIds: Set<string>): FeedItem {
  return {
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
  };
}

export async function searchArticles(
  userId: string,
  query: string,
  topic: Topic | null,
  page: number,
  limit: number,
): Promise<FeedResponse> {
  limit = Math.min(Math.max(limit, 1), 50);
  page = Math.max(page, 1);

  const filter: Record<string, unknown> = {
    $text: { $search: query },
    processing_status: { $in: ['done', 'fallback'] },
  };
  if (topic) {
    filter.topic = topic;
  }

  const totalItems = await Article.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const skip = (page - 1) * limit;

  const articles = await Article.find(filter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit)
    .lean();

  const articleIds = articles.map((a) => a._id);
  const bookmarks = await Bookmark.find({
    user_id: userId,
    article_id: { $in: articleIds },
  })
    .select('article_id')
    .lean();
  const bookmarkedIds = new Set(bookmarks.map((b) => b.article_id.toString()));

  const items: FeedItem[] = (articles as IArticle[]).map((a) =>
    mapArticleToFeedItem(a, bookmarkedIds),
  );

  return {
    items,
    page,
    totalPages,
    hasMore: page < totalPages,
  };
}
