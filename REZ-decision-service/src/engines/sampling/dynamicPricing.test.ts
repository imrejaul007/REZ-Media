/**
 * DYNAMIC PRICING ENGINE TESTS
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DynamicPricingEngine,
  calculateDynamicPrice,
  getCurrentSurgeLevel,
  type PricingContext,
  type DynamicPrice,
  type MerchantInventory,
  type NearbyUserCount,
  type LocationType
} from './dynamicPricing';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  hgetall: vi.fn(),
  sadd: vi.fn(),
  expire: vi.fn(),
  lpush: vi.fn(),
  lrange: vi.fn(),
  ltrim: vi.fn(),
  incr: vi.fn(),
  hincrby: vi.fn()
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis)
}));

describe('DynamicPricingEngine', () => {
  let engine: DynamicPricingEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new DynamicPricingEngine();
  });

  describe('calculateTimeMultiplier', () => {
    it('should return 1.0 during peak lunch hours (12-14)', () => {
      const lunchTime = new Date('2024-01-15T12:30:00');
      expect(engine.calculateTimeMultiplier(lunchTime)).toBe(1.0);
    });

    it('should return 1.0 during peak dinner hours (19-22)', () => {
      const dinnerTime = new Date('2024-01-15T20:00:00');
      expect(engine.calculateTimeMultiplier(dinnerTime)).toBe(1.0);
    });

    it('should return 1.25 during off-peak morning (10-12)', () => {
      const morningTime = new Date('2024-01-15T11:00:00');
      expect(engine.calculateTimeMultiplier(morningTime)).toBe(1.25);
    });

    it('should return 1.5 during very off-peak (6-10)', () => {
      const earlyTime = new Date('2024-01-15T08:00:00');
      expect(engine.calculateTimeMultiplier(earlyTime)).toBe(1.5);
    });

    it('should return 1.75 during midnight hours (0-6)', () => {
      const midnightTime = new Date('2024-01-15T03:00:00');
      expect(engine.calculateTimeMultiplier(midnightTime)).toBe(1.75);
    });
  });

  describe('calculateInventoryMultiplier', () => {
    it('should return 1.0 for high stock (above 70%)', () => {
      const inventory: MerchantInventory = {
        productId: 'prod-1',
        quantity: 100,
        maxQuantity: 100,
        category: 'food'
      };
      expect(engine.calculateInventoryMultiplier(inventory)).toBe(1.0);
    });

    it('should return 1.1 for medium stock (40-70%)', () => {
      const inventory: MerchantInventory = {
        productId: 'prod-1',
        quantity: 50,
        maxQuantity: 100,
        category: 'food'
      };
      expect(engine.calculateInventoryMultiplier(inventory)).toBe(1.1);
    });

    it('should return 1.3 for low stock (15-40%)', () => {
      const inventory: MerchantInventory = {
        productId: 'prod-1',
        quantity: 25,
        maxQuantity: 100,
        category: 'food'
      };
      expect(engine.calculateInventoryMultiplier(inventory)).toBe(1.3);
    });

    it('should return 1.5 for very low stock (5-15%)', () => {
      const inventory: MerchantInventory = {
        productId: 'prod-1',
        quantity: 8,
        maxQuantity: 100,
        category: 'food'
      };
      expect(engine.calculateInventoryMultiplier(inventory)).toBe(1.5);
    });

    it('should return 1.75 for near-expiry items regardless of stock', () => {
      const tomorrow = new Date(Date.now() + 20 * 60 * 60 * 1000); // 20 hours from now
      const inventory: MerchantInventory = {
        productId: 'prod-1',
        quantity: 50,
        maxQuantity: 100,
        expiresAt: tomorrow,
        category: 'food'
      };
      expect(engine.calculateInventoryMultiplier(inventory)).toBe(1.75);
    });

    it('should return neutral 1.1 for null inventory', () => {
      expect(engine.calculateInventoryMultiplier(null)).toBe(1.1);
    });
  });

  describe('calculateDemandMultiplier', () => {
    it('should return 1.0 for high demand (above 50 users)', () => {
      const demand: NearbyUserCount = {
        total: 100,
        activeLast5min: 60,
        activeLast15min: 75
      };
      expect(engine.calculateDemandMultiplier(demand)).toBe(1.0);
    });

    it('should return 1.1 for medium demand (20-50 users)', () => {
      const demand: NearbyUserCount = {
        total: 40,
        activeLast5min: 30,
        activeLast15min: 35
      };
      expect(engine.calculateDemandMultiplier(demand)).toBe(1.1);
    });

    it('should return 1.25 for low demand (5-20 users)', () => {
      const demand: NearbyUserCount = {
        total: 15,
        activeLast5min: 10,
        activeLast15min: 12
      };
      expect(engine.calculateDemandMultiplier(demand)).toBe(1.25);
    });

    it('should return 1.5 for very low demand (below 5 users)', () => {
      const demand: NearbyUserCount = {
        total: 5,
        activeLast5min: 2,
        activeLast15min: 3
      };
      expect(engine.calculateDemandMultiplier(demand)).toBe(1.5);
    });
  });

  describe('calculateLocationMultiplier', () => {
    it('should return 1.0 for premium locations', () => {
      const location: LocationType = { type: 'premium', geohash: 'abc' };
      expect(engine.calculateLocationMultiplier(location)).toBe(1.0);
    });

    it('should return 1.0 for standard locations', () => {
      const location: LocationType = { type: 'standard', geohash: 'abc' };
      expect(engine.calculateLocationMultiplier(location)).toBe(1.0);
    });

    it('should return 1.25 for emerging areas', () => {
      const location: LocationType = { type: 'emerging', geohash: 'abc' };
      expect(engine.calculateLocationMultiplier(location)).toBe(1.25);
    });

    it('should return 1.5 for campus/hard-to-reach areas', () => {
      const location: LocationType = { type: 'campus', geohash: 'abc' };
      expect(engine.calculateLocationMultiplier(location)).toBe(1.5);
    });
  });

  describe('determineSurgeLabel', () => {
    it('should return "normal" for combined multiplier < 1.15', () => {
      expect(engine.determineSurgeLabel(1.1)).toBe('normal');
    });

    it('should return "boosted" for combined multiplier 1.15-1.3', () => {
      expect(engine.determineSurgeLabel(1.2)).toBe('boosted');
      expect(engine.determineSurgeLabel(1.29)).toBe('boosted');
    });

    it('should return "surge" for combined multiplier >= 1.3', () => {
      expect(engine.determineSurgeLabel(1.3)).toBe('surge');
      expect(engine.determineSurgeLabel(1.5)).toBe('surge');
    });
  });

  describe('calculatePrice', () => {
    beforeEach(() => {
      // Mock Redis responses
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('inventory')) return null;
        if (key.includes('location')) return null;
        if (key.includes('demand')) return Promise.resolve(JSON.stringify({
          total: '10',
          last5min: '5',
          last15min: '8'
        }));
        return null;
      });
      mockRedis.hgetall.mockResolvedValue({
        total: '10',
        last5min: '5',
        last15min: '8'
      });
    });

    it('should calculate price with all multipliers', async () => {
      const context: PricingContext = {
        merchantId: 'merchant-1',
        location: { lat: 40.7128, lng: -74.0060 },
        time: new Date('2024-01-15T12:00:00') // Lunch peak
      };

      const price = await engine.calculatePrice(context, 100);

      expect(price.baseCoins).toBe(100);
      expect(price.finalCoins).toBeGreaterThan(0);
      expect(price.multipliers).toHaveProperty('time');
      expect(price.multipliers).toHaveProperty('inventory');
      expect(price.multipliers).toHaveProperty('demand');
      expect(price.multipliers).toHaveProperty('location');
      expect(price.surgeLabel).toMatch(/^(normal|boosted|surge)$/);
      expect(price.expiresAt).toBeInstanceOf(Date);
    });

    it('should apply maximum boost during midnight off-peak with low inventory', async () => {
      // Midnight with low inventory should give high boost
      const midnightWithLowInventory: PricingContext = {
        merchantId: 'merchant-1',
        time: new Date('2024-01-15T02:00:00') // Midnight
      };

      // Mock low inventory
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('inventory')) {
          return Promise.resolve(JSON.stringify({
            productId: 'prod-1',
            quantity: 5,
            maxQuantity: 100,
            category: 'food'
          }));
        }
        if (key.includes('location')) return null;
        if (key.includes('demand')) return Promise.resolve(JSON.stringify({
          total: '10',
          last5min: '5',
          last15min: '8'
        }));
        return null;
      });

      const price = await engine.calculatePrice(midnightWithLowInventory, 100);

      // Should be boosted due to midnight (1.75) and low inventory (1.5)
      expect(price.multipliers.time).toBe(1.75);
      expect(price.multipliers.inventory).toBe(1.5);
      expect(price.finalCoins).toBeGreaterThan(100);
    });
  });
});

describe('Convenience functions', () => {
  it('calculateDynamicPrice should work as standalone function', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.hgetall.mockResolvedValue({
      total: '10',
      last5min: '5',
      last15min: '8'
    });

    const context: PricingContext = {
      merchantId: 'test-merchant',
      time: new Date()
    };

    const price = await calculateDynamicPrice(context);

    expect(price).toHaveProperty('baseCoins');
    expect(price).toHaveProperty('finalCoins');
    expect(price).toHaveProperty('multipliers');
    expect(price).toHaveProperty('surgeLabel');
  });

  it('getCurrentSurgeLevel should return surge info', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.hgetall.mockResolvedValue({
      total: '10',
      last5min: '5',
      last15min: '8'
    });

    const surge = await getCurrentSurgeLevel('test-merchant');

    expect(surge).toHaveProperty('level');
    expect(surge).toHaveProperty('activeMultiplier');
    expect(['normal', 'boosted', 'surge']).toContain(surge.level);
  });
});

describe('Integration scenarios', () => {
  beforeEach(() => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.hgetall.mockResolvedValue({
      total: '10',
      last5min: '5',
      last15min: '8'
    });
  });

  it('should model Uber surge pricing behavior', async () => {
    // Peak lunch + mall location + high demand = normal pricing
    const peakMall: PricingContext = {
      merchantId: 'mall-store-1',
      location: { lat: 40.7580, lng: -73.9855 }, // Times Square area
      time: new Date('2024-01-15T12:30:00')
    };

    const price = await calculateDynamicPrice(peakMall, 50);

    // During peak hours at premium location with normal demand
    expect(price.multipliers.time).toBe(1.0); // Peak lunch
    expect(price.surgeLabel).toBe('normal');
    expect(price.finalCoins).toBeLessThanOrEqual(price.baseCoins * 1.5);
  });

  it('should model boosting for off-peak with low inventory', async () => {
    // Midnight + low stock = surge pricing
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('inventory')) {
        return Promise.resolve(JSON.stringify({
          productId: 'prod-1',
          quantity: 3,
          maxQuantity: 100,
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          category: 'food'
        }));
      }
      return null;
    });

    const midnightBoost: PricingContext = {
      merchantId: 'late-night-merchant',
      time: new Date('2024-01-15T03:00:00')
    };

    const price = await calculateDynamicPrice(midnightBoost, 50);

    // Should be surge due to near-expiry inventory override
    expect(price.surgeLabel).toBe('surge');
    expect(price.finalCoins).toBeGreaterThan(50);
  });
});
