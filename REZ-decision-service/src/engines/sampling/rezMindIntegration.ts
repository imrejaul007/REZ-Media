/**
 * ReZ Mind Integration for RDE
 *
 * Connects RDE Core to ReZ Mind for user intent data
 *
 * This is CRITICAL - RDE needs user intent to make smart decisions
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PREFIX = 'rde:rezmind:';

// ReZ Mind service URL
const REZMIND_URL = process.env.REZMIND_URL || 'https://rez-event-platform.onrender.com';

export interface UserIntent {
  userId: string;
  topIntents: {
    category: string;
    confidence: number;
    signals: number;
  }[];
  vibeScore: number;
  dormantScore: number;
  lastActive: Date;
  affinity: Record<string, number>;
}

export interface IntentQuery {
  userId: string;
  intent?: string;
  location?: { lat: number; lng: number };
}

// ============================================
// REZ MIND INTEGRATION
// ============================================

export class ReZMindIntegration {

  /**
   * Get user intent profile from ReZ Mind
   */
  async getUserIntent(userId: string): Promise<UserIntent | null> {
    try {
      // Try cache first
      const cacheKey = `${PREFIX}intent:${userId}`;
      const cached = await redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Call ReZ Mind API
      const response = await fetch(`${REZMIND_URL}/api/intent/profile/${userId}`);

      if (!response.ok) {
        console.error(`[RDE-ReZMIND] Failed to get intent: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Cache for 5 minutes
      await redis.set(cacheKey, JSON.stringify(data), 'EX', 300);

      return data;

    } catch (error) {
      console.error('[RDE-ReZMIND] Error getting user intent:', error);
      return null;
    }
  }

  /**
   * Get top intent for a user (for targeting)
   */
  async getTopIntent(userId: string): Promise<string | null> {
    const intent = await this.getUserIntent(userId);

    if (!intent || !intent.topIntents || intent.topIntents.length === 0) {
      return null;
    }

    // Return highest confidence intent
    return intent.topIntents[0].category;
  }

  /**
   * Get dormant users for reactivation campaigns
   */
  async getDormantUsers(days: number = 7): Promise<string[]> {
    try {
      const response = await fetch(`${REZMIND_URL}/api/intent/dormant?days=${days}`);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.users || [];

    } catch (error) {
      console.error('[RDE-ReZMIND] Error getting dormant users:', error);
      return [];
    }
  }

  /**
   * Get users by intent category
   */
  async getUsersByIntent(category: string, limit: number = 100): Promise<string[]> {
    try {
      const response = await fetch(
        `${REZMIND_URL}/api/intent/users?category=${category}&limit=${limit}`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.users || [];

    } catch (error) {
      console.error('[RDE-ReZMIND] Error getting users by intent:', error);
      return [];
    }
  }

  /**
   * Get high-intent users for a category (for targeting)
   */
  async getHighIntentUsers(category: string): Promise<{
    userId: string;
    intentScore: number;
    lastActive: Date;
  }[]> {
    try {
      const response = await fetch(
        `${REZMIND_URL}/api/intent/high-intent?category=${category}`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.users || [];

    } catch (error) {
      console.error('[RDE-ReZMIND] Error getting high intent users:', error);
      return [];
    }
  }

  /**
   * Send intent signal to ReZ Mind (when RDE captures user action)
   */
  async sendIntentSignal(
    userId: string,
    eventType: string,
    category: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const response = await fetch(`${REZMIND_URL}/api/intent/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          eventType,
          category,
          appType: 'marketing',
          metadata
        })
      });

      if (!response.ok) {
        console.error(`[RDE-ReZMIND] Failed to capture intent: ${response.status}`);
        return false;
      }

      // Invalidate cache
      const cacheKey = `${PREFIX}intent:${userId}`;
      await redis.del(cacheKey);

      return true;

    } catch (error) {
      console.error('[RDE-ReZMIND] Error sending intent signal:', error);
      return false;
    }
  }

  /**
   * Get vibe score for user (engagement level)
   */
  async getVibeScore(userId: string): Promise<number> {
    const intent = await this.getUserIntent(userId);
    return intent?.vibeScore || 50; // Default 50
  }

  /**
   * Get dormant score for user (higher = more dormant)
   */
  async getDormantScore(userId: string): Promise<number> {
    const intent = await this.getUserIntent(userId);
    return intent?.dormantScore || 0; // Default 0
  }

  /**
   * Check if user should be reactivated
   */
  async shouldReactivate(userId: string): Promise<boolean> {
    const dormantScore = await this.getDormantScore(userId);
    return dormantScore > 70; // >70 = dormant
  }

  /**
   * Get affinity scores for user
   */
  async getAffinity(userId: string): Promise<Record<string, number>> {
    const intent = await this.getUserIntent(userId);
    return intent?.affinity || {};
  }

  /**
   * Batch get intents for multiple users
   */
  async batchGetIntents(userIds: string[]): Promise<Map<string, UserIntent>> {
    const results = new Map<string, UserIntent>();

    // Use pipeline for efficiency
    const pipeline = redis.pipeline();

    for (const userId of userIds) {
      const cacheKey = `${PREFIX}intent:${userId}`;
      pipeline.get(cacheKey);
    }

    const cached = await pipeline.exec();

    if (cached) {
      for (let i = 0; i < userIds.length; i++) {
        const [err, data] = cached[i];
        if (!err && data) {
          results.set(userIds[i], JSON.parse(data as string));
        }
      }
    }

    // Fetch missing from API
    const missing = userIds.filter(id => !results.has(id));

    if (missing.length > 0) {
      const response = await fetch(`${REZMIND_URL}/api/intent/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: missing })
      });

      if (response.ok) {
        const data = await response.json();
        for (const intent of data.intents || []) {
          results.set(intent.userId, intent);

          // Cache
          const cacheKey = `${PREFIX}intent:${intent.userId}`;
          await redis.set(cacheKey, JSON.stringify(intent), 'EX', 300);
        }
      }
    }

    return results;
  }
}

// Export singleton
export const rezMindIntegration = new ReZMindIntegration();

// Convenience functions
export async function getUserIntent(userId: string): Promise<UserIntent | null> {
  return rezMindIntegration.getUserIntent(userId);
}

export async function getTopIntent(userId: string): Promise<string | null> {
  return rezMindIntegration.getTopIntent(userId);
}

export async function getDormantUsers(days?: number): Promise<string[]> {
  return rezMindIntegration.getDormantUsers(days);
}

export async function getHighIntentUsers(category: string): Promise<{
  userId: string;
  intentScore: number;
  lastActive: Date;
}[]> {
  return rezMindIntegration.getHighIntentUsers(category);
}

export async function sendIntentSignal(
  userId: string,
  eventType: string,
  category: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  return rezMindIntegration.sendIntentSignal(userId, eventType, category, metadata);
}
