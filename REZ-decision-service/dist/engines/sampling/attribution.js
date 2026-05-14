"use strict";
/**
 * ATTRIBUTION TRACKER
 * Phase 3: Full funnel tracking - Scan → Visit → Redeem → Purchase → Repeat
 * Credits campaigns accurately across multi-touch user journeys
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attributionTracker = exports.AttributionTracker = exports.ATTRIBUTION_WEIGHTS = void 0;
exports.trackScan = trackScan;
exports.trackVisit = trackVisit;
exports.trackRedeem = trackRedeem;
exports.trackPurchase = trackPurchase;
exports.trackRepeat = trackRepeat;
exports.getUserAttributionSummary = getUserAttributionSummary;
exports.attributeConversion = attributeConversion;
const ioredis_1 = __importDefault(require("ioredis"));
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
// ============================================
// CONSTANTS
// ============================================
const REDIS_PREFIX = 'attribution:';
const DEFAULT_WINDOW_DAYS = 7;
const TTL_SECONDS = DEFAULT_WINDOW_DAYS * 24 * 60 * 60; // 7 days in seconds
// Attribution event weights for credit calculation
exports.ATTRIBUTION_WEIGHTS = {
    scan: 0.30,
    visit: 0.25,
    redeem: 0.45,
    purchase: 0.85,
    repeat: 1.00
};
// ============================================
// UTILITY FUNCTIONS
// ============================================
/**
 * Generate Redis key for event storage
 */
function eventKey(userId, campaignId, eventId) {
    return `${REDIS_PREFIX}events:${userId}:${campaignId}:${eventId}`;
}
/**
 * Generate Redis key for user campaign events list
 */
function userCampaignKey(userId, campaignId) {
    return `${REDIS_PREFIX}user:${userId}:campaign:${campaignId}:events`;
}
/**
 * Generate Redis key for campaign attribution tracking
 */
function campaignKey(campaignId) {
    return `${REDIS_PREFIX}campaign:${campaignId}`;
}
/**
 * Generate Redis key for user attribution window tracking
 */
function userWindowKey(userId) {
    return `${REDIS_PREFIX}user:${userId}:window`;
}
/**
 * Get effective weights (custom + defaults)
 */
function getEffectiveWeights(customWeights) {
    return {
        ...exports.ATTRIBUTION_WEIGHTS,
        ...customWeights
    };
}
/**
 * Calculate time decay factor (exponential decay)
 * More recent events get higher weight
 */
function calculateTimeDecayFactor(eventTimestamp, conversionTimestamp, windowDays) {
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const timeDiff = conversionTimestamp.getTime() - eventTimestamp.getTime();
    const decayRate = Math.log(2) / windowMs; // Half-life decay
    return Math.exp(-decayRate * timeDiff);
}
// ============================================
// ATTRIBUTION TRACKER CLASS
// ============================================
class AttributionTracker {
    /**
     * Track an attribution event
     * Stores in Redis with TTL for window management
     */
    async trackEvent(event) {
        try {
            const eventId = `${event.userId}:${event.campaignId}:${Date.now()}:${event.event}`;
            const key = eventKey(event.userId, event.campaignId, eventId);
            const userCampaignListKey = userCampaignKey(event.userId, event.campaignId);
            // Prepare event data for storage
            const eventData = {
                id: eventId,
                ...event,
                timestamp: event.timestamp.toISOString()
            };
            // Store event with TTL
            const ttl = this.calculateTTL();
            await redis.setex(key, ttl, JSON.stringify(eventData));
            // Add to user's campaign event list (sorted by timestamp)
            await redis.zadd(userCampaignListKey, event.timestamp.getTime(), eventId);
            await redis.expire(userCampaignListKey, ttl);
            // Update campaign stats
            await this.updateCampaignStats(event.campaignId, event);
            // Update funnel tracking
            await this.updateFunnelStats(event.userId, event);
            // Track window for conversion tracking
            await this.trackAttributionWindow(event.userId, event.campaignId);
            return {
                success: true,
                eventId
            };
        }
        catch (error) {
            return {
                success: false,
                eventId: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Calculate attribution for a conversion event
     */
    async calculateAttribution(userId, conversionCampaignId, conversionValue, conversionEvent, model = 'last-touch') {
        const events = await this.getUserEventsInWindow(userId, conversionCampaignId);
        if (events.length === 0) {
            return [{
                    campaignId: conversionCampaignId,
                    userId,
                    creditedCampaign: conversionCampaignId,
                    creditedAmount: conversionValue,
                    weight: exports.ATTRIBUTION_WEIGHTS[conversionEvent],
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
    calculateFirstTouchAttribution(events, conversionValue, userId) {
        // Sort by timestamp ascending
        const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const firstEvent = sorted[0];
        const weight = exports.ATTRIBUTION_WEIGHTS[firstEvent.event];
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
    calculateLastTouchAttribution(events, conversionValue, userId) {
        // Sort by timestamp descending
        const sorted = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const lastEvent = sorted[0];
        const weight = exports.ATTRIBUTION_WEIGHTS[lastEvent.event];
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
    calculateLinearAttribution(events, conversionValue, userId) {
        const creditPerEvent = conversionValue / events.length;
        const results = [];
        // Group by campaign
        const campaignEvents = {};
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
            const avgWeight = campaignEventList.reduce((sum, e) => sum + exports.ATTRIBUTION_WEIGHTS[e.event], 0) / campaignEventList.length;
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
    calculateTimeDecayAttribution(events, conversionValue, userId) {
        const conversionTime = new Date();
        const totalWeight = events.reduce((sum, event) => {
            const decayFactor = calculateTimeDecayFactor(event.timestamp, conversionTime, DEFAULT_WINDOW_DAYS);
            return sum + (exports.ATTRIBUTION_WEIGHTS[event.event] * decayFactor);
        }, 0);
        // Group by campaign
        const campaignWeights = {};
        for (const event of events) {
            const decayFactor = calculateTimeDecayFactor(event.timestamp, conversionTime, DEFAULT_WINDOW_DAYS);
            const eventWeight = exports.ATTRIBUTION_WEIGHTS[event.event] * decayFactor;
            const current = campaignWeights[event.campaignId] || 0;
            campaignWeights[event.campaignId] = current + eventWeight;
        }
        const results = [];
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
     */
    async getUserEventsInWindow(userId, campaignId, windowDays) {
        const window = windowDays || DEFAULT_WINDOW_DAYS;
        const cutoffTime = Date.now() - (window * 24 * 60 * 60 * 1000);
        let keys;
        if (campaignId) {
            // Get events for specific campaign
            keys = [`${REDIS_PREFIX}user:${userId}:campaign:${campaignId}:events`];
        }
        else {
            // Get all campaigns for user (scan for pattern)
            keys = await this.getUserCampaignKeys(userId);
        }
        const events = [];
        for (const key of keys) {
            const eventIds = await redis.zrangebyscore(key, cutoffTime, '+inf');
            for (const eventId of eventIds) {
                const [uid, cid, , eventType] = eventId.split(':');
                const eventKey = `${REDIS_PREFIX}events:${uid}:${cid}:${eventId}`;
                const eventData = await redis.get(eventKey);
                if (eventData) {
                    const parsed = JSON.parse(eventData);
                    events.push({
                        ...parsed,
                        timestamp: new Date(parsed.timestamp)
                    });
                }
            }
        }
        return events;
    }
    /**
     * Get attribution summary for a user
     */
    async getAttributionSummary(userId, windowDays) {
        const events = await this.getUserEventsInWindow(userId, undefined, windowDays);
        const campaigns = {};
        const funnelStats = {
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
            if (event.event === 'scan')
                funnelStats.scans++;
            if (event.event === 'visit')
                funnelStats.visits++;
            if (event.event === 'redeem')
                funnelStats.redeems++;
            if (event.event === 'purchase')
                funnelStats.purchases++;
            if (event.event === 'repeat')
                funnelStats.repeats++;
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
            if (event.value)
                summary.totalValue += event.value;
            if (!summary.firstTouch || event.timestamp < summary.firstTouch) {
                summary.firstTouch = event.timestamp;
            }
            if (!summary.lastTouch || event.timestamp > summary.lastTouch) {
                summary.lastTouch = event.timestamp;
            }
            // Calculate attributed value
            summary.attributedValue += (event.value || 0) * exports.ATTRIBUTION_WEIGHTS[event.event];
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
    async getCampaignAttribution(campaignId) {
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
    async queryAttribution(query) {
        const summaries = [];
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
    calculateTTL(windowDays = DEFAULT_WINDOW_DAYS) {
        return windowDays * 24 * 60 * 60;
    }
    /**
     * Update campaign statistics
     */
    async updateCampaignStats(campaignId, event) {
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
    async updateFunnelStats(userId, event) {
        const key = `${REDIS_PREFIX}funnel:${userId}`;
        await redis.hincrby(key, event.event, 1);
        await redis.hset(key, 'lastEvent', event.event);
        await redis.hset(key, 'lastEventTime', event.timestamp.toISOString());
        await redis.expire(key, TTL_SECONDS);
    }
    /**
     * Track attribution window for a user-campaign pair
     */
    async trackAttributionWindow(userId, campaignId) {
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
    async getUserCampaignKeys(userId) {
        // Scan for user campaign event lists
        const pattern = `${REDIS_PREFIX}user:${userId}:campaign:*:events`;
        const keys = [];
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
    async clearExpiredData() {
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
    async recordConversion(userId, campaignId, merchantId, conversionType, value, model = 'last-touch') {
        // Create conversion event
        const conversionEvent = {
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
        return this.calculateAttribution(userId, campaignId, value, conversionType, model);
    }
}
exports.AttributionTracker = AttributionTracker;
// ============================================
// SINGLETON EXPORT
// ============================================
exports.attributionTracker = new AttributionTracker();
// ============================================
// CONVENIENCE FUNCTIONS
// ============================================
/**
 * Quick track scan event
 */
async function trackScan(userId, campaignId, merchantId, metadata) {
    return exports.attributionTracker.trackEvent({
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
async function trackVisit(userId, campaignId, merchantId, metadata) {
    return exports.attributionTracker.trackEvent({
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
async function trackRedeem(userId, campaignId, merchantId, value, metadata) {
    return exports.attributionTracker.trackEvent({
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
async function trackPurchase(userId, campaignId, merchantId, amount, metadata) {
    return exports.attributionTracker.trackEvent({
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
async function trackRepeat(userId, campaignId, merchantId, metadata) {
    return exports.attributionTracker.trackEvent({
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
async function getUserAttributionSummary(userId, windowDays = DEFAULT_WINDOW_DAYS) {
    return exports.attributionTracker.getAttributionSummary(userId, windowDays);
}
/**
 * Calculate attribution for a conversion
 */
async function attributeConversion(userId, campaignId, conversionValue, model = 'last-touch') {
    return exports.attributionTracker.calculateAttribution(userId, campaignId, conversionValue, 'purchase', model);
}
//# sourceMappingURL=attribution.js.map