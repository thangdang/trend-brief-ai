/**
 * Dynamic Affiliate Search — find relevant products by article keywords.
 * Searches Shopee/Lazada APIs, ranks by match score, caches 24h.
 */

import Redis from 'ioredis';
import { config } from '../config';

const redis = new Redis(config.redisUrl);
const CACHE_TTL = 86400; // 24 hours
const CACHE_PREFIX = 'aff_search:';

interface AffiliateProduct {
  name: string;
  url: string;
  price: number;
  commission_rate: number;
  image_url?: string;
  platform: string;
  match_score: number;
}

/**
 * Search for affiliate products matching article keywords.
 * Returns top N products ranked by match_score.
 */
export async function searchAffiliateProducts(
  keywords: string[],
  topic: string,
  limit = 2,
): Promise<AffiliateProduct[]> {
  if (!keywords.length) return [];

  const cacheKey = `${CACHE_PREFIX}${keywords.slice(0, 3).join('_')}:${topic}`;

  // Check cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached).slice(0, limit);
  } catch { /* cache miss */ }

  const results: AffiliateProduct[] = [];

  // Search Shopee (placeholder — real implementation uses Shopee Open Platform API)
  try {
    const shopeeResults = await _searchShopee(keywords);
    results.push(...shopeeResults);
  } catch { /* Shopee unavailable */ }

  // Search Lazada (placeholder — real implementation uses Lazada Open Platform API)
  try {
    const lazadaResults = await _searchLazada(keywords);
    results.push(...lazadaResults);
  } catch { /* Lazada unavailable */ }

  // Rank by match score
  const scored = results.map(p => ({
    ...p,
    match_score: _computeMatchScore(p, keywords, topic),
  }));
  scored.sort((a, b) => b.match_score - a.match_score);

  const topResults = scored.slice(0, limit);

  // Cache results
  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(topResults));
  } catch { /* cache write failed */ }

  return topResults;
}

function _computeMatchScore(
  product: AffiliateProduct,
  keywords: string[],
  topic: string,
): number {
  const nameLower = product.name.toLowerCase();

  // Keyword overlap (50%)
  const matchCount = keywords.filter(k => nameLower.includes(k.toLowerCase())).length;
  const keywordScore = Math.min(matchCount / Math.max(keywords.length, 1), 1.0);

  // Category match (30%) — simple topic-to-category mapping
  const categoryMap: Record<string, string[]> = {
    ai: ['tech', 'software', 'gadget'],
    finance: ['book', 'course', 'tool'],
    lifestyle: ['home', 'beauty', 'food'],
    health: ['fitness', 'supplement', 'equipment'],
    career: ['book', 'course', 'tool'],
  };
  const categories = categoryMap[topic] || [];
  const categoryScore = categories.some(c => nameLower.includes(c)) ? 1.0 : 0.3;

  // Commission rate (20%)
  const commissionScore = Math.min(product.commission_rate / 15, 1.0);

  return keywordScore * 0.5 + categoryScore * 0.3 + commissionScore * 0.2;
}

async function _searchShopee(keywords: string[]): Promise<AffiliateProduct[]> {
  // Placeholder — real implementation calls Shopee Open Platform API
  // For now, return empty (will be populated when API keys are configured)
  return [];
}

async function _searchLazada(keywords: string[]): Promise<AffiliateProduct[]> {
  // Placeholder — real implementation calls Lazada Open Platform API
  return [];
}
