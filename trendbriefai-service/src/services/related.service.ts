/**
 * Related Articles Service
 *
 * Delegates to AI engine POST /related for embedding-based similarity.
 * Falls back to same-topic recency if engine is offline.
 * Results cached in Redis for 1 hour.
 */

import axios from 'axios';
import { config } from '../config';
import { Article } from '../models/Article';
import { getRedis } from '../db/connection';

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = 'related:';

/**
 * Get related articles for a given article ID.
 * Calls AI engine for embedding similarity, falls back to same-topic recency.
 */
export async function getRelatedArticles(articleId: string, limit = 5): Promise<any[]> {
  // Check Redis cache
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get(`${CACHE_PREFIX}${articleId}`);
      if (cached) return JSON.parse(cached);
    }
  } catch { /* cache miss */ }

  // Try AI engine for embedding-based similarity
  try {
    const { data } = await axios.post(
      `${config.aiServiceUrl}/related`,
      { article_id: articleId, limit },
      { timeout: 5000 },
    );
    const articles = data.articles || [];

    // Cache result
    if (articles.length > 0) {
      try {
        const redis = getRedis();
        if (redis) {
          await redis.setex(`${CACHE_PREFIX}${articleId}`, CACHE_TTL, JSON.stringify(articles));
        }
      } catch { /* cache write failed */ }
    }

    return articles;
  } catch {
    // AI engine offline — fallback to same-topic recency
  }

  // Fallback: same-topic recent articles (no AI needed)
  const article = await Article.findById(articleId).select('topic').lean();
  if (!article) return [];

  const fallback = await Article.find({
    _id: { $ne: articleId },
    topic: article.topic || 'lifestyle',
    processing_status: 'done',
  })
    .select('title_ai summary_bullets image_url topic source created_at')
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  // Cache fallback too
  try {
    const redis = getRedis();
    if (redis && fallback.length > 0) {
      await redis.setex(`${CACHE_PREFIX}${articleId}`, CACHE_TTL, JSON.stringify(fallback));
    }
  } catch { /* cache write failed */ }

  return fallback;
}
