/**
 * Lead Intelligence Service Configuration
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '4040', 10),
  healthPort: parseInt(process.env.HEALTH_PORT || '4041', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    db: process.env.MONGODB_DB || 'rez_lead_intelligence',
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Service URLs
  services: {
    marketing: process.env.MARKETING_SERVICE_URL || 'https://rez-marketing-service.onrender.com',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notification-service.onrender.com',
    profile: process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com',
    order: process.env.ORDER_SERVICE_URL || 'https://rez-order-service.onrender.com',
    intent: process.env.INTENT_SERVICE_URL || 'https://rez-intent-graph.onrender.com',
    mind: process.env.MIND_SERVICE_URL || 'https://rez-event-platform.onrender.com',
  },

  // Lead Scoring Thresholds
  thresholds: {
    hot: parseFloat(process.env.LEAD_HOT_THRESHOLD || '75'),
    warm: parseFloat(process.env.LEAD_WARM_THRESHOLD || '40'),
  },

  // Scoring Weights
  scoring: {
    weights: {
      recentSearches: parseFloat(process.env.WEIGHT_RECENT_SEARCHES || '0.15'),
      abandonedCarts: parseFloat(process.env.WEIGHT_ABANDONED_CARTS || '0.25'),
      viewedProducts: parseFloat(process.env.WEIGHT_VIEWED_PRODUCTS || '0.10'),
      lastActiveHours: parseFloat(process.env.WEIGHT_LAST_ACTIVE || '0.20'),
      intentStrength: parseFloat(process.env.WEIGHT_INTENT || '0.15'),
      purchaseProbability: parseFloat(process.env.WEIGHT_PURCHASE_PROB || '0.15'),
    },
  },

  // Re-Engagement Configuration
  reEngagement: {
    maxAttempts: parseInt(process.env.REENGAGEMENT_MAX_ATTEMPTS || '3', 10),
    minIntervalHours: parseInt(process.env.REENGAGEMENT_MIN_INTERVAL || '4', 10),
    cartExpiryHours: parseInt(process.env.CART_EXPIRY_HOURS || '168', 10), // 7 days
    searchExpiryHours: parseInt(process.env.SEARCH_EXPIRY_HOURS || '72', 10), // 3 days
    hotLeadsIntervalHours: parseInt(process.env.HOT_LEADS_INTERVAL || '1', 10),
    warmLeadsIntervalHours: parseInt(process.env.WARM_LEADS_INTERVAL || '24', 10),
    coldLeadsIntervalHours: parseInt(process.env.COLD_LEADS_INTERVAL || '168', 10),
  },

  // Channel Preference Weights
  channelWeights: {
    whatsapp: {
      engagementRate: parseFloat(process.env.CHANNEL_WHATSAPP_ENGAGEMENT || '0.35'),
      conversionRate: parseFloat(process.env.CHANNEL_WHATSAPP_CONVERSION || '0.25'),
      urgency: parseFloat(process.env.CHANNEL_WHATSAPP_URGENCY || '0.40'),
    },
    push: {
      engagementRate: parseFloat(process.env.CHANNEL_PUSH_ENGAGEMENT || '0.30'),
      conversionRate: parseFloat(process.env.CHANNEL_PUSH_CONVERSION || '0.20'),
      urgency: parseFloat(process.env.CHANNEL_PUSH_URGENCY || '0.50'),
    },
    sms: {
      engagementRate: parseFloat(process.env.CHANNEL_SMS_ENGAGEMENT || '0.25'),
      conversionRate: parseFloat(process.env.CHANNEL_SMS_CONVERSION || '0.30'),
      urgency: parseFloat(process.env.CHANNEL_SMS_URGENCY || '0.45'),
    },
    email: {
      engagementRate: parseFloat(process.env.CHANNEL_EMAIL_ENGAGEMENT || '0.10'),
      conversionRate: parseFloat(process.env.CHANNEL_EMAIL_CONVERSION || '0.25'),
      urgency: parseFloat(process.env.CHANNEL_EMAIL_URGENCY || '0.20'),
    },
  },

  // Cache Configuration
  cache: {
    leadScoreTTL: parseInt(process.env.CACHE_LEAD_SCORE_TTL || '300', 10), // 5 minutes
    userActivityTTL: parseInt(process.env.CACHE_USER_ACTIVITY_TTL || '60', 10), // 1 minute
  },

  // ML Model Configuration
  ml: {
    modelServer: process.env.MODEL_SERVER_URL || 'https://ml-model-server.onrender.com',
    featureStore: process.env.FEATURE_STORE_URL || 'https://feature-store.onrender.com',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  },
};

export default config;
