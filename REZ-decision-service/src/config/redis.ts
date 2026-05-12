/**
 * Redis Configuration
 * Phase 3-5 Engine Redis Setup
 */

// @ts-ignore - ioredis default export compatibility
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_CONNECTIONS = parseInt(process.env.REDIS_MAX_CONNECTIONS || '50');

// Create Redis client
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('[REDIS] Max retry attempts reached');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
  enableReadyCheck: true,
  lazyConnect: false,
});

// Event handlers
redis.on('connect', () => {
  console.log('[REDIS] Connected to Redis');
});

redis.on('ready', () => {
  console.log('[REDIS] Redis ready');
});

redis.on('error', (error) => {
  console.error('[REDIS] Error:', error.message);
});

redis.on('close', () => {
  console.log('[REDIS] Connection closed');
});

redis.on('reconnecting', () => {
  console.log('[REDIS] Reconnecting...');
});

// Connection pool settings
redis.setMaxListeners(MAX_CONNECTIONS);

// Health check function
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    return false;
  }
}

// Redis key patterns for Phase 3-5 engines
export const REDIS_KEYS = {
  // Sampling Engine
  sampling: {
    fatigue: (userId: string) => `sampling:fatigue:${userId}`,
    leaderboard: (date: string) => `sampling:leaderboard:${date}`,
    campaignScans: (campaignId: string, date: string) => `sampling:campaign:${campaignId}:scans:${date}`,
  },

  // Attribution Engine
  attribution: {
    events: (userId: string) => `attribution:events:${userId}`,
    conversions: (campaignId: string) => `attribution:conversions:${campaignId}`,
  },

  // Dynamic Pricing
  pricing: {
    surge: (merchantId: string) => `pricing:surge:${merchantId}`,
    history: (merchantId: string) => `pricing:history:${merchantId}`,
  },

  // Auto Campaign
  autoCampaign: {
    signals: (merchantId: string) => `autocampaign:signals:${merchantId}`,
    campaigns: (merchantId: string) => `autocampaign:campaigns:${merchantId}`,
  },

  // Smart Coin Allocation
  coinAllocation: {
    budget: (campaignId: string) => `coin:budget:${campaignId}`,
    userBudget: (userId: string) => `coin:user_budget:${userId}`,
  },

  // Auto Coin Distribution
  coinDistribution: {
    triggers: (userId: string) => `coin:triggers:${userId}`,
    rules: 'coin:rules',
  },

  // Analytics
  analytics: {
    merchantCoins: (merchantId: string) => `analytics:merchant_coin:${merchantId}`,
    dooh: {
      screens: 'analytics:dooh:screens',
      screen: (screenId: string) => `analytics:dooh:screen:${screenId}`,
      campaigns: 'analytics:dooh:campaigns',
    },
  },
};

export default redis;
