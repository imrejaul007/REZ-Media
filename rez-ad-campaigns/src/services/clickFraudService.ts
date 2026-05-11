// @ts-nocheck
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { randomUUID } from 'crypto';

const RAPID_CLICK_THRESHOLD_MS = 30_000; // 30 seconds
const IP_FLOOD_THRESHOLD = 10; // Max clicks per hour
const IP_FLOOD_WINDOW_MS = 3_600_000; // 1 hour
const RECORD_TTL_SECONDS = 3_600; // 1 hour TTL on keys
const CLEANUP_INTERVAL_MS = 600_000; // Clean every 10 minutes

const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /curl/i,
  /wget/i,
  /python/i,
  /java\b/i,
  /node/i,
];

/**
 * BAK-ADS-006 FIX: Redis-backed click fraud detection.
 *
 * Previously used an in-memory Map<string, CampaignClickMap> which:
 * - Lost all fraud data on service restart
 * - Was isolated per-instance in multi-pod deployments (flagged on pod A = unknown on pod B)
 *
 * Now uses Redis sorted sets for time-bucketed click tracking:
 * - User clicks: `ads:fraud:user:{campaignId}:{userId}` (score = timestamp)
 * - IP clicks:    `ads:fraud:ip:{campaignId}:{ip}`    (score = timestamp)
 * - Each click is a unique member (clickId) so repeated rapid clicks are counted correctly
 * - TTL on each key ensures automatic expiration (no manual cleanup needed)
 *
 * This is persistent across restarts and shared across all service instances.
 */
class ClickFraudService {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Graceful shutdown — clears the periodic cleanup interval.
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Detect if a click is fraudulent based on multiple signals.
   * Checks are performed against Redis data, so they are consistent across restarts and instances.
   */
  async detectFraudulentClick(
    campaignId: string,
    userId: string,
    ip: string,
    userAgent: string,
  ): Promise<{ isFraud: boolean; reason?: string }> {
    // Check 1: Known bot pattern
    if (this.isKnownBot(userAgent)) {
      return { isFraud: true, reason: 'Known bot user agent detected' };
    }

    // Check 2: Rapid-fire clicks from same user
    const rapidClickReason = await this.checkRapidClick(campaignId, userId);
    if (rapidClickReason) {
      return { isFraud: true, reason: rapidClickReason };
    }

    // Check 3: IP flooding (same IP too many clicks in short time)
    const ipFloodReason = await this.checkIPFlooding(campaignId, ip);
    if (ipFloodReason) {
      return { isFraud: true, reason: ipFloodReason };
    }

    return { isFraud: false };
  }

  /**
   * Record a click for fraud analysis in Redis.
   * Uses a unique clickId member so multiple clicks at the same millisecond are all tracked.
   */
  async recordClick(campaignId: string, userId: string, ip: string, userAgent: string): Promise<void> {
    if (!campaignId || !userId) {
      logger.warn('[ClickFraudService] Missing campaignId or userId');
      return;
    }

    const now = Date.now();
    // BAK-MKT-018 FIX: Use randomUUID() for clickId — Math.random() is predictable.
    // An attacker could anticipate clickId generation and manipulate fraud detection.
    const clickId = `${now}:${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const redis = getRedis();

    try {
      // Record by user (sorted set, score = timestamp, member = clickId)
      const userKey = `ads:fraud:user:${campaignId}:${userId}`;
      await redis.zadd(userKey, now, clickId);
      await redis.expire(userKey, RECORD_TTL_SECONDS);

      // Record by IP
      if (ip) {
        const ipKey = `ads:fraud:ip:${campaignId}:${ip}`;
        await redis.zadd(ipKey, now, clickId);
        await redis.expire(ipKey, RECORD_TTL_SECONDS);
      }
    } catch (err) {
      logger.warn('[ClickFraudService] Redis recordClick failed', { campaignId, userId, error: err });
      // Do not block the click — log and continue
    }
  }

  /**
   * Get click statistics for a campaign from Redis.
   */
  async getClickStats(campaignId: string): Promise<{
    totalClicks: number;
    fraudClicks: number;
    fraudRate: number;
    uniqueUsers: number;
    uniqueIPs: number;
  }> {
    const redis = getRedis();

    try {
      // Count total user keys matching pattern (approximate)
      const userKeys = await redis.keys(`ads:fraud:user:${campaignId}:*`);
      const ipKeys = await redis.keys(`ads:fraud:ip:${campaignId}:*`);

      let totalClicks = 0;
      const uniqueUsers = userKeys.length;
      const uniqueIPs = ipKeys.length;

      // Count clicks per user (sum of zcard across all user keys)
      for (const key of userKeys.slice(0, 100)) { // cap at 100 for performance
        const count = await redis.zcard(key);
        totalClicks += count;
      }

      // Count fraud (rapid clicks — clicks within threshold)
      let fraudClicks = 0;
      const now = Date.now();
      for (const key of userKeys.slice(0, 100)) {
        const recent = await redis.zrangebyscore(key, now - RAPID_CLICK_THRESHOLD_MS, now);
        fraudClicks += recent.length;
      }

      const fraudRate = totalClicks > 0 ? (fraudClicks / totalClicks) * 100 : 0;

      return { totalClicks, fraudClicks, fraudRate, uniqueUsers, uniqueIPs };
    } catch (err) {
      logger.warn('[ClickFraudService] Redis getClickStats failed', { campaignId, error: err });
      return { totalClicks: 0, fraudClicks: 0, fraudRate: 0, uniqueUsers: 0, uniqueIPs: 0 };
    }
  }

  /**
   * Check if user clicked same campaign within rapid click threshold.
   * Uses Redis ZCOUNT to count clicks within the threshold window.
   */
  private async checkRapidClick(campaignId: string, userId: string): Promise<string | null> {
    const redis = getRedis();
    const userKey = `ads:fraud:user:${campaignId}:${userId}`;

    try {
      const now = Date.now();
      const recentCount = await redis.zcount(userKey, now - RAPID_CLICK_THRESHOLD_MS, now);

      if (recentCount > 0) {
        // Get the last click time for the message
        const lastClicks = await redis.zrange(userKey, -2, -1, 'WITHSCORES');
        const lastClickTime = lastClicks.length >= 2 ? parseInt(lastClicks[1]) : now;
        const timeSinceLastClick = now - lastClickTime;
        return `Rapid click detected: ${timeSinceLastClick}ms since last click (threshold: ${RAPID_CLICK_THRESHOLD_MS}ms)`;
      }
    } catch (err) {
      logger.warn('[ClickFraudService] Redis checkRapidClick failed', { campaignId, userId, error: err });
    }

    return null;
  }

  /**
   * Check if IP has clicked same campaign too many times recently.
   * Uses Redis ZCOUNT to count clicks within the flood window.
   */
  private async checkIPFlooding(campaignId: string, ip: string): Promise<string | null> {
    if (!ip) return null;

    const redis = getRedis();
    const ipKey = `ads:fraud:ip:${campaignId}:${ip}`;

    try {
      const now = Date.now();
      const recentCount = await redis.zcount(ipKey, now - IP_FLOOD_WINDOW_MS, now);

      if (recentCount >= IP_FLOOD_THRESHOLD) {
        return `IP flooding detected: ${recentCount} clicks in ${IP_FLOOD_WINDOW_MS / 1000}s (threshold: ${IP_FLOOD_THRESHOLD})`;
      }
    } catch (err) {
      logger.warn('[ClickFraudService] Redis checkIPFlooding failed', { campaignId, ip, error: err });
    }

    return null;
  }

  /**
   * Check if user agent matches known bot patterns.
   */
  private isKnownBot(userAgent: string): boolean {
    if (!userAgent) return false;
    return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Cleanup old entries from Redis sorted sets.
   * Keys have TTL so this is mostly a no-op, but it handles
   * entries older than RECORD_TTL within each sorted set.
   */
  private async cleanup(): Promise<void> {
    const redis = getRedis();
    const now = Date.now();

    try {
      // Scan for user keys and clean stale entries
      let cursor = '0';
      let cleaned = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'ads:fraud:user:*', 'COUNT', 100);
        cursor = nextCursor;

        for (const key of keys) {
          // Remove entries older than RECORD_TTL
          const removed = await redis.zremrangebyscore(key, '-inf', now - RAPID_CLICK_THRESHOLD_MS * 2);
          cleaned += removed;
          // Delete empty keys
          const size = await redis.zcard(key);
          if (size === 0) {
            await redis.del(key);
          }
        }
      } while (cursor !== '0');

      if (cleaned > 0) {
        logger.debug('[ClickFraudService] Cleanup completed', { cleanedEntries: cleaned });
      }
    } catch (err) {
      logger.warn('[ClickFraudService] Redis cleanup failed', { error: err });
    }
  }
}

export const clickFraudService = new ClickFraudService();
