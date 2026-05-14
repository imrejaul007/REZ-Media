"use strict";
/**
 * DYNAMIC PRICING ENGINE TESTS
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const dynamicPricing_1 = require("./dynamicPricing");
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
(0, vitest_1.describe)('DynamicPricingEngine', () => {
    let engine;
    (0, vitest_1.beforeEach)(() => {
        vi.clearAllMocks();
        engine = new dynamicPricing_1.DynamicPricingEngine();
    });
    (0, vitest_1.describe)('calculateTimeMultiplier', () => {
        (0, vitest_1.it)('should return 1.0 during peak lunch hours (12-14)', () => {
            const lunchTime = new Date('2024-01-15T12:30:00');
            (0, vitest_1.expect)(engine.calculateTimeMultiplier(lunchTime)).toBe(1.0);
        });
        (0, vitest_1.it)('should return 1.0 during peak dinner hours (19-22)', () => {
            const dinnerTime = new Date('2024-01-15T20:00:00');
            (0, vitest_1.expect)(engine.calculateTimeMultiplier(dinnerTime)).toBe(1.0);
        });
        (0, vitest_1.it)('should return 1.25 during off-peak morning (10-12)', () => {
            const morningTime = new Date('2024-01-15T11:00:00');
            (0, vitest_1.expect)(engine.calculateTimeMultiplier(morningTime)).toBe(1.25);
        });
        (0, vitest_1.it)('should return 1.5 during very off-peak (6-10)', () => {
            const earlyTime = new Date('2024-01-15T08:00:00');
            (0, vitest_1.expect)(engine.calculateTimeMultiplier(earlyTime)).toBe(1.5);
        });
        (0, vitest_1.it)('should return 1.75 during midnight hours (0-6)', () => {
            const midnightTime = new Date('2024-01-15T03:00:00');
            (0, vitest_1.expect)(engine.calculateTimeMultiplier(midnightTime)).toBe(1.75);
        });
    });
    (0, vitest_1.describe)('calculateInventoryMultiplier', () => {
        (0, vitest_1.it)('should return 1.0 for high stock (above 70%)', () => {
            const inventory = {
                productId: 'prod-1',
                quantity: 100,
                maxQuantity: 100,
                category: 'food'
            };
            (0, vitest_1.expect)(engine.calculateInventoryMultiplier(inventory)).toBe(1.0);
        });
        (0, vitest_1.it)('should return 1.1 for medium stock (40-70%)', () => {
            const inventory = {
                productId: 'prod-1',
                quantity: 50,
                maxQuantity: 100,
                category: 'food'
            };
            (0, vitest_1.expect)(engine.calculateInventoryMultiplier(inventory)).toBe(1.1);
        });
        (0, vitest_1.it)('should return 1.3 for low stock (15-40%)', () => {
            const inventory = {
                productId: 'prod-1',
                quantity: 25,
                maxQuantity: 100,
                category: 'food'
            };
            (0, vitest_1.expect)(engine.calculateInventoryMultiplier(inventory)).toBe(1.3);
        });
        (0, vitest_1.it)('should return 1.5 for very low stock (5-15%)', () => {
            const inventory = {
                productId: 'prod-1',
                quantity: 8,
                maxQuantity: 100,
                category: 'food'
            };
            (0, vitest_1.expect)(engine.calculateInventoryMultiplier(inventory)).toBe(1.5);
        });
        (0, vitest_1.it)('should return 1.75 for near-expiry items regardless of stock', () => {
            const tomorrow = new Date(Date.now() + 20 * 60 * 60 * 1000); // 20 hours from now
            const inventory = {
                productId: 'prod-1',
                quantity: 50,
                maxQuantity: 100,
                expiresAt: tomorrow,
                category: 'food'
            };
            (0, vitest_1.expect)(engine.calculateInventoryMultiplier(inventory)).toBe(1.75);
        });
        (0, vitest_1.it)('should return neutral 1.1 for null inventory', () => {
            (0, vitest_1.expect)(engine.calculateInventoryMultiplier(null)).toBe(1.1);
        });
    });
    (0, vitest_1.describe)('calculateDemandMultiplier', () => {
        (0, vitest_1.it)('should return 1.0 for high demand (above 50 users)', () => {
            const demand = {
                total: 100,
                activeLast5min: 60,
                activeLast15min: 75
            };
            (0, vitest_1.expect)(engine.calculateDemandMultiplier(demand)).toBe(1.0);
        });
        (0, vitest_1.it)('should return 1.1 for medium demand (20-50 users)', () => {
            const demand = {
                total: 40,
                activeLast5min: 30,
                activeLast15min: 35
            };
            (0, vitest_1.expect)(engine.calculateDemandMultiplier(demand)).toBe(1.1);
        });
        (0, vitest_1.it)('should return 1.25 for low demand (5-20 users)', () => {
            const demand = {
                total: 15,
                activeLast5min: 10,
                activeLast15min: 12
            };
            (0, vitest_1.expect)(engine.calculateDemandMultiplier(demand)).toBe(1.25);
        });
        (0, vitest_1.it)('should return 1.5 for very low demand (below 5 users)', () => {
            const demand = {
                total: 5,
                activeLast5min: 2,
                activeLast15min: 3
            };
            (0, vitest_1.expect)(engine.calculateDemandMultiplier(demand)).toBe(1.5);
        });
    });
    (0, vitest_1.describe)('calculateLocationMultiplier', () => {
        (0, vitest_1.it)('should return 1.0 for premium locations', () => {
            const location = { type: 'premium', geohash: 'abc' };
            (0, vitest_1.expect)(engine.calculateLocationMultiplier(location)).toBe(1.0);
        });
        (0, vitest_1.it)('should return 1.0 for standard locations', () => {
            const location = { type: 'standard', geohash: 'abc' };
            (0, vitest_1.expect)(engine.calculateLocationMultiplier(location)).toBe(1.0);
        });
        (0, vitest_1.it)('should return 1.25 for emerging areas', () => {
            const location = { type: 'emerging', geohash: 'abc' };
            (0, vitest_1.expect)(engine.calculateLocationMultiplier(location)).toBe(1.25);
        });
        (0, vitest_1.it)('should return 1.5 for campus/hard-to-reach areas', () => {
            const location = { type: 'campus', geohash: 'abc' };
            (0, vitest_1.expect)(engine.calculateLocationMultiplier(location)).toBe(1.5);
        });
    });
    (0, vitest_1.describe)('determineSurgeLabel', () => {
        (0, vitest_1.it)('should return "normal" for combined multiplier < 1.15', () => {
            (0, vitest_1.expect)(engine.determineSurgeLabel(1.1)).toBe('normal');
        });
        (0, vitest_1.it)('should return "boosted" for combined multiplier 1.15-1.3', () => {
            (0, vitest_1.expect)(engine.determineSurgeLabel(1.2)).toBe('boosted');
            (0, vitest_1.expect)(engine.determineSurgeLabel(1.29)).toBe('boosted');
        });
        (0, vitest_1.it)('should return "surge" for combined multiplier >= 1.3', () => {
            (0, vitest_1.expect)(engine.determineSurgeLabel(1.3)).toBe('surge');
            (0, vitest_1.expect)(engine.determineSurgeLabel(1.5)).toBe('surge');
        });
    });
    (0, vitest_1.describe)('calculatePrice', () => {
        (0, vitest_1.beforeEach)(() => {
            // Mock Redis responses
            mockRedis.get.mockImplementation((key) => {
                if (key.includes('inventory'))
                    return null;
                if (key.includes('location'))
                    return null;
                if (key.includes('demand'))
                    return Promise.resolve(JSON.stringify({
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
        (0, vitest_1.it)('should calculate price with all multipliers', async () => {
            const context = {
                merchantId: 'merchant-1',
                location: { lat: 40.7128, lng: -74.0060 },
                time: new Date('2024-01-15T12:00:00') // Lunch peak
            };
            const price = await engine.calculatePrice(context, 100);
            (0, vitest_1.expect)(price.baseCoins).toBe(100);
            (0, vitest_1.expect)(price.finalCoins).toBeGreaterThan(0);
            (0, vitest_1.expect)(price.multipliers).toHaveProperty('time');
            (0, vitest_1.expect)(price.multipliers).toHaveProperty('inventory');
            (0, vitest_1.expect)(price.multipliers).toHaveProperty('demand');
            (0, vitest_1.expect)(price.multipliers).toHaveProperty('location');
            (0, vitest_1.expect)(price.surgeLabel).toMatch(/^(normal|boosted|surge)$/);
            (0, vitest_1.expect)(price.expiresAt).toBeInstanceOf(Date);
        });
        (0, vitest_1.it)('should apply maximum boost during midnight off-peak with low inventory', async () => {
            // Midnight with low inventory should give high boost
            const midnightWithLowInventory = {
                merchantId: 'merchant-1',
                time: new Date('2024-01-15T02:00:00') // Midnight
            };
            // Mock low inventory
            mockRedis.get.mockImplementation((key) => {
                if (key.includes('inventory')) {
                    return Promise.resolve(JSON.stringify({
                        productId: 'prod-1',
                        quantity: 5,
                        maxQuantity: 100,
                        category: 'food'
                    }));
                }
                if (key.includes('location'))
                    return null;
                if (key.includes('demand'))
                    return Promise.resolve(JSON.stringify({
                        total: '10',
                        last5min: '5',
                        last15min: '8'
                    }));
                return null;
            });
            const price = await engine.calculatePrice(midnightWithLowInventory, 100);
            // Should be boosted due to midnight (1.75) and low inventory (1.5)
            (0, vitest_1.expect)(price.multipliers.time).toBe(1.75);
            (0, vitest_1.expect)(price.multipliers.inventory).toBe(1.5);
            (0, vitest_1.expect)(price.finalCoins).toBeGreaterThan(100);
        });
    });
});
(0, vitest_1.describe)('Convenience functions', () => {
    (0, vitest_1.it)('calculateDynamicPrice should work as standalone function', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.hgetall.mockResolvedValue({
            total: '10',
            last5min: '5',
            last15min: '8'
        });
        const context = {
            merchantId: 'test-merchant',
            time: new Date()
        };
        const price = await (0, dynamicPricing_1.calculateDynamicPrice)(context);
        (0, vitest_1.expect)(price).toHaveProperty('baseCoins');
        (0, vitest_1.expect)(price).toHaveProperty('finalCoins');
        (0, vitest_1.expect)(price).toHaveProperty('multipliers');
        (0, vitest_1.expect)(price).toHaveProperty('surgeLabel');
    });
    (0, vitest_1.it)('getCurrentSurgeLevel should return surge info', async () => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.hgetall.mockResolvedValue({
            total: '10',
            last5min: '5',
            last15min: '8'
        });
        const surge = await (0, dynamicPricing_1.getCurrentSurgeLevel)('test-merchant');
        (0, vitest_1.expect)(surge).toHaveProperty('level');
        (0, vitest_1.expect)(surge).toHaveProperty('activeMultiplier');
        (0, vitest_1.expect)(['normal', 'boosted', 'surge']).toContain(surge.level);
    });
});
(0, vitest_1.describe)('Integration scenarios', () => {
    (0, vitest_1.beforeEach)(() => {
        mockRedis.get.mockResolvedValue(null);
        mockRedis.hgetall.mockResolvedValue({
            total: '10',
            last5min: '5',
            last15min: '8'
        });
    });
    (0, vitest_1.it)('should model Uber surge pricing behavior', async () => {
        // Peak lunch + mall location + high demand = normal pricing
        const peakMall = {
            merchantId: 'mall-store-1',
            location: { lat: 40.7580, lng: -73.9855 }, // Times Square area
            time: new Date('2024-01-15T12:30:00')
        };
        const price = await (0, dynamicPricing_1.calculateDynamicPrice)(peakMall, 50);
        // During peak hours at premium location with normal demand
        (0, vitest_1.expect)(price.multipliers.time).toBe(1.0); // Peak lunch
        (0, vitest_1.expect)(price.surgeLabel).toBe('normal');
        (0, vitest_1.expect)(price.finalCoins).toBeLessThanOrEqual(price.baseCoins * 1.5);
    });
    (0, vitest_1.it)('should model boosting for off-peak with low inventory', async () => {
        // Midnight + low stock = surge pricing
        mockRedis.get.mockImplementation((key) => {
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
        const midnightBoost = {
            merchantId: 'late-night-merchant',
            time: new Date('2024-01-15T03:00:00')
        };
        const price = await (0, dynamicPricing_1.calculateDynamicPrice)(midnightBoost, 50);
        // Should be surge due to near-expiry inventory override
        (0, vitest_1.expect)(price.surgeLabel).toBe('surge');
        (0, vitest_1.expect)(price.finalCoins).toBeGreaterThan(50);
    });
});
//# sourceMappingURL=dynamicPricing.test.js.map