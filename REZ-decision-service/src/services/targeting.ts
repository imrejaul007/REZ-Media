import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// 9 PREDEFINED SEGMENTS
// ============================================

interface SegmentCriteria {
  type: string;
  priority: number;
}

const SEGMENTS: SegmentCriteria[] = [
  { type: 'HIGH_VALUE', priority: 1 },
  { type: 'CHURNED', priority: 2 },
  { type: 'WINDOW_SHOPPERS', priority: 3 },
  { type: 'DEAL_SEEKERS', priority: 4 },
  { type: 'FOODIES', priority: 5 },
  { type: 'BUDGET_MINDERS', priority: 6 },
  { type: 'NEW_USERS', priority: 7 },
  { type: 'REORDER_PROBABILITY_HIGH', priority: 8 },
  { type: 'RECENTLY_PURCHASED', priority: 9 }
];

// ============================================
// TARGETING ENGINE
// ============================================

export class TargetingEngine {
  /**
   * Evaluate user segments
   */
  async evaluate(userId: string): Promise<SegmentCriteria[]> {
    const matched: SegmentCriteria[] = [];

    if (await this.isHighValue(userId)) matched.push(SEGMENTS[0]);
    if (await this.isChurned(userId)) matched.push(SEGMENTS[1]);
    if (await this.isWindowShopper(userId)) matched.push(SEGMENTS[2]);
    if (await this.isDealSeeker(userId)) matched.push(SEGMENTS[3]);
    if (await this.isFoodie(userId)) matched.push(SEGMENTS[4]);
    if (await this.isBudgetMinder(userId)) matched.push(SEGMENTS[5]);
    if (await this.isNewUser(userId)) matched.push(SEGMENTS[6]);
    if (await this.isReorderProbabilityHigh(userId)) matched.push(SEGMENTS[7]);
    if (await this.isRecentlyPurchased(userId)) matched.push(SEGMENTS[8]);

    return matched.sort((a, b) => a.priority - b.priority);
  }

  private async isHighValue(userId: string): Promise<boolean> {
    const ltv = parseFloat(await redis.get(`user:ltv:${userId}`) || '0');
    return ltv > 1000;
  }

  private async isChurned(userId: string): Promise<boolean> {
    const lastOrder = await redis.get(`user:lastOrder:${userId}`);
    if (!lastOrder) return false;
    const daysSince = (Date.now() - parseInt(lastOrder)) / 86400000;
    return daysSince > 30;
  }

  private async isWindowShopper(userId: string): Promise<boolean> {
    const searches = parseInt(await redis.get(`user:searches:${userId}`) || '0');
    const orders = parseInt(await redis.get(`user:orders:${userId}`) || '0');
    return searches > 10 && orders < 3;
  }

  private async isDealSeeker(userId: string): Promise<boolean> {
    const deals = parseInt(await redis.get(`user:deals:${userId}`) || '0');
    return deals > 5;
  }

  private async isFoodie(userId: string): Promise<boolean> {
    const orders = parseInt(await redis.get(`user:orders:${userId}`) || '0');
    const variety = parseInt(await redis.get(`user:variety:${userId}`) || '0');
    return orders > 10 && variety > 5;
  }

  private async isBudgetMinder(userId: string): Promise<boolean> {
    const aov = parseFloat(await redis.get(`user:aov:${userId}`) || '0');
    return aov < 200;
  }

  private async isNewUser(userId: string): Promise<boolean> {
    const created = await redis.get(`user:created:${userId}`);
    if (!created) return false;
    const days = (Date.now() - parseInt(created)) / 86400000;
    return days < 7;
  }

  private async isReorderProbabilityHigh(userId: string): Promise<boolean> {
    const lastOrder = parseInt(await redis.get(`user:lastOrder:${userId}`) || '0');
    const orders = parseInt(await redis.get(`user:orders:${userId}`) || '0');
    const days = lastOrder ? (Date.now() - lastOrder) / 86400000 : 999;
    return days >= 5 && days <= 14 && orders >= 3;
  }

  private async isRecentlyPurchased(userId: string): Promise<boolean> {
    const lastOrder = await redis.get(`user:lastOrder:${userId}`);
    if (!lastOrder) return false;
    const days = (Date.now() - parseInt(lastOrder)) / 86400000;
    return days <= 7;
  }

  /**
   * Deterministic A/B variant assignment
   */
  assignVariant(userId: string, campaignId: string): 'A' | 'B' {
    const hash = this.simpleHash(`${userId}:${campaignId}`);
    return hash % 2 === 0 ? 'A' : 'B';
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  /**
   * Frequency cap check
   */
  async checkFrequencyCap(userId: string, campaignId: string, channel: string): Promise<boolean> {
    const daily = parseInt(await redis.hget(`freq:${userId}`, `${campaignId}:${channel}:daily`) || '0');
    const weekly = parseInt(await redis.hget(`freq:${userId}`, `${campaignId}:${channel}:weekly`) || '0');
    const lifetime = parseInt(await redis.hget(`freq:${userId}`, `${campaignId}:${channel}:lifetime`) || '0');

    return daily < 5 && weekly < 15 && lifetime < 50;
  }

  /**
   * Record impression
   */
  async recordImpression(userId: string, campaignId: string, channel: string): Promise<void> {
    await redis.hincrby(`freq:${userId}`, `${campaignId}:${channel}:daily`, 1);
    await redis.hincrby(`freq:${userId}`, `${campaignId}:${channel}:weekly`, 1);
    await redis.hincrby(`freq:${userId}`, `${campaignId}:${channel}:lifetime`, 1);
    await redis.expire(`freq:${userId}`, 86400 * 7);
  }
}

export const targetingEngine = new TargetingEngine();
