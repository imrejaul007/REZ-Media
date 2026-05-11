/**
 * Redis Cache Service
 *
 * Caching layer for fast rule lookups
 */

import Redis from 'ioredis';
import { config } from '../config';

class CacheService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Cache] Max retries reached, giving up');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: 3
    });

    this.client.on('connect', () => {
      console.log('[Cache] Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('[Cache] Redis error:', err);
      this.isConnected = false;
    });
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;

    try {
      const value = await this.client.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('[Cache] Set error:', error);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('[Cache] Delete error:', error);
      return false;
    }
  }

  /**
   * Delete keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('[Cache] DeletePattern error:', error);
      return 0;
    }
  }

  /**
   * Get cached rules for a category
   */
  async getRulesForCategory(category: string): Promise<any[] | null> {
    return this.get(`rules:${category}`);
  }

  /**
   * Cache rules for a category
   */
  async setRulesForCategory(category: string, rules: any[]): Promise<boolean> {
    return this.set(`rules:${category}`, rules, config.CACHE.RULES_TTL);
  }

  /**
   * Invalidate rules cache for a category
   */
  async invalidateRulesCache(category?: string): Promise<void> {
    if (category) {
      await this.delete(`rules:${category}`);
    } else {
      await this.deletePattern('rules:*');
    }
  }

  /**
   * Cache karma score
   */
  async getKarmaScore(userId: string): Promise<any | null> {
    return this.get(`karma:${userId}`);
  }

  /**
   * Cache karma score
   */
  async setKarmaScore(userId: string, score: any): Promise<boolean> {
    return this.set(`karma:${userId}`, score, config.CACHE.KARMA_TTL);
  }

  /**
   * Invalidate karma cache
   */
  async invalidateKarmaCache(userId: string): Promise<boolean> {
    return this.delete(`karma:${userId}`);
  }

  /**
   * Increment counter (for rate limiting, velocity checks)
   */
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const count = await this.client.incr(key);
      if (ttlSeconds && count === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return count;
    } catch (error) {
      console.error('[Cache] Increment error:', error);
      return 0;
    }
  }

  /**
   * Get counter value
   */
  async getCounter(key: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const value = await this.client.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error('[Cache] GetCounter error:', error);
      return 0;
    }
  }

  /**
   * Store scan history for fraud detection
   */
  async addScanHistory(
    userId: string,
    scan: { timestamp: Date; location?: { lat: number; lng: number }; ip?: string }
  ): Promise<void> {
    if (!this.isConnected) return;

    const key = `scan_history:${userId}`;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    try {
      // Add new scan
      await this.client.zadd(key, now, JSON.stringify(scan));

      // Remove scans older than 1 day
      await this.client.zremrangebyscore(key, 0, oneDayAgo);

      // Set expiry
      await this.client.expire(key, 86400 * 2); // 2 days
    } catch (error) {
      console.error('[Cache] AddScanHistory error:', error);
    }
  }

  /**
   * Get scan history for fraud detection
   */
  async getScanHistory(userId: string, limit: number = 10): Promise<any[]> {
    if (!this.isConnected) return [];

    try {
      const key = `scan_history:${userId}`;
      const results = await this.client.zrevrange(key, 0, limit - 1);
      return results.map(r => JSON.parse(r));
    } catch (error) {
      console.error('[Cache] GetScanHistory error:', error);
      return [];
    }
  }

  /**
   * Store percentile ranking (for relative rank)
   */
  async updatePercentile(userId: string, score: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.zadd('karma:percentiles', score, userId);
    } catch (error) {
      console.error('[Cache] UpdatePercentile error:', error);
    }
  }

  /**
   * Get user percentile
   */
  async getPercentile(userId: string): Promise<number> {
    if (!this.isConnected) return 50;

    try {
      const key = 'karma:percentiles';
      const rank = await this.client.zrevrank(key, userId);
      const total = await this.client.zcard(key);

      if (rank === null || total === 0) return 50;

      return Math.round(((total - rank - 1) / total) * 100);
    } catch (error) {
      console.error('[Cache] GetPercentile error:', error);
      return 50;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.client.quit();
    this.isConnected = false;
  }
}

// Singleton instance
export const cacheService = new CacheService();
export default cacheService;
