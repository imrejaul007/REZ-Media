/**
 * ATTRIBUTION TRACKER
 * Phase 3: Full funnel tracking - Scan → Visit → Redeem → Purchase → Repeat
 * Credits campaigns accurately across multi-touch user journeys
 */

// @ts-ignore
import Redis from 'ioredis';
// @ts-ignore
import type { Redis as RedisClient } from 'ioredis';
import { redis } from '../config/redis';

// ============================================
// REDIS CONNECTION MANAGER
// ============================================

const REDIS_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  connectTimeoutMs: 5000,
  commandTimeoutMs: 3000,
};

interface RedisConnectionState {
  client: RedisClient | null;
  isConnected: boolean;
  lastError: Error | null;
  connectionAttempts: number;
}

const connectionState: RedisConnectionState = {
  client: null,
  isConnected: false,
  lastError: null,
  connectionAttempts: 0,
};

/**
 * Log Redis errors with context for monitoring
 */
function logRedisError(operation: string, error: Error, context?: Record<string, any>): void {
  console.error('[Redis Error]', {
    operation,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    connectionAttempts: connectionState.connectionAttempts,
    isConnected: connectionState.isConnected,
    ...context,
  });
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a resilient Redis connection with retry logic
 */
async function createRedisConnection(): Promise<RedisClient | null> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  for (let attempt = 1; attempt <= REDIS_CONFIG.maxRetries; attempt++) {
    try {
      connectionState.connectionAttempts = attempt;

      const client = new Redis(redisUrl, {
        connectTimeout: REDIS_CONFIG.connectTimeoutMs,
        commandTimeout: REDIS_CONFIG.commandTimeoutMs,
        retryStrategy: (times: number) => {
          if (times > REDIS_CONFIG.maxRetries) {
            return null; // Stop retrying
          }
          const delay = Math.min(
            REDIS_CONFIG.retryDelayMs * Math.pow(2, times - 1),
            10000 // Max 10 seconds
          );
          console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
          return delay;
        },
        lazyConnect: true,
      });

      // Set up event handlers
      client.on('connect', () => {
        console.log('[Redis] Connected successfully');
        connectionState.isConnected = true;
        connectionState.lastError = null;
      });

      client.on('ready', () => {
        console.log('[Redis] Ready to accept commands');
        connectionState.isConnected = true;
      });

      client.on('error', (error: Error) => {
        logRedisError('connection', error);
        connectionState.isConnected = false;
        connectionState.lastError = error;
      });

      client.on('close', () => {
        console.log('[Redis] Connection closed');
        connectionState.isConnected = false;
      });

      client.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
      });

      // Attempt connection
      await client.connect();

      // Verify connection with ping
      await client.ping();

      return client;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logRedisError(`connection attempt ${attempt}/${REDIS_CONFIG.maxRetries}`, err);

      if (attempt < REDIS_CONFIG.maxRetries) {
        const delay = REDIS_CONFIG.retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`[Redis] Retrying connection in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  console.error('[Redis] Failed to connect after all retry attempts');
  return null;
}

/**
 * Initialize Redis connection (call at service startup)
 */
async function initializeRedis(): Promise<RedisClient | null> {
  if (connectionState.client && connectionState.isConnected) {
    return connectionState.client;
  }

  connectionState.client = await createRedisConnection();
  return connectionState.client;
}

/**
 * Get the current Redis client, or null if unavailable
 */
function getRedisClient(): RedisClient | null {
  if (connectionState.client && connectionState.isConnected) {
    return connectionState.client;
  }
  return null;
}

/**
 * Check if Redis is available
 */
function isRedisAvailable(): boolean {
  return connectionState.isConnected && connectionState.client !== null;
}

/**
 * Execute a Redis command with error handling and graceful degradation
 */
async function executeRedisCommand<T>(
  operation: string,
  command: () => Promise<T>,
  fallback: T
): Promise<{ result: T; error: string | null; available: boolean }> {
  const client = getRedisClient();

  if (!client) {
    const errorMsg = `Redis unavailable for operation: ${operation}`;
    logRedisError(operation, connectionState.lastError || new Error(errorMsg));
    return {
      result: fallback,
      error: errorMsg,
      available: false,
    };
  }

  try {
    const result = await Promise.race([
      command(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis command timeout')), REDIS_CONFIG.commandTimeoutMs)
      ),
    ]);

    return {
      result,
      error: null,
      available: true,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logRedisError(operation, err);
    return {
      result: fallback,
      error: err.message,
      available: false,
    };
  }
}

/**
 * Health check for Redis connection
 */
async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const client = getRedisClient();

  if (!client) {
    return {
      healthy: false,
      error: 'No Redis client available',
    };
  }

  try {
    const start = Date.now();
    await client.ping();
    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      healthy: false,
      error: err.message,
    };
  }
}

// Initialize connection on module load (non-blocking)
initializeRedis().catch((error) => {
  console.error('[Redis] Initial connection failed, will retry on first use:', error.message);
});

// Getter for backward compatibility with existing code
function getRedis(): RedisClient {
  const client = getRedisClient();
  if (!client) {
    throw new Error('Redis not available');
  }
  return client;
}

// ============================================
// CONSTANTS
// ============================================

const REDIS_PREFIX = 'attribution:';
const DEFAULT_WINDOW_DAYS = 7;
const TTL_SECONDS = DEFAULT_WINDOW_DAYS * 24 * 60 * 60; // 7 days in seconds

// Attribution event weights for credit calculation
export const ATTRIBUTION_WEIGHTS: Record<AttributionEventType, number> = {
  scan: 0.30,
  visit: 0.25,
  redeem: 0.45,
  purchase: 0.85,
  repeat: 1.00
};

// Attribution model types
export type AttributionModel = 'first-touch' | 'last-touch' | 'linear' | 'time-decay';

// Event types
export type AttributionEventType = 'scan' | 'visit' | 'redeem' | 'purchase' | 'repeat';

// ============================================
// INTERFACES
// ============================================

export interface AttributionEvent {
  userId: string;
  campaignId: string;
  merchantId: string;
  event: AttributionEventType;
  timestamp: Date;
  value?: number; // For purchase: amount
  metadata?: Record<string, any>;
}

export interface AttributionResult {
  campaignId: string;
  userId: string;
  creditedCampaign: string;
  creditedAmount: number;
  weight: number;
  window: string;
}

export interface CampaignAttributionConfig {
  attributionModel: AttributionModel;
  windowDays: number;
  weights?: Partial<Record<AttributionEventType, number>>;
}

export interface AttributionQuery {
  userId: string;
  campaignId?: string;
  merchantId?: string;
  startDate?: Date;
  endDate?: Date;
  model?: AttributionModel;
}

export interface AttributionSummary {
  userId: string;
  totalEvents: number;
  campaigns: Record<string, CampaignAttributionSummary>;
  funnelStats: FunnelStats;
}

interface CampaignAttributionSummary {
  events: number;
  totalValue: number;
  attributedValue: number;
  firstTouch: Date | null;
  lastTouch: Date | null;
  touchpoints: AttributionEvent[];
}

interface FunnelStats {
  scans: number;
  visits: number;
  redeems: number;
  purchases: number;
  repeats: number;
  conversionRates: {
    scanToVisit: number;
    visitToRedeem: number;
    redeemToPurchase: number;
    purchaseToRepeat: number;
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate Redis key for event storage
 */
function eventKey(userId: string, campaignId: string, eventId: string): string {
  return `${REDIS_PREFIX}events:${userId}:${campaignId}:${eventId}`;
}

/**
 * Generate Redis key for user campaign events list
 */
function userCampaignKey(userId: string, campaignId: string): string {
  return `${REDIS_PREFIX}user:${userId}:campaign:${campaignId}:events`;
}

/**
 * Generate Redis key for campaign attribution tracking
 */
function campaignKey(campaignId: string): string {
  return `${REDIS_PREFIX}campaign:${campaignId}`;
}

/**
 * Generate Redis key for user attribution window tracking
 */
function userWindowKey(userId: string): string {
  return `${REDIS_PREFIX}user:${userId}:window`;
}

/**
 * Get effective weights (custom + defaults)
 */
function getEffectiveWeights(customWeights?: Partial<Record<AttributionEventType, number>>): Record<AttributionEventType, number> {
  return {
    ...ATTRIBUTION_WEIGHTS,
    ...customWeights
  };
}

/**
 * Calculate time decay factor (exponential decay)
 * More recent events get higher weight
 */
function calculateTimeDecayFactor(eventTimestamp: Date, conversionTimestamp: Date, windowDays: number): number {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const timeDiff = conversionTimestamp.getTime() - eventTimestamp.getTime();
  const decayRate = Math.log(2) / windowMs; // Half-life decay

  return Math.exp(-decayRate * timeDiff);
}

// ============================================
// ATTRIBUTION TRACKER CLASS
// ============================================

export class AttributionTracker {

  /**
   * Track an attribution event
   * Stores in Redis with TTL for window management
   * Gracefully degrades when Redis is unavailable
   */
  async trackEvent(event: AttributionEvent): Promise<{
    success: boolean;
    eventId: string;
    error?: string;
  }> {
    const eventId = `${event.userId}:${event.campaignId}:${Date.now()}:${event.event}`;

    // Check Redis availability first
    if (!isRedisAvailable()) {
      // Try to reconnect
      await initializeRedis();
      if (!isRedisAvailable()) {
        logRedisError('trackEvent', connectionState.lastError || new Error('Redis unavailable'), { eventId });
        return {
          success: false,
          eventId: '',
          error: 'Redis unavailable - event tracking disabled',
        };
      }
    }

    try {
      const key = eventKey(event.userId, event.campaignId, eventId);
      const userCampaignListKey = userCampaignKey(event.userId, event.campaignId);

      // Prepare event data for storage
      const eventData = {
        id: eventId,
        ...event,
        timestamp: event.timestamp.toISOString()
      };

      const ttl = this.calculateTTL();
      const redis = getRedis();

      // Store event with TTL
      await redis.setex(key, ttl, JSON.stringify(eventData));

      // Add to user's campaign event list (sorted by timestamp)
      await redis.zadd(
        userCampaignListKey,
        event.timestamp.getTime(),
        eventId
      );
      await redis.expire(userCampaignListKey, ttl);

      // Update campaign stats (fire-and-forget with error handling)
      this.updateCampaignStats(event.campaignId, event).catch((err) => {
        logRedisError('updateCampaignStats', err, { campaignId: event.campaignId });
      });

      // Update funnel tracking (fire-and-forget with error handling)
      this.updateFunnelStats(event.userId, event).catch((err) => {
        logRedisError('updateFunnelStats', err, { userId: event.userId });
      });

      // Track window for conversion tracking (fire-and-forget with error handling)
      this.trackAttributionWindow(event.userId, event.campaignId).catch((err) => {
        logRedisError('trackAttributionWindow', err, { userId: event.userId, campaignId: event.campaignId });
      });

      return {
        success: true,
        eventId,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logRedisError('trackEvent', err, { eventId });
      return {
        success: false,
        eventId: '',
        error: err.message,
      };
    }
  }

  /**
   * Calculate attribution for a conversion event
   */
  async calculateAttribution(
    userId: string,
    conversionCampaignId: string,
    conversionValue: number,
    conversionEvent: AttributionEventType,
    model: AttributionModel = 'last-touch'
  ): Promise<AttributionResult[]> {
    const events = await this.getUserEventsInWindow(userId, conversionCampaignId);

    if (events.length === 0) {
      return [{
        campaignId: conversionCampaignId,
        userId,
        creditedCampaign: conversionCampaignId,
        creditedAmount: conversionValue,
        weight: ATTRIBUTION_WEIGHTS[conversionEvent],
        window: `${DEFAULT_WINDOW_DAYS}-day`
      }];
    }

    switch (model) {
      case 'first-touch':
        return this.calculateFirstTouchAttribution(events, conversionValue, userId);
      case 'last-touch':
        return this.calculateLastTouchAttribution(events, conversionValue, userId);
      case 'linear':
        return this.calculateLinearAttribution(events, conversionValue, userId);
      case 'time-decay':
        return this.calculateTimeDecayAttribution(events, conversionValue, userId);
      default:
        return this.calculateLastTouchAttribution(events, conversionValue, userId);
    }
  }

  /**
   * First Touch Attribution - credit goes to first touchpoint
   */
  private calculateFirstTouchAttribution(
    events: AttributionEvent[],
    conversionValue: number,
    userId: string
  ): AttributionResult[] {
    // Sort by timestamp ascending
    const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const firstEvent = sorted[0];

    const weight = ATTRIBUTION_WEIGHTS[firstEvent.event];
    const creditedAmount = conversionValue * weight;

    return [{
      campaignId: firstEvent.campaignId,
      userId,
      creditedCampaign: firstEvent.campaignId,
      creditedAmount,
      weight,
      window: `${DEFAULT_WINDOW_DAYS}-day`
    }];
  }

  /**
   * Last Touch Attribution - credit goes to most recent touchpoint
   */
  private calculateLastTouchAttribution(
    events: AttributionEvent[],
    conversionValue: number,
    userId: string
  ): AttributionResult[] {
    // Sort by timestamp descending
    const sorted = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const lastEvent = sorted[0];

    const weight = ATTRIBUTION_WEIGHTS[lastEvent.event];
    const creditedAmount = conversionValue * weight;

    return [{
      campaignId: lastEvent.campaignId,
      userId,
      creditedCampaign: lastEvent.campaignId,
      creditedAmount,
      weight,
      window: `${DEFAULT_WINDOW_DAYS}-day`
    }];
  }

  /**
   * Linear Attribution - split credit equally among all touchpoints
   */
  private calculateLinearAttribution(
    events: AttributionEvent[],
    conversionValue: number,
    userId: string
  ): AttributionResult[] {
    const creditPerEvent = conversionValue / events.length;
    const results: AttributionResult[] = [];

    // Group by campaign
    const campaignEvents: Record<string, AttributionEvent[]> = {};
    for (const event of events) {
      if (!campaignEvents[event.campaignId]) {
        campaignEvents[event.campaignId] = [];
      }
      campaignEvents[event.campaignId].push(event);
    }

    // Distribute credit by campaign
    for (const campaignId of Object.keys(campaignEvents)) {
      const campaignEventList = campaignEvents[campaignId];
      const campaignCredit = (creditPerEvent * campaignEventList.length);
      const avgWeight = campaignEventList.reduce((sum, e) => sum + ATTRIBUTION_WEIGHTS[e.event], 0) / campaignEventList.length;

      results.push({
        campaignId,
        userId,
        creditedCampaign: campaignId,
        creditedAmount: campaignCredit,
        weight: avgWeight / events.length,
        window: `${DEFAULT_WINDOW_DAYS}-day`
      });
    }

    return results;
  }

  /**
   * Time Decay Attribution - recent touchpoints get more credit
   */
  private calculateTimeDecayAttribution(
    events: AttributionEvent[],
    conversionValue: number,
    userId: string
  ): AttributionResult[] {
    const conversionTime = new Date();
    const totalWeight = events.reduce((sum, event) => {
      const decayFactor = calculateTimeDecayFactor(event.timestamp, conversionTime, DEFAULT_WINDOW_DAYS);
      return sum + (ATTRIBUTION_WEIGHTS[event.event] * decayFactor);
    }, 0);

    // Group by campaign
    const campaignWeights: Record<string, number> = {};
    for (const event of events) {
      const decayFactor = calculateTimeDecayFactor(event.timestamp, conversionTime, DEFAULT_WINDOW_DAYS);
      const eventWeight = ATTRIBUTION_WEIGHTS[event.event] * decayFactor;
      const current = campaignWeights[event.campaignId] || 0;
      campaignWeights[event.campaignId] = current + eventWeight;
    }

    const results: AttributionResult[] = [];
    for (const campaignId of Object.keys(campaignWeights)) {
      const weight = campaignWeights[campaignId];
      const normalizedWeight = totalWeight > 0 ? weight / totalWeight : 0;
      results.push({
        campaignId,
        userId,
        creditedCampaign: campaignId,
        creditedAmount: conversionValue * normalizedWeight,
        weight: normalizedWeight,
        window: `${DEFAULT_WINDOW_DAYS}-day`
      });
    }

    return results;
  }

  /**
   * Get all events for a user within the attribution window
   * Gracefully returns empty array when Redis is unavailable
   */
  async getUserEventsInWindow(
    userId: string,
    campaignId?: string,
    windowDays?: number
  ): Promise<AttributionEvent[]> {
    const window = windowDays || DEFAULT_WINDOW_DAYS;
    const cutoffTime = Date.now() - (window * 24 * 60 * 60 * 1000);

    // Check Redis availability
    if (!isRedisAvailable()) {
      await initializeRedis();
      if (!isRedisAvailable()) {
        logRedisError('getUserEventsInWindow', connectionState.lastError || new Error('Redis unavailable'), { userId, campaignId });
        return []; // Graceful degradation - return empty instead of throwing
      }
    }

    let keys: string[];
    try {
      if (campaignId) {
        // Get events for specific campaign
        keys = [`${REDIS_PREFIX}user:${userId}:campaign:${campaignId}:events`];
      } else {
        // Get all campaigns for user (scan for pattern)
        keys = await this.getUserCampaignKeys(userId);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logRedisError('getUserCampaignKeys', err, { userId, campaignId });
      return [];
    }

    const events: AttributionEvent[] = [];

    for (const key of keys) {
      const { result: eventIds, error } = await executeRedisCommand(
        'zrangebyscore',
        () => getRedis().zrangebyscore(key, cutoffTime, '+inf'),
        []
      );

      if (error || !eventIds) continue;

      for (const eventId of eventIds) {
        const { result: eventData, error: getError } = await executeRedisCommand(
          'get',
          () => getRedis().get(`${REDIS_PREFIX}events:${eventId}`),
          null
        );

        if (getError || !eventData) continue;

        try {
          const parsed = JSON.parse(eventData);
          events.push({
            ...parsed,
            timestamp: new Date(parsed.timestamp)
          });
        } catch (parseError) {
          logRedisError('JSON.parse', parseError instanceof Error ? parseError : new Error(String(parseError)), { eventData });
        }
      }
    }

    return events;
  }

  /**
   * Get attribution summary for a user
   */
  async getAttributionSummary(
    userId: string,
    windowDays?: number
  ): Promise<AttributionSummary> {
    const events = await this.getUserEventsInWindow(userId, undefined, windowDays);

    const campaigns: Record<string, CampaignAttributionSummary> = {};
    const funnelStats: FunnelStats = {
      scans: 0,
      visits: 0,
      redeems: 0,
      purchases: 0,
      repeats: 0,
      conversionRates: {
        scanToVisit: 0,
        visitToRedeem: 0,
        redeemToPurchase: 0,
        purchaseToRepeat: 0
      }
    };

    // Process events
    for (const event of events) {
      // Update funnel stats
      if (event.event === 'scan') funnelStats.scans++;
      if (event.event === 'visit') funnelStats.visits++;
      if (event.event === 'redeem') funnelStats.redeems++;
      if (event.event === 'purchase') funnelStats.purchases++;
      if (event.event === 'repeat') funnelStats.repeats++;

      // Update campaign summary
      if (!campaigns[event.campaignId]) {
        campaigns[event.campaignId] = {
          events: 0,
          totalValue: 0,
          attributedValue: 0,
          firstTouch: null,
          lastTouch: null,
          touchpoints: []
        };
      }

      const summary = campaigns[event.campaignId];
      summary.events++;
      summary.touchpoints.push(event);
      if (event.value) summary.totalValue += event.value;

      if (!summary.firstTouch || event.timestamp < summary.firstTouch) {
        summary.firstTouch = event.timestamp;
      }
      if (!summary.lastTouch || event.timestamp > summary.lastTouch) {
        summary.lastTouch = event.timestamp;
      }

      // Calculate attributed value
      summary.attributedValue += (event.value || 0) * ATTRIBUTION_WEIGHTS[event.event];
    }

    // Calculate conversion rates
    if (funnelStats.scans > 0) {
      funnelStats.conversionRates.scanToVisit = (funnelStats.visits / funnelStats.scans) * 100;
    }
    if (funnelStats.visits > 0) {
      funnelStats.conversionRates.visitToRedeem = (funnelStats.redeems / funnelStats.visits) * 100;
    }
    if (funnelStats.redeems > 0) {
      funnelStats.conversionRates.redeemToPurchase = (funnelStats.purchases / funnelStats.redeems) * 100;
    }
    if (funnelStats.purchases > 0) {
      funnelStats.conversionRates.purchaseToRepeat = (funnelStats.repeats / funnelStats.purchases) * 100;
    }

    return {
      userId,
      totalEvents: events.length,
      campaigns,
      funnelStats
    };
  }

  /**
   * Get campaign attribution data
   */
  async getCampaignAttribution(campaignId: string): Promise<{
    totalEvents: number;
    uniqueUsers: number;
    totalValue: number;
    attributedValue: number;
    eventBreakdown: Record<AttributionEventType, number>;
  }> {
    const key = campaignKey(campaignId);

    const data = await redis.hgetall(key);
    const eventCounts = await redis.hget(key, 'eventCounts');

    return {
      totalEvents: parseInt(data.totalEvents || '0'),
      uniqueUsers: parseInt(data.uniqueUsers || '0'),
      totalValue: parseFloat(data.totalValue || '0'),
      attributedValue: parseFloat(data.attributedValue || '0'),
      eventBreakdown: eventCounts ? JSON.parse(eventCounts) : {
        scan: 0,
        visit: 0,
        redeem: 0,
        purchase: 0,
        repeat: 0
      }
    };
  }

  /**
   * Query attribution data with filters
   */
  async queryAttribution(query: AttributionQuery): Promise<AttributionSummary[]> {
    const summaries: AttributionSummary[] = [];

    if (query.userId) {
      // Calculate window days from date range if provided
      let windowDays = DEFAULT_WINDOW_DAYS;
      if (query.startDate && query.endDate) {
        const daysDiff = Math.ceil((query.endDate.getTime() - query.startDate.getTime()) / (1000 * 60 * 60 * 24));
        windowDays = Math.max(1, daysDiff);
      }
      const summary = await this.getAttributionSummary(query.userId, windowDays);
      summaries.push(summary);
    }

    return summaries;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Calculate TTL based on window days
   */
  private calculateTTL(windowDays: number = DEFAULT_WINDOW_DAYS): number {
    return windowDays * 24 * 60 * 60;
  }

  /**
   * Update campaign statistics
   */
  private async updateCampaignStats(campaignId: string, event: AttributionEvent): Promise<void> {
    const key = campaignKey(campaignId);

    await redis.hincrby(key, 'totalEvents', 1);
    await redis.sadd(`${key}:users`, event.userId);
    await redis.expire(`${key}:users`, TTL_SECONDS);

    if (event.value) {
      await redis.hincrbyfloat(key, 'totalValue', event.value);
    }

    // Update event counts
    const eventCountsKey = `${key}:eventCounts`;
    await redis.hincrby(eventCountsKey, event.event, 1);
    await redis.expire(eventCountsKey, TTL_SECONDS);

    await redis.expire(key, TTL_SECONDS);
  }

  /**
   * Update funnel statistics for user
   */
  private async updateFunnelStats(userId: string, event: AttributionEvent): Promise<void> {
    const key = `${REDIS_PREFIX}funnel:${userId}`;

    await redis.hincrby(key, event.event, 1);
    await redis.hset(key, 'lastEvent', event.event);
    await redis.hset(key, 'lastEventTime', event.timestamp.toISOString());
    await redis.expire(key, TTL_SECONDS);
  }

  /**
   * Track attribution window for a user-campaign pair
   */
  private async trackAttributionWindow(userId: string, campaignId: string): Promise<void> {
    const key = userWindowKey(userId);

    // Track which campaigns user has touched
    await redis.sadd(`${key}:campaigns`, campaignId);
    await redis.expire(`${key}:campaigns`, TTL_SECONDS);

    // Track window start for each campaign
    const windowStart = await redis.hget(key, `window:${campaignId}`);
    if (!windowStart) {
      await redis.hset(key, `window:${campaignId}`, Date.now().toString());
    }
  }

  /**
   * Get all campaign keys for a user
   */
  private async getUserCampaignKeys(userId: string): Promise<string[]> {
    // Scan for user campaign event lists
    const pattern = `${REDIS_PREFIX}user:${userId}:campaign:*:events`;
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [newCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Clear expired attribution data (cleanup job)
   */
  async clearExpiredData(): Promise<{ cleared: number }> {
    let cleared = 0;
    const pattern = `${REDIS_PREFIX}events:*`;
    let cursor = '0';

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl <= 0) {
          await redis.del(key);
          cleared++;
        }
      }
    } while (cursor !== '0');

    return { cleared };
  }

  /**
   * Record a conversion and attribute it
   */
  async recordConversion(
    userId: string,
    campaignId: string,
    merchantId: string,
    conversionType: 'redeem' | 'purchase' | 'repeat',
    value: number,
    model: AttributionModel = 'last-touch'
  ): Promise<AttributionResult[]> {
    // Create conversion event
    const conversionEvent: AttributionEvent = {
      userId,
      campaignId,
      merchantId,
      event: conversionType,
      timestamp: new Date(),
      value
    };

    // Track the conversion event
    await this.trackEvent(conversionEvent);

    // Calculate attribution
    return this.calculateAttribution(
      userId,
      campaignId,
      value,
      conversionType,
      model
    );
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const attributionTracker = new AttributionTracker();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick track scan event
 */
export async function trackScan(
  userId: string,
  campaignId: string,
  merchantId: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return attributionTracker.trackEvent({
    userId,
    campaignId,
    merchantId,
    event: 'scan',
    timestamp: new Date(),
    metadata
  });
}

/**
 * Quick track visit event
 */
export async function trackVisit(
  userId: string,
  campaignId: string,
  merchantId: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return attributionTracker.trackEvent({
    userId,
    campaignId,
    merchantId,
    event: 'visit',
    timestamp: new Date(),
    metadata
  });
}

/**
 * Quick track redeem event
 */
export async function trackRedeem(
  userId: string,
  campaignId: string,
  merchantId: string,
  value?: number,
  metadata?: Record<string, any>
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return attributionTracker.trackEvent({
    userId,
    campaignId,
    merchantId,
    event: 'redeem',
    timestamp: new Date(),
    value,
    metadata
  });
}

/**
 * Quick track purchase event
 */
export async function trackPurchase(
  userId: string,
  campaignId: string,
  merchantId: string,
  amount: number,
  metadata?: Record<string, any>
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return attributionTracker.trackEvent({
    userId,
    campaignId,
    merchantId,
    event: 'purchase',
    timestamp: new Date(),
    value: amount,
    metadata
  });
}

/**
 * Quick track repeat customer event
 */
export async function trackRepeat(
  userId: string,
  campaignId: string,
  merchantId: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return attributionTracker.trackEvent({
    userId,
    campaignId,
    merchantId,
    event: 'repeat',
    timestamp: new Date(),
    metadata
  });
}

/**
 * Get attribution summary for a user
 */
export async function getUserAttributionSummary(
  userId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS
): Promise<AttributionSummary> {
  return attributionTracker.getAttributionSummary(userId, windowDays);
}

/**
 * Calculate attribution for a conversion
 */
export async function attributeConversion(
  userId: string,
  campaignId: string,
  conversionValue: number,
  model: AttributionModel = 'last-touch'
): Promise<AttributionResult[]> {
  return attributionTracker.calculateAttribution(
    userId,
    campaignId,
    conversionValue,
    'purchase',
    model
  );
}
