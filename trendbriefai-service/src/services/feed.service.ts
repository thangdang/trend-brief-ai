import Redis from 'ioredis';
import { config } from '../config';
import { Article, IArticle } from '../models/Article';
import { User } from '../models/User';
import { Interaction } from '../models/Interaction';
import { Bookmark } from '../models/Bookmark';
import { Topic, FeedItem, FeedResponse, FeedEntry, AdItem, AffiliateLink } from '../types/api.types';
import { getActiveAds, trackAdImpression } from './ad.service';
import { getAffiliateLinks, trackAffiliateImpressions } from './affiliate.service';
import { recordActivity, recordArticleView } from './userActivity.service';

const redis = new Redis(config.redisUrl);

const CACHE_TTL = 300; // 5 minutes
const DECAY_WINDOW_MS = 48 * 3600_000; // 48 hours
const READING_SPEED_WPM = 200; // Vietnamese reading speed ~200 words/min

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateReadingTimeSec(article: Pick<IArticle, 'title_ai' | 'summary_bullets' | 'reason'>): number {
  const combined = [
    article.title_ai ?? '',
    ...(article.summary_bullets ?? []),
    article.reason ?? '',
  ].join(' ');
  const words = countWords(combined);
  const seconds = Math.ceil((words / READING_SPEED_WPM) * 60);
  return Math.min(60, Math.max(15, seconds));
}

interface ScoredArticle extends IArticle {
  score: number;
}

function rankArticles(
  articles: IArticle[],
  userInterests: Topic[],
  viewedArticleIds: Set<string>,
): ScoredArticle[] {
  const now = Date.now();

  return articles
    .map((article) => {
      let score = 0;

      if (article.topic && userInterests.includes(article.topic)) {
        score += 2.0;
      }

      const ageMs = now - new Date(article.created_at).getTime();
      const recency = Math.max(0, 1.0 - ageMs / DECAY_WINDOW_MS);
      score += recency;

      if (viewedArticleIds.has(article._id.toString())) {
        score -= 5.0;
      }

      return Object.assign(article, { score }) as ScoredArticle;
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}


export async function getFeed(
  userId: string,
  topic: Topic | null,
  page: number,
  limit: number,
): Promise<FeedResponse> {
  limit = Math.min(Math.max(limit, 1), 50);
  page = Math.max(page, 1);

  const cacheKey = `feed:${userId}:${topic ?? 'all'}:${page}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    // Still record user activity even on cache hit
    recordActivity(userId).catch(() => {});
    return JSON.parse(cached) as FeedResponse;
  }

  // Record user activity (DAU tracking)
  recordActivity(userId).catch(() => {});

  const user = await User.findById(userId).lean();
  const userInterests: Topic[] = user?.interests ?? [];

  const viewedInteractions = await Interaction.find({
    user_id: userId,
    action: 'view',
  })
    .select('article_id')
    .lean();
  const viewedArticleIds = new Set(
    viewedInteractions.map((i) => i.article_id.toString()),
  );

  const articleFilter: Record<string, unknown> = {
    processing_status: { $in: ['done', 'fallback'] },
  };
  if (topic) {
    articleFilter.topic = topic;
  }

  const articles = await Article.find(articleFilter)
    .sort({ created_at: -1 })
    .lean();

  const ranked = rankArticles(
    articles as IArticle[],
    userInterests,
    viewedArticleIds,
  );

  const totalItems = ranked.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit;
  const pageArticles = ranked.slice(start, start + limit);

  const articleIds = pageArticles.map((a) => a._id);
  const bookmarks = await Bookmark.find({
    user_id: userId,
    article_id: { $in: articleIds },
  })
    .select('article_id')
    .lean();
  const bookmarkedIds = new Set(bookmarks.map((b) => b.article_id.toString()));

  // Fetch active ads for the current topic filter
  const activeAds = await getActiveAds(topic ?? undefined);

  // Build a map of affiliate links by topic
  const topicsInPage = [...new Set(pageArticles.map((a) => a.topic).filter(Boolean))] as Topic[];
  const affiliateLinksByTopic: Record<string, AffiliateLink[]> = {};
  for (const t of topicsInPage) {
    const links = await getAffiliateLinks(t);
    affiliateLinksByTopic[t] = links.map((l) => ({
      id: l._id.toString(),
      title: l.title,
      url: l.url,
      topic: l.topic,
      commission: l.commission,
      provider: l.provider,
      isActive: l.is_active,
    }));
  }

  // Map to FeedItem with isSponsored and affiliateLinks
  const feedItems: FeedItem[] = pageArticles.map((a) => {
    const articleTopic = a.topic ?? ('ai' as Topic);
    const topicLinks = affiliateLinksByTopic[articleTopic] ?? [];
    return {
      id: a._id.toString(),
      titleOriginal: a.title_original,
      titleAi: a.title_ai ?? '',
      summaryBullets: a.summary_bullets ?? [],
      reason: a.reason ?? '',
      url: a.url,
      topic: articleTopic,
      source: a.source,
      publishedAt: a.published_at?.toISOString() ?? '',
      isBookmarked: bookmarkedIds.has(a._id.toString()),
      createdAt: a.created_at.toISOString(),
      readingTimeSec: estimateReadingTimeSec(a),
      isSponsored: a.is_sponsored ?? false,
      affiliateLinks: topicLinks.slice(0, 2),
      thumbnailUrl: (a as any).thumbnailUrl ?? undefined,
      isTrending: false,
    };
  });

  // Inject native ad slots every 5th position
  const items: FeedEntry[] = [];
  let adIndex = 0;

  // Collect affiliate link IDs for impression tracking
  const affiliateLinkIdsShown: string[] = [];

  for (let i = 0; i < feedItems.length; i++) {
    const fi = feedItems[i];
    // Collect affiliate impression IDs
    if (fi.affiliateLinks) {
      for (const al of fi.affiliateLinks) {
        affiliateLinkIdsShown.push(al.id);
      }
    }
    items.push(fi);
    if ((i + 1) % 5 === 0 && adIndex < activeAds.length) {
      const ad = activeAds[adIndex];
      const adItem: AdItem = {
        id: ad._id.toString(),
        type: 'native_ad',
        title: ad.title,
        description: ad.description,
        imageUrl: ad.image_url,
        targetUrl: ad.target_url,
        advertiser: ad.advertiser,
        topic: ad.topic,
        isAd: true,
      };
      items.push(adItem);
      // Fire-and-forget impression tracking
      trackAdImpression(ad._id.toString()).catch(() => {});
      adIndex++;
    }
  }

  const response: FeedResponse = {
    items,
    page,
    totalPages,
    hasMore: page < totalPages,
  };

  // Fire-and-forget affiliate impression tracking
  trackAffiliateImpressions(affiliateLinkIdsShown).catch(() => {});

  await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL);

  return response;
}

export async function invalidateUserFeedCache(userId: string): Promise<void> {
  const pattern = `feed:${userId}:*`;
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}
