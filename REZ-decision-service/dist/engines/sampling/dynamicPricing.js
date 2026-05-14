"use strict";
/**
 * DYNAMIC QR PRICING ENGINE
 * "Uber Surge Pricing" for coins - adjusts rewards based on context
 *
 * Pricing factors:
 * - Time: Peak hours (lunch/dinner) = standard, Off-peak = boosted
 * - Inventory: High stock = standard, Low stock = boosted, Near expiry = maximum boost
 * - Demand: High nearby users = standard, Low demand = boosted
 * - Location: Premium = standard, Emerging/hard-to-reach = boosted
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicPricingEngine = void 0;
exports.calculateDynamicPrice = calculateDynamicPrice;
exports.getCurrentSurgeLevel = getCurrentSurgeLevel;
const ioredis_1 = __importDefault(require("ioredis"));
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
const REDIS_PREFIX = 'pricing:';
const COIN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
// ============================================
// PRICING CONSTANTS
// ============================================
const TIME_MULTIPLIERS = {
    // Peak hours - standard (1.0x)
    peakLunch: { start: 12, end: 14, multiplier: 1.0 },
    peakDinner: { start: 19, end: 22, multiplier: 1.0 },
    // Normal hours (1.0x)
    normal: { multiplier: 1.0 },
    // Off-peak hours - boosted (1.25x)
    offPeak: { start: 10, end: 12, multiplier: 1.25 },
    lateAfternoon: { start: 15, end: 19, multiplier: 1.25 },
    // Very off-peak - higher boost (1.5x)
    veryOffPeak: { start: 6, end: 10, multiplier: 1.5 },
    // Midnight - maximum boost (1.75x)
    midnight: { start: 0, end: 6, multiplier: 1.75 },
    // Late night (1.5x)
    lateNight: { start: 22, end: 24, multiplier: 1.5 }
};
const INVENTORY_MULTIPLIERS = {
    // High stock (above 70%) - standard (1.0x)
    high: { threshold: 0.7, multiplier: 1.0 },
    // Medium stock (40-70%) - slightly boosted (1.1x)
    medium: { threshold: 0.4, multiplier: 1.1 },
    // Low stock (15-40%) - boosted (1.3x)
    low: { threshold: 0.15, multiplier: 1.3 },
    // Very low stock (5-15%) - maximum boost (1.5x)
    veryLow: { threshold: 0.05, multiplier: 1.5 },
    // Near expiry (any stock level, expiring soon) - maximum boost (1.75x)
    nearExpiry: { hoursThreshold: 24, multiplier: 1.75 }
};
const DEMAND_MULTIPLIERS = {
    // High demand (above 50 users nearby) - standard (1.0x)
    high: { threshold: 50, multiplier: 1.0 },
    // Medium demand (20-50 users) - slightly boosted (1.1x)
    medium: { threshold: 20, multiplier: 1.1 },
    // Low demand (5-20 users) - boosted (1.25x)
    low: { threshold: 5, multiplier: 1.25 },
    // Very low demand (below 5 users) - maximum boost (1.5x)
    veryLow: { threshold: 0, multiplier: 1.5 }
};
const LOCATION_MULTIPLIERS = {
    // Premium locations (malls, transit hubs) - standard (1.0x)
    premium: { multiplier: 1.0 },
    // Standard locations - standard (1.0x)
    standard: { multiplier: 1.0 },
    // Emerging areas - boosted (1.25x)
    emerging: { multiplier: 1.25 },
    // Campus/hard-to-reach - maximum boost (1.5x)
    campus: { multiplier: 1.5 }
};
const LOCATION_GEOHASH_PRECISION = 5; // ~5km precision
// ============================================
// DYNAMIC PRICING ENGINE
// ============================================
class DynamicPricingEngine {
    /**
     * Calculate dynamic price for a merchant at a given time/location
     */
    async calculatePrice(context, baseCoins = 50) {
        const [inventory, demand, locationType] = await Promise.all([
            this.fetchInventory(context.merchantId),
            this.fetchDemand(context.merchantId, context.location),
            this.determineLocationType(context.location)
        ]);
        // Calculate individual multipliers
        const timeMultiplier = this.calculateTimeMultiplier(context.time);
        const inventoryMultiplier = this.calculateInventoryMultiplier(inventory);
        const demandMultiplier = this.calculateDemandMultiplier(demand);
        const locationMultiplier = this.calculateLocationMultiplier(locationType);
        // Calculate combined multiplier (geometric mean to prevent extreme values)
        const combinedMultiplier = Math.pow(timeMultiplier * inventoryMultiplier * demandMultiplier * locationMultiplier, 0.25);
        // Calculate final coins
        const finalCoins = Math.round(baseCoins * combinedMultiplier);
        // Determine surge label based on combined multiplier
        const surgeLabel = this.determineSurgeLabel(combinedMultiplier);
        // Price expires in 5 minutes (to allow for real-time adjustments)
        const expiresAt = new Date(Date.now() + COIN_EXPIRY_BUFFER_MS);
        return {
            baseCoins,
            finalCoins,
            multipliers: {
                time: timeMultiplier,
                inventory: inventoryMultiplier,
                demand: demandMultiplier,
                location: locationMultiplier
            },
            surgeLabel,
            expiresAt
        };
    }
    /**
     * Calculate time-of-day multiplier
     * Peak hours = standard, Off-peak = boosted, Midnight = maximum boost
     */
    calculateTimeMultiplier(time) {
        const hour = time.getHours();
        // Peak lunch (12-14)
        if (hour >= TIME_MULTIPLIERS.peakLunch.start && hour < TIME_MULTIPLIERS.peakLunch.end) {
            return TIME_MULTIPLIERS.peakLunch.multiplier;
        }
        // Peak dinner (19-22)
        if (hour >= TIME_MULTIPLIERS.peakDinner.start && hour < TIME_MULTIPLIERS.peakDinner.end) {
            return TIME_MULTIPLIERS.peakDinner.multiplier;
        }
        // Off-peak morning (10-12)
        if (hour >= TIME_MULTIPLIERS.offPeak.start && hour < TIME_MULTIPLIERS.offPeak.end) {
            return TIME_MULTIPLIERS.offPeak.multiplier;
        }
        // Late afternoon (15-19)
        if (hour >= TIME_MULTIPLIERS.lateAfternoon.start && hour < TIME_MULTIPLIERS.lateAfternoon.end) {
            return TIME_MULTIPLIERS.lateAfternoon.multiplier;
        }
        // Very off-peak (6-10)
        if (hour >= TIME_MULTIPLIERS.veryOffPeak.start && hour < TIME_MULTIPLIERS.veryOffPeak.end) {
            return TIME_MULTIPLIERS.veryOffPeak.multiplier;
        }
        // Late night (22-24)
        if (hour >= TIME_MULTIPLIERS.lateNight.start && hour < TIME_MULTIPLIERS.lateNight.end) {
            return TIME_MULTIPLIERS.lateNight.multiplier;
        }
        // Midnight (0-6) - maximum boost
        if (hour >= TIME_MULTIPLIERS.midnight.start && hour < TIME_MULTIPLIERS.midnight.end) {
            return TIME_MULTIPLIERS.midnight.multiplier;
        }
        return TIME_MULTIPLIERS.normal.multiplier;
    }
    /**
     * Calculate inventory-based multiplier
     * High stock = standard, Low stock = boosted, Near expiry = maximum boost
     */
    calculateInventoryMultiplier(inventory) {
        if (!inventory) {
            return INVENTORY_MULTIPLIERS.medium.multiplier; // Neutral if unknown
        }
        // Check near expiry first (takes precedence)
        if (inventory.expiresAt) {
            const hoursUntilExpiry = (inventory.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
            if (hoursUntilExpiry <= INVENTORY_MULTIPLIERS.nearExpiry.hoursThreshold && hoursUntilExpiry > 0) {
                return INVENTORY_MULTIPLIERS.nearExpiry.multiplier;
            }
        }
        // Calculate stock level
        const stockLevel = inventory.quantity / inventory.maxQuantity;
        if (stockLevel >= INVENTORY_MULTIPLIERS.high.threshold) {
            return INVENTORY_MULTIPLIERS.high.multiplier;
        }
        if (stockLevel >= INVENTORY_MULTIPLIERS.medium.threshold) {
            return INVENTORY_MULTIPLIERS.medium.multiplier;
        }
        if (stockLevel >= INVENTORY_MULTIPLIERS.low.threshold) {
            return INVENTORY_MULTIPLIERS.low.multiplier;
        }
        // Very low stock
        return INVENTORY_MULTIPLIERS.veryLow.multiplier;
    }
    /**
     * Calculate demand-based multiplier
     * High demand (many nearby users) = standard, Low demand = boosted
     */
    calculateDemandMultiplier(demand) {
        const activeUsers = demand.activeLast15min;
        if (activeUsers >= DEMAND_MULTIPLIERS.high.threshold) {
            return DEMAND_MULTIPLIERS.high.multiplier;
        }
        if (activeUsers >= DEMAND_MULTIPLIERS.medium.threshold) {
            return DEMAND_MULTIPLIERS.medium.multiplier;
        }
        if (activeUsers >= DEMAND_MULTIPLIERS.low.threshold) {
            return DEMAND_MULTIPLIERS.low.multiplier;
        }
        // Very low demand
        return DEMAND_MULTIPLIERS.veryLow.multiplier;
    }
    /**
     * Calculate location-based multiplier
     * Premium = standard, Emerging = boosted, Campus/hard-to-reach = maximum boost
     */
    calculateLocationMultiplier(locationType) {
        return LOCATION_MULTIPLIERS[locationType.type].multiplier;
    }
    /**
     * Determine surge label based on combined multiplier
     */
    determineSurgeLabel(combinedMultiplier) {
        if (combinedMultiplier >= 1.3) {
            return 'surge';
        }
        if (combinedMultiplier >= 1.15) {
            return 'boosted';
        }
        return 'normal';
    }
    /**
     * Fetch merchant inventory from Redis
     */
    async fetchInventory(merchantId) {
        const key = `${REDIS_PREFIX}inventory:${merchantId}`;
        const data = await redis.get(key);
        if (!data) {
            return null;
        }
        try {
            const parsed = JSON.parse(data);
            return {
                ...parsed,
                expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Fetch demand (nearby users) from Redis
     */
    async fetchDemand(merchantId, location) {
        const now = Date.now();
        const fiveMinAgo = now - 5 * 60 * 1000;
        const fifteenMinAgo = now - 15 * 60 * 1000;
        if (location) {
            // Count users by geohash proximity
            const geohash = this.encodeGeohash(location.lat, location.lng, LOCATION_GEOHASH_PRECISION);
            // Get users in this and surrounding areas
            const keys = [
                `${REDIS_PREFIX}users:${geohash}`,
                ...this.getSurroundingGeohashes(geohash)
            ];
            let total = 0;
            let activeLast5min = 0;
            let activeLast15min = 0;
            for (const k of keys) {
                const users = await redis.smembers(k);
                for (const userId of users) {
                    total++;
                    const lastActive = await redis.get(`${REDIS_PREFIX}user:${userId}:lastActive`);
                    if (lastActive) {
                        const ts = parseInt(lastActive);
                        if (ts >= fifteenMinAgo)
                            activeLast15min++;
                        if (ts >= fiveMinAgo)
                            activeLast5min++;
                    }
                }
            }
            return { total, activeLast5min, activeLast15min };
        }
        // Fallback: Get merchant's general demand from Redis
        const merchantDemand = await redis.hgetall(`${REDIS_PREFIX}demand:${merchantId}`);
        return {
            total: parseInt(merchantDemand.total || '0'),
            activeLast5min: parseInt(merchantDemand.last5min || '0'),
            activeLast15min: parseInt(merchantDemand.last15min || '0')
        };
    }
    /**
     * Determine location type from coordinates or geohash
     */
    async determineLocationType(location) {
        if (!location) {
            return { type: 'standard', geohash: 'unknown' };
        }
        const geohash = this.encodeGeohash(location.lat, location.lng, LOCATION_GEOHASH_PRECISION);
        // Check Redis for cached location type
        const cachedType = await redis.get(`${REDIS_PREFIX}location:${geohash}:type`);
        if (cachedType) {
            return {
                type: cachedType,
                geohash
            };
        }
        // Classify based on geohash patterns (simplified)
        // In production, this would use a POI database or ML model
        const type = this.inferLocationType(geohash);
        // Cache for 24 hours
        await redis.setex(`${REDIS_PREFIX}location:${geohash}:type`, 86400, type);
        return { type, geohash };
    }
    /**
     * Simple geohash encoding (base32)
     */
    encodeGeohash(lat, lng, precision) {
        const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
        let minLat = -90, maxLat = 90;
        let minLng = -180, maxLng = 180;
        let hash = '';
        let isLng = true;
        let bit = 0;
        let ch = 0;
        while (hash.length < precision) {
            const val = isLng
                ? (lng - minLng) / (maxLng - minLng)
                : (lat - minLat) / (maxLat - minLat);
            ch = (ch << 1) | (val > 0.5 ? 1 : 0);
            if (isLng) {
                if (val > 0.5) {
                    minLng = (minLng + maxLng) / 2;
                }
                else {
                    maxLng = (minLng + maxLng) / 2;
                }
            }
            else {
                if (val > 0.5) {
                    minLat = (minLat + maxLat) / 2;
                }
                else {
                    maxLat = (minLat + maxLat) / 2;
                }
            }
            isLng = !isLng;
            if (++bit === 5) {
                hash += BASE32[ch];
                bit = 0;
                ch = 0;
            }
        }
        return hash;
    }
    /**
     * Get surrounding geohash cells (8 neighbors + self)
     */
    getSurroundingGeohashes(center) {
        const neighbors = [
            `${center}u`, `${center}d`, `${center}l`, `${center}r`,
            `${center}ul`, `${center}ur`, `${center}dl`, `${center}dr`
        ];
        return neighbors.slice(0, 8); // Max 8 neighbors
    }
    /**
     * Infer location type from geohash pattern
     * This is a simplified heuristic - production would use POI/MLS data
     */
    inferLocationType(geohash) {
        // Check for known location patterns in Redis
        // This would normally integrate with a POI database
        // Campus detection (simplified - check for university POIs nearby)
        const isCampus = false; // Would check POI database
        if (isCampus) {
            return 'campus';
        }
        // Emerging area detection
        // Would check for areas with growing user base but lower foot traffic
        const emergingPatterns = ['demo', 'test', 'new'];
        if (emergingPatterns.some(p => geohash.startsWith(p))) {
            return 'emerging';
        }
        // Premium location detection (malls, transit hubs)
        const premiumPatterns = ['mall', 'station', 'plaza'];
        if (premiumPatterns.some(p => geohash.startsWith(p))) {
            return 'premium';
        }
        return 'standard';
    }
    /**
     * Record a user presence at a location (for demand tracking)
     */
    async recordUserPresence(userId, location) {
        const geohash = this.encodeGeohash(location.lat, location.lng, LOCATION_GEOHASH_PRECISION);
        const now = Date.now().toString();
        // Add user to geohash set
        await redis.sadd(`${REDIS_PREFIX}users:${geohash}`, userId);
        await redis.expire(`${REDIS_PREFIX}users:${geohash}`, 3600); // 1 hour TTL
        // Update last active time
        await redis.set(`${REDIS_PREFIX}user:${userId}:lastActive`, now);
        await redis.expire(`${REDIS_PREFIX}user:${userId}:lastActive`, 900); // 15 min TTL
        // Increment demand counters
        await redis.hincrby(`${REDIS_PREFIX}demand:global`, 'total', 1);
        await redis.hincrby(`${REDIS_PREFIX}demand:global`, 'last15min', 1);
        await redis.hincrby(`${REDIS_PREFIX}demand:global`, 'last5min', 1);
        // Schedule counter resets
        await redis.setex(`${REDIS_PREFIX}demand:global:last15min:reset`, 900, '1');
        await redis.setex(`${REDIS_PREFIX}demand:global:last5min:reset`, 300, '1');
    }
    /**
     * Update merchant inventory in Redis
     */
    async updateInventory(merchantId, inventory) {
        const key = `${REDIS_PREFIX}inventory:${merchantId}`;
        const data = {
            productId: inventory.productId,
            quantity: inventory.quantity,
            maxQuantity: inventory.maxQuantity,
            expiresAt: inventory.expiresAt?.toISOString(),
            category: inventory.category
        };
        // Set with TTL based on expiry (or default 24 hours)
        const ttl = inventory.expiresAt
            ? Math.max(3600, (inventory.expiresAt.getTime() - Date.now()) / 1000)
            : 86400;
        await redis.setex(key, ttl, JSON.stringify(data));
    }
    /**
     * Set location type explicitly (admin function)
     */
    async setLocationType(geohash, type) {
        await redis.setex(`${REDIS_PREFIX}location:${geohash}:type`, 86400 * 30, type); // 30 days
    }
    /**
     * Get pricing history for analytics
     */
    async getPricingHistory(merchantId, hours = 24) {
        const key = `${REDIS_PREFIX}history:${merchantId}`;
        const entries = await redis.lrange(key, 0, hours * 12 - 1); // ~12 entries per hour
        return entries.map(e => {
            const parsed = JSON.parse(e);
            return {
                ...parsed,
                timestamp: new Date(parsed.timestamp)
            };
        });
    }
    /**
     * Record pricing event for analytics
     */
    async recordPricingEvent(merchantId, price) {
        const key = `${REDIS_PREFIX}history:${merchantId}`;
        await redis.lpush(key, JSON.stringify({
            timestamp: new Date().toISOString(),
            baseCoins: price.baseCoins,
            finalCoins: price.finalCoins,
            multipliers: price.multipliers
        }));
        // Keep last 1000 entries (roughly 3 days at 12/hour)
        await redis.ltrim(key, 0, 999);
    }
}
exports.DynamicPricingEngine = DynamicPricingEngine;
// ============================================
// CONVENIENCE FUNCTIONS
// ============================================
async function calculateDynamicPrice(context, baseCoins) {
    const engine = new DynamicPricingEngine();
    return engine.calculatePrice(context, baseCoins);
}
async function getCurrentSurgeLevel(merchantId) {
    const engine = new DynamicPricingEngine();
    const price = await engine.calculatePrice({
        merchantId,
        time: new Date()
    });
    const combinedMultiplier = Math.pow(price.multipliers.time *
        price.multipliers.inventory *
        price.multipliers.demand *
        price.multipliers.location, 0.25);
    return {
        level: price.surgeLabel,
        activeMultiplier: combinedMultiplier
    };
}
// Default export
exports.default = DynamicPricingEngine;
//# sourceMappingURL=dynamicPricing.js.map