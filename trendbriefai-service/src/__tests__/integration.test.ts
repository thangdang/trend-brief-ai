/**
 * Integration tests for TrendBrief AI service improvements.
 * Tests: source health, feed scores, circuit breaker, referral, validation.
 */

// ─── Circuit Breaker Tests ───

describe('CircuitBreaker', () => {
  let CircuitBreaker: any;

  beforeEach(() => {
    CircuitBreaker = require('../middleware/circuitBreaker').default;
  });

  it('should start in CLOSED state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 100 });
    expect(cb.getStatus().state).toBe('CLOSED');
  });

  it('should open after threshold failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 100 });
    const failFn = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      try { await cb.exec(failFn); } catch {}
    }

    expect(cb.getStatus().state).toBe('OPEN');
    expect(cb.getStatus().failureCount).toBe(3);
  });

  it('should use fallback when open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50 });
    try { await cb.exec(() => Promise.reject(new Error('fail'))); } catch {}

    const result = await cb.exec(
      () => Promise.resolve('main'),
      () => 'fallback',
    );
    expect(result).toBe('fallback');
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50 });
    try { await cb.exec(() => Promise.reject(new Error('fail'))); } catch {}

    await new Promise(r => setTimeout(r, 60));

    const result = await cb.exec(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(cb.getStatus().state).toBe('CLOSED');
  });

  it('should reset on manual reset', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    cb.reset();
    expect(cb.getStatus().state).toBe('CLOSED');
    expect(cb.getStatus().failureCount).toBe(0);
  });
});

// ─── Validation Middleware Tests ───

describe('Validation Middleware', () => {
  it('should export validate function', () => {
    const { validate } = require('../middleware/validate');
    expect(typeof validate).toBe('function');
  });

  it('should export common schemas', () => {
    const schemas = require('../middleware/validate');
    expect(schemas.feedQuerySchema).toBeDefined();
    expect(schemas.searchQuerySchema).toBeDefined();
    expect(schemas.bookmarkBodySchema).toBeDefined();
    expect(schemas.loginBodySchema).toBeDefined();
  });

  it('feedQuerySchema should validate valid input', () => {
    const { feedQuerySchema } = require('../middleware/validate');
    const result = feedQuerySchema.safeParse({ topic: 'ai', page: '1', limit: '20' });
    expect(result.success).toBe(true);
  });

  it('feedQuerySchema should reject invalid topic', () => {
    const { feedQuerySchema } = require('../middleware/validate');
    const result = feedQuerySchema.safeParse({ topic: 'invalid_topic' });
    expect(result.success).toBe(false);
  });

  it('searchQuerySchema should require q param', () => {
    const { searchQuerySchema } = require('../middleware/validate');
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── API Version Middleware Tests ───

describe('API Version Middleware', () => {
  it('should export API_VERSION', () => {
    const { API_VERSION } = require('../middleware/apiVersion');
    expect(API_VERSION).toBe('1');
  });
});

// ─── Request Logger Tests ───

describe('Request Logger', () => {
  it('should export getRequestMetrics', () => {
    const { getRequestMetrics } = require('../middleware/requestLogger');
    const metrics = getRequestMetrics();
    expect(metrics).toHaveProperty('total_requests_5min');
    expect(metrics).toHaveProperty('error_count_5min');
    expect(metrics).toHaveProperty('error_rate');
  });
});

// ─── Related Service Tests ───

describe('Related Service', () => {
  it('should export getRelatedArticles', () => {
    const { getRelatedArticles } = require('../services/related.service');
    expect(typeof getRelatedArticles).toBe('function');
  });
});

// ─── Meilisearch Service Tests ───

describe('Meilisearch Service', () => {
  it('should export search and sync functions', () => {
    const meili = require('../services/meiliSearch.service');
    expect(typeof meili.searchArticles).toBe('function');
    expect(typeof meili.syncArticle).toBe('function');
    expect(typeof meili.bulkSyncArticles).toBe('function');
    expect(typeof meili.isAvailable).toBe('function');
  });
});

// ─── Affiliate Search Tests ───

describe('Affiliate Search', () => {
  it('should export searchAffiliateProducts', () => {
    const { searchAffiliateProducts } = require('../services/affiliateSearch.service');
    expect(typeof searchAffiliateProducts).toBe('function');
  });
});
