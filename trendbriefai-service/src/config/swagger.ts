import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TrendBrief AI – API Documentation',
      version: '1.0.0',
      description: 'Vietnamese AI-summarized news for Gen Z. Đọc nhanh 30–60 giây.',
      contact: { name: 'TrendBrief AI Team' },
    },
    servers: [
      { url: '/api', description: 'API' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            display_name: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
            plan: { type: 'string', enum: ['free', 'premium'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Article: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title_ai: { type: 'string' },
            summary_bullets: {
              type: 'array',
              items: { type: 'string' },
              minItems: 3,
              maxItems: 3,
              example: ['Điểm chính 1', 'Điểm chính 2', 'Điểm chính 3'],
            },
            reason: { type: 'string' },
            topic: { type: 'string' },
            source_lang: { type: 'string', example: 'en' },
            was_translated: { type: 'boolean' },
            source_url: { type: 'string', format: 'uri' },
            image_url: { type: 'string', format: 'uri' },
            published_at: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Bookmark: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user_id: { type: 'string' },
            article_id: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Interaction: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user_id: { type: 'string' },
            article_id: { type: 'string' },
            type: { type: 'string', enum: ['view', 'like', 'share', 'read'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Topic: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            icon: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Ad: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            image_url: { type: 'string', format: 'uri' },
            target_url: { type: 'string', format: 'uri' },
            placement: { type: 'string' },
            is_active: { type: 'boolean' },
            impressions: { type: 'integer' },
            clicks: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        AffiliateLink: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            article_id: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            label: { type: 'string' },
            provider: { type: 'string' },
            clicks: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Analytics: {
          type: 'object',
          properties: {
            date: { type: 'string', example: '2026-04-15' },
            total_views: { type: 'integer' },
            unique_users: { type: 'integer' },
            articles_crawled: { type: 'integer' },
            bookmarks: { type: 'integer' },
            shares: { type: 'integer' },
          },
        },
        FeedResponse: {
          type: 'object',
          properties: {
            articles: { type: 'array', items: { $ref: '#/components/schemas/Article' } },
            page: { type: 'integer' },
            total_pages: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
