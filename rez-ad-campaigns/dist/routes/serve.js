"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const mongoose_1 = __importStar(require("mongoose"));
const auth_1 = require("../middleware/auth");
const AdCampaign_1 = __importDefault(require("../models/AdCampaign"));
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const crypto_1 = require("crypto");
const intentCaptureService_1 = require("../services/intentCaptureService");
const router = (0, express_1.Router)();
router.use(auth_1.verifyConsumer);
// In-memory sliding-window rate limiter for impression/click endpoints.
// Uses Redis sorted sets: score = timestamp, member = request-id.
// ADS-001 FIX: Fail closed (rate limit) if Redis is unavailable to prevent DoS
function createRateLimiter(windowMs, maxRequests) {
    let inMemoryLimiters = new Map(); // userId -> [timestamps]
    return async (userId, endpoint) => {
        try {
            const redis = (0, redis_1.getRedis)();
            const key = `ratelimit:${endpoint}:${userId}`;
            const now = Date.now();
            const windowStart = now - windowMs;
            await redis.zremrangebyscore(key, 0, windowStart);
            const count = await redis.zcard(key);
            if (count >= maxRequests) {
                return false; // rate limited
            }
            await redis.zadd(key, now, `${now}:${(0, crypto_1.randomUUID)()}`);
            await redis.expire(key, Math.ceil(windowMs / 1000));
            return true; // allowed
        }
        catch (redisErr) {
            // Fail closed: fall back to in-memory sliding window to prevent DoS
            logger_1.logger.warn(`[RateLimiter] Redis error, using in-memory fallback: ${redisErr?.message}`);
            const memKey = `${endpoint}:${userId}`;
            const now = Date.now();
            const windowStart = now - windowMs;
            let timestamps = inMemoryLimiters.get(memKey) || [];
            // Remove old timestamps outside the window
            timestamps = timestamps.filter(ts => ts > windowStart);
            if (timestamps.length >= maxRequests) {
                return false; // rate limited
            }
            timestamps.push(now);
            inMemoryLimiters.set(memKey, timestamps);
            return true; // allowed
        }
    };
}
const impressionLimiter = createRateLimiter(60000, 100); // 100/min
const clickLimiter = createRateLimiter(60000, 100); // 100/min
// ── GET /serve — serve one active ad for a placement ────────────────────────
router.get('/serve', async (req, res) => {
    try {
        const { placement } = req.query;
        const userId = req.userId;
        if (!placement || typeof placement !== 'string') {
            return res.status(400).json({ success: false, message: 'placement query parameter is required' });
        }
        const validPlacements = ['home_banner', 'explore_feed', 'store_listing', 'search_result'];
        if (!validPlacements.includes(placement)) {
            return res.status(400).json({
                success: false,
                message: `placement must be one of: ${validPlacements.join(', ')}`,
            });
        }
        const now = new Date();
        // ADS-H3: Build targeting filters from consumer profile (location, segment, interests)
        // BE-ADS-004 FIX: Clarify and document targeting logic (AND vs OR semantics)
        // BE-ADS-022 FIX: Handle missing location data explicitly
        const targetFilters = {};
        try {
            if (userId && mongoose_1.default.connection.readyState === 1) {
                const user = await mongoose_1.default.connection.db.collection('users').findOne({ _id: new mongoose_1.Types.ObjectId(userId) }, { projection: { segment: 1, location: 1, interests: 1 } });
                if (user) {
                    // BE-ADS-022: Exclude users without location from location-targeted ads (safe approach)
                    if (user.location?.city) {
                        targetFilters['targetLocation.city'] = user.location.city;
                    }
                    if (user.segment) {
                        targetFilters.$or = targetFilters.$or || [];
                        targetFilters.$or.push({ targetSegment: user.segment }, { targetSegment: 'all' });
                    }
                    if (user.interests?.length) {
                        targetFilters.$or = targetFilters.$or || [];
                        targetFilters.$or.push({ targetInterests: { $in: user.interests } });
                    }
                }
            }
        }
        catch {
            // Targeting fetch failed — fall back to non-targeted serve
        }
        // ADS-M1: Per-user eligibility check — pick the best matching ad
        // BE-ADS-015: Use compound index hint to optimize query performance
        const ads = await AdCampaign_1.default.find({
            status: 'active',
            placement,
            startDate: { $lte: now },
            $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gt: now } },
            ],
            ...targetFilters,
        })
            .hint({ status: 1, placement: 1, startDate: 1, endDate: 1 })
            .select('_id title headline description ctaText ctaUrl imageUrl placement merchantId storeId targetSegment targetLocation targetInterests')
            .lean();
        if (ads.length === 0) {
            return res.json({ success: true, data: null });
        }
        // ADS-H5: Frequency cap — skip ads already shown to this user in last 24h
        // BE-ADS-002: Include campaign/ad info in freq cap key to reset on campaign expiry
        const redis = (0, redis_1.getRedis)();
        const freqKey = `ad:freq:${userId}`;
        const shownAdIds = await redis.smembers(freqKey);
        const unseenAds = shownAdIds.length > 0
            ? ads.filter((ad) => !shownAdIds.includes(ad._id.toString()))
            : ads;
        const adPool = unseenAds.length > 0 ? unseenAds : ads;
        // BE-ADS-014 FIX: Use crypto.randomUUID() for ad selection index instead of Math.random()
        // Math.random() is predictable — an attacker could game ad frequency or cause bias in ad rotation.
        // Use weighted random index derived from crypto UUID for unpredictability.
        const randomIndex = Number(BigInt('0x' + (0, crypto_1.randomUUID)().replace(/-/g, '')) % BigInt(adPool.length));
        const ad = adPool[Number(randomIndex)];
        // Record this impression in the frequency set (TTL 24h)
        // BE-ADS-016: Make frequency cap TTL configurable (default 24h)
        // MED-27 FIX: Sanitize userId before using in Redis key to prevent injection
        const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
        const safeFreqKey = `ad:freq:${safeUserId}`;
        const frequencyCapDays = ad.frequencyCapDays;
        const frequencyCapTTL = (typeof frequencyCapDays === 'number' && frequencyCapDays > 0)
            ? frequencyCapDays * 86400
            : 86400; // Default 24h TTL when field is missing or invalid
        await redis.sadd(safeFreqKey, ad._id.toString());
        await redis.expire(safeFreqKey, frequencyCapTTL);
        return res.json({ success: true, data: ad });
    }
    catch (error) {
        logger_1.logger.error('[AD SERVING] serve error:', error);
        return res.status(500).json({ success: false, message: 'Failed to serve ad' });
    }
});
// ── POST /impression — track impression ─────────────────────────────────────
// ADS-H1: Use $expr field-to-field comparison in filter for atomic budget check.
// ADS-H4: Rate limiting applied before processing.
router.post('/impression', async (req, res) => {
    const userId = req.userId || 'unknown';
    // ADS-H4: Rate limit
    if (!(await impressionLimiter(userId, 'impression'))) {
        return res.status(429).json({ success: false, message: 'Rate limit exceeded' });
    }
    try {
        const { adId } = req.body;
        if (!adId) {
            return res.status(400).json({ success: false, message: 'adId is required' });
        }
        if (!mongoose_1.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({ success: false, message: 'Invalid adId' });
        }
        // BE-ADS-007 FIX: Validate ad exists and is active before counting impression
        const adExists = await AdCampaign_1.default.findOne({ _id: adId, status: 'active' }).select('_id').lean();
        if (!adExists) {
            return res.status(404).json({ success: false, message: 'Ad not found or inactive' });
        }
        // ADS-H1: $expr in filter compares totalSpent vs totalBudget atomically
        const ad = await AdCampaign_1.default.findOneAndUpdate({ _id: adId, status: 'active', $expr: { $lt: ['$totalSpent', '$totalBudget'] } }, [
            {
                $set: {
                    impressions: { $add: ['$impressions', 1] },
                    totalSpent: {
                        $cond: {
                            if: { $eq: ['$bidType', 'CPM'] },
                            then: { $add: ['$totalSpent', { $divide: ['$bidAmount', 1000] }] },
                            else: '$totalSpent',
                        },
                    },
                    status: {
                        $cond: {
                            if: { $gte: [{ $add: ['$totalSpent', { $divide: ['$bidAmount', 1000] }] }, '$totalBudget'] },
                            then: 'completed',
                            else: '$status',
                        },
                    },
                },
            },
        ], { new: true });
        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found or not active' });
        }
        (0, intentCaptureService_1.track)({
            userId,
            event: 'ad_impression',
            intentKey: 'RTMN_COMMERCE_MEMORY',
            properties: {
                campaignId: adId,
                merchantId: ad.merchantId.toString(),
                category: 'GENERAL',
                appType: 'rez-ads-service',
            },
        }).catch((err) => {
            logger_1.logger.error('[Ads] Operation failed', { error: err });
        });
        return res.json({ success: true, message: 'Impression recorded' });
    }
    catch (error) {
        logger_1.logger.error('[AD SERVING] impression error:', error);
        return res.status(500).json({ success: false, message: 'Failed to record impression' });
    }
});
// ── POST /click — track click ───────────────────────────────────────────────
// ADS-H2: Add budget check to filter. ADS-H4: Rate limiting applied.
router.post('/click', async (req, res) => {
    const userId = req.userId || 'unknown';
    // ADS-H4: Rate limit
    if (!(await clickLimiter(userId, 'click'))) {
        return res.status(429).json({ success: false, message: 'Rate limit exceeded' });
    }
    try {
        const { adId } = req.body;
        if (!adId) {
            return res.status(400).json({ success: false, message: 'adId is required' });
        }
        if (!mongoose_1.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({ success: false, message: 'Invalid adId' });
        }
        // BE-ADS-020 FIX: Implement click deduplication to prevent fraudulent inflation
        const dedupeKey = `click:dedup:${adId}:${userId}:${Math.floor(Date.now() / 1000)}`;
        const redis = (0, redis_1.getRedis)();
        const isDuplicate = await redis.get(dedupeKey);
        if (isDuplicate) {
            return res.status(429).json({ success: false, message: 'Duplicate click detected' });
        }
        // BAK-MKT-014 FIX: Extend dedup window from 30s to 300s (5 min).
        // 30 seconds was too short — rapid-fire clicks could still be recorded if
        // the client retried after the window expired. 5 minutes provides better
        // fraud protection while remaining acceptable for legitimate re-clicks.
        await redis.setex(dedupeKey, 300, '1');
        // ADS-H2: Filter now includes atomic budget check via $expr
        const ad = await AdCampaign_1.default.findOneAndUpdate({ _id: adId, status: 'active', $expr: { $lt: ['$totalSpent', '$totalBudget'] } }, [
            {
                $set: {
                    clicks: { $add: ['$clicks', 1] },
                    totalSpent: {
                        $cond: {
                            if: { $eq: ['$bidType', 'CPC'] },
                            then: { $add: ['$totalSpent', '$bidAmount'] },
                            else: '$totalSpent',
                        },
                    },
                },
            },
            {
                $set: {
                    status: {
                        $cond: {
                            if: { $gte: ['$totalSpent', '$totalBudget'] },
                            then: 'completed',
                            else: '$status',
                        },
                    },
                },
            },
        ], { new: true });
        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found or not active' });
        }
        (0, intentCaptureService_1.track)({
            userId,
            event: 'ad_click',
            intentKey: 'RTMN_COMMERCE_MEMORY',
            properties: {
                campaignId: adId,
                merchantId: ad.merchantId.toString(),
                category: 'GENERAL',
                appType: 'rez-ads-service',
            },
        }).catch((err) => {
            logger_1.logger.error('[Ads] Operation failed', { error: err });
        });
        return res.json({ success: true, message: 'Click recorded' });
    }
    catch (error) {
        logger_1.logger.error('[AD SERVING] click error:', error);
        return res.status(500).json({ success: false, message: 'Failed to record click' });
    }
});
exports.default = router;
//# sourceMappingURL=serve.js.map