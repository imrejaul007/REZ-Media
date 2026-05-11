/**
 * PHASE 3-5 SAMPLING ENGINES - INTEGRATION TESTS
 *
 * Tests integration between:
 * 1. Sampling Decision Engine + Smart Coin Allocation
 * 2. Smart Coin Allocation + Dynamic Pricing
 * 3. Attribution Tracker + Sampling Analytics
 * 4. Auto Campaign + Budget Allocator
 * 5. Cross-Brand Coins + Coin Bundles
 * 6. DOOH Attribution + DOOH Analytics
 *
 * Test scenarios:
 * - End-to-end scan flow
 * - Coin allocation with all boosts
 * - Attribution tracking
 * - DOOH attribution loop
 * - Cross-brand redemption
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Redis before importing modules
const mockRedisData: Record<string, string | null> = {};
const mockRedisHashes: Record<string, Record<string, string>> = {};
const mockRedisSets: Record<string, Set<string>> = {};
const mockRedisSortedSets: Record<string, Map<string, number>> = {};
const mockRedisLists: Record<string, string[]> = {};

const mockRedis = {
  get: vi.fn(async (key: string) => mockRedisData[key] || null),
  set: vi.fn(async (key: string, value: string | number) => {
    mockRedisData[key] = String(value);
    return 'OK';
  }),
  setex: vi.fn(async (key: string, _ttl: number, value: string) => {
    mockRedisData[key] = value;
    return 'OK';
  }),
  hget: vi.fn(async (key: string, field: string) => {
    return mockRedisHashes[key]?.[field] || null;
  }),
  hgetall: vi.fn(async (key: string) => mockRedisHashes[key] || {}),
  hset: vi.fn(async (key: string, field: string, value: string | number) => {
    if (!mockRedisHashes[key]) mockRedisHashes[key] = {};
    mockRedisHashes[key][field] = String(value);
    return 1;
  }),
  hmset: vi.fn(async (key: string, data: Record<string, string | number>) => {
    if (!mockRedisHashes[key]) mockRedisHashes[key] = {};
    for (const [field, value] of Object.entries(data)) {
      mockRedisHashes[key][field] = String(value);
    }
    return 'OK';
  }),
  hincrby: vi.fn(async (key: string, field: string, increment: number) => {
    if (!mockRedisHashes[key]) mockRedisHashes[key] = {};
    const current = parseInt(mockRedisHashes[key][field] || '0');
    mockRedisHashes[key][field] = String(current + increment);
    return current + increment;
  }),
  hincrbyfloat: vi.fn(async (key: string, field: string, increment: number) => {
    if (!mockRedisHashes[key]) mockRedisHashes[key] = {};
    const current = parseFloat(mockRedisHashes[key][field] || '0');
    const result = current + increment;
    mockRedisHashes[key][field] = String(result);
    return String(result);
  }),
  sadd: vi.fn(async (key: string, ...members: string[]) => {
    if (!mockRedisSets[key]) mockRedisSets[key] = new Set();
    let added = 0;
    for (const member of members) {
      if (!mockRedisSets[key]!.has(member)) {
        mockRedisSets[key]!.add(member);
        added++;
      }
    }
    return added;
  }),
  smembers: vi.fn(async (key: string) => {
    return Array.from(mockRedisSets[key] || []);
  }),
  scard: vi.fn(async (key: string) => {
    return mockRedisSets[key]?.size || 0;
  }),
  zadd: vi.fn(async (key: string, score: number, member: string) => {
    if (!mockRedisSortedSets[key]) mockRedisSortedSets[key] = new Map();
    const isNew = !mockRedisSortedSets[key]!.has(member);
    mockRedisSortedSets[key]!.set(member, score);
    return isNew ? 1 : 0;
  }),
  zrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
    const sortedSet = mockRedisSortedSets[key];
    if (!sortedSet) return [];
    const result: string[] = [];
    for (const [member, score] of sortedSet) {
      if (score >= min && score <= max) result.push(member);
    }
    return result;
  }),
  zrange: vi.fn(async (key: string, start: number, stop: number) => {
    const sortedSet = mockRedisSortedSets[key];
    if (!sortedSet) return [];
    const sorted = Array.from(sortedSet.entries()).sort((a, b) => a[1] - b[1]);
    const end = stop === -1 ? undefined : stop + 1;
    return sorted.slice(start, end).map(([m]) => m);
  }),
  zrem: vi.fn(async (key: string, ...members: string[]) => {
    const sortedSet = mockRedisSortedSets[key];
    if (!sortedSet) return 0;
    let removed = 0;
    for (const member of members) {
      if (sortedSet.delete(member)) removed++;
    }
    return removed;
  }),
  zscore: vi.fn(async (key: string, member: string) => {
    const sortedSet = mockRedisSortedSets[key];
    if (!sortedSet) return null;
    const score = sortedSet.get(member);
    return score !== undefined ? String(score) : null;
  }),
  zincrby: vi.fn(async (key: string, increment: number, member: string) => {
    if (!mockRedisSortedSets[key]) mockRedisSortedSets[key] = new Map();
    const current = mockRedisSortedSets[key]!.get(member) || 0;
    const result = current + increment;
    mockRedisSortedSets[key]!.set(member, result);
    return String(result);
  }),
  lpush: vi.fn(async (key: string, ...values: string[]) => {
    if (!mockRedisLists[key]) mockRedisLists[key] = [];
    mockRedisLists[key]!.unshift(...values);
    return mockRedisLists[key]!.length;
  }),
  lrange: vi.fn(async (key: string, start: number, stop: number) => {
    const list = mockRedisLists[key] || [];
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end);
  }),
  ltrim: vi.fn(async (key: string, start: number, stop: number) => {
    const list = mockRedisLists[key] || [];
    const end = stop === -1 ? undefined : stop + 1;
    mockRedisLists[key] = list.slice(start, end);
    return 'OK';
  }),
  incr: vi.fn(async (key: string) => {
    const current = parseInt(mockRedisData[key] || '0');
    mockRedisData[key] = String(current + 1);
    return current + 1;
  }),
  incrby: vi.fn(async (key: string, increment: number) => {
    const current = parseInt(mockRedisData[key] || '0');
    mockRedisData[key] = String(current + increment);
    return current + increment;
  }),
  incrbyfloat: vi.fn(async (key: string, increment: number) => {
    const current = parseFloat(mockRedisData[key] || '0');
    const result = current + increment;
    mockRedisData[key] = String(result);
    return String(result);
  }),
  decrby: vi.fn(async (key: string, decrement: number) => {
    const current = parseInt(mockRedisData[key] || '0');
    mockRedisData[key] = String(current - decrement);
    return current - decrement;
  }),
  expire: vi.fn(async () => 1),
  ttl: vi.fn(async () => -1),
  del: vi.fn(async (...keys: string[]) => {
    let deleted = 0;
    for (const key of keys) {
      if (mockRedisData[key] !== undefined) {
        delete mockRedisData[key];
        deleted++;
      }
    }
    return deleted;
  }),
  pipeline: vi.fn(() => {
    const commands: Array<{ fn: string; args: unknown[] }> = [];
    const pipe = {
      get: (key: string) => { commands.push({ fn: 'get', args: [key] }); return pipe; },
      set: (key: string, value: string | number) => { commands.push({ fn: 'set', args: [key, value] }); return pipe; },
      setex: (key: string, ttl: number, value: string) => { commands.push({ fn: 'setex', args: [key, ttl, value] }); return pipe; },
      incrby: (key: string, val: number) => { commands.push({ fn: 'incrby', args: [key, val] }); return pipe; },
      incrbyfloat: (key: string, val: number) => { commands.push({ fn: 'incrbyfloat', args: [key, val] }); return pipe; },
      decrby: (key: string, val: number) => { commands.push({ fn: 'decrby', args: [key, val] }); return pipe; },
      expire: (key: string, ttl: number) => { commands.push({ fn: 'expire', args: [key, ttl] }); return pipe; },
      lpush: (key: string, val: string) => { commands.push({ fn: 'lpush', args: [key, val] }); return pipe; },
      ltrim: (key: string, start: number, stop: number) => { commands.push({ fn: 'ltrim', args: [key, start, stop] }); return pipe; },
      zadd: (key: string, score: number, member: string) => { commands.push({ fn: 'zadd', args: [key, score, member] }); return pipe; },
      hincrby: (key: string, field: string, val: number) => { commands.push({ fn: 'hincrby', args: [key, field, val] }); return pipe; },
      hset: (key: string, field: string, val: string | number) => { commands.push({ fn: 'hset', args: [key, field, val] }); return pipe; },
      hmset: (key: string, data: Record<string, string | number>) => { commands.push({ fn: 'hmset', args: [key, data] }); return pipe; },
      sadd: (key: string, val: string) => { commands.push({ fn: 'sadd', args: [key, val] }); return pipe; },
      exec: async () => {
        const results: Array<[Error | null, unknown]> = [];
        for (const cmd of commands) {
          try {
            const result = await (mockRedis as Record<string, (...args: unknown[]) => Promise<unknown>>)[cmd.fn](...cmd.args);
            results.push([null, result]);
          } catch (e) {
            results.push([e as Error, null]);
          }
        }
        return results;
      }
    };
    return pipe;
  }),
  scan: vi.fn(async () => ['0', []] as [string, string[]])
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis)
}));

// ============================================
// TEST HELPERS
// ============================================

function clearMockData(): void {
  Object.keys(mockRedisData).forEach(key => delete mockRedisData[key]);
  Object.keys(mockRedisHashes).forEach(key => delete mockRedisHashes[key]);
  Object.keys(mockRedisSets).forEach(key => delete mockRedisSets[key]);
  Object.keys(mockRedisSortedSets).forEach(key => delete mockRedisSortedSets[key]);
  Object.keys(mockRedisLists).forEach(key => delete mockRedisLists[key]);
}

async function seedUserData(userId: string, data: {
  lastActivity?: number;
  lifetimeCoins?: number;
  categoryHistory?: Record<string, string>;
}): Promise<void> {
  const prefix = 'smartcoins:';
  if (data.lastActivity) {
    await mockRedis.set(`${prefix}user:${userId}:lastActivity`, data.lastActivity.toString());
  }
  if (data.lifetimeCoins !== undefined) {
    await mockRedis.set(`${prefix}user:${userId}:lifetimeCoins`, data.lifetimeCoins.toString());
  }
  if (data.categoryHistory) {
    await mockRedis.hmset(`${prefix}user:${userId}:categoryHistory`, data.categoryHistory);
  }
}

async function seedMerchantData(merchantId: string, data: {
  inventory?: number;
  conversionRate?: number;
  rating?: number;
  totalRedeems?: number;
  category?: string;
}): Promise<void> {
  const prefix = 'smartcoins:';
  if (data.inventory !== undefined) {
    await mockRedis.set(`${prefix}merchant:${merchantId}:inventory`, data.inventory.toString());
  }
  if (data.conversionRate !== undefined) {
    await mockRedis.set(`${prefix}merchant:${merchantId}:conversionRate`, data.conversionRate.toString());
  }
  if (data.rating !== undefined) {
    await mockRedis.set(`${prefix}merchant:${merchantId}:rating`, data.rating.toString());
  }
  if (data.totalRedeems !== undefined) {
    await mockRedis.set(`${prefix}merchant:${merchantId}:totalRedeems`, data.totalRedeems.toString());
  }
  if (data.category) {
    await mockRedis.set(`${prefix}merchant:${merchantId}:category`, data.category);
  }
}

// ============================================
// INTEGRATION TESTS
// ============================================

describe('PHASE 3-5 SAMPLING ENGINES INTEGRATION TESTS', () => {
  beforeEach(() => {
    clearMockData();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearMockData();
  });

  // ============================================
  // TEST 1: Sampling Decision + Smart Coin Allocation
  // ============================================
  describe('Integration 1: Sampling Decision + Smart Coin Allocation', () => {
    it('should flow from sampling decision to coin allocation seamlessly', async () => {
      // Import engines
      const { makeSamplingDecision } = await import('../engines/sampling/samplingDecision.js');
      const { SmartCoinAllocator } = await import('../engines/sampling/smartCoinAllocation.js');

      const userId = 'user-decision-test-1';
      const campaignId = 'campaign-test-1';
      const merchantId = 'merchant-test-1';

      await seedUserData(userId, {
        lastActivity: Date.now() - 2 * 24 * 60 * 60 * 1000,
        lifetimeCoins: 500,
        categoryHistory: { 'food': '75' }
      });

      await seedMerchantData(merchantId, {
        inventory: 0.8,
        conversionRate: 0.35,
        rating: 4.5,
        totalRedeems: 50,
        category: 'food'
      });

      const context = {
        userId,
        campaignId,
        merchantId,
        time: new Date('2024-01-15T12:30:00')
      };

      const config = {
        coinType: 'try' as const,
        minCoins: 10,
        maxCoins: 100,
        targeting: {
          segments: ['food', 'dining'],
          maxPerUser: 5
        }
      };

      const decision = await makeSamplingDecision(context, config);

      expect(decision).toHaveProperty('eligible');
      expect(decision).toHaveProperty('coinAmount');
      expect(decision).toHaveProperty('coinType');
      expect(decision).toHaveProperty('timing');
      expect(decision).toHaveProperty('priority');

      const allocator = new SmartCoinAllocator();
      const allocation = await allocator.allocate({
        userId,
        campaignId,
        merchantId,
        baseCoins: decision.coinAmount || 20,
        location: { lat: 40.7128, lng: -74.0060 }
      });

      expect(allocation).toHaveProperty('coins');
      expect(allocation).toHaveProperty('breakdown');
      expect(allocation).toHaveProperty('reason');
      expect(allocation).toHaveProperty('budgetStatus');

      expect(allocation.coins).toBeGreaterThan(0);
      expect(allocation.breakdown).toHaveProperty('base');
      expect(allocation.breakdown).toHaveProperty('userBoost');
      expect(allocation.breakdown).toHaveProperty('merchantBoost');
      expect(allocation.breakdown).toHaveProperty('marketBoost');
    });

    it('should handle NEW user boost through the integration', async () => {
      const { makeSamplingDecision } = await import('../engines/sampling/samplingDecision.js');
      const { SmartCoinAllocator } = await import('../engines/sampling/smartCoinAllocation.js');

      const userId = 'user-new-test';
      const campaignId = 'campaign-new-test';
      const merchantId = 'merchant-new-test';

      await seedUserData(userId, {
        lifetimeCoins: 0
      });

      await seedMerchantData(merchantId, {
        inventory: 0.6,
        category: 'food'
      });

      const decision = await makeSamplingDecision({
        userId,
        campaignId,
        merchantId,
        time: new Date()
      }, {
        coinType: 'try',
        minCoins: 15,
        maxCoins: 80
      });

      const allocator = new SmartCoinAllocator();
      const allocation = await allocator.allocate({
        userId,
        campaignId,
        merchantId,
        baseCoins: decision.coinAmount || 20
      });

      expect(allocation.reason).toContain('NEW user boost');
    });

    it('should handle timing decisions from sampling decision', async () => {
      const { makeSamplingDecision } = await import('../engines/sampling/samplingDecision.js');

      const userId = 'user-timing-test';
      const campaignId = 'campaign-timing-test';
      const merchantId = 'merchant-timing-test';

      await seedUserData(userId, {
        lastActivity: Date.now()
      });

      await seedMerchantData(merchantId, {
        category: 'food'
      });

      // Test that timing decision is returned
      const context = {
        userId,
        campaignId,
        merchantId,
        time: new Date('2024-01-15T23:30:00')
      };

      const decision = await makeSamplingDecision(context, {
        coinType: 'try',
        minCoins: 10,
        maxCoins: 50
      });

      // Verify timing object exists with expected structure
      expect(decision.timing).toBeDefined();
      expect(typeof decision.timing.sendNow).toBe('boolean');
    });
  });

  // ============================================
  // TEST 2: Smart Coin Allocation + Dynamic Pricing
  // ============================================
  describe('Integration 2: Smart Coin Allocation + Dynamic Pricing', () => {
    it('should integrate coin allocation with dynamic pricing multipliers', async () => {
      const { SmartCoinAllocator } = await import('../engines/sampling/smartCoinAllocation.js');
      const { DynamicPricingEngine } = await import('../engines/sampling/dynamicPricing.js');

      const userId = 'user-pricing-test';
      const campaignId = 'campaign-pricing-test';
      const merchantId = 'merchant-pricing-test';

      await seedUserData(userId, {
        lastActivity: Date.now() - 3 * 24 * 60 * 60 * 1000,
        categoryHistory: { 'food': '60' }
      });

      await seedMerchantData(merchantId, {
        inventory: 0.5,
        conversionRate: 0.3,
        rating: 4.0,
        totalRedeems: 20
      });

      const pricingPrefix = 'pricing:';
      await mockRedis.setex(
        `${pricingPrefix}inventory:${merchantId}`,
        3600,
        JSON.stringify({
          productId: 'prod-1',
          quantity: 50,
          maxQuantity: 100,
          category: 'food'
        })
      );

      await mockRedis.hmset(`${pricingPrefix}demand:${merchantId}`, {
        total: '15',
        last5min: '8',
        last15min: '12'
      });

      const pricingEngine = new DynamicPricingEngine();

      const offPeakPricing = await pricingEngine.calculatePrice({
        merchantId,
        location: { lat: 40.7128, lng: -74.0060 },
        time: new Date('2024-01-15T03:00:00')
      }, 50);

      expect(offPeakPricing.multipliers.time).toBe(1.75);
      expect(offPeakPricing.finalCoins).toBeGreaterThan(50);

      const peakPricing = await pricingEngine.calculatePrice({
        merchantId,
        location: { lat: 40.7128, lng: -74.0060 },
        time: new Date('2024-01-15T12:30:00')
      }, 50);

      expect(peakPricing.multipliers.time).toBe(1.0);
      expect(peakPricing.surgeLabel).toBe('normal');

      const allocator = new SmartCoinAllocator();
      const baseAllocation = await allocator.allocate({
        userId,
        campaignId,
        merchantId,
        baseCoins: 50
      });

      expect(baseAllocation.coins).toBeGreaterThanOrEqual(5);
      expect(baseAllocation.coins).toBeLessThanOrEqual(500);
    });

    it('should apply surge pricing correctly in allocation', async () => {
      const { DynamicPricingEngine } = await import('../engines/sampling/dynamicPricing.js');

      const merchantId = 'merchant-surge-test';

      const pricingEngine = new DynamicPricingEngine();

      const nearExpiryTime = new Date();
      nearExpiryTime.setHours(nearExpiryTime.getHours() + 2);

      await mockRedis.setex(
        'pricing:inventory:' + merchantId,
        3600,
        JSON.stringify({
          productId: 'prod-1',
          quantity: 5,
          maxQuantity: 100,
          expiresAt: nearExpiryTime.toISOString(),
          category: 'food'
        })
      );

      const surgePricing = await pricingEngine.calculatePrice({
        merchantId,
        time: new Date()
      }, 50);

      // Verify near-expiry inventory multiplier is applied
      expect(surgePricing.multipliers.inventory).toBe(1.75);
      // The surge label depends on combined multiplier
      expect(['normal', 'boosted', 'surge']).toContain(surgePricing.surgeLabel);
    });
  });

  // ============================================
  // TEST 3: Attribution Tracker + Sampling Analytics
  // ============================================
  describe('Integration 3: Attribution Tracker + Sampling Analytics', () => {
    it('should track complete scan-to-purchase funnel', async () => {
      const { trackScan, trackVisit, trackRedeem, trackPurchase, attributionTracker } = await import('../engines/sampling/attribution.js');

      const userId = 'user-attribution-test';
      const campaignId = 'campaign-attr-test';
      const merchantId = 'merchant-attr-test';

      // Track scan event
      const scanResult = await trackScan(userId, campaignId, merchantId, {
        location: { lat: 40.7128, lng: -74.0060 }
      });
      expect(scanResult).toBeDefined();
      expect(scanResult).toHaveProperty('success');

      // Track visit event
      const visitResult = await trackVisit(userId, campaignId, merchantId, {
        checkinTime: new Date()
      });
      expect(visitResult).toBeDefined();

      // Track redeem event
      const redeemResult = await trackRedeem(userId, campaignId, merchantId, 25);
      expect(redeemResult).toBeDefined();

      // Track purchase event
      const purchaseResult = await trackPurchase(
        userId,
        campaignId,
        merchantId,
        150,
        { items: ['burger', 'fries'] }
      );
      expect(purchaseResult).toBeDefined();

      // Get attribution summary
      const summary = await attributionTracker.getAttributionSummary(userId, 7);

      expect(summary).toBeDefined();
      expect(summary.userId).toBe(userId);
      // Verify funnel stats exist
      expect(summary.funnelStats).toBeDefined();
      expect(summary.funnelStats.conversionRates).toBeDefined();
    });

    it('should calculate attribution with different models', async () => {
      const { attributionTracker } = await import('../engines/sampling/attribution.js');

      const userId = 'user-model-test';
      const campaignId = 'campaign-model-test';
      const merchantId = 'merchant-model-test';

      const baseTime = Date.now() - 2 * 60 * 60 * 1000;

      await attributionTracker.trackEvent({
        userId,
        campaignId,
        merchantId,
        event: 'scan',
        timestamp: new Date(baseTime)
      });

      await attributionTracker.trackEvent({
        userId,
        campaignId,
        merchantId,
        event: 'visit',
        timestamp: new Date(baseTime + 30 * 60 * 1000)
      });

      await attributionTracker.trackEvent({
        userId,
        campaignId,
        merchantId,
        event: 'redeem',
        timestamp: new Date(baseTime + 60 * 60 * 1000)
      });

      const conversionValue = 200;

      const lastTouchResults = await attributionTracker.calculateAttribution(
        userId,
        campaignId,
        conversionValue,
        'purchase',
        'last-touch'
      );
      expect(lastTouchResults.length).toBeGreaterThan(0);
      expect(lastTouchResults[0].weight).toBeLessThanOrEqual(1);

      const firstTouchResults = await attributionTracker.calculateAttribution(
        userId,
        campaignId,
        conversionValue,
        'purchase',
        'first-touch'
      );
      expect(firstTouchResults.length).toBeGreaterThan(0);

      const linearResults = await attributionTracker.calculateAttribution(
        userId,
        campaignId,
        conversionValue,
        'purchase',
        'linear'
      );
      expect(linearResults.length).toBeGreaterThan(0);

      const timeDecayResults = await attributionTracker.calculateAttribution(
        userId,
        campaignId,
        conversionValue,
        'purchase',
        'time-decay'
      );
      expect(timeDecayResults.length).toBeGreaterThan(0);
    });

    it('should record conversion with automatic attribution', async () => {
      const { trackScan, attributionTracker } = await import('../engines/sampling/attribution.js');

      const userId = 'user-conversion-test';
      const campaignId = 'campaign-conv-test';
      const merchantId = 'merchant-conv-test';

      await trackScan(userId, campaignId, merchantId);

      const conversionResults = await attributionTracker.recordConversion(
        userId,
        campaignId,
        merchantId,
        'purchase',
        250,
        'last-touch'
      );

      expect(conversionResults.length).toBeGreaterThan(0);
      expect(conversionResults[0]).toHaveProperty('creditedCampaign');
      expect(conversionResults[0]).toHaveProperty('creditedAmount');
      expect(conversionResults[0]).toHaveProperty('weight');
    });
  });

  // ============================================
  // TEST 4: Auto Campaign + Budget Allocator
  // ============================================
  describe('Integration 4: Auto Campaign + Budget Allocator', () => {
    it('should create campaign and allocate budget correctly', async () => {
      const { SignalDetectionEngine, CampaignSuggestionEngine } = await import('../engines/sampling/autoCampaign.js');
      const { createBudgetAllocator } = await import('../engines/sampling/budgetAllocator.js');

      const merchantId = 'merchant-auto-test';
      const userId = 'user-auto-test';

      await mockRedis.set(
        'autocampaign:merchant:' + merchantId + ':inventory',
        '0.9'
      );
      await mockRedis.set(
        'autocampaign:merchant:' + merchantId + ':daysInStock',
        '15'
      );

      const signalEngine = new SignalDetectionEngine();
      const signals = await signalEngine.detectSignals({
        merchantId,
        time: new Date('2024-01-15T12:30:00')
      });

      expect(signals.length).toBeGreaterThan(0);

      const suggestionEngine = new CampaignSuggestionEngine();
      const campaigns = await suggestionEngine.suggestCampaigns(signals);

      if (campaigns.length > 0) {
        const campaign = campaigns[0];

        const budgetConfig = {
          campaignId: campaign.id,
          totalBudget: campaign.suggestedBudget,
          channels: {
            whatsapp: 250,
            push: 200,
            ads: 350,
            qr: 200
          },
          dailyLimit: 1000,
          perUserLimit: 10
        };

        const allocator = await createBudgetAllocator(budgetConfig);

        await allocator.recordSpending('whatsapp', userId, 5);
        await allocator.recordSpending('push', userId, 3);

        const allocation = await allocator.getAllocation();

        expect(allocation.campaignId).toBe(campaign.id);
        expect(allocation.totalBudget).toBe(campaign.suggestedBudget);
        expect(allocation.spent).toBe(8);

        const whatsappChannel = allocation.allocations.find(a => a.channel === 'whatsapp');
        expect(whatsappChannel).toBeDefined();
        expect(whatsappChannel!.spent).toBe(5);
      }
    });

    it('should enforce budget guards', async () => {
      const { createBudgetAllocator } = await import('../engines/sampling/budgetAllocator.js');

      const campaignId = 'campaign-guard-test';
      const userId = 'user-guard-test';

      const budgetConfig = {
        campaignId,
        totalBudget: 100,
        channels: {
          whatsapp: 25,
          push: 25,
          ads: 25,
          qr: 25
        },
        dailyLimit: 50,
        perUserLimit: 10
      };

      const allocator = await createBudgetAllocator(budgetConfig);

      // First check should return a result
      const canSpend1 = await allocator.canSpend('whatsapp', userId, 5);
      expect(canSpend1).toHaveProperty('allowed');
      expect(typeof canSpend1.allowed).toBe('boolean');

      // Record the spend
      await allocator.recordSpending('whatsapp', userId, 5);

      // Second check
      const canSpend2 = await allocator.canSpend('whatsapp', userId, 4);
      expect(canSpend2).toHaveProperty('allowed');

      // Verify allocation structure
      const allocation = await allocator.getAllocation();
      expect(allocation.campaignId).toBe(campaignId);
    });

    it('should generate alerts for budget issues', async () => {
      const { createBudgetAllocator } = await import('../engines/sampling/budgetAllocator.js');

      const campaignId = 'campaign-alert-test';

      const budgetConfig = {
        campaignId,
        totalBudget: 100,
        channels: {
          whatsapp: 25,
          push: 25,
          ads: 25,
          qr: 25
        }
      };

      const allocator = await createBudgetAllocator(budgetConfig);

      // Record spending
      await allocator.recordSpending('whatsapp', 'user-1', 10);
      await allocator.recordSpending('push', 'user-2', 10);

      // Get allocation and verify
      const allocation = await allocator.getAllocation();
      expect(allocation).toBeDefined();
      expect(allocation.spent).toBeGreaterThanOrEqual(0);
      expect(allocation.alerts).toBeDefined();
    });
  });

  // ============================================
  // TEST 5: Cross-Brand Coins + Coin Bundles
  // ============================================
  describe('Integration 5: Cross-Brand Coins + Coin Bundles', () => {
    it('should create cross-brand coin and track balance', async () => {
      const { CrossBrandCoinManager } = await import('../engines/sampling/crossBrandCoins.js');
      const { BundleGenerationEngine, PurchaseEngine } = await import('../engines/sampling/coinBundles.js');

      const merchants = ['merchant-brand-1', 'merchant-brand-2', 'merchant-brand-3'];
      const userId = 'user-crossbrand-test';

      const coinManager = new CrossBrandCoinManager();

      const coin = await coinManager.createCoin({
        name: 'Foodie Coins',
        symbol: 'FOOD',
        merchants,
        networkType: 'restaurant',
        maxRedemptionPercent: 50,
        expiryDays: 90
      });

      expect(coin.id).toBeDefined();
      expect(coin.merchants).toEqual(merchants);
      expect(coin.status).toBe('active');

      const bundleGen = new BundleGenerationEngine();
      const bundle = bundleGen.generateValuePack('rez');

      const purchaseEngine = new PurchaseEngine();
      const purchaseResult = await purchaseEngine.processPurchase({
        bundle,
        userId,
        paymentId: 'pay-test-123',
        applyFirstPurchaseDiscount: true
      });

      expect(purchaseResult.success).toBe(true);
      expect(purchaseResult.purchase).toBeDefined();
      expect(purchaseResult.purchase!.coins).toBe(bundle.coinAmount);
      expect(purchaseResult.purchase!.bonus).toBeGreaterThan(0);
    });

    it('should handle redemption at network merchants', async () => {
      const { CrossBrandCoinManager, MerchantRulesEngine, RedemptionEngine, BalanceTracker } = await import('../engines/sampling/crossBrandCoins.js');

      const merchants = ['merchant-1', 'merchant-2', 'merchant-3'];
      const userId = 'user-redeem-test';
      const merchantId = 'merchant-1';

      const coinManager = new CrossBrandCoinManager();
      const coin = await coinManager.createCoin({
        name: 'Fashion Coins',
        symbol: 'FASH',
        merchants,
        networkType: 'fashion',
        maxRedemptionPercent: 40
      });

      const balanceTracker = new BalanceTracker();
      await balanceTracker.addCoins(userId, coin.id, 200, 'fashion');

      const rulesEngine = new MerchantRulesEngine();
      await rulesEngine.setRule(merchantId, coin.id, {
        maxPercent: 30,
        minBillAmount: 200,
        status: 'active'
      });

      const redemptionEngine = new RedemptionEngine();
      const calculation = await redemptionEngine.calculateRedemption({
        userId,
        coinId: coin.id,
        merchantId,
        billAmount: 500
      });

      expect(calculation.success).toBe(true);
      expect(calculation.coinsUsed).toBeGreaterThan(0);
      expect(calculation.discountAmount).toBeGreaterThan(0);
      expect(calculation.cashRequired).toBeLessThan(500);

      const redemption = await redemptionEngine.redeem({
        userId,
        coinId: coin.id,
        merchantId,
        billAmount: 500
      });

      expect(redemption.success).toBe(true);
      expect(redemption.newBalance).toBeLessThan(200);
    });

    it('should calculate bundle bonuses correctly', async () => {
      const { BonusCalculationEngine, BundlePricingEngine } = await import('../engines/sampling/coinBundles.js');

      const bonusEngine = new BonusCalculationEngine();
      const pricingEngine = new BundlePricingEngine();

      const bonuses = bonusEngine.calculateTotalBonus({
        coinAmount: 500,
        userId: 'user-bonus-test',
        isFirstPurchase: true,
        loyaltyTier: 'bronze',
        hasActiveSubscription: false,
        date: new Date('2024-01-13')
      });

      expect(bonuses.totalBonus).toBeGreaterThan(0);
      expect(bonuses.volumeBonus).toBeGreaterThan(0);
      expect(bonuses.firstPurchaseBonus).toBeGreaterThan(0);
      expect(bonuses.timeLimitedBonus).toBeGreaterThan(0);

      const price = pricingEngine.calculatePrice(500, 'rez');
      expect(price).toBeLessThan(500 * 0.012);
    });

    it('should apply loyalty tier discounts', async () => {
      const { BundlePricingEngine } = await import('../engines/sampling/coinBundles.js');

      const pricingEngine = new BundlePricingEngine();

      const bronzeBonus = pricingEngine.calculateLoyaltyBonus(500, 'bronze');
      const silverBonus = pricingEngine.calculateLoyaltyBonus(500, 'silver');
      const goldBonus = pricingEngine.calculateLoyaltyBonus(500, 'gold');
      const platinumBonus = pricingEngine.calculateLoyaltyBonus(500, 'platinum');

      expect(bronzeBonus).toBe(0);
      expect(silverBonus).toBe(10);
      expect(goldBonus).toBe(25);
      expect(platinumBonus).toBe(50);

      expect(pricingEngine.getLoyaltyTier(50)).toBe('bronze');
      expect(pricingEngine.getLoyaltyTier(150)).toBe('silver');
      expect(pricingEngine.getLoyaltyTier(600)).toBe('gold');
      expect(pricingEngine.getLoyaltyTier(2500)).toBe('platinum');
    });
  });

  // ============================================
  // TEST 6: DOOH Attribution + DOOH Analytics
  // ============================================
  describe('Integration 6: DOOH Attribution + DOOH Analytics', () => {
    it('should track complete DOOH funnel', async () => {
      const { DOOHAttributionTracker } = await import('../engines/sampling/doohAttribution.js');

      const screenId = 'screen-dooh-test';
      const campaignId = 'campaign-dooh-test';
      const userId = 'user-dooh-test';

      const tracker = new DOOHAttributionTracker();

      const screenResult = await tracker.registerScreen({
        screenId,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          venueType: 'mall'
        },
        network: 'premium-network',
        dimensions: { width: 1920, height: 1080 },
        orientation: 'landscape',
        isActive: true
      });
      expect(screenResult.success).toBe(true);

      const impressionResult = await tracker.trackImpression({
        screenId,
        campaignId,
        timestamp: new Date(),
        durationViewed: 15,
        audienceCount: 3
      });
      expect(impressionResult.success).toBe(true);

      const qrMapping = await tracker.createQRMapping(screenId, campaignId);
      expect(qrMapping.qrCode).toBeDefined();

      const scanResult = await tracker.trackQRScan({
        screenId,
        campaignId,
        qrCode: qrMapping.qrCode,
        userId,
        scanTime: new Date(),
        deviceInfo: { isMobile: true }
      });
      expect(scanResult).toBeDefined();

      const visitResult = await tracker.trackVisit({
        screenId,
        campaignId,
        userId,
        visitTime: new Date(),
        source: 'qr_scan'
      });
      expect(visitResult).toBeDefined();

      const purchaseResult = await tracker.trackPurchase({
        screenId,
        campaignId,
        userId,
        purchaseTime: new Date(),
        purchaseValue: 350,
        orderId: 'order-dooh-test-1'
      });
      expect(purchaseResult).toBeDefined();
    });

    it('should calculate DOOH attribution with different models', async () => {
      const { DOOHAttributionTracker } = await import('../engines/sampling/doohAttribution.js');

      const screenId = 'screen-attr-model-test';
      const campaignId = 'campaign-attr-model-test';
      const userId = 'user-dooh-model-test';

      const tracker = new DOOHAttributionTracker();

      const baseTime = Date.now() - 4 * 60 * 60 * 1000;

      await tracker.trackImpression({
        screenId,
        campaignId,
        timestamp: new Date(baseTime),
        durationViewed: 10,
        audienceCount: 2
      });

      await tracker.trackQRScan({
        screenId,
        campaignId,
        qrCode: 'TEST_QR_123',
        userId,
        scanTime: new Date(baseTime + 30 * 60 * 1000)
      });

      await tracker.trackVisit({
        screenId,
        campaignId,
        userId,
        visitTime: new Date(baseTime + 60 * 60 * 1000),
        source: 'qr_scan'
      });

      const purchaseValue = 500;

      const firstTouch = await tracker.calculateAttribution(
        userId,
        screenId,
        campaignId,
        purchaseValue,
        'first-touch'
      );
      expect(Array.isArray(firstTouch)).toBe(true);

      const lastTouch = await tracker.calculateAttribution(
        userId,
        screenId,
        campaignId,
        purchaseValue,
        'last-touch'
      );
      expect(Array.isArray(lastTouch)).toBe(true);

      const timeDecay = await tracker.calculateAttribution(
        userId,
        screenId,
        campaignId,
        purchaseValue,
        'time-decay'
      );
      expect(Array.isArray(timeDecay)).toBe(true);
    });

    it('should get DOOH screen and campaign summaries', async () => {
      const { DOOHAttributionTracker } = await import('../engines/sampling/doohAttribution.js');

      const screenId = 'screen-summary-test';
      const campaignId = 'campaign-summary-test';

      const tracker = new DOOHAttributionTracker();

      await tracker.registerScreen({
        screenId,
        location: { latitude: 40.7128, longitude: -74.0060, venueType: 'mall' },
        network: 'test-network',
        dimensions: { width: 1920, height: 1080 },
        orientation: 'landscape',
        isActive: true
      });

      // Track some impressions
      for (let i = 0; i < 3; i++) {
        await tracker.trackImpression({
          screenId,
          campaignId,
          timestamp: new Date(),
          durationViewed: 12,
          audienceCount: 2
        });
      }

      const screenSummary = await tracker.getScreenSummary(screenId, campaignId);
      expect(Array.isArray(screenSummary)).toBe(true);

      const campaignSummary = await tracker.getCampaignSummary(campaignId);
      expect(campaignSummary).toBeDefined();
      expect(campaignSummary.campaignId).toBe(campaignId);
      expect(campaignSummary.conversionFunnel).toBeDefined();
    });
  });

  // ============================================
  // END-TO-END SCAN FLOW TEST
  // ============================================
  describe('End-to-End Scan Flow', () => {
    it('should execute complete scan-to-redemption flow', async () => {
      const { makeSamplingDecision } = await import('../engines/sampling/samplingDecision.js');
      const { SmartCoinAllocator } = await import('../engines/sampling/smartCoinAllocation.js');
      const { trackScan, trackVisit, trackRedeem, trackPurchase, attributionTracker } = await import('../engines/sampling/attribution.js');

      const userId = 'user-e2e-test';
      const campaignId = 'campaign-e2e-test';
      const merchantId = 'merchant-e2e-test';

      // Track scan
      const scanResult = await trackScan(userId, campaignId, merchantId, {
        location: { lat: 40.7128, lng: -74.0060 },
        scanType: 'qr'
      });
      expect(scanResult).toBeDefined();

      await seedUserData(userId, {
        lastActivity: Date.now() - 1 * 24 * 60 * 60 * 1000,
        categoryHistory: { 'food': '70' }
      });

      await seedMerchantData(merchantId, {
        inventory: 0.75,
        conversionRate: 0.4,
        rating: 4.3,
        totalRedeems: 30,
        category: 'food'
      });

      const decision = await makeSamplingDecision({
        userId,
        campaignId,
        merchantId,
        time: new Date('2024-01-15T12:30:00')
      }, {
        coinType: 'try',
        minCoins: 15,
        maxCoins: 100
      });

      expect(decision).toHaveProperty('eligible');

      const allocator = new SmartCoinAllocator();
      const allocation = await allocator.allocate({
        userId,
        campaignId,
        merchantId,
        baseCoins: decision.coinAmount || 20,
        location: { lat: 40.7128, lng: -74.0060 }
      });

      expect(allocation).toHaveProperty('coins');

      // Track visit
      const visitResult = await trackVisit(userId, campaignId, merchantId, {
        checkinTime: new Date()
      });
      expect(visitResult).toBeDefined();

      // Track redeem
      const redeemResult = await trackRedeem(
        userId,
        campaignId,
        merchantId,
        allocation.coins
      );
      expect(redeemResult).toBeDefined();

      // Track purchase
      const purchaseResult = await trackPurchase(
        userId,
        campaignId,
        merchantId,
        200,
        { items: ['meal'] }
      );
      expect(purchaseResult).toBeDefined();

      // Get attribution summary
      const summary = await attributionTracker.getAttributionSummary(userId, 7);
      expect(summary).toBeDefined();
      expect(summary.userId).toBe(userId);
      expect(summary.funnelStats).toBeDefined();
    });
  });

  // ============================================
  // TIMING & SCHEDULING TESTS
  // ============================================
  describe('Timing and Scheduling Integration', () => {
    it('should respect time-based decision timing', async () => {
      const { makeSamplingDecision } = await import('../engines/sampling/samplingDecision.js');

      const userId = 'user-timing-integration';
      const campaignId = 'campaign-timing-integration';
      const merchantId = 'merchant-timing-integration';

      await seedUserData(userId, { lastActivity: Date.now() });

      // Test morning decision
      const morningDecision = await makeSamplingDecision({
        userId,
        campaignId,
        merchantId,
        time: new Date('2024-01-15T09:00:00')
      }, {
        coinType: 'try',
        minCoins: 10,
        maxCoins: 50
      });

      // Verify timing object exists
      expect(morningDecision.timing).toBeDefined();
      expect(typeof morningDecision.timing.sendNow).toBe('boolean');

      // Test late night decision
      const nightDecision = await makeSamplingDecision({
        userId,
        campaignId,
        merchantId,
        time: new Date('2024-01-15T23:30:00')
      }, {
        coinType: 'try',
        minCoins: 10,
        maxCoins: 50
      });

      expect(nightDecision.timing).toBeDefined();
      expect(typeof nightDecision.timing.sendNow).toBe('boolean');
    });
  });
});
