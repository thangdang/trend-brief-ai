/**
 * Tests for Crawler & Performance improvements.
 * Source health, feed scores, trending cache, Meilisearch.
 */

// ─── Source Health Tests ───

describe('Source Health Tracking', () => {
  it('RssSource model should have health field', () => {
    const { RssSource } = require('../models/RssSource');
    const schema = RssSource.schema.obj;
    expect(schema.health).toBeDefined();
    expect(schema.health.type.success_count_24h).toBeDefined();
    expect(schema.health.type.auto_disabled).toBeDefined();
  });

  it('health defaults should be healthy', () => {
    const { RssSource } = require('../models/RssSource');
    const defaults = RssSource.schema.obj.health.default();
    expect(defaults.success_rate).toBe(1.0);
    expect(defaults.auto_disabled).toBe(false);
    expect(defaults.consecutive_failures).toBe(0);
  });
});

// ─── Feed Score Tests ───

describe('Feed Score Worker', () => {
  it('should export computeFeedScores function', () => {
    const { computeFeedScores } = require('../workers/feedScore.worker');
    expect(typeof computeFeedScores).toBe('function');
  });

  it('should export startFeedScoreScheduler function', () => {
    const { startFeedScoreScheduler } = require('../workers/feedScore.worker');
    expect(typeof startFeedScoreScheduler).toBe('function');
  });
});

describe('Feed Service ranking', () => {
  it('Article model should have feed_score field', () => {
    const { Article } = require('../models/Article');
    const schema = Article.schema.obj;
    expect(schema.feed_score).toBeDefined();
    expect(schema.feed_score.type).toBe(Number);
    expect(schema.feed_score.default).toBe(0);
  });

  it('Article model should have quality_score field', () => {
    const { Article } = require('../models/Article');
    expect(Article.schema.obj.quality_score).toBeDefined();
  });

  it('Article model should support all 10 topics', () => {
    const { Article } = require('../models/Article');
    const topicEnum = Article.schema.obj.topic.enum;
    expect(topicEnum).toContain('ai');
    expect(topicEnum).toContain('technology');
    expect(topicEnum).toContain('health');
    expect(topicEnum).toContain('entertainment');
    expect(topicEnum).toContain('sport');
    expect(topicEnum.length).toBe(10);
  });
});

// ─── Trending Cache Tests ───

describe('Trending Service', () => {
  it('should export getTrendingArticles', () => {
    const { getTrendingArticles } = require('../services/trending.service');
    expect(typeof getTrendingArticles).toBe('function');
  });

  it('should export refreshTrendingCache', () => {
    const { refreshTrendingCache } = require('../services/trending.service');
    expect(typeof refreshTrendingCache).toBe('function');
  });
});

// ─── Meilisearch Tests ───

describe('Meilisearch Service', () => {
  it('should export all required functions', () => {
    const meili = require('../services/meiliSearch.service');
    expect(typeof meili.searchArticles).toBe('function');
    expect(typeof meili.syncArticle).toBe('function');
    expect(typeof meili.bulkSyncArticles).toBe('function');
    expect(typeof meili.isAvailable).toBe('function');
  });

  it('isAvailable should return boolean', () => {
    const { isAvailable } = require('../services/meiliSearch.service');
    expect(typeof isAvailable()).toBe('boolean');
  });
});

// ─── Image Proxy Tests ───

describe('Image Proxy Route', () => {
  it('should be importable', () => {
    const imageRoutes = require('../routes/image.routes');
    expect(imageRoutes).toBeDefined();
  });
});

// ─── Related Articles Tests ───

describe('Related Service', () => {
  it('should export getRelatedArticles', () => {
    const { getRelatedArticles } = require('../services/related.service');
    expect(typeof getRelatedArticles).toBe('function');
  });
});
