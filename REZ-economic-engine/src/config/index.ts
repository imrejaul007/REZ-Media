/**
 * ReZ Economic Engine - Configuration
 *
 * All configurable values in one place
 */

export const config = {
  // Service
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB - REQUIRED in production
  MONGODB_URI: process.env.MONGODB_URI,

  // Redis
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  // BullMQ (for workers)
  BULLMQ_REDIS_HOST: process.env.BULLMQ_REDIS_HOST || process.env.REDIS_HOST,
  BULLMQ_REDIS_PORT: parseInt(process.env.BULLMQ_REDIS_PORT || '6379'),

  // Authentication - REQUIRED in production
  JWT_SECRET: process.env.JWT_SECRET,
  SERVICE_API_KEY: process.env.SERVICE_API_KEY,

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 1000,

  // Karma Scoring
  KARMA: {
    SCORE: {
      MIN: 300,
      MAX: 900,
      BASE: 300,
    },
    COMPONENTS: {
      IMPACT_MAX: 250,
      RELATIVE_RANK_MAX: 180,
      TRUST_MAX: 100,
      MOMENTUM_MAX: 70,
    },
    STABILITY: {
      MAX_DAILY_CHANGE: 5,
      EXTREME_MAX: 10,
    },
    DECAY: {
      THIRTY_DAYS: -5,
      SIXTY_DAYS: -10,
      NINETY_DAYS: -20,
    },
    WEEKLY_CAP: 500, // Max karma earned per week
    NIGHTLY_JOB_HOUR: 1, // 1 AM
  },

  // Coins
  COINS: {
    DAILY_CAP: 1000,
    WEEKLY_CAP: 3000,
    MIN_REDEMPTION: 10,
    MAX_REDEMPTION: 5000,
    TO_RUPEE_RATE: 1.0, // 1 coin = ₹1
  },

  // Karma-to-Coin Conversion
  CONVERSION: {
    WEEKLY_COIN_CAP: 300, // Max coins from conversion per week
    // Rates by tier (percentage of karma converted to coins)
    RATES: {
      L1: 0.25, // 25%
      L2: 0.50, // 50%
      L3: 0.75, // 75%
      L4: 1.00, // 100%
    },
  },

  // Fraud Detection
  FRAUD: {
    RAPID_SCAN_THRESHOLD: 10,
    RAPID_SCAN_WINDOW_SECONDS: 30,
    IP_FLOOD_THRESHOLD: 10,
    IP_FLOOD_WINDOW_SECONDS: 3600,
    IMPOSSIBLE_TRAVEL_KM: 500,
    IMPOSSIBLE_TRAVEL_HOURS: 1,
  },

  // Cache TTL (seconds)
  CACHE: {
    RULES_TTL: 300, // 5 minutes
    KARMA_TTL: 60, // 1 minute
    USER_TTL: 300, // 5 minutes
  },

  // External Services
  EXTERNAL_SERVICES: {
    WALLET_SERVICE_URL: process.env.WALLET_SERVICE_URL || 'http://localhost:4002',
    KARMA_SERVICE_URL: process.env.KARMA_SERVICE_URL || 'http://localhost:4001',
    MIND_SERVICE_URL: process.env.MIND_SERVICE_URL || 'http://localhost:4008',
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:4000',
  },
};

export type Config = typeof config;
