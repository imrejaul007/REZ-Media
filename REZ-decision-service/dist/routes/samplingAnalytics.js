"use strict";
/**
 * SAMPLING ANALYTICS DASHBOARD API
 * Phase 3: Real-time analytics for campaigns
 *
 * Endpoints:
 * - GET /api/sampling/analytics/campaign/:id     - Campaign performance metrics
 * - GET /api/sampling/analytics/user/:id       - User activity & engagement
 * - GET /api/sampling/analytics/merchant/:id    - Merchant redemption analytics
 * - GET /api/sampling/analytics/system           - System-wide metrics & alerts
 * - GET /api/sampling/analytics/funnel/:id      - Conversion funnel analysis
 * - GET /api/sampling/analytics/leaderboard     - Top users ranking
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ioredis_1 = __importDefault(require("ioredis"));
const router = (0, express_1.Router)();
// ============================================
// HELPERS
// ============================================
/**
 * Parse date range from query params or return defaults
 */
function parseDateRange(req) {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const start = req.query.start
        ? new Date(req.query.start)
        : defaultStart;
    const end = req.query.end
        ? new Date(req.query.end)
        : now;
    return { start, end };
}
/**
 * Generate date array between two dates
 */
function getDateArray(start, end) {
    const dates = [];
    const current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}
/**
 * Create Redis client with error handling
 */
async function getRedisClient() {
    const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
    return redis;
}
/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toLocaleString('en-US');
}
/**
 * Calculate percentage with safe division
 */
function safePercentage(numerator, denominator) {
    if (denominator === 0)
        return 0;
    return Math.round((numerator / denominator) * 100 * 100) / 100;
}
// ============================================
// 1. CAMPAIGN ANALYTICS
// GET /api/sampling/analytics/campaign/:id
// ============================================
router.get('/campaign/:id', async (req, res) => {
    try {
        const redis = await getRedisClient();
        const { id: campaignId } = req.params;
        const { start, end } = parseDateRange(req);
        const dates = getDateArray(start, end);
        // Aggregate key patterns for campaign data
        const REDIS_KEYS = {
            scans: (date) => `sampling:campaign:${campaignId}:scans:${date}`,
            redemptions: (date) => `sampling:campaign:${campaignId}:redemptions:${date}`,
            purchases: (date) => `sampling:campaign:${campaignId}:purchases:${date}`,
            coinsAwarded: (date) => `sampling:campaign:${campaignId}:coins:${date}`,
            budgetTotal: `sampling:campaign:${campaignId}:budget`,
            budgetSpent: `sampling:campaign:${campaignId}:budget_spent`,
            impressions: (date) => `sampling:campaign:${campaignId}:impressions:${date}`,
        };
        // Aggregate totals
        let totalScans = 0;
        let totalRedemptions = 0;
        let totalPurchases = 0;
        let totalCoinsAwarded = 0;
        let totalImpressions = 0;
        const timeSeries = {
            scans: [],
            redemptions: [],
            purchases: []
        };
        // Batch fetch all daily data
        const pipeline = redis.pipeline();
        for (const date of dates) {
            pipeline.get(REDIS_KEYS.scans(date));
            pipeline.get(REDIS_KEYS.redemptions(date));
            pipeline.get(REDIS_KEYS.purchases(date));
            pipeline.get(REDIS_KEYS.coinsAwarded(date));
            pipeline.get(REDIS_KEYS.impressions(date));
        }
        pipeline.get(REDIS_KEYS.budgetTotal);
        pipeline.get(REDIS_KEYS.budgetSpent);
        const results = await pipeline.exec();
        // Parse time series data
        for (let i = 0; i < dates.length; i++) {
            const baseIndex = i * 5;
            const scans = parseInt(results?.[baseIndex]?.[1] || '0');
            const redemptions = parseInt(results?.[baseIndex + 1]?.[1] || '0');
            const purchases = parseInt(results?.[baseIndex + 2]?.[1] || '0');
            const coins = parseInt(results?.[baseIndex + 3]?.[1] || '0');
            const impressions = parseInt(results?.[baseIndex + 4]?.[1] || '0');
            totalScans += scans;
            totalRedemptions += redemptions;
            totalPurchases += purchases;
            totalCoinsAwarded += coins;
            totalImpressions += impressions;
            timeSeries.scans.push({ date: dates[i], value: scans });
            timeSeries.redemptions.push({ date: dates[i], value: redemptions });
            timeSeries.purchases.push({ date: dates[i], value: purchases });
        }
        const budgetTotal = parseInt(results?.[results.length - 2]?.[1] || '0');
        const budgetSpent = parseInt(results?.[results.length - 1]?.[1] || '0');
        // Calculate conversion rates
        const scanToRedemptionRate = safePercentage(totalRedemptions, totalScans);
        const redemptionToPurchaseRate = safePercentage(totalPurchases, totalRedemptions);
        const impressionToScanRate = safePercentage(totalScans, totalImpressions);
        // ROI calculation (assuming average order value of $25)
        const avgOrderValue = 25;
        const totalRevenue = totalPurchases * avgOrderValue;
        const estimatedCoinCost = totalCoinsAwarded * 0.05; // $0.05 per coin
        const roi = budgetTotal > 0 ? safePercentage(totalRevenue - estimatedCoinCost, estimatedCoinCost) : 0;
        // Funnel stages
        const funnel = [
            { step: 'Impressions', count: totalImpressions, dropoffRate: 0 },
            { step: 'Scans', count: totalScans, dropoffRate: safePercentage(totalImpressions - totalScans, totalImpressions) },
            { step: 'Redemptions', count: totalRedemptions, dropoffRate: safePercentage(totalScans - totalRedemptions, totalScans) },
            { step: 'Purchases', count: totalPurchases, dropoffRate: safePercentage(totalRedemptions - totalPurchases, totalRedemptions) }
        ];
        // Budget utilization
        const budgetUtilization = safePercentage(budgetSpent, budgetTotal);
        const budgetRemaining = budgetTotal - budgetSpent;
        const analytics = {
            campaignId,
            period: { start: start.toISOString(), end: end.toISOString() },
            summary: {
                totalScans,
                totalRedemptions,
                totalPurchases,
                totalCoinsAwarded,
                totalImpressions,
                scanToRedemptionRate: `${scanToRedemptionRate}%`,
                redemptionToPurchaseRate: `${redemptionToPurchaseRate}%`,
                impressionToScanRate: `${impressionToScanRate}%`
            },
            roi: {
                estimatedRevenue: totalRevenue,
                coinCost: estimatedCoinCost,
                roiPercentage: `${roi}%`,
                profitMargin: `${safePercentage(totalRevenue - estimatedCoinCost, totalRevenue)}%`
            },
            funnel,
            budget: {
                total: budgetTotal,
                spent: budgetSpent,
                remaining: budgetRemaining,
                utilization: `${budgetUtilization}%`
            },
            timeSeries,
            meta: {
                daysAnalyzed: dates.length,
                avgDailyScans: Math.round(totalScans / dates.length),
                avgDailyRedemptions: Math.round(totalRedemptions / dates.length)
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] Campaign analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch campaign analytics'
        });
    }
});
// ============================================
// 2. USER ANALYTICS
// GET /api/sampling/analytics/user/:id
// ============================================
router.get('/user/:id', async (req, res) => {
    try {
        const redis = await getRedisClient();
        const { id: userId } = req.params;
        const { start, end } = parseDateRange(req);
        const dates = getDateArray(start, end);
        const REDIS_KEYS = {
            userScans: (date) => `sampling:fatigue:${userId}:scans:${date}`,
            userCoins: `sampling:fatigue:${userId}:totalCoins`,
            userRedemptions: `sampling:user:${userId}:redemptions`,
            userPurchases: `sampling:user:${userId}:purchases`,
            lastScan: `sampling:fatigue:${userId}:lastScan`,
            lastRedeem: `sampling:fatigue:${userId}:lastRedeem`,
            fatigueLevel: `sampling:fatigue:${userId}:level`,
            userCampaigns: `sampling:fatigue:${userId}:campaigns`,
            userPreferences: `sampling:user:${userId}:preferences`
        };
        // Fetch user metrics
        const [totalCoins, lastScan, lastRedeem, fatigueLevel, campaigns, preferences, userRedemptions, userPurchases] = await Promise.all([
            redis.get(REDIS_KEYS.userCoins),
            redis.get(REDIS_KEYS.lastScan),
            redis.get(REDIS_KEYS.lastRedeem),
            redis.get(REDIS_KEYS.fatigueLevel),
            redis.lrange(REDIS_KEYS.userCampaigns, 0, -1),
            redis.hgetall(REDIS_KEYS.userPreferences),
            redis.get(REDIS_KEYS.userRedemptions),
            redis.get(REDIS_KEYS.userPurchases)
        ]);
        // Count scans in date range
        let totalScansInRange = 0;
        const dailyScans = [];
        for (const date of dates) {
            const scans = parseInt(await redis.get(REDIS_KEYS.userScans(date)) || '0');
            totalScansInRange += scans;
            dailyScans.push({ date, value: scans });
        }
        // Calculate engagement metrics
        const totalScans = totalScansInRange;
        const totalRedemptions = parseInt(userRedemptions || '0');
        const totalPurchases = parseInt(userPurchases || '0');
        // User cohort classification
        const userStage = (() => {
            if (!lastScan)
                return 'NEW';
            const daysSinceLastScan = (Date.now() - parseInt(lastScan)) / (1000 * 60 * 60 * 24);
            if (daysSinceLastScan > 30)
                return 'CHURNED';
            if (daysSinceLastScan > 7)
                return 'WARM';
            return 'ACTIVE';
        })();
        // Fatigue analysis
        const maxScansPerDay = 3;
        const scansToday = parseInt(await redis.get(REDIS_KEYS.userScans(new Date().toISOString().split('T')[0])) || '0');
        const fatigueDistribution = {
            low: scansToday < 1 ? 100 : Math.round(((maxScansPerDay - scansToday) / maxScansPerDay) * 100),
            medium: scansToday >= 1 && scansToday < 2 ? 50 : 0,
            high: scansToday >= 2 ? scansToday >= maxScansPerDay ? 100 : 75 : 0,
            maxed: scansToday >= maxScansPerDay
        };
        // Category preferences
        const categoryPreferences = Object.entries(preferences || {}).map(([category, affinity]) => ({
            category,
            affinity: parseFloat(affinity || '0'),
            tier: parseFloat(affinity || '0') >= 0.7 ? 'HIGH' :
                parseFloat(affinity || '0') >= 0.4 ? 'MEDIUM' : 'LOW'
        })).sort((a, b) => b.affinity - a.affinity);
        // Engagement score (0-100)
        const engagementScore = Math.min(100, Math.round((totalScans * 5) +
            (totalRedemptions * 15) +
            (totalPurchases * 20) -
            (scansToday >= maxScansPerDay ? 30 : 0)));
        // Recommended action
        const recommendedAction = (() => {
            if (scansToday >= maxScansPerDay)
                return 'REST';
            if (userStage === 'CHURNED')
                return 'RE_ENGAGE';
            if (categoryPreferences.length > 0)
                return 'RECOMMEND';
            return 'SURVEY';
        })();
        const analytics = {
            userId,
            period: { start: start.toISOString(), end: end.toISOString() },
            summary: {
                totalScans,
                totalRedemptions,
                totalPurchases,
                totalCoinsEarned: parseInt(totalCoins || '0'),
                engagementScore
            },
            profile: {
                stage: userStage,
                daysSinceLastScan: lastScan ? Math.round((Date.now() - parseInt(lastScan)) / (1000 * 60 * 60 * 24)) : null,
                daysSinceLastRedeem: lastRedeem ? Math.round((Date.now() - parseInt(lastRedeem)) / (1000 * 60 * 60 * 24)) : null,
                campaignsParticipated: campaigns.length,
                recommendedAction
            },
            fatigue: {
                currentLevel: parseInt(fatigueLevel || '0'),
                scansToday,
                maxScansPerDay,
                distribution: fatigueDistribution,
                canScan: scansToday < maxScansPerDay,
                nextScanPossible: scansToday >= maxScansPerDay ? 'Tomorrow' :
                    lastScan ? `${Math.max(0, 240 - Math.round((Date.now() - parseInt(lastScan)) / 60000))} minutes` : 'Now'
            },
            preferences: {
                categories: categoryPreferences.slice(0, 10),
                topCategory: categoryPreferences[0]?.category || 'none'
            },
            timeSeries: {
                dailyScans
            },
            meta: {
                daysAnalyzed: dates.length,
                avgDailyScans: Math.round(totalScans / dates.length) || 0,
                redemptionRate: `${safePercentage(totalRedemptions, totalScans)}%`,
                purchaseRate: `${safePercentage(totalPurchases, totalRedemptions)}%`
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] User analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user analytics'
        });
    }
});
// ============================================
// 3. MERCHANT ANALYTICS
// GET /api/sampling/analytics/merchant/:id
// ============================================
router.get('/merchant/:id', async (req, res) => {
    try {
        const redis = await getRedisClient();
        const { id: merchantId } = req.params;
        const { start, end } = parseDateRange(req);
        const dates = getDateArray(start, end);
        const REDIS_KEYS = {
            merchantRedemptions: (date) => `sampling:merchant:${merchantId}:redemptions:${date}`,
            merchantCoins: (date) => `sampling:merchant:${merchantId}:coins:${date}`,
            merchantPurchases: (date) => `sampling:merchant:${merchantId}:purchases:${date}`,
            merchantScans: (date) => `sampling:merchant:${merchantId}:scans:${date}`,
            merchantCustomers: `sampling:merchant:${merchantId}:unique_customers`,
            merchantCategory: `sampling:merchant:${merchantId}:category`,
            merchantInventory: `sampling:merchant:${merchantId}:inventory`,
            merchantLTV: (userId) => `sampling:merchant:${merchantId}:ltv:${userId}`
        };
        // Fetch static data
        const [category, inventory] = await Promise.all([
            redis.get(REDIS_KEYS.merchantCategory),
            redis.get(REDIS_KEYS.merchantInventory)
        ]);
        // Aggregate daily metrics
        let totalRedemptions = 0;
        let totalCoins = 0;
        let totalPurchases = 0;
        let totalScans = 0;
        const dailyMetrics = [];
        for (const date of dates) {
            const [redemptions, coins, purchases, scans] = await Promise.all([
                redis.get(REDIS_KEYS.merchantRedemptions(date)),
                redis.get(REDIS_KEYS.merchantCoins(date)),
                redis.get(REDIS_KEYS.merchantPurchases(date)),
                redis.get(REDIS_KEYS.merchantScans(date))
            ]);
            const r = parseInt(redemptions || '0');
            const c = parseInt(coins || '0');
            const p = parseInt(purchases || '0');
            const s = parseInt(scans || '0');
            totalRedemptions += r;
            totalCoins += c;
            totalPurchases += p;
            totalScans += s;
            dailyMetrics.push({ date, redemptions: r, coins: c, purchases: p, scans: s });
        }
        // Get unique customer count
        const uniqueCustomers = parseInt(await redis.get(REDIS_KEYS.merchantCustomers) || '0');
        // Calculate customer LTV metrics
        const customerIds = await redis.smembers(`sampling:merchant:${merchantId}:customer_set`);
        let totalCustomerLTV = 0;
        let ltvValues = [];
        for (const customerId of customerIds.slice(0, 100)) { // Sample first 100
            const ltv = parseFloat(await redis.get(REDIS_KEYS.merchantLTV(customerId)) || '0');
            totalCustomerLTV += ltv;
            ltvValues.push(ltv);
        }
        const avgCustomerLTV = customerIds.length > 0 ? totalCustomerLTV / customerIds.length : 0;
        const medianLTV = ltvValues.sort((a, b) => a - b)[Math.floor(ltvValues.length / 2)] || 0;
        const maxLTV = Math.max(...ltvValues, 0);
        // Calculate key metrics
        const redemptionRate = safePercentage(totalRedemptions, totalScans);
        const avgCoinsPerRedemption = safePercentage(totalCoins, totalRedemptions);
        const postRedemptionPurchaseRate = safePercentage(totalPurchases, totalRedemptions);
        // Time series for key metrics
        const redemptionRateSeries = dailyMetrics.map(d => ({
            date: d.date,
            value: safePercentage(d.redemptions, d.scans)
        }));
        const coinsPerRedemptionSeries = dailyMetrics.map(d => ({
            date: d.date,
            value: safePercentage(d.coins, d.redemptions)
        }));
        // Performance benchmarks
        const avgRedemptionRateBenchmark = 35; // Industry average
        const performanceVsBenchmark = safePercentage(redemptionRate, avgRedemptionRateBenchmark);
        // Inventory health
        const inventoryLevel = parseFloat(inventory || '0.5');
        const inventoryHealth = inventoryLevel >= 0.7 ? 'HIGH' :
            inventoryLevel >= 0.4 ? 'OPTIMAL' :
                inventoryLevel >= 0.2 ? 'LOW' : 'CRITICAL';
        const analytics = {
            merchantId,
            period: { start: start.toISOString(), end: end.toISOString() },
            summary: {
                totalRedemptions,
                totalCoinsDistributed: totalCoins,
                totalPurchases,
                uniqueCustomers,
                avgRedemptionRate: `${redemptionRate}%`,
                avgCoinsPerRedemption: avgCoinsPerRedemption.toFixed(1),
                postRedemptionPurchaseRate: `${postRedemptionPurchaseRate}%`
            },
            ltv: {
                avgCustomerLTV: Math.round(avgCustomerLTV * 100) / 100,
                medianLTV: Math.round(medianLTV * 100) / 100,
                maxLTV: Math.round(maxLTV * 100) / 100,
                totalLTV: Math.round(totalCustomerLTV * 100) / 100,
                sampleSize: customerIds.length
            },
            performance: {
                redemptionRate: `${redemptionRate}%`,
                benchmarkRate: `${avgRedemptionRateBenchmark}%`,
                vsBenchmark: `${performanceVsBenchmark > 100 ? '+' : ''}${(performanceVsBenchmark - 100).toFixed(1)}%`,
                efficiency: redemptionRate >= avgRedemptionRateBenchmark ? 'ABOVE' : 'BELOW'
            },
            inventory: {
                level: inventoryLevel,
                health: inventoryHealth,
                status: inventoryLevel >= 0.4 ? 'OK' : 'REPLENISH'
            },
            timeSeries: {
                dailyMetrics,
                redemptionRateSeries,
                coinsPerRedemptionSeries
            },
            meta: {
                daysAnalyzed: dates.length,
                avgDailyRedemptions: Math.round(totalRedemptions / dates.length),
                avgDailyPurchases: Math.round(totalPurchases / dates.length),
                category: category || 'general'
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] Merchant analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch merchant analytics'
        });
    }
});
// ============================================
// 4. SYSTEM ANALYTICS
// GET /api/sampling/analytics/system
// ============================================
router.get('/system', async (req, res) => {
    try {
        const redis = await getRedisClient();
        const { start, end } = parseDateRange(req);
        const dates = getDateArray(start, end);
        // System-wide aggregate keys
        const SYSTEM_KEYS = {
            totalCoins: (date) => `sampling:system:coins:${date}`,
            totalScans: (date) => `sampling:system:scans:${date}`,
            totalRedemptions: (date) => `sampling:system:redemptions:${date}`,
            totalPurchases: (date) => `sampling:system:purchases:${date}`,
            activeUsers: (date) => `sampling:system:active_users:${date}`,
            budgetPool: `sampling:system:budget_pool`,
            budgetSpent: `sampling:system:budget_spent`,
            channelPush: (date) => `sampling:system:channel:push:${date}`,
            channelEmail: (date) => `sampling:system:channel:email:${date}`,
            channelSMS: (date) => `sampling:system:channel:sms:${date}`,
            channelInApp: (date) => `sampling:system:channel:inapp:${date}`,
            anomaliesQueue: `sampling:system:anomalies`
        };
        // Aggregate system totals
        let totalCoinsDistributed = 0;
        let totalScans = 0;
        let totalRedemptions = 0;
        let totalPurchases = 0;
        let totalActiveUsers = 0;
        let channelPush = 0;
        let channelEmail = 0;
        let channelSMS = 0;
        let channelInApp = 0;
        const dailyTotals = [];
        for (const date of dates) {
            const [coins, scans, redemptions, purchases, active, push, email, sms, inapp] = await Promise.all([
                redis.get(SYSTEM_KEYS.totalCoins(date)),
                redis.get(SYSTEM_KEYS.totalScans(date)),
                redis.get(SYSTEM_KEYS.totalRedemptions(date)),
                redis.get(SYSTEM_KEYS.totalPurchases(date)),
                redis.get(SYSTEM_KEYS.activeUsers(date)),
                redis.get(SYSTEM_KEYS.channelPush(date)),
                redis.get(SYSTEM_KEYS.channelEmail(date)),
                redis.get(SYSTEM_KEYS.channelSMS(date)),
                redis.get(SYSTEM_KEYS.channelInApp(date))
            ]);
            const c = parseInt(coins || '0');
            const s = parseInt(scans || '0');
            const r = parseInt(redemptions || '0');
            const p = parseInt(purchases || '0');
            const a = parseInt(active || '0');
            totalCoinsDistributed += c;
            totalScans += s;
            totalRedemptions += r;
            totalPurchases += p;
            totalActiveUsers += a;
            channelPush += parseInt(push || '0');
            channelEmail += parseInt(email || '0');
            channelSMS += parseInt(sms || '0');
            channelInApp += parseInt(inapp || '0');
            dailyTotals.push({ date, coins: c, scans: s, redemptions: r, purchases: p });
        }
        // Budget metrics
        const budgetPool = parseInt(await redis.get(SYSTEM_KEYS.budgetPool) || '100000');
        const budgetSpent = parseInt(await redis.get(SYSTEM_KEYS.budgetSpent) || '0');
        const budgetUtilization = safePercentage(budgetSpent, budgetPool);
        const budgetRemaining = budgetPool - budgetSpent;
        // Channel performance
        const totalChannelImpressions = channelPush + channelEmail + channelSMS + channelInApp;
        const channelPerformance = {
            push: {
                impressions: channelPush,
                percentage: `${safePercentage(channelPush, totalChannelImpressions)}%`,
                conversionRate: `${safePercentage(totalScans, channelPush)}%`
            },
            email: {
                impressions: channelEmail,
                percentage: `${safePercentage(channelEmail, totalChannelImpressions)}%`,
                conversionRate: `${safePercentage(totalScans, channelEmail)}%`
            },
            sms: {
                impressions: channelSMS,
                percentage: `${safePercentage(channelSMS, totalChannelImpressions)}%`,
                conversionRate: `${safePercentage(totalScans, channelSMS)}%`
            },
            inApp: {
                impressions: channelInApp,
                percentage: `${safePercentage(channelInApp, totalChannelImpressions)}%`,
                conversionRate: `${safePercentage(totalScans, channelInApp)}%`
            }
        };
        // Best performing channel
        const channelRankings = Object.entries(channelPerformance)
            .sort((a, b) => parseFloat(b[1].conversionRate) - parseFloat(a[1].conversionRate));
        // Calculate conversion metrics
        const overallConversionRate = safePercentage(totalRedemptions, totalScans);
        const purchaseConversionRate = safePercentage(totalPurchases, totalRedemptions);
        const avgScansPerUser = safePercentage(totalScans, totalActiveUsers);
        // Detect anomalies
        const anomalies = [];
        // Check for high dropoff
        const scanRate = safePercentage(totalScans, totalChannelImpressions);
        if (scanRate < 10) {
            anomalies.push({
                type: 'low_conversion',
                severity: 'warning',
                message: `Scan conversion rate (${scanRate}%) is below 10% threshold`,
                metric: 'scan_rate',
                value: scanRate,
                threshold: 10,
                timestamp: new Date()
            });
        }
        // Check budget utilization
        if (budgetUtilization > 90) {
            anomalies.push({
                type: 'budget_exceeded',
                severity: 'critical',
                message: `Budget utilization at ${budgetUtilization}% - approaching limit`,
                metric: 'budget_utilization',
                value: budgetUtilization,
                threshold: 90,
                timestamp: new Date()
            });
        }
        else if (budgetUtilization > 75) {
            anomalies.push({
                type: 'budget_exceeded',
                severity: 'warning',
                message: `Budget utilization at ${budgetUtilization}% - monitor closely`,
                metric: 'budget_utilization',
                value: budgetUtilization,
                threshold: 75,
                timestamp: new Date()
            });
        }
        // Check for unusual activity patterns (variance in daily scans)
        if (dailyTotals.length >= 2) {
            const avgDaily = totalScans / dailyTotals.length;
            const variance = dailyTotals.reduce((sum, d) => sum + Math.pow(d.scans - avgDaily, 2), 0) / dailyTotals.length;
            const stdDev = Math.sqrt(variance);
            const coefficientOfVariation = safePercentage(stdDev, avgDaily);
            if (coefficientOfVariation > 50) {
                anomalies.push({
                    type: 'unusual_activity',
                    severity: 'warning',
                    message: `High variance in daily activity (CV: ${coefficientOfVariation.toFixed(1)}%)`,
                    metric: 'activity_variance',
                    value: coefficientOfVariation,
                    threshold: 50,
                    timestamp: new Date()
                });
            }
        }
        // Check for funnel dropoff
        if (overallConversionRate < 20 && totalScans > 100) {
            anomalies.push({
                type: 'high_dropoff',
                severity: 'warning',
                message: `Low redemption conversion (${overallConversionRate}%) - investigate funnel`,
                metric: 'redemption_rate',
                value: overallConversionRate,
                threshold: 20,
                timestamp: new Date()
            });
        }
        // Get pending anomaly alerts from Redis queue
        const pendingAnomalies = await redis.lrange(SYSTEM_KEYS.anomaliesQueue, 0, 4);
        for (const rawAnomaly of pendingAnomalies) {
            try {
                const anomaly = JSON.parse(rawAnomaly);
                anomalies.push(anomaly);
            }
            catch {
                // Skip malformed entries
            }
        }
        const analytics = {
            period: { start: start.toISOString(), end: end.toISOString() },
            summary: {
                totalCoinsDistributed,
                totalScans,
                totalRedemptions,
                totalPurchases,
                totalActiveUsers,
                totalChannelImpressions,
                overallConversionRate: `${overallConversionRate}%`,
                purchaseConversionRate: `${purchaseConversionRate}%`,
                avgScansPerUser: avgScansPerUser.toFixed(1)
            },
            budget: {
                pool: budgetPool,
                spent: budgetSpent,
                remaining: budgetRemaining,
                utilization: `${budgetUtilization}%`,
                dailyBurnRate: Math.round(budgetSpent / dates.length),
                projectedExhaustion: budgetSpent > 0 ?
                    new Date(Date.now() + (budgetRemaining / (budgetSpent / dates.length)) * 24 * 60 * 60 * 1000).toISOString() :
                    null
            },
            channelPerformance,
            channelRankings,
            anomalies: anomalies.slice(0, 10),
            anomaliesSummary: {
                total: anomalies.length,
                critical: anomalies.filter(a => a.severity === 'critical').length,
                warning: anomalies.filter(a => a.severity === 'warning').length
            },
            timeSeries: {
                dailyTotals
            },
            meta: {
                daysAnalyzed: dates.length,
                avgDailyCoins: Math.round(totalCoinsDistributed / dates.length),
                avgDailyScans: Math.round(totalScans / dates.length),
                avgDailyRedemptions: Math.round(totalRedemptions / dates.length),
                peakDay: dailyTotals.reduce((max, d) => d.scans > (max?.scans || 0) ? d : max, dailyTotals[0])
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] System analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch system analytics'
        });
    }
});
// ============================================
// 5. FUNNEL ANALYTICS
// GET /api/sampling/analytics/funnel/:campaignId
// ============================================
router.get('/funnel/:campaignId', async (req, res) => {
    try {
        const redis = await getRedisClient();
        const { campaignId } = req.params;
        const { start, end } = parseDateRange(req);
        const dates = getDateArray(start, end);
        const FUNNEL_KEYS = {
            impressions: (date) => `sampling:campaign:${campaignId}:impressions:${date}`,
            notifications: (date) => `sampling:campaign:${campaignId}:notifications:${date}`,
            scans: (date) => `sampling:campaign:${campaignId}:scans:${date}`,
            eligibility: (date) => `sampling:campaign:${campaignId}:eligibility:${date}`,
            offers: (date) => `sampling:campaign:${campaignId}:offers:${date}`,
            redemptions: (date) => `sampling:campaign:${campaignId}:redemptions:${date}`,
            purchases: (date) => `sampling:campaign:${campaignId}:purchases:${date}`,
            reviews: (date) => `sampling:campaign:${campaignId}:reviews:${date}`,
            referrals: (date) => `sampling:campaign:${campaignId}:referrals:${date}`
        };
        // Aggregate funnel stages
        const aggregate = async (keyFn) => {
            let total = 0;
            const daily = [];
            for (const date of dates) {
                const value = parseInt(await redis.get(keyFn(date)) || '0');
                total += value;
                daily.push({ date, value });
            }
            return { total, daily };
        };
        const [impressions, notifications, scans, eligibility, offers, redemptions, purchases, reviews, referrals] = await Promise.all([
            aggregate(FUNNEL_KEYS.impressions),
            aggregate(FUNNEL_KEYS.notifications),
            aggregate(FUNNEL_KEYS.scans),
            aggregate(FUNNEL_KEYS.eligibility),
            aggregate(FUNNEL_KEYS.offers),
            aggregate(FUNNEL_KEYS.redemptions),
            aggregate(FUNNEL_KEYS.purchases),
            aggregate(FUNNEL_KEYS.reviews),
            aggregate(FUNNEL_KEYS.referrals)
        ]);
        // Build funnel with conversion rates
        const funnelStages = [
            { step: 'Impressions', count: impressions.total, dropoffRate: 0 },
            { step: 'Notifications Sent', count: notifications.total, dropoffRate: safePercentage(notifications.total, impressions.total) },
            { step: 'Users Eligible', count: eligibility.total, dropoffRate: safePercentage(eligibility.total, notifications.total) },
            { step: 'Offers Viewed', count: offers.total, dropoffRate: safePercentage(offers.total, eligibility.total) },
            { step: 'Scans', count: scans.total, dropoffRate: safePercentage(scans.total, offers.total) },
            { step: 'Redemptions', count: redemptions.total, dropoffRate: safePercentage(redemptions.total, scans.total) },
            { step: 'Purchases', count: purchases.total, dropoffRate: safePercentage(purchases.total, redemptions.total) },
            { step: 'Reviews', count: reviews.total, dropoffRate: safePercentage(reviews.total, purchases.total) },
            { step: 'Referrals', count: referrals.total, dropoffRate: safePercentage(referrals.total, reviews.total) }
        ];
        // Calculate stage-to-stage conversion rates
        const conversionRates = [];
        for (let i = 0; i < funnelStages.length - 1; i++) {
            const from = funnelStages[i];
            const to = funnelStages[i + 1];
            conversionRates.push({
                from: from.step,
                to: to.step,
                rate: safePercentage(to.count, from.count)
            });
        }
        // Calculate overall funnel efficiency
        const overallConversionRate = safePercentage(purchases.total, impressions.total);
        const scanRate = safePercentage(scans.total, impressions.total);
        const redemptionRate = safePercentage(redemptions.total, impressions.total);
        // Identify biggest drop-off points
        const bottlenecks = funnelStages
            .map((stage, i) => ({
            step: stage.step,
            dropoffRate: stage.dropoffRate,
            stage: i + 1
        }))
            .filter(s => s.dropoffRate > 0)
            .sort((a, b) => b.dropoffRate - a.dropoffRate)
            .slice(0, 3);
        // Time series for each funnel stage
        const timeSeriesByStage = {
            impressions: impressions.daily,
            scans: scans.daily,
            redemptions: redemptions.daily,
            purchases: purchases.daily
        };
        // Calculate velocity (days to convert)
        const avgVelocity = (() => {
            // Simplified: average time from scan to redemption
            if (scans.total === 0 || redemptions.total === 0)
                return null;
            const conversionDays = dates.length * (redemptions.total / scans.total);
            return Math.round(conversionDays * 10) / 10;
        })();
        const analytics = {
            campaignId,
            period: { start: start.toISOString(), end: end.toISOString() },
            funnel: funnelStages,
            conversionRates,
            summary: {
                impressions: impressions.total,
                scanRate: `${scanRate}%`,
                redemptionRate: `${redemptionRate}%`,
                overallConversion: `${overallConversionRate}%`,
                avgVelocityDays: avgVelocity,
                totalPurchases: purchases.total
            },
            bottlenecks,
            recommendations: (() => {
                const recs = [];
                if (scanRate < 15)
                    recs.push('Improve notification CTR - test different messaging');
                if (redemptionRate < 30)
                    recs.push('Review offer attractiveness - consider increasing coin value');
                if (purchases.total < redemptions.total * 0.3)
                    recs.push('Post-redemption engagement needs improvement');
                if (bottlenecks[0]?.dropoffRate > 50)
                    recs.push(`Critical drop-off at ${bottlenecks[0].step} - investigate user experience`);
                return recs;
            })(),
            timeSeries: timeSeriesByStage,
            meta: {
                daysAnalyzed: dates.length,
                avgDailyImpressions: Math.round(impressions.total / dates.length),
                avgDailyScans: Math.round(scans.total / dates.length),
                avgDailyRedemptions: Math.round(redemptions.total / dates.length),
                avgDailyPurchases: Math.round(purchases.total / dates.length)
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] Funnel analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch funnel analytics'
        });
    }
});
// ============================================
// 6. LEADERBOARD
// GET /api/sampling/analytics/leaderboard
// ============================================
router.get('/leaderboard', async (req, res) => {
    try {
        const redis = await getRedisClient();
        const period = req.query.period || 'today';
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        // Determine date range based on period
        const getLeaderboardKey = () => {
            const today = new Date().toISOString().split('T')[0];
            switch (period) {
                case 'today':
                    return `sampling:leaderboard:${today}`;
                case 'week':
                    return `sampling:leaderboard:week:${today}`;
                case 'month':
                    return `sampling:leaderboard:month:${today}`;
                case 'all':
                    return 'sampling:leaderboard:all';
                default:
                    return `sampling:leaderboard:${today}`;
            }
        };
        const leaderboardKey = getLeaderboardKey();
        // Get top users with scores
        const rawLeaderboard = await redis.zrevrange(leaderboardKey, 0, limit - 1, 'WITHSCORES');
        const entries = [];
        for (let i = 0; i < rawLeaderboard.length; i += 2) {
            const userId = rawLeaderboard[i];
            const score = parseInt(rawLeaderboard[i + 1] || '0');
            // Get additional user stats
            const [totalCoins, totalRedemptions] = await Promise.all([
                redis.get(`sampling:fatigue:${userId}:totalCoins`),
                redis.get(`sampling:user:${userId}:redemptions`)
            ]);
            entries.push({
                rank: Math.floor(i / 2) + 1,
                userId,
                score,
                scans: score,
                coinsEarned: parseInt(totalCoins || '0'),
                redemptions: parseInt(totalRedemptions || '0')
            });
        }
        // Get current user position if specified
        const userId = req.query.userId;
        let userPosition = null;
        if (userId) {
            const rank = await redis.zrevrank(leaderboardKey, userId);
            if (rank !== null) {
                const score = await redis.zscore(leaderboardKey, userId);
                userPosition = {
                    rank: rank + 1,
                    userId,
                    score: parseInt(score || '0'),
                    percentile: Math.round((1 - (rank + 1) / (entries.length + 1)) * 100)
                };
            }
        }
        // Calculate aggregate stats for top users
        const totalScansTop10 = entries.reduce((sum, e) => sum + e.scans, 0);
        const avgScansTop10 = entries.length > 0 ? Math.round(totalScansTop10 / entries.length) : 0;
        // Get trend data (last 7 days)
        const trend = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayKey = `sampling:leaderboard:${dateStr}`;
            const topScore = await redis.zrevrange(dayKey, 0, 0, 'WITHSCORES');
            trend.push({
                date: dateStr,
                topScans: topScore.length > 1 ? parseInt(topScore[1]) : 0
            });
        }
        // Category breakdown for top users
        const categoryBreakdown = {};
        for (const entry of entries) {
            const prefs = await redis.hgetall(`sampling:user:${entry.userId}:preferences`);
            for (const [category, affinity] of Object.entries(prefs)) {
                if (parseFloat(affinity) >= 0.5) {
                    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
                }
            }
        }
        const topCategories = Object.entries(categoryBreakdown)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([category, count]) => ({ category, count }));
        const analytics = {
            period,
            periodLabel: period === 'today' ? 'Today' :
                period === 'week' ? 'This Week' :
                    period === 'month' ? 'This Month' : 'All Time',
            leaderboard: entries,
            userPosition,
            summary: {
                totalParticipants: await redis.zcard(leaderboardKey),
                topUserScans: entries[0]?.scans || 0,
                topUserCoins: entries[0]?.coinsEarned || 0,
                avgScansTop10: avgScansTop10
            },
            trend,
            topCategories,
            meta: {
                limit,
                generatedAt: new Date().toISOString()
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] Leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard'
        });
    }
});
// ============================================
// ACTIVE USERS AGGREGATE
// GET /api/sampling/analytics/active-users
// (Bonus endpoint for user analytics)
// ============================================
router.get('/active-users', async (req, res) => {
    try {
        const redis = await getRedisClient();
        const { start, end } = parseDateRange(req);
        const dates = getDateArray(start, end);
        let totalActive = 0;
        const dailyActive = [];
        const allUserIds = new Set();
        for (const date of dates) {
            const key = `sampling:system:active_users:${date}`;
            const count = parseInt(await redis.get(key) || '0');
            totalActive += count;
            dailyActive.push({ date, value: count });
            // Get user IDs from leaderboard
            const users = await redis.zrange(`sampling:leaderboard:${date}`, 0, -1);
            users.forEach(id => allUserIds.add(id));
        }
        const uniqueUsers = allUserIds.size;
        const avgDailyActive = Math.round(totalActive / dates.length);
        // Calculate returning users
        let returningUsers = 0;
        for (const userId of Array.from(allUserIds).slice(0, 1000)) {
            let daysActive = 0;
            for (const date of dates.slice(-7)) {
                const isActive = await redis.zscore(`sampling:leaderboard:${date}`, userId);
                if (isActive !== null)
                    daysActive++;
            }
            if (daysActive > 1)
                returningUsers++;
        }
        const retentionRate = uniqueUsers > 0 ? safePercentage(returningUsers, uniqueUsers) : 0;
        const analytics = {
            period: { start: start.toISOString(), end: end.toISOString() },
            summary: {
                uniqueUsers,
                totalActiveSessions: totalActive,
                avgDailyActive: avgDailyActive,
                returningUsers,
                newUsers: uniqueUsers - returningUsers,
                retentionRate: `${retentionRate}%`
            },
            timeSeries: {
                dailyActive
            },
            meta: {
                daysAnalyzed: dates.length
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] Active users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active users analytics'
        });
    }
});
// ============================================
// COHORT ANALYSIS
// GET /api/sampling/analytics/cohorts
// (Bonus endpoint for user analytics)
// ============================================
router.get('/cohorts', async (req, res) => {
    try {
        const redis = await getRedisClient();
        const cohortWeeks = parseInt(req.query.weeks) || 8;
        // Generate weekly cohorts
        const cohorts = [];
        const now = new Date();
        for (let w = cohortWeeks - 1; w >= 0; w--) {
            const cohortDate = new Date(now);
            cohortDate.setDate(cohortDate.getDate() - (w * 7));
            const weekStart = cohortDate.toISOString().split('T')[0];
            // Get cohort size from new users that week
            const cohortKey = `sampling:cohort:${weekStart}:users`;
            const users = await redis.smembers(cohortKey);
            const userCount = users.size || 0;
            // Calculate retention over subsequent weeks
            const retention = [];
            for (let r = 1; r <= 4; r++) {
                let retainedCount = 0;
                const checkDate = new Date(cohortDate);
                checkDate.setDate(checkDate.getDate() + (r * 7));
                const checkKey = `sampling:leaderboard:${checkDate.toISOString().split('T')[0]}`;
                for (const userId of users) {
                    const isActive = await redis.zscore(checkKey, userId);
                    if (isActive !== null)
                        retainedCount++;
                }
                retention.push(userCount > 0 ? safePercentage(retainedCount, userCount) : 0);
            }
            // Calculate scans per week
            const scans = [];
            for (let s = 0; s < 4; s++) {
                let weekScans = 0;
                for (let d = 0; d < 7; d++) {
                    const date = new Date(cohortDate);
                    date.setDate(date.getDate() + (s * 7) + d);
                    const dateKey = `sampling:leaderboard:${date.toISOString().split('T')[0]}`;
                    for (const userId of users) {
                        const score = await redis.zscore(dateKey, userId);
                        if (score)
                            weekScans += parseInt(score);
                    }
                }
                scans.push(weekScans);
            }
            cohorts.push({
                week: weekStart,
                users: userCount,
                scansWeek1: scans[0],
                scansWeek2: scans[1],
                scansWeek3: scans[2],
                scansWeek4: scans[3],
                retentionWeek1: retention[0],
                retentionWeek2: retention[1],
                retentionWeek3: retention[2],
                retentionWeek4: retention[3]
            });
        }
        // Calculate average retention
        const avgRetention = {
            week1: cohorts.reduce((sum, c) => sum + c.retentionWeek1, 0) / cohorts.length,
            week2: cohorts.reduce((sum, c) => sum + c.retentionWeek2, 0) / cohorts.length,
            week3: cohorts.reduce((sum, c) => sum + c.retentionWeek3, 0) / cohorts.length,
            week4: cohorts.reduce((sum, c) => sum + c.retentionWeek4, 0) / cohorts.length
        };
        const analytics = {
            cohortWeeks,
            cohorts,
            summary: {
                avgRetention,
                totalUsersEnrolled: cohorts.reduce((sum, c) => sum + c.users, 0),
                avgCohortSize: Math.round(cohorts.reduce((sum, c) => sum + c.users, 0) / cohorts.length),
                bestRetentionWeek: cohorts.reduce((best, c) => c.retentionWeek1 > best.retentionWeek1 ? c : best, cohorts[0])?.week || 'N/A'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] Cohort analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch cohort analytics'
        });
    }
});
// ============================================
// FATIGUE DISTRIBUTION
// GET /api/sampling/analytics/fatigue-distribution
// (Bonus endpoint for user analytics)
// ============================================
router.get('/fatigue-distribution', async (req, res) => {
    try {
        const redis = await getRedisClient();
        // Scan for all fatigue keys and aggregate
        const fatigueLevels = {
            none: 0, // 0 scans today
            low: 0, // 1 scan
            medium: 0, // 2 scans
            high: 0, // 3+ scans
            maxed: 0 // At max (3+)
        };
        const today = new Date().toISOString().split('T')[0];
        const scanPattern = `sampling:fatigue:*:scans:${today}`;
        // Use SCAN to iterate (production-safe)
        let cursor = '0';
        const maxScansPerDay = 3;
        let processedCount = 0;
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', scanPattern, 'COUNT', 100);
            cursor = nextCursor;
            for (const key of keys) {
                const scans = parseInt(await redis.get(key) || '0');
                processedCount++;
                if (scans === 0)
                    fatigueLevels.none++;
                else if (scans === 1)
                    fatigueLevels.low++;
                else if (scans === 2)
                    fatigueLevels.medium++;
                else if (scans >= maxScansPerDay)
                    fatigueLevels.maxed++;
                else
                    fatigueLevels.high++;
            }
        } while (cursor !== '0' && processedCount < 10000);
        const totalUsers = Object.values(fatigueLevels).reduce((a, b) => a + b, 0);
        // Calculate percentiles
        const distribution = {
            none: { count: fatigueLevels.none, percentage: safePercentage(fatigueLevels.none, totalUsers) },
            low: { count: fatigueLevels.low, percentage: safePercentage(fatigueLevels.low, totalUsers) },
            medium: { count: fatigueLevels.medium, percentage: safePercentage(fatigueLevels.medium, totalUsers) },
            high: { count: fatigueLevels.high, percentage: safePercentage(fatigueLevels.high, totalUsers) },
            maxed: { count: fatigueLevels.maxed, percentage: safePercentage(fatigueLevels.maxed, totalUsers) }
        };
        // Determine engagement health
        const eligiblePercentage = safePercentage(fatigueLevels.none + fatigueLevels.low, totalUsers);
        const engagementHealth = eligiblePercentage >= 70 ? 'EXCELLENT' :
            eligiblePercentage >= 50 ? 'GOOD' :
                eligiblePercentage >= 30 ? 'FAIR' : 'POOR';
        const analytics = {
            date: today,
            totalUsers,
            processedUsers: processedCount,
            distribution,
            summary: {
                eligibleToScan: fatigueLevels.none + fatigueLevels.low,
                eligiblePercentage: `${eligiblePercentage}%`,
                atMaxCapacity: fatigueLevels.maxed,
                engagementHealth
            },
            recommendations: (() => {
                const recs = [];
                if (fatigueLevels.maxed / totalUsers > 0.3) {
                    recs.push('High percentage of users at max capacity - consider increasing daily scan limits');
                }
                if (fatigueLevels.none / totalUsers > 0.6) {
                    recs.push('Low engagement - users not scanning. Review notification strategy');
                }
                if (eligiblePercentage < 50) {
                    recs.push('Fatigue is high - consider reducing campaign frequency');
                }
                return recs;
            })(),
            meta: {
                generatedAt: new Date().toISOString(),
                maxScansPerDay
            }
        };
        await redis.quit();
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('[ANALYTICS] Fatigue distribution error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch fatigue distribution'
        });
    }
});
exports.default = router;
//# sourceMappingURL=samplingAnalytics.js.map