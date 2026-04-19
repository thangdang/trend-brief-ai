import express from 'express';
import cors from 'cors';
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
import { startCrawlScheduler } from './workers/crawl.worker';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'TrendBrief AI – API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}));
app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// Routes
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

async function start() {
  await connectDatabase();
  startCrawlScheduler();

  app.listen(config.port, () => {
    console.log(`🚀 TrendBrief API running on port ${config.port}`);
    console.log(`📚 Swagger docs: http://localhost:${config.port}/api-docs`);
  });
}

start();

export default app;
