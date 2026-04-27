import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/trendbriefai',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-me',
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',

  // AI Service
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',

  // Crawl
  crawlIntervalMinutes: parseInt(process.env.CRAWL_INTERVAL_MINUTES || '10', 10),
  // CRAWL_MODE: 'service' = service triggers crawl via HTTP to engine (legacy)
  //             'engine'  = engine runs its own scheduler independently (recommended for hybrid)
  crawlMode: (process.env.CRAWL_MODE || 'engine') as 'service' | 'engine',

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  // Apple Sign In
  apple: {
    clientId: process.env.APPLE_CLIENT_ID || '',
    teamId: process.env.APPLE_TEAM_ID || '',
    keyId: process.env.APPLE_KEY_ID || '',
  },

  // Payment
  payment: {
    momo: {
      partnerCode: process.env.MOMO_PARTNER_CODE || '',
      accessKey: process.env.MOMO_ACCESS_KEY || '',
      secretKey: process.env.MOMO_SECRET_KEY || '',
      endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api',
      redirectUrl: process.env.MOMO_REDIRECT_URL || 'http://localhost:4200/payment/callback',
      ipnUrl: process.env.MOMO_IPN_URL || 'http://localhost:3000/api/payment/webhook/momo',
    },
    vnpay: {
      tmnCode: process.env.VNPAY_TMN_CODE || '',
      hashSecret: process.env.VNPAY_HASH_SECRET || '',
      url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:4200/payment/callback',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:4200/payment/success',
      cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:4200/payment/cancel',
    },
  },
};
