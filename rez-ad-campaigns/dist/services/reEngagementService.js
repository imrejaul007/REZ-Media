"use strict";
/**
 * Re-engagement Service for REZ Ads Service
 *
 * Handles scheduling and tracking of re-targeting notifications:
 * - Users who viewed an ad but didn't click (24h delay)
 * - Users who clicked but didn't convert (48h delay)
 *
 * Uses Redis for:
 * - Tracking scheduled notifications (dedup)
 * - Storing user-ad interaction state for conversion tracking
 * - Processing batches of users for re-engagement
 */
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
exports.scheduleRetargetView = scheduleRetargetView;
exports.scheduleFollowupClick = scheduleFollowupClick;
exports.markUserConverted = markUserConverted;
exports.processInteractionForReengagement = processInteractionForReengagement;
exports.processSpendUpdate = processSpendUpdate;
exports.checkEngagementSpikes = checkEngagementSpikes;
exports.startReengagementScheduler = startReengagementScheduler;
exports.stopReengagementScheduler = stopReengagementScheduler;
const bullmq_1 = require("bullmq");
const mongoose_1 = __importStar(require("mongoose"));
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const AdCampaign_1 = __importDefault(require("../models/AdCampaign"));
const AdInteraction_1 = __importDefault(require("../models/AdInteraction"));
const notificationService_1 = require("./notificationService");
// Re-engagement scheduler queue (internal, not shared with notification-events)
const REENGAGEMENT_QUEUE_NAME = 'ads-reengagement';
// 24 hours in milliseconds
const RETARGET_DELAY_MS = 24 * 60 * 60 * 1000;
// 48 hours in milliseconds
const FOLLOWUP_DELAY_MS = 48 * 60 * 60 * 1000;
// Engagement spike threshold (200% of average = spike)
const SPIKE_THRESHOLD = 2.0;
let _queue = null;
let _worker = null;
function getReengagementQueue() {
    if (!_queue) {
        _queue = new bullmq_1.Queue(REENGAGEMENT_QUEUE_NAME, {
            connection: (0, redis_1.getRedis)(),
            defaultJobOptions: {
                attempts: 2,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 100,
                removeOnFail: false,
            },
        });
    }
    return _queue;
}
/**
 * Schedule re-target notification for user who viewed but didn't click
 * Called after an impression is recorded
 */
async function scheduleRetargetView(userId, adId, merchantId) {
    const redis = (0, redis_1.getRedis)();
    const dedupKey = `retarget:view:${adId}:${userId}`;
    // Check if already scheduled
    const exists = await redis.get(dedupKey);
    if (exists)
        return;
    try {
        // Get ad details
        const ad = await AdCampaign_1.default.findById(adId).select('title merchantId ctaText').lean();
        if (!ad)
            return;
        // Get merchant name
        const merchant = await mongoose_1.default.connection
            .collection('merchants')
            .findOne({ _id: new mongoose_1.Types.ObjectId(merchantId) }, { projection: { businessName: 1 } });
        const merchantName = merchant?.businessName || 'a store';
        const scheduledFor = new Date(Date.now() + RETARGET_DELAY_MS);
        // Schedule the notification
        await (0, notificationService_1.notifyAdViewedNoClick)(userId, adId, ad.title, merchantName, ad.ctaText || 'Shop now', scheduledFor);
        // Mark as scheduled to prevent duplicates
        await redis.set(dedupKey, scheduledFor.toISOString(), 'EX', RETARGET_DELAY_MS + 3600000);
        logger_1.logger.debug('[ReEngagement] Scheduled retarget view notification', {
            userId,
            adId,
            scheduledFor: scheduledFor.toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('[ReEngagement] Failed to schedule retarget view', {
            userId,
            adId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
/**
 * Schedule follow-up notification for user who clicked but didn't convert
 * Called after a click is recorded
 */
async function scheduleFollowupClick(userId, adId, merchantId) {
    const redis = (0, redis_1.getRedis)();
    const dedupKey = `followup:click:${adId}:${userId}`;
    // Check if already scheduled
    const exists = await redis.get(dedupKey);
    if (exists)
        return;
    try {
        // Get ad details
        const ad = await AdCampaign_1.default.findById(adId).select('title merchantId ctaText').lean();
        if (!ad)
            return;
        // Get merchant name
        const merchant = await mongoose_1.default.connection
            .collection('merchants')
            .findOne({ _id: new mongoose_1.Types.ObjectId(merchantId) }, { projection: { businessName: 1 } });
        const merchantName = merchant?.businessName || 'a store';
        const scheduledFor = new Date(Date.now() + FOLLOWUP_DELAY_MS);
        // Schedule the notification
        await (0, notificationService_1.notifyClickedNoConvert)(userId, adId, ad.title, merchantName, ad.ctaText || 'Shop now', scheduledFor);
        // Mark as scheduled to prevent duplicates
        await redis.set(dedupKey, scheduledFor.toISOString(), 'EX', FOLLOWUP_DELAY_MS + 3600000);
        logger_1.logger.debug('[ReEngagement] Scheduled follow-up click notification', {
            userId,
            adId,
            scheduledFor: scheduledFor.toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('[ReEngagement] Failed to schedule follow-up click', {
            userId,
            adId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
/**
 * Mark user as having converted (no longer eligible for re-engagement)
 * Called when an order attribution is recorded
 */
async function markUserConverted(userId, adId) {
    const redis = (0, redis_1.getRedis)();
    // Remove pending retarget/followup notifications
    await redis.del(`retarget:view:${adId}:${userId}`);
    await redis.del(`followup:click:${adId}:${userId}`);
    // Track conversion for future engagement analysis
    const convertKey = `ad:converted:${adId}:${userId}`;
    await redis.set(convertKey, Date.now().toString(), 'EX', 7 * 86400000);
    logger_1.logger.debug('[ReEngagement] User marked as converted', { userId, adId });
}
/**
 * Process interaction to trigger re-engagement flows
 * Call this after recording an impression or click
 */
async function processInteractionForReengagement(userId, adId, interactionType) {
    try {
        // Get ad details for scheduling
        const ad = await AdCampaign_1.default.findById(adId)
            .select('merchantId status')
            .lean();
        if (!ad || ad.status !== 'active')
            return;
        const merchantId = ad.merchantId.toString();
        if (interactionType === 'impression') {
            // Check if user already clicked (skip retarget if they did)
            const clicked = await AdInteraction_1.default.findOne({
                campaignId: new mongoose_1.Types.ObjectId(adId),
                userId,
                type: 'click',
            }).lean();
            if (!clicked) {
                await scheduleRetargetView(userId, adId, merchantId);
            }
        }
        else if (interactionType === 'click') {
            // Schedule follow-up if no conversion within 48h
            await scheduleFollowupClick(userId, adId, merchantId);
        }
    }
    catch (error) {
        logger_1.logger.error('[ReEngagement] Failed to process interaction', {
            userId,
            adId,
            interactionType,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
// ── Budget & Spend Monitoring ─────────────────────────────────────────────────
/**
 * Check and update spend metrics, triggering alerts if needed
 * Call this after each impression/click that updates spend
 */
async function processSpendUpdate(merchantId, adId, adTitle, dailyBudget, totalBudget, totalSpent) {
    const redis = (0, redis_1.getRedis)();
    try {
        // Calculate daily spent (since midnight UTC)
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const dailySpentAgg = await AdInteraction_1.default.aggregate([
            {
                $match: {
                    campaignId: new mongoose_1.Types.ObjectId(adId),
                    type: { $in: ['impression', 'click'] },
                    createdAt: { $gte: today },
                    isFraud: false,
                },
            },
            {
                $lookup: {
                    from: 'adcampaigns',
                    localField: 'campaignId',
                    foreignField: '_id',
                    as: 'campaign',
                },
            },
            { $unwind: '$campaign' },
            {
                $group: {
                    _id: null,
                    impressions: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'impression'] }, 1, 0],
                        },
                    },
                    clicks: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'click'] }, 1, 0],
                        },
                    },
                },
            },
        ]);
        const dailyStats = dailySpentAgg[0] || { impressions: 0, clicks: 0 };
        // Calculate daily cost based on bid type
        const ad = await AdCampaign_1.default.findById(adId).select('bidType bidAmount').lean();
        if (!ad)
            return;
        let dailySpent = 0;
        if (ad.bidType === 'CPM') {
            dailySpent = (dailyStats.impressions / 1000) * ad.bidAmount;
        }
        else {
            dailySpent = dailyStats.clicks * ad.bidAmount;
        }
        // Check spend milestones
        await (0, notificationService_1.checkSpendMilestones)(merchantId, adId, adTitle, totalBudget, totalSpent);
        // Check budget alerts
        await (0, notificationService_1.checkBudgetAlerts)(merchantId, adId, adTitle, dailyBudget, totalBudget, dailySpent, totalSpent);
    }
    catch (error) {
        logger_1.logger.error('[ReEngagement] Failed to process spend update', {
            merchantId,
            adId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
/**
 * Check for engagement spikes in an ad
 * Call this periodically (e.g., every hour) via a scheduler
 */
async function checkEngagementSpikes() {
    try {
        const redis = (0, redis_1.getRedis)();
        // Get all active campaigns
        const activeCampaigns = await AdCampaign_1.default.find({ status: 'active' })
            .select('_id merchantId title impressions clicks')
            .lean();
        for (const campaign of activeCampaigns) {
            const adId = campaign._id.toString();
            const merchantId = campaign.merchantId.toString();
            // Get today's stats
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const todayStats = await AdInteraction_1.default.aggregate([
                {
                    $match: {
                        campaignId: new mongoose_1.Types.ObjectId(adId),
                        type: { $in: ['impression', 'click'] },
                        createdAt: { $gte: today },
                        isFraud: false,
                    },
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                    },
                },
            ]);
            const impressions = todayStats.find((s) => s._id === 'impression')?.count || 0;
            const clicks = todayStats.find((s) => s._id === 'click')?.count || 0;
            // Get historical average (last 7 days, excluding today)
            const weekAgo = new Date(today.getTime() - 7 * 86400000);
            const historicalStats = await AdInteraction_1.default.aggregate([
                {
                    $match: {
                        campaignId: new mongoose_1.Types.ObjectId(adId),
                        type: { $in: ['impression', 'click'] },
                        createdAt: { $gte: weekAgo, $lt: today },
                        isFraud: false,
                    },
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                    },
                },
            ]);
            const avgImpressions = (historicalStats.find((s) => s._id === 'impression')?.count || 0) / 7;
            const avgClicks = (historicalStats.find((s) => s._id === 'click')?.count || 0) / 7;
            // Check for spikes (with minimum threshold to avoid noise)
            const MIN_THRESHOLD = 10; // Minimum 10 interactions to trigger spike notification
            if (avgImpressions > 0 && impressions >= avgImpressions * SPIKE_THRESHOLD && impressions >= MIN_THRESHOLD) {
                const spikeKey = `spike:impression:${adId}:${today.toISOString().split('T')[0]}`;
                const alreadyAlerted = await redis.get(spikeKey);
                if (!alreadyAlerted) {
                    await redis.set(spikeKey, '1', 'EX', 86400);
                    await (0, notificationService_1.notifyEngagementSpike)(merchantId, adId, campaign.title, 'impression', impressions, avgImpressions, (impressions / avgImpressions - 1) * 100);
                }
            }
            if (avgClicks > 0 && clicks >= avgClicks * SPIKE_THRESHOLD && clicks >= MIN_THRESHOLD) {
                const spikeKey = `spike:click:${adId}:${today.toISOString().split('T')[0]}`;
                const alreadyAlerted = await redis.get(spikeKey);
                if (!alreadyAlerted) {
                    await redis.set(spikeKey, '1', 'EX', 86400);
                    await (0, notificationService_1.notifyEngagementSpike)(merchantId, adId, campaign.title, 'click', clicks, avgClicks, (clicks / avgClicks - 1) * 100);
                }
            }
        }
    }
    catch (error) {
        logger_1.logger.error('[ReEngagement] Failed to check engagement spikes', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
// ── Scheduler ─────────────────────────────────────────────────────────────────
/**
 * Start the re-engagement scheduler worker
 * Processes periodic tasks like engagement spike checks
 */
async function startReengagementScheduler() {
    const queue = getReengagementQueue();
    // Schedule hourly engagement spike check
    await queue.upsertJobScheduler('engagement-spike-check', { pattern: '0 * * * *' }, // Every hour
    {
        name: 'check_engagement_spikes',
        data: {},
        opts: { attempts: 2, backoff: { type: 'exponential', delay: 10000 } },
    });
    logger_1.logger.info('[ReEngagement] Scheduler started');
}
/**
 * Stop the re-engagement scheduler
 */
async function stopReengagementScheduler() {
    if (_worker) {
        await _worker.close();
        _worker = null;
    }
    if (_queue) {
        await _queue.close();
        _queue = null;
    }
    logger_1.logger.info('[ReEngagement] Scheduler stopped');
}
//# sourceMappingURL=reEngagementService.js.map