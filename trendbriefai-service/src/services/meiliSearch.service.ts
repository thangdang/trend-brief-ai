/**
 * Meilisearch Service — Vietnamese full-text search with typo tolerance.
 * Falls back to MongoDB $text search if Meilisearch is unavailable.
 */

import { config } from '../config';
import { Article } from '../models/Article';
import { Topic, FeedItem } from '../types/api.types';
import { estimateReadingTimeSec } from './feed.service';

const MEILI_URL = process.env.MEILI_URL || 'http://localhost:7700';
const MEILI_KEY = process.env.MEILI_MASTER_KEY || 'dev-meili-key';
const INDEX_NAME = 'articles';

let _client: any = null;
let _available = false;

async function getClient() {
  if (_client) return _client;
  try {
    const { MeiliSearch } = await import('meilisearch');
    _client = new MeiliSearch({ host: MEILI_URL, apiKey: MEILI_KEY });
    await _client.health();
    _available = true;

    // Ensure index exists with searchable attributes
    try {
      const index = _client.index(INDEX_NAME);
      await index.updateSearchableAttributes(['title_ai', 'title_original', 'summary_text', 'topic', 'source']);
      await index.updateFilterableAttributes(['topic', 'processing_status']);
      await index.updateSortableAttributes(['created_at']);
    } catch { /* index may already be configured */ }

    console.log('[Meilisearch] Connected and index configured');
    return _client;
  } catch (err: any) {
    console.warn(`[Meilisearch] Unavailable: ${err.message} — using MongoDB fallback`);
    _available = false;
    return null;
  }
}

/**
 * Sync an article to Meilisearch index.
 * Call after article insert/update with processing_status=done.
 */
export async function syncArticle(article: any): Promise<void> {
  const client = await getClient();
  if (!client) return;

  try {
    const doc = {
      id: article._id.toString(),
      title_ai: article.title_ai || '',
      title_original: article.title_original || '',
      summary_text: (article.summary_bullets || []).join(' '),
      topic: article.topic || '',
      source: article.source || '',
      processing_status: article.processing_status || 'done',
      created_at: article.created_at ? new Date(article.created_at).getTime() : Date.now(),
      image_url: article.image_url || null,
    };
    await client.index(INDEX_NAME).addDocuments([doc]);
  } catch (err: any) {
    console.warn(`[Meilisearch] Sync failed for ${article._id}: ${err.message}`);
  }
}

/**
 * Search articles via Meilisearch. Falls back to MongoDB $text.
 */
export async function searchArticles(
  query: string,
  topic?: string,
  page = 1,
  limit = 20,
): Promise<{ items: FeedItem[]; total: number; source: 'meilisearch' | 'mongodb' }> {
  // Try Meilisearch first
  if (_available) {
    try {
      const client = await getClient();
      if (client) {
        const filters: string[] = ['processing_status = done'];
        if (topic) filters.push(`topic = ${topic}`);

        const result = await client.index(INDEX_NAME).search(query, {
          limit,
          offset: (page - 1) * limit,
          filter: filters.join(' AND '),
          sort: ['created_at:desc'],
          attributesToHighlight: ['title_ai', 'summary_text'],
          highlightPreTag: '<mark>',
          highlightPostTag: '</mark>',
        });

        const items: FeedItem[] = result.hits.map((hit: any) => ({
          id: hit.id,
          titleOriginal: hit.title_original || '',
          titleAi: hit._formatted?.title_ai || hit.title_ai || '',
          summaryBullets: hit.summary_text ? [hit._formatted?.summary_text || hit.summary_text] : [],
          reason: '',
          url: '',
          topic: (hit.topic || 'ai') as Topic,
          source: hit.source || '',
          publishedAt: '',
          isBookmarked: false,
          createdAt: new Date(hit.created_at).toISOString(),
          readingTimeSec: 30,
          isSponsored: false,
          isTrending: false,
        }));

        return { items, total: result.estimatedTotalHits || 0, source: 'meilisearch' };
      }
    } catch (err: any) {
      console.warn(`[Meilisearch] Search failed: ${err.message} — falling back to MongoDB`);
    }
  }

  // Fallback: MongoDB $text search
  const filter: any = {
    $text: { $search: query },
    processing_status: { $in: ['done', 'fallback'] },
  };
  if (topic) filter.topic = topic;

  const [articles, total] = await Promise.all([
    Article.find(filter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Article.countDocuments(filter),
  ]);

  const items: FeedItem[] = articles.map((a: any) => ({
    id: a._id.toString(),
    titleOriginal: a.title_original,
    titleAi: a.title_ai || '',
    summaryBullets: a.summary_bullets || [],
    reason: a.reason || '',
    url: a.url,
    topic: (a.topic || 'ai') as Topic,
    source: a.source,
    publishedAt: a.published_at?.toISOString() || '',
    isBookmarked: false,
    createdAt: a.created_at.toISOString(),
    readingTimeSec: estimateReadingTimeSec(a),
    isSponsored: false,
    isTrending: false,
  }));

  return { items, total, source: 'mongodb' };
}

/**
 * Bulk sync all existing articles to Meilisearch (initial index build).
 */
export async function bulkSyncArticles(): Promise<number> {
  const client = await getClient();
  if (!client) return 0;

  const articles = await Article.find({ processing_status: { $in: ['done', 'fallback'] } })
    .select('title_ai title_original summary_bullets topic source processing_status created_at image_url')
    .lean();

  const docs = articles.map((a: any) => ({
    id: a._id.toString(),
    title_ai: a.title_ai || '',
    title_original: a.title_original || '',
    summary_text: (a.summary_bullets || []).join(' '),
    topic: a.topic || '',
    source: a.source || '',
    processing_status: a.processing_status,
    created_at: a.created_at ? new Date(a.created_at).getTime() : Date.now(),
    image_url: a.image_url || null,
  }));

  if (docs.length > 0) {
    // Batch in chunks of 1000
    for (let i = 0; i < docs.length; i += 1000) {
      await client.index(INDEX_NAME).addDocuments(docs.slice(i, i + 1000));
    }
  }

  console.log(`[Meilisearch] Bulk synced ${docs.length} articles`);
  return docs.length;
}

export function isAvailable(): boolean {
  return _available;
}
