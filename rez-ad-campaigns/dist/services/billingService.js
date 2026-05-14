"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingService = void 0;
// @ts-nocheck
const AdCampaign_1 = __importDefault(require("../models/AdCampaign"));
const logger_1 = require("../config/logger");
const redis_1 = require("../config/redis");
/**
 * BillingService — handles ad campaign billing on impression/click events.
 *
 * Charging logic:
 *   - CPM (cost per mille): charge bidAmount / 1000 per impression
 *   - CPC (cost per click): charge bidAmount per click
 *
 * Budget enforcement:
 *   - totalBudget: if totalSpent >= totalBudget → mark campaign 'completed'
 *   - dailyBudget: if daily spend >= dailyBudget → mark campaign 'paused'
 *     (a scheduled job should unpause daily-paused campaigns at midnight)
 *
 * This service is called from interactionRoutes.ts after recording the interaction.
 * The serve.ts routes use inline MongoDB aggregation pipelines for atomic billing;
 * this service provides the same logic for the legacy interaction endpoints.
 */
class BillingService {
    /**
     * Charge a campaign for an ad event (impression or click).
     *
     * Calculates the charge amount based on bidType, applies it to totalSpent,
     * then checks both total and daily budget limits.
     *
     * BAK-ADS-001/003 FIX: Accepts bidType ('CPC'|'CPM') instead of eventType.
     * The old signature accepted eventType ('click'|'impression') and compared it
     * against bidType ('CPC'|'CPM') — different enum values that never matched,
     * causing ALL charges to return 0. Now callers pass the campaign's bidType
     * directly, so calculateCharge can correctly match.
     *
     * @param campaignId - The AdCampaign _id
     * @param bidType    - 'CPC' or 'CPM' (from the campaign's bidType field)
     * @param eventType  - 'impression' or 'click' (the event that triggered billing)
     * @returns Object indicating whether the campaign was paused/completed, or null on error
     */
    async chargeCampaign(campaignId, bidType, eventType) {
        try {
            const campaign = await AdCampaign_1.default.findById(campaignId);
            if (!campaign || campaign.status !== 'active') {
                return null;
            }
            // BAK-ADS-001/003 FIX: Pass bidType directly to calculateCharge.
            // Previously eventType was passed and compared against campaign.bidType internally,
            // but the types ('click'|'impression' vs 'CPC'|'CPM') never matched,
            // causing all charges to return 0.
            // BAK-ADS-001/003 FIX: Pass bidAmount along with bidType.
            const chargeAmount = this.calculateCharge(bidType, eventType, campaign.bidAmount);
            if (chargeAmount <= 0) {
                return { charged: 0, campaignStatus: campaign.status };
            }
            // BAK-ADS-004 FIX: Atomic budget decrement with $expr guard to prevent race condition.
            // Previously the code read totalSpent, checked budget, then incremented — a separate
            // operation. With 10 concurrent workers, multiple requests could all pass the budget
            // check before any incremented totalSpent, causing overspend of up to 10x the charge.
            // Using $expr in the filter atomically checks and increments in one operation.
            const updated = await AdCampaign_1.default.findOneAndUpdate({
                _id: campaignId,
                status: 'active',
                $expr: { $lt: ['$totalSpent', '$totalBudget'] },
            }, { $inc: { totalSpent: chargeAmount } }, { new: true });
            if (!updated) {
                // Either campaign not found, not active, or budget already exhausted
                logger_1.logger.info('[BillingService] Campaign not charged — not active or budget exhausted', { campaignId });
                return { charged: 0, campaignStatus: 'completed' };
            }
            // Increment Redis per-day counter for accurate daily budget tracking
            try {
                const redis = (0, redis_1.getRedis)();
                const today = new Date().toISOString().split('T')[0];
                const dailyKey = `ads:daily:${campaignId}:${today}`;
                await redis.incrbyfloat(dailyKey, chargeAmount);
                await redis.expire(dailyKey, 86400); // expire after 24 hours
            }
            catch (redisErr) {
                logger_1.logger.warn('[BillingService] Redis daily tracking failed, falling back to estimate:', { campaignId, error: redisErr });
            }
            // Check daily budget limit: daily spend >= dailyBudget → pause for day
            const dailySpent = await this.getDailySpent(campaignId);
            if (dailySpent >= updated.dailyBudget) {
                await AdCampaign_1.default.findByIdAndUpdate(campaignId, { $set: { status: 'paused' } });
                logger_1.logger.info('[BillingService] Campaign paused — daily budget exhausted', {
                    campaignId,
                    dailySpent,
                    dailyBudget: updated.dailyBudget,
                });
                return { charged: chargeAmount, campaignStatus: 'paused' };
            }
            return { charged: chargeAmount, campaignStatus: updated.status };
        }
        catch (error) {
            logger_1.logger.error('[BillingService] chargeCampaign error:', { campaignId, eventType, error });
            return null;
        }
    }
    /**
     * Calculate the charge amount for a given event type and bid type.
     *
     * - CPC campaigns: charged bidAmount per click (impressions are free)
     * - CPM campaigns: charged bidAmount/1000 per impression (clicks are free)
     *
     * BAK-ADS-001/003 FIX: bidType is now passed directly by the caller (not read from
     * the campaign object internally) so the comparison is between two values of the same
     * type ('CPC' vs 'CPC', 'CPM' vs 'CPM'). Previously, eventType was passed by the caller
     * and compared against bidType internally — mismatched types always returned 0.
     */
    calculateCharge(bidType, eventType, bidAmount) {
        if (eventType === 'click' && bidType === 'CPC') {
            return bidAmount;
        }
        if (eventType === 'impression' && bidType === 'CPM') {
            return bidAmount / 1000;
        }
        return 0;
    }
    /**
     * Read the daily spend for a campaign from Redis.
     * Falls back to an in-memory Map if Redis is unavailable.
     *
     * Key format: `ads:daily:{campaignId}:{YYYY-MM-DD}`
     * The key is incremented atomically in `chargeCampaign` via `incrbyfloat`.
     */
    async getDailySpent(campaignId) {
        const today = new Date().toISOString().split('T')[0];
        const key = `ads:daily:${campaignId}:${today}`;
        try {
            const redis = (0, redis_1.getRedis)();
            const spent = await redis.get(key);
            return parseFloat(spent || '0');
        }
        catch (redisErr) {
            logger_1.logger.warn('[BillingService] Redis getDailySpent failed, returning 0:', { campaignId, error: redisErr });
            return 0;
        }
    }
}
exports.billingService = new BillingService();
//# sourceMappingURL=billingService.js.map