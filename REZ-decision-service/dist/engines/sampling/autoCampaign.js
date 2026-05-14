"use strict";
/**
 * AUTO-CAMPAIGN ENGINE
 * Phase 3 - AI Campaign Manager
 *
 * Automatically suggests and creates campaigns based on signals:
 * - High inventory signals from merchants
 * - Low conversion signals
 * - Dormant user signals
 * - Location-based signals
 * - Time-based signals (lunch/dinner)
 * - Event signals (festivals/seasonal)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignPerformanceTracker = exports.autoLaunchEngine = exports.campaignSuggestionEngine = exports.signalDetectionEngine = exports.autoCampaignEngine = exports.AutoCampaignEngine = exports.CampaignPerformanceTracker = exports.AutoLaunchEngine = exports.CampaignSuggestionEngine = exports.SignalDetectionEngine = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const uuid_1 = require("uuid");
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
const REDIS_PREFIX = 'autocampaign:';
const SIGNAL_PREFIX = 'signal:';
const CAMPAIGN_PREFIX = 'campaign:';
// ============================================
// SIGNAL WEIGHTS & THRESHOLDS
// ============================================
const DEFAULT_CONFIG = {
    inventoryThreshold: 0.8,
    dormancyDays: 30,
    locationRadiusMeters: 500,
    minSignalStrength: 40,
    autoLaunchThreshold: 75
};
const SIGNAL_WEIGHTS = {
    inventory_excess: 0.25,
    dormant_users: 0.20,
    nearby_location: 0.25,
    time_based: 0.15,
    event: 0.15
};
const COIN_RECOMMENDATIONS = {
    inventory_excess: { min: 15, max: 50, base: 25 },
    dormant_users: { min: 20, max: 75, base: 40 },
    nearby_location: { min: 10, max: 30, base: 15 },
    time_based: { min: 15, max: 40, base: 20 },
    event: { min: 25, max: 100, base: 50 }
};
const BUDGET_RECOMMENDATIONS = {
    inventory_excess: { min: 500, max: 5000, base: 1500 },
    dormant_users: { min: 1000, max: 8000, base: 3000 },
    nearby_location: { min: 200, max: 2000, base: 500 },
    time_based: { min: 300, max: 3000, base: 800 },
    event: { min: 2000, max: 20000, base: 8000 }
};
// ============================================
// SIGNAL DETECTION ENGINE
// ============================================
class SignalDetectionEngine {
    /**
     * Detect all signal types and return active signals
     */
    async detectSignals(context) {
        const signals = [];
        const time = context.time || new Date();
        // 1. Check inventory excess signal
        if (context.merchantId) {
            const inventorySignal = await this.detectInventoryExcess(context.merchantId);
            if (inventorySignal)
                signals.push(inventorySignal);
        }
        // 2. Check dormant users signal
        if (context.merchantId) {
            const dormantSignal = await this.detectDormantUsers(context.merchantId);
            if (dormantSignal)
                signals.push(dormantSignal);
        }
        // 3. Check nearby location signal
        if (context.userId && context.location) {
            const locationSignal = await this.detectNearbyLocation(context.userId, context.location);
            if (locationSignal)
                signals.push(locationSignal);
        }
        // 4. Check time-based signal
        const timeSignal = this.detectTimeBased(time);
        if (timeSignal)
            signals.push(timeSignal);
        // 5. Check event signal
        const eventSignal = this.detectEventSignal(time);
        if (eventSignal)
            signals.push(eventSignal);
        return signals;
    }
    /**
     * Detect high inventory signal
     */
    async detectInventoryExcess(merchantId) {
        const inventoryKey = `${REDIS_PREFIX}merchant:${merchantId}:inventory`;
        const stockLevel = parseFloat(await redis.get(inventoryKey) || '0.5');
        // Check if inventory exceeds threshold
        if (stockLevel < DEFAULT_CONFIG.inventoryThreshold) {
            return null;
        }
        const strength = Math.round((stockLevel - DEFAULT_CONFIG.inventoryThreshold) * 100 / (1 - DEFAULT_CONFIG.inventoryThreshold));
        const clampedStrength = Math.min(100, Math.max(0, strength));
        // Get days in inventory
        const daysInInventory = parseInt(await redis.get(`${REDIS_PREFIX}merchant:${merchantId}:daysInStock`) || '0');
        return {
            type: 'inventory_excess',
            merchantId,
            strength: clampedStrength,
            recommendation: `Merchant ${merchantId} has excess inventory (${(stockLevel * 100).toFixed(0)}% capacity). ${daysInInventory > 7 ? 'Stock has been slow for ' + daysInInventory + ' days.' : 'Consider sampling campaign to move stock.'}`,
            metadata: {
                stockLevel,
                daysInInventory,
                category: await redis.get(`${REDIS_PREFIX}merchant:${merchantId}:category`)
            },
            timestamp: new Date()
        };
    }
    /**
     * Detect dormant users signal (users not active recently)
     */
    async detectDormantUsers(merchantId) {
        // Get dormant user count from Redis
        const dormantKey = `${REDIS_PREFIX}merchant:${merchantId}:dormantUsers`;
        const dormantCount = parseInt(await redis.get(dormantKey) || '0');
        if (dormantCount === 0) {
            // Calculate dormant users based on last activity
            const lastActivityKey = `${REDIS_PREFIX}merchant:${merchantId}:userActivities`;
            const activities = await redis.zrangebyscore(lastActivityKey, 0, Date.now() - (DEFAULT_CONFIG.dormancyDays * 24 * 60 * 60 * 1000));
            if (activities.length < 10)
                return null;
            const dormantUserIds = activities.slice(0, Math.min(activities.length, 100));
            await redis.set(dormantKey, dormantUserIds.length.toString());
            await redis.expire(dormantKey, 3600); // 1 hour cache
            return {
                type: 'dormant_users',
                merchantId,
                strength: Math.min(100, dormantUserIds.length * 2),
                recommendation: `${dormantUserIds.length} dormant users identified for merchant ${merchantId}. Re-engagement campaign recommended.`,
                metadata: {
                    dormantUserIds,
                    dormancyDays: DEFAULT_CONFIG.dormancyDays,
                    totalUsers: await redis.zcard(lastActivityKey)
                },
                timestamp: new Date()
            };
        }
        if (dormantCount < 10)
            return null;
        return {
            type: 'dormant_users',
            merchantId,
            strength: Math.min(100, dormantCount * 2),
            recommendation: `${dormantCount} dormant users need re-activation for merchant ${merchantId}.`,
            metadata: { dormantCount },
            timestamp: new Date()
        };
    }
    /**
     * Detect nearby location signal (user near merchant)
     */
    async detectNearbyLocation(userId, location) {
        // Check if user is near any merchant
        const nearbyMerchants = await this.findNearbyMerchants(location, DEFAULT_CONFIG.locationRadiusMeters);
        if (nearbyMerchants.length === 0)
            return null;
        // Score based on distance (closer = higher strength)
        const nearestMerchant = nearbyMerchants[0];
        const distanceScore = Math.max(0, 100 - (nearestMerchant.distance / DEFAULT_CONFIG.locationRadiusMeters * 100));
        // Check user preferences for this category
        const userPrefScore = await this.getUserPreferenceScore(userId, nearestMerchant.merchantId);
        const combinedStrength = Math.round(distanceScore * 0.6 + userPrefScore * 0.4);
        return {
            type: 'nearby_location',
            userId,
            merchantId: nearestMerchant.merchantId,
            location,
            strength: combinedStrength,
            recommendation: `User ${userId} is near merchant ${nearestMerchant.merchantId} (${nearestMerchant.distance.toFixed(0)}m away). Location-triggered sampling opportunity.`,
            metadata: {
                distance: nearestMerchant.distance,
                category: nearestMerchant.category,
                userPreferenceMatch: userPrefScore > 50
            },
            timestamp: new Date()
        };
    }
    /**
     * Detect time-based signal (meal times, weekends)
     */
    detectTimeBased(time) {
        const hour = time.getHours();
        const day = time.getDay();
        let signalType = null;
        let strength = 0;
        // Lunch time: 11:30 AM - 1:30 PM
        if (hour >= 11 && hour <= 13) {
            signalType = 'lunch';
            strength = hour >= 12 && hour <= 13 ? 90 : 70;
        }
        // Dinner time: 6:30 PM - 9:30 PM
        if (hour >= 18 && hour <= 21) {
            signalType = 'dinner';
            strength = hour >= 19 && hour <= 20 ? 95 : 75;
        }
        // Weekend boost
        if (day === 0 || day === 6) {
            strength = Math.min(100, strength + 15);
        }
        if (!signalType)
            return null;
        return {
            type: 'time_based',
            strength,
            recommendation: `Optimal ${signalType} time detected (${time.toLocaleTimeString()}). ${day === 0 || day === 6 ? 'Weekend boost active.' : ''} Users more receptive to sampling offers.`,
            metadata: {
                mealTime: signalType,
                hour,
                day,
                isWeekend: day === 0 || day === 6
            },
            timestamp: time
        };
    }
    /**
     * Detect event/festival signal
     */
    detectEventSignal(time) {
        const month = time.getMonth();
        const day = time.getDate();
        // Known events and festivals
        const events = {
            'new_year': { month: 0, day: 1, name: 'New Year', boost: 50 },
            'valentines': { month: 1, day: 14, name: "Valentine's Day", boost: 40 },
            'easter': { month: 2, day: -1, name: 'Easter', boost: 35 },
            'ramadan_start': { month: 2, name: 'Ramadan Start', boost: 60 },
            'eid_fitr': { month: 4, name: 'Eid al-Fitr', boost: 70 },
            'eid_adha': { month: 6, name: 'Eid al-Adha', boost: 70 },
            'summer_solstice': { month: 5, day: 21, name: 'Summer Solstice', boost: 30 },
            'national_day': { month: 11, day: 16, name: 'National Day', boost: 65 },
            'christmas': { month: 11, day: 25, name: 'Christmas', boost: 45 },
            'black_friday': { month: 10, day: -1, name: 'Black Friday', boost: 80 }
        };
        for (const event of Object.values(events)) {
            if (month === event.month) {
                // Exact day match
                if (event.day && event.day === day) {
                    return {
                        type: 'event',
                        strength: 100,
                        recommendation: `${event.name} detected! Maximum event boost active. Launch premium sampling campaigns.`,
                        metadata: {
                            eventName: event.name,
                            boostPercentage: event.boost
                        },
                        timestamp: time
                    };
                }
                // Month-based event (e.g., Ramadan month)
                if (!event.day) {
                    return {
                        type: 'event',
                        strength: 60 + event.boost / 2,
                        recommendation: `${event.name} period active. Consider themed sampling campaigns.`,
                        metadata: {
                            eventName: event.name,
                            boostPercentage: event.boost
                        },
                        timestamp: time
                    };
                }
            }
        }
        return null;
    }
    /**
     * Find merchants near a location
     */
    async findNearbyMerchants(location, radiusMeters) {
        // Get all merchant locations from Redis
        const merchantLocations = await redis.smembers(`${REDIS_PREFIX}merchant:locations`);
        const nearby = [];
        for (const merchantId of merchantLocations) {
            const locKey = `${REDIS_PREFIX}merchant:${merchantId}:location`;
            const locData = await redis.get(locKey);
            if (locData) {
                const merchantLoc = JSON.parse(locData);
                const distance = this.calculateDistance(location.lat, location.lng, merchantLoc.lat, merchantLoc.lng);
                if (distance <= radiusMeters) {
                    nearby.push({
                        merchantId,
                        distance,
                        category: await redis.get(`${REDIS_PREFIX}merchant:${merchantId}:category`) || 'general'
                    });
                }
            }
        }
        // Sort by distance
        return nearby.sort((a, b) => a.distance - b.distance);
    }
    /**
     * Calculate distance between two points (Haversine formula)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRad(deg) {
        return deg * (Math.PI / 180);
    }
    /**
     * Get user's preference score for a merchant's category
     */
    async getUserPreferenceScore(userId, merchantId) {
        const category = await redis.get(`${REDIS_PREFIX}merchant:${merchantId}:category`);
        if (!category)
            return 50; // Neutral
        const prefKey = `${REDIS_PREFIX}user:${userId}:preferences`;
        const categoryPref = await redis.hget(prefKey, category);
        if (!categoryPref)
            return 50; // Neutral
        return Math.min(100, parseFloat(categoryPref) * 100);
    }
}
exports.SignalDetectionEngine = SignalDetectionEngine;
// ============================================
// CAMPAIGN SUGGESTION ENGINE
// ============================================
class CampaignSuggestionEngine {
    /**
     * Generate campaign suggestions based on signals
     */
    async suggestCampaigns(signals, config = DEFAULT_CONFIG) {
        const campaigns = [];
        // Group signals by merchant for efficient processing
        const signalsByMerchant = this.groupSignalsByMerchant(signals);
        for (const [merchantId, merchantSignals] of Object.entries(signalsByMerchant)) {
            // Calculate combined signal strength
            const combinedStrength = this.calculateCombinedStrength(merchantSignals);
            // Skip if below minimum threshold
            if (combinedStrength < (config.minSignalStrength || 40)) {
                continue;
            }
            // Determine if auto-launch is appropriate
            const shouldAutoLaunch = combinedStrength >= (config.autoLaunchThreshold || 75);
            // Generate targeting criteria
            const targeting = this.generateTargetingCriteria(merchantSignals);
            // Calculate optimal coins and budget
            const { coins, budget } = this.calculateOptimalSpend(merchantSignals, combinedStrength);
            // Create campaign suggestion
            const campaign = {
                id: (0, uuid_1.v4)(),
                merchantId,
                type: this.determinePrimarySignalType(merchantSignals),
                status: shouldAutoLaunch ? 'approved' : 'suggested',
                suggestedCoins: coins,
                suggestedBudget: budget,
                suggestedTargeting: targeting,
                reason: this.generateCampaignReason(merchantSignals),
                autoLaunch: shouldAutoLaunch,
                targetUserIds: this.extractTargetUserIds(merchantSignals),
                locationRadius: this.determineLocationRadius(merchantSignals),
                startDate: new Date(),
                endDate: this.calculateEndDate(merchantSignals),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            campaigns.push(campaign);
        }
        return campaigns;
    }
    /**
     * Group signals by merchant
     */
    groupSignalsByMerchant(signals) {
        const grouped = {};
        for (const signal of signals) {
            if (signal.merchantId) {
                if (!grouped[signal.merchantId]) {
                    grouped[signal.merchantId] = [];
                }
                grouped[signal.merchantId].push(signal);
            }
        }
        return grouped;
    }
    /**
     * Calculate combined signal strength
     */
    calculateCombinedStrength(signals) {
        if (signals.length === 0)
            return 0;
        let totalWeight = 0;
        let weightedSum = 0;
        for (const signal of signals) {
            const weight = SIGNAL_WEIGHTS[signal.type] || 0.2;
            totalWeight += weight;
            weightedSum += signal.strength * weight;
        }
        return Math.round(weightedSum / totalWeight);
    }
    /**
     * Generate targeting criteria based on signals
     */
    generateTargetingCriteria(signals) {
        const criteria = new Set();
        for (const signal of signals) {
            switch (signal.type) {
                case 'inventory_excess':
                    criteria.add('category_boost');
                    criteria.add('high_spenders');
                    break;
                case 'dormant_users':
                    criteria.add('churned_users');
                    criteria.add('last_order_30_days');
                    criteria.add('reactivation_target');
                    break;
                case 'nearby_location':
                    criteria.add('geo_fence');
                    criteria.add('frequent_visitor');
                    break;
                case 'time_based':
                    criteria.add('meal_time_active');
                    criteria.add('weekend_preference');
                    break;
                case 'event':
                    criteria.add('event_interested');
                    criteria.add('gift_givers');
                    break;
            }
        }
        return Array.from(criteria);
    }
    /**
     * Calculate optimal coin amount and budget
     */
    calculateOptimalSpend(signals, combinedStrength) {
        // Determine primary signal type
        const primarySignal = this.getStrongestSignal(signals);
        if (!primarySignal) {
            return { coins: 20, budget: 1000 };
        }
        const coinConfig = COIN_RECOMMENDATIONS[primarySignal.type];
        const budgetConfig = BUDGET_RECOMMENDATIONS[primarySignal.type];
        // Scale based on signal strength
        const strengthFactor = combinedStrength / 100;
        // Calculate coins
        const coinRange = coinConfig.max - coinConfig.min;
        const coins = Math.round(coinConfig.min + (coinRange * strengthFactor));
        // Calculate budget (more complex - depends on multiple factors)
        const budgetRange = budgetConfig.max - budgetConfig.min;
        const baseBudget = budgetConfig.min + (budgetRange * strengthFactor);
        // Adjust for dormant users (they need more incentive)
        const dormantAdjustment = signals.some(s => s.type === 'dormant_users') ? 1.3 : 1;
        const budget = Math.round(baseBudget * dormantAdjustment);
        return { coins, budget };
    }
    /**
     * Get the strongest signal from a list
     */
    getStrongestSignal(signals) {
        if (signals.length === 0)
            return null;
        return signals.reduce((strongest, current) => current.strength > strongest.strength ? current : strongest);
    }
    /**
     * Determine primary signal type
     */
    determinePrimarySignalType(signals) {
        const strongest = this.getStrongestSignal(signals);
        return strongest?.type || 'time_based';
    }
    /**
     * Generate campaign reason
     */
    generateCampaignReason(signals) {
        const reasons = [];
        for (const signal of signals) {
            if (signal.strength > 50) {
                reasons.push(signal.recommendation.split('.')[0]);
            }
        }
        if (reasons.length === 0) {
            return 'Automated campaign based on system signals';
        }
        return reasons.slice(0, 3).join('. ') + '.';
    }
    /**
     * Extract target user IDs from signals
     */
    extractTargetUserIds(signals) {
        const userIds = new Set();
        for (const signal of signals) {
            if (signal.type === 'dormant_users' && signal.metadata?.dormantUserIds) {
                const dormantUsers = signal.metadata.dormantUserIds;
                dormantUsers.forEach(id => userIds.add(id));
            }
            if (signal.userId) {
                userIds.add(signal.userId);
            }
        }
        return Array.from(userIds);
    }
    /**
     * Determine location radius for targeting
     */
    determineLocationRadius(signals) {
        const locationSignal = signals.find(s => s.type === 'nearby_location');
        if (locationSignal) {
            return DEFAULT_CONFIG.locationRadiusMeters;
        }
        return 5000; // Default 5km for general campaigns
    }
    /**
     * Calculate campaign end date
     */
    calculateEndDate(signals) {
        const endDate = new Date();
        // Check for event signal
        const eventSignal = signals.find(s => s.type === 'event');
        if (eventSignal) {
            // Event campaigns: 7-14 days
            endDate.setDate(endDate.getDate() + 14);
            return endDate;
        }
        // Default: 3-7 days
        endDate.setDate(endDate.getDate() + 5);
        return endDate;
    }
}
exports.CampaignSuggestionEngine = CampaignSuggestionEngine;
// ============================================
// AUTO-LAUNCH ENGINE
// ============================================
class AutoLaunchEngine {
    /**
     * Determine if campaign should auto-launch
     */
    shouldAutoLaunch(campaign, signals) {
        // Check if campaign already marked for auto-launch
        if (campaign.autoLaunch)
            return true;
        // Check signal strength threshold
        const avgStrength = signals.reduce((sum, s) => sum + s.strength, 0) / signals.length;
        if (avgStrength >= DEFAULT_CONFIG.autoLaunchThreshold) {
            return true;
        }
        // Check for trusted patterns
        if (this.isTrustedPattern(signals)) {
            return true;
        }
        return false;
    }
    /**
     * Check if signals represent a trusted pattern
     */
    isTrustedPattern(signals) {
        const signalTypes = signals.map(s => s.type);
        // Trusted pattern: time_based + nearby_location (meal time near restaurant)
        if (signalTypes.includes('time_based') && signalTypes.includes('nearby_location')) {
            const timeSignal = signals.find(s => s.type === 'time_based');
            if (timeSignal && timeSignal.strength >= 70) {
                return true;
            }
        }
        // Trusted pattern: event signal with high strength
        const eventSignal = signals.find(s => s.type === 'event');
        if (eventSignal && eventSignal.strength >= 80) {
            return true;
        }
        // Trusted pattern: inventory excess with high strength
        const inventorySignal = signals.find(s => s.type === 'inventory_excess');
        if (inventorySignal && inventorySignal.strength >= 85) {
            return true;
        }
        return false;
    }
    /**
     * Execute auto-launch
     */
    async launchCampaign(campaign) {
        try {
            // Store campaign in Redis
            const campaignKey = `${CAMPAIGN_PREFIX}${campaign.id}`;
            await redis.set(campaignKey, JSON.stringify({
                ...campaign,
                status: 'active',
                updatedAt: new Date()
            }));
            // Track active campaigns
            await redis.zadd(`${REDIS_PREFIX}active_campaigns`, Date.now(), campaign.id);
            // Queue campaign for distribution
            await this.queueCampaignDistribution(campaign);
            return { success: true, campaignId: campaign.id };
        }
        catch (error) {
            return {
                success: false,
                campaignId: campaign.id,
                error: error instanceof Error ? error.message : 'Launch failed'
            };
        }
    }
    /**
     * Queue campaign for user distribution
     */
    async queueCampaignDistribution(campaign) {
        const queueKey = `${REDIS_PREFIX}distribution:queue`;
        // Add to distribution queue
        await redis.lpush(queueKey, JSON.stringify({
            campaignId: campaign.id,
            merchantId: campaign.merchantId,
            targetUserIds: campaign.targetUserIds,
            coins: campaign.suggestedCoins,
            priority: campaign.autoLaunch ? 'high' : 'normal',
            queuedAt: Date.now()
        }));
    }
}
exports.AutoLaunchEngine = AutoLaunchEngine;
// ============================================
// CAMPAIGN PERFORMANCE TRACKER
// ============================================
class CampaignPerformanceTracker {
    /**
     * Record campaign impression
     */
    async recordImpression(campaignId, userId) {
        const key = `${CAMPAIGN_PREFIX}${campaignId}:impressions`;
        await redis.hincrby(key, userId, 1);
        await redis.expire(key, 86400 * 30); // 30 days retention
        // Update total count
        await redis.zincrby(`${REDIS_PREFIX}campaign:${campaignId}:stats`, 1, 'impressions');
    }
    /**
     * Record campaign conversion
     */
    async recordConversion(campaignId, userId, coinsUsed, revenue) {
        const conversionKey = `${CAMPAIGN_PREFIX}${campaignId}:conversions`;
        await redis.hset(conversionKey, userId, JSON.stringify({
            coinsUsed,
            revenue,
            convertedAt: Date.now()
        }));
        // Update stats
        await redis.zincrby(`${REDIS_PREFIX}campaign:${campaignId}:stats`, 1, 'conversions');
        await redis.zincrby(`${REDIS_PREFIX}campaign:${campaignId}:stats`, coinsUsed, 'coinsSpent');
        await redis.zincrby(`${REDIS_PREFIX}campaign:${campaignId}:stats`, revenue, 'revenue');
    }
    /**
     * Get campaign performance metrics
     */
    async getPerformance(campaignId) {
        const stats = await redis.zscore(`${REDIS_PREFIX}campaign:${campaignId}:stats`, 'impressions');
        if (!stats)
            return null;
        const impressions = await redis.zscore(`${REDIS_PREFIX}campaign:${campaignId}:stats`, 'impressions') || '0';
        const conversions = await redis.zscore(`${REDIS_PREFIX}campaign:${campaignId}:stats`, 'conversions') || '0';
        const coinsSpent = parseFloat(await redis.zscore(`${REDIS_PREFIX}campaign:${campaignId}:stats`, 'coinsSpent') || '0');
        const revenue = parseFloat(await redis.zscore(`${REDIS_PREFIX}campaign:${campaignId}:stats`, 'revenue') || '0');
        const imp = parseInt(impressions);
        const conv = parseInt(conversions);
        const conversionRate = imp > 0 ? (conv / imp) * 100 : 0;
        const roi = coinsSpent > 0 ? ((revenue - coinsSpent) / coinsSpent) * 100 : 0;
        return {
            campaignId,
            impressions: imp,
            conversions: conv,
            conversionRate,
            coinsSpent,
            revenue,
            roi
        };
    }
    /**
     * Get top performing campaigns
     */
    async getTopPerformingCampaigns(limit = 10) {
        const activeCampaigns = await redis.zrange(`${REDIS_PREFIX}active_campaigns`, 0, -1);
        const performances = [];
        for (const campaignId of activeCampaigns) {
            const perf = await this.getPerformance(campaignId);
            if (perf) {
                performances.push(perf);
            }
        }
        // Sort by ROI descending
        return performances
            .sort((a, b) => b.roi - a.roi)
            .slice(0, limit);
    }
}
exports.CampaignPerformanceTracker = CampaignPerformanceTracker;
// ============================================
// MAIN AUTO-CAMPAIGN ENGINE
// ============================================
class AutoCampaignEngine {
    signalDetection;
    suggestion;
    autoLaunch;
    performance;
    constructor() {
        this.signalDetection = new SignalDetectionEngine();
        this.suggestion = new CampaignSuggestionEngine();
        this.autoLaunch = new AutoLaunchEngine();
        this.performance = new CampaignPerformanceTracker();
    }
    /**
     * Main entry point: process signals and create campaigns
     */
    async processSignals(context) {
        const errors = [];
        const launched = [];
        // 1. Detect all signals
        const signals = await this.signalDetection.detectSignals(context);
        if (signals.length === 0) {
            return { signals: [], campaigns: [], launched: [], errors: [] };
        }
        // Store signals for analytics
        await this.storeSignals(signals);
        // 2. Generate campaign suggestions
        const config = context.config || DEFAULT_CONFIG;
        let campaigns = await this.suggestion.suggestCampaigns(signals, config);
        // 3. Handle auto-launch for trusted campaigns
        for (const campaign of campaigns) {
            if (this.autoLaunch.shouldAutoLaunch(campaign, signals)) {
                campaign.status = 'active';
                campaign.autoLaunch = true;
                const launchResult = await this.autoLaunch.launchCampaign(campaign);
                if (launchResult.success) {
                    launched.push(campaign);
                }
                else {
                    errors.push(`Failed to launch campaign ${campaign.id}: ${launchResult.error}`);
                }
            }
        }
        // 4. Return results
        return {
            signals,
            campaigns,
            launched,
            errors
        };
    }
    /**
     * Store signals for historical analysis
     */
    async storeSignals(signals) {
        for (const signal of signals) {
            const signalKey = `${SIGNAL_PREFIX}${signal.type}:${Date.now()}`;
            await redis.set(signalKey, JSON.stringify(signal));
            await redis.expire(signalKey, 86400 * 7); // 7 days retention
            // Add to sorted set for time-based queries
            await redis.zadd(`${SIGNAL_PREFIX}history:${signal.type}`, signal.timestamp.getTime(), signalKey);
        }
    }
    /**
     * Get active campaigns for a merchant
     */
    async getMerchantCampaigns(merchantId) {
        const campaignIds = await redis.smembers(`${REDIS_PREFIX}merchant:${merchantId}:campaigns`);
        const campaigns = [];
        for (const id of campaignIds) {
            const data = await redis.get(`${CAMPAIGN_PREFIX}${id}`);
            if (data) {
                campaigns.push(JSON.parse(data));
            }
        }
        return campaigns;
    }
    /**
     * Get signal history
     */
    async getSignalHistory(signalType, startTime, endTime) {
        const signalKeys = await redis.zrangebyscore(`${SIGNAL_PREFIX}history:${signalType}`, startTime.getTime(), endTime.getTime());
        const signals = [];
        for (const key of signalKeys) {
            const data = await redis.get(key);
            if (data) {
                signals.push(JSON.parse(data));
            }
        }
        return signals;
    }
    /**
     * Update campaign status
     */
    async updateCampaignStatus(campaignId, status) {
        const campaignKey = `${CAMPAIGN_PREFIX}${campaignId}`;
        const data = await redis.get(campaignKey);
        if (!data)
            return false;
        const campaign = JSON.parse(data);
        campaign.status = status;
        campaign.updatedAt = new Date();
        await redis.set(campaignKey, JSON.stringify(campaign));
        // Remove from active if completed or paused
        if (status === 'completed' || status === 'paused') {
            await redis.zrem(`${REDIS_PREFIX}active_campaigns`, campaignId);
        }
        return true;
    }
}
exports.AutoCampaignEngine = AutoCampaignEngine;
// ============================================
// FACTORY INSTANCE
// ============================================
exports.autoCampaignEngine = new AutoCampaignEngine();
exports.signalDetectionEngine = new SignalDetectionEngine();
exports.campaignSuggestionEngine = new CampaignSuggestionEngine();
exports.autoLaunchEngine = new AutoLaunchEngine();
exports.campaignPerformanceTracker = new CampaignPerformanceTracker();
//# sourceMappingURL=autoCampaign.js.map