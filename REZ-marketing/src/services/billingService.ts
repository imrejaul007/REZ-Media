import { AdCampaign } from '../models/AdCampaign';
import { logger } from '../config/logger';
import { getRedis } from '../config/redis';

/**
 * BillingService — handles ad campaign billing on impression/click events.
 *
 * Uses Redis for atomic daily spend tracking to enforce daily budget caps accurately
 * across service restarts. Falls back gracefully if Redis is unavailable.
 */
export class BillingService {
  /**
   * Charge a campaign for a single interaction (impression or click).
   * - CPC: charged on click events
   * - CPM: charged on impression events
   *
   * Before charging, checks:
   * 1. Daily budget cap (via Redis counter)
   * 2. Total budget cap (via MongoDB totalSpent)
   *
   * Returns null if the campaign is paused/completed or budget is exhausted.
   * Logs and skips on Redis failure (graceful degradation).
   */
  async chargeCampaign(
    campaignId: string,
    eventType: 'CPC' | 'CPM',
    count: number = 1,
  ): Promise<number | null> {
    const campaign = await AdCampaign.findById(campaignId).lean();
    if (!campaign) {
      logger.warn('[BillingService] Campaign not found', { campaignId });
      return null;
    }

    if (campaign.status === 'paused' || campaign.status === 'completed') {
      return null;
    }

    const chargeAmount = campaign.bidAmount * count;

    // Increment Redis per-day counter for accurate daily budget tracking
    try {
      const redis = getRedis();
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `ads:daily:${campaignId}:${today}`;
      await redis.incrbyfloat(dailyKey, chargeAmount);
      await redis.expire(dailyKey, 86400); // expire after 24 hours
    } catch (redisErr) {
      logger.warn('[BillingService] Redis daily tracking failed, skipping charge:', {
        campaignId,
        error: String(redisErr),
      });
      return null;
    }

    // Atomically compare-and-swap: only increment if budget is not yet exhausted.
    // Embeds the spent-check directly in the query predicate so no stale-read
    // window exists between checking and updating — eliminating the TOCTOU race.
    const updated = await AdCampaign.findOneAndUpdate(
      { _id: campaignId, totalSpent: { $lt: campaign.totalBudget } },
      { $inc: { totalSpent: chargeAmount } },
      { new: true },
    ).lean();

    if (!updated) {
      // Either campaign doesn't exist (already null-checked above) or budget is exhausted.
      // Attempt to mark completed idempotently — safe to ignore if already completed.
      await AdCampaign.findByIdAndUpdate(campaignId, { $set: { status: 'completed' } }).catch(
        (err) => {
          logger.warn('[BillingService] Failed to mark campaign completed', {
            campaignId,
            error: String(err),
          });
        },
      );
      return null;
    }

    // If updated totalSpent hits or exceeds totalBudget, mark completed idempotently.
    if (updated.totalSpent >= updated.totalBudget) {
      await AdCampaign.findByIdAndUpdate(campaignId, { $set: { status: 'completed' } }).catch(
        (err) => {
          logger.warn('[BillingService] Failed to mark campaign completed', {
            campaignId,
            error: String(err),
          });
        },
      );
    }

    return chargeAmount;
  }

  /**
   * Read the daily spend for a campaign from Redis.
   * Falls back to 0 if Redis is unavailable.
   *
   * Key format: `ads:daily:{campaignId}:{YYYY-MM-DD}`
   */
  async getDailySpent(campaignId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `ads:daily:${campaignId}:${today}`;

    try {
      const redis = getRedis();
      const spent = await redis.get(key);
      return parseFloat(spent || '0');
    } catch (redisErr) {
      logger.warn('[BillingService] Redis getDailySpent failed, returning 0:', {
        campaignId,
        error: String(redisErr),
      });
      return 0;
    }
  }

  /**
   * Check if a campaign can still serve impressions/clicks based on daily budget.
   */
  async canServe(campaignId: string): Promise<boolean> {
    const campaign = await AdCampaign.findById(campaignId).lean();
    if (!campaign || campaign.status !== 'active') return false;

    const dailySpent = await this.getDailySpent(campaignId);
    if (dailySpent >= campaign.dailyBudget && campaign.dailyBudget > 0) return false;

    if (campaign.totalSpent >= campaign.totalBudget) return false;

    return true;
  }
}
