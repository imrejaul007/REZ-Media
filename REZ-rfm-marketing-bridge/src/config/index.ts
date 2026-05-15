import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  PORT: parseInt(process.env.PORT || '4099', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-rfm-marketing-bridge',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Internal Service Token
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN || '',
  INTERNAL_SERVICE_TOKENS_JSON: process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}',

  // RFM Settings
  RFM: {
    DEFAULT_LOOKBACK_DAYS: parseInt(process.env.RFM_LOOKBACK_DAYS || '90', 10),
    RECENCY_WEIGHT: parseFloat(process.env.RFM_RECENCY_WEIGHT || '0.3'),
    FREQUENCY_WEIGHT: parseFloat(process.env.RFM_FREQUENCY_WEIGHT || '0.3'),
    MONETARY_WEIGHT: parseFloat(process.env.RFM_MONETARY_WEIGHT || '0.4'),
    MIN_PURCHASES_FOR_FREQUENCY: parseInt(process.env.RFM_MIN_PURCHASES || '2', 10),
    RECALCULATION_INTERVAL_HOURS: parseInt(process.env.RFM_RECALC_INTERVAL || '24', 10),
  },

  // Segment Thresholds (RFM score ranges)
  SEGMENTS: {
    CHAMPIONS: { min: 13, max: 15 },
    LOYAL: { min: 11, max: 12 },
    POTENTIAL_LOYALIST: { min: 9, max: 10 },
    RECENT_CUSTOMERS: { min: 8, max: 8 },
    PROMISING: { min: 7, max: 7 },
    AT_RISK: { min: 5, max: 6 },
    CANT_LOSE_THEM: { min: 4, max: 4 },
    LOST: { min: 3, max: 3 },
    HESITANT: { min: 3, max: 5 },
    NEW_LOYAL: { min: 9, max: 15 },
  },

  // Campaign Settings
  CAMPAIGNS: {
    BATCH_SIZE: parseInt(process.env.CAMPAIGN_BATCH_SIZE || '100', 10),
    MAX_CONCURRENT: parseInt(process.env.CAMPAIGN_MAX_CONCURRENT || '5', 10),
    RETRY_ATTEMPTS: parseInt(process.env.CAMPAIGN_RETRY_ATTEMPTS || '3', 10),
    RATE_LIMIT_PER_MINUTE: parseInt(process.env.CAMPAIGN_RATE_LIMIT || '100', 10),
  },

  // External Services
  SERVICES: {
    RFM_SERVICE_URL: process.env.RFM_SERVICE_URL || 'http://localhost:4055',
    JOURNEY_SERVICE_URL: process.env.JOURNEY_SERVICE_URL || 'http://localhost:4019',
    ENGAGEMENT_SERVICE_URL: process.env.ENGAGEMENT_SERVICE_URL || 'http://localhost:4017',
    NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004',
    ANALYTICS_SERVICE_URL: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4006',
  },

  // Winston Logger
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Health Check
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),

  // Cron Jobs
  CRON: {
    RFM_RECALCULATION: process.env.CRON_RFM_RECALC || '0 2 * * *', // 2 AM daily
    SEGMENT_HEALTH_UPDATE: process.env.CRON_SEGMENT_HEALTH || '0 6 * * *', // 6 AM daily
    CAMPAIGN_TRIGGER_CHECK: process.env.CRON_CAMPAIGN_CHECK || '*/15 * * * *', // Every 15 minutes
  },
};

export const serviceTokens = JSON.parse(config.INTERNAL_SERVICE_TOKENS_JSON) as Record<string, string>;
