/**
 * Feed Service — Optimized for mobile performance
 *
 * Optimizations applied:
 * 1. Redis cache (5min TTL) with ETag support
 * 2. Projection — only return fields needed by mobile (no content_clean, no embedding)
 * 3. Cursor-based pagination (optional, for infinite scroll)
 * 4. Compound index usage (processing_status + topic + created_at)
 * 5. Limit MongoDB query to 200 candidates max (not full scan)
 * 6. Pre-computed reading time
 * 7. Batch bookmark lookup
 */

import crypto from 'crypto';
import Redis from 'ioredis';
import { config } from '../config';
import { Article, IArticle } from '../models/Article';
import { User } from '../models/User';
import { Interaction } from '../models/Interaction';
import { Bookmark } from '../models/Bookmark';
import { Topic, FeedItem, FeedResponse, FeedEntry, AdItem, AffiliateLink } from '../types/api.types';
import { getActiveAds, trackAdImpression } from './ad.service';
import { getAffiliateLinks, trackAffiliateImpressions } from './affiliate.service';
import { recordActivity } from './userActivity.service';

const redis = new Redis(config.redisUrl);

const CACHE_TTL = 300; // 5 minutes
const DECAY_WINDOW_MS = 48 * 3600_000; // 48 hours
const READING_SPEED_WPM = 200;
const MAX_CANDIDATES = 200; // Max articles to fetch from DB for ranking

// ─── Projection: only fields needed by mobile ───
const FEED_PROJECTION = {
  title_original: 1,
  title_ai: 1,
  summary_bullets: 1,
  reason: 1,
  url: 1,
  topic: 1,
  source: 1,
  published_at: 1,
  created_at: 1,
  is_sponsored: 1,
  sponsor_name: 1,
  image_url: 1,
  // Explicitly exclude heavy fields:
  // content_clean: 0, embedding: 0, cluster_id: 0, url_hash: 0
};

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

interface ScoredArticle {
  _id: any;
  title_original: string;
  title_ai: string;
  summary_bullets: string[];
  reason: string;
  url: string;
  topic: Topic;
  source: string;
  published_at: Date | null;
  created_at: Date;
  is_sponsored: boolean;
  sponsor_name?: string;
  image_url?: string;
  score: number;
}

function rankArticles(
  articles: any[],
  userInterests: Topic[],
  viewedArticleIds: Set<string>,
): ScoredArticle[] {
  const now = Date.now();

  return articles
    .map((article) => {
      let score = 0;

      // Topic boost
      if (article.topic && userInterests.includes(article.topic)) {
        score += 2.0;
      }

      // Recency decay (48h window)
      const ageMs = now - new Date(article.created_at).getTime();
      const recency = Math.max(0, 1.0 - ageMs / DECAY_WINDOW_MS);
      score += recency;

      // View penalty
      if (viewedArticleIds.has(article._id.toString())) {
        score -= 5.0;
      }

      return { ...article, score } as ScoredArticle;
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}


// ─── Main Feed (offset pagination — for backward compat) ───

export async function getFeed(
  userId: string,
  topic: Topic | null,
  page: number,
  limit: number,
): Promise<FeedResponse & { etag?: string }> {
  limit = Math.min(Math.max(limit, 1), 50);
  page = Math.max(page, 1);

  const cacheKey = `feed:${userId}:${topic ?? 'all'}:${page}:${limit}`;

  // Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    recordActivity(userId).catch(() => {});
    const parsed = JSON.parse(cached);
    return parsed;
  }

  // Record user activity (DAU tracking, fire-and-forget)
  recordActivity(userId).catch(() => {});

  // Fetch user interests (lean, only interests field)
  const user = await User.findById(userId).select('interests').lean();
  const userInterests: Topic[] = user?.interests ?? [];

  // Fetch viewed article IDs (only recent 500 to limit memory)
  const viewedInteractions = await Interaction.find({
    user_id: userId,
    action: 'view',
  })
    .sort({ created_at: -1 })
    .limit(500)
    .select('article_id')
    .lean();
  const viewedArticleIds = new Set(
    viewedInteractions.map((i) => i.article_id.toString()),
  );

  // Query articles with PROJECTION (no content_clean, no embedding)
  // Limit to MAX_CANDIDATES to avoid full collection scan
  const articleFilter: Record<string, unknown> = {
    processing_status: { $in: ['done', 'fallback'] },
  };
  if (topic) {
    articleFilter.topic = topic;
  }

  const articles = await Article.find(articleFilter)
    .select(FEED_PROJECTION)
    .sort({ created_at: -1 })
    .limit(MAX_CANDIDATES)
    .lean();

  // Rank in memory (fast — only 200 items max)
  const ranked = rankArticles(articles, userInterests, viewedArticleIds);

  const totalItems = ranked.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit;
  const pageArticles = ranked.slice(start, start + limit);

  // Batch bookmark lookup (single query)
  const articleIds = pageArticles.map((a) => a._id);
  const bookmarks = await Bookmark.find({
    user_id: userId,
    article_id: { $in: articleIds },
  })
    .select('article_id')
    .lean();
  const bookmarkedIds = new Set(bookmarks.map((b) => b.article_id.toString()));

  // Fetch ads + affiliates
  const activeAds = await getActiveAds(topic ?? undefined);
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

  // Build feed items (lightweight — no heavy fields)
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
      publishedAt: a.published_at?.toISOString?.() ?? '',
      isBookmarked: bookmarkedIds.has(a._id.toString()),
      createdAt: a.created_at.toISOString?.() ?? new Date(a.created_at).toISOString(),
      readingTimeSec: estimateReadingTimeSec(a as any),
      isSponsored: a.is_sponsored ?? false,
      affiliateLinks: topicLinks.slice(0, 2),
      thumbnailUrl: a.image_url || undefined,
      isTrending: false,
    };
  });

  // Inject native ad slots every 5th position
  const items: FeedEntry[] = [];
  let adIndex = 0;
  const affiliateLinkIdsShown: string[] = [];

  for (let i = 0; i < feedItems.length; i++) {
    const fi = feedItems[i];
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
      trackAdImpression(ad._id.toString()).catch(() => {});
      adIndex++;
    }
  }

  const response: FeedResponse & { etag?: string } = {
    items,
    page,
    totalPages,
    hasMore: page < totalPages,
  };

  // Generate ETag for 304 support
  const etag = crypto.createHash('md5').update(JSON.stringify(items.map(i => (i as any).id || (i as any).title))).digest('hex');
  response.etag = etag;

  // Fire-and-forget tracking
  trackAffiliateImpressions(affiliateLinkIdsShown).catch(() => {});

  // Cache in Redis
  await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL);

  return response;
}


// ─── Cursor-based Feed (for mobile infinite scroll) ───

export async function getFeedCursor(
  userId: string,
  topic: Topic | null,
  cursor: string | null,
  limit: number,
): Promise<{ items: FeedEntry[]; nextCursor: string | null; etag: string }> {
  limit = Math.min(Math.max(limit, 1), 50);

  // Record activity
  recordActivity(userId).catch(() => {});

  const user = await User.findById(userId).select('interests').lean();
  const userInterests: Topic[] = user?.interests ?? [];

  // Build filter with cursor (cursor = last article _id)
  const articleFilter: Record<string, unknown> = {
    processing_status: { $in: ['done', 'fallback'] },
  };
  if (topic) articleFilter.topic = topic;
  if (cursor) articleFilter._id = { $lt: cursor };

  // Fetch with projection + limit (no full scan)
  const articles = await Article.find(articleFilter)
    .select(FEED_PROJECTION)
    .sort({ _id: -1 })
    .limit(limit + 1) // +1 to check hasMore
    .lean();

  const hasMore = articles.length > limit;
  const pageArticles = hasMore ? articles.slice(0, limit) : articles;
  const nextCursor = hasMore ? pageArticles[pageArticles.length - 1]._id.toString() : null;

  // Viewed articles (for penalty — but don't block, just deprioritize)
  const viewedInteractions = await Interaction.find({
    user_id: userId,
    action: 'view',
    article_id: { $in: pageArticles.map(a => a._id) },
  }).select('article_id').lean();
  const viewedIds = new Set(viewedInteractions.map(i => i.article_id.toString()));

  // Bookmarks
  const bookmarks = await Bookmark.find({
    user_id: userId,
    article_id: { $in: pageArticles.map(a => a._id) },
  }).select('article_id').lean();
  const bookmarkedIds = new Set(bookmarks.map(b => b.article_id.toString()));

  // Build items
  const items: FeedEntry[] = pageArticles.map((a) => ({
    id: a._id.toString(),
    titleOriginal: a.title_original,
    titleAi: a.title_ai ?? '',
    summaryBullets: a.summary_bullets ?? [],
    reason: a.reason ?? '',
    url: a.url,
    topic: (a.topic ?? 'ai') as Topic,
    source: a.source,
    publishedAt: a.published_at?.toISOString?.() ?? '',
    isBookmarked: bookmarkedIds.has(a._id.toString()),
    createdAt: a.created_at.toISOString?.() ?? new Date(a.created_at).toISOString(),
    readingTimeSec: estimateReadingTimeSec(a as any),
    isSponsored: a.is_sponsored ?? false,
    affiliateLinks: [],
    thumbnailUrl: (a as any).image_url || undefined,
    isTrending: false,
    isViewed: viewedIds.has(a._id.toString()),
  } as FeedItem));

  const etag = crypto.createHash('md5').update(JSON.stringify(items.map(i => (i as any).id))).digest('hex');

  return { items, nextCursor, etag };
}


// ─── Cache Invalidation ───

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
