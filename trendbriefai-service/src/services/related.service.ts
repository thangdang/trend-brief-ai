/**
 * Related Articles Service
 * Uses existing article embeddings (all-MiniLM-L6-v2, 384-dim) to find
 * semantically similar articles via cosine similarity.
 */

import { Article } from '../models/Article';
import { getRedis } from '../db/connection';

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = 'related:';

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Get related articles for a given article ID.
 * Uses embedding cosine similarity, falls back to same-topic recency.
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

  const article = await Article.findById(articleId)
    .select('embedding topic created_at')
    .lean();

  if (!article) return [];

  // If no embedding, fallback to same-topic recent articles
  if (!article.embedding?.length) {
    return getFallbackRelated(articleId, article.topic, limit);
  }

  // Find candidates: same topic, last 7 days, has embedding
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const candidates = await Article.find({
    _id: { $ne: articleId },
    topic: article.topic,
    processing_status: 'done',
    embedding: { $exists: true, $ne: [] },
    created_at: { $gte: sevenDaysAgo },
  })
    .select('title_ai summary_bullets image_url embedding created_at topic source')
    .limit(50)
    .lean();

  // Score by cosine similarity
  const scored = candidates
    .map((c: any) => ({
      _id: c._id,
      title_ai: c.title_ai,
      summary_bullets: c.summary_bullets,
      image_url: c.image_url,
      topic: c.topic,
      source: c.source,
      created_at: c.created_at,
      similarity: cosineSimilarity(article.embedding, c.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(({ similarity, ...rest }) => rest); // remove embedding from response

  // Cache result
  try {
    const redis = getRedis();
    if (redis && scored.length > 0) {
      await redis.setex(`${CACHE_PREFIX}${articleId}`, CACHE_TTL, JSON.stringify(scored));
    }
  } catch { /* cache write failed */ }

  return scored;
}

async function getFallbackRelated(articleId: string, topic: string, limit: number): Promise<any[]> {
  return Article.find({
    _id: { $ne: articleId },
    topic: topic || 'lifestyle',
    processing_status: 'done',
  })
    .select('title_ai summary_bullets image_url topic source created_at')
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
}
