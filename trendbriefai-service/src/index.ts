import express from 'express';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { connectDatabase } from './db/connection';
import { generalLimiter, authLimiter } from './middleware/rateLimit';

import authRoutes from './routes/auth.routes';
import feedRoutes from './routes/feed.routes';
import bookmarkRoutes from './routes/bookmark.routes';
import interactionRoutes from './routes/interaction.routes';
import topicRoutes from './routes/topic.routes';
import userRoutes from './routes/user.routes';
import searchRoutes from './routes/search.routes';
import trendingRoutes from './routes/trending.routes';
import adRoutes from './routes/ad.routes';
import affiliateRoutes from './routes/affiliate.routes';
import analyticsRoutes from './routes/analytics.routes';
import notificationRoutes from './routes/notification.routes';
import publicRoutes from './routes/public.routes';
import sourceRoutes from './routes/source.routes';
import adminRoutes from './routes/admin.routes';
import articleRoutes from './routes/article.routes';
import referralRoutes from './routes/referral.routes';
import reactionRoutes from './routes/reaction.routes';
import paymentRoutes from './routes/payment.routes';
import { startCrawlScheduler } from './workers/crawl.worker';
import { startNotificationScheduler } from './workers/notification.scheduler';
import { startFeedScoreScheduler } from './workers/feedScore.worker';

const app = express();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(generalLimiter);

// API version header
import { apiVersionHeader } from './middleware/apiVersion';
app.use(apiVersionHeader);

// Request logger (structured JSON, slow request warnings)
import { requestLogger } from './middleware/requestLogger';
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  const { aiEngineBreaker } = require('./middleware/circuitBreaker');
  const { getRequestMetrics } = require('./middleware/requestLogger');
  const { refreshTrendingCache } = require('./services/trending.service');
  res.json({
    status: 'ok',
    circuit_breaker: aiEngineBreaker.getStatus(),
    request_metrics: getRequestMetrics(),
    trending_cache: { note: 'Refreshed every 30 min via scheduler' },
  });
});

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'TrendBrief AI – API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}));
app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// Public routes (no auth — for user website)
app.use('/api/public', publicRoutes);

// Image proxy (public, no auth)
import imageRoutes from './routes/image.routes';
app.use('/api/img', imageRoutes);

// Routes (auth required — for admin + mobile app)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/payment', paymentRoutes);

async function start() {
  await connectDatabase();
  // Crawl scheduler: only start if CRAWL_MODE=service (legacy mode)
  // In hybrid deployment, the engine runs its own scheduler (python scheduler.py)
  if (config.crawlMode === 'service') {
    startCrawlScheduler();
    console.log('📡 Crawl mode: service (triggers engine via HTTP)');
  } else {
    console.log('📡 Crawl mode: engine (engine runs its own scheduler independently)');
  }
  startNotificationScheduler();
  startFeedScoreScheduler();

  app.listen(config.port, () => {
    console.log(`🚀 TrendBrief API running on port ${config.port}`);
    console.log(`📚 Swagger docs: http://localhost:${config.port}/api-docs`);
  });
}

start();

export default app;
