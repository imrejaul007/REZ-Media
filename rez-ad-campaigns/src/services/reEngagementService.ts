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

import { Queue, Worker, Job } from 'bullmq';
import mongoose, { Types } from 'mongoose';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import AdCampaign from '../models/AdCampaign';
import AdInteraction from '../models/AdInteraction';
import {
  notifyAdViewedNoClick,
  notifyClickedNoConvert,
  checkSpendMilestones,
  checkBudgetAlerts,
  notifyEngagementSpike,
} from './notificationService';

// Re-engagement scheduler queue (internal, not shared with notification-events)
const REENGAGEMENT_QUEUE_NAME = 'ads-reengagement';

// 24 hours in milliseconds
const RETARGET_DELAY_MS = 24 * 60 * 60 * 1000;
// 48 hours in milliseconds
const FOLLOWUP_DELAY_MS = 48 * 60 * 60 * 1000;

// Engagement spike threshold (200% of average = spike)
const SPIKE_THRESHOLD = 2.0;

let _queue: Queue | null = null;
let _worker: Worker | null = null;

function getReengagementQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(REENGAGEMENT_QUEUE_NAME, {
      connection: getRedis(),
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
export async function scheduleRetargetView(
  userId: string,
  adId: string,
  merchantId: string
): Promise<void> {
  const redis = getRedis();
  const dedupKey = `retarget:view:${adId}:${userId}`;

  // Check if already scheduled
  const exists = await redis.get(dedupKey);
  if (exists) return;

  try {
    // Get ad details
    const ad = await AdCampaign.findById(adId).select('title merchantId ctaText').lean();
    if (!ad) return;

    // Get merchant name
    const merchant = await mongoose.connection
      .collection('merchants')
      .findOne({ _id: new Types.ObjectId(merchantId) }, { projection: { businessName: 1 } });

    const merchantName = (merchant as any)?.businessName || 'a store';
    const scheduledFor = new Date(Date.now() + RETARGET_DELAY_MS);

    // Schedule the notification
    await notifyAdViewedNoClick(
      userId,
      adId,
      ad.title,
      merchantName,
      ad.ctaText || 'Shop now',
      scheduledFor
    );

    // Mark as scheduled to prevent duplicates
    await redis.set(dedupKey, scheduledFor.toISOString(), 'EX', RETARGET_DELAY_MS + 3600000);

    logger.debug('[ReEngagement] Scheduled retarget view notification', {
      userId,
      adId,
      scheduledFor: scheduledFor.toISOString(),
    });
  } catch (error) {
    logger.error('[ReEngagement] Failed to schedule retarget view', {
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
export async function scheduleFollowupClick(
  userId: string,
  adId: string,
  merchantId: string
): Promise<void> {
  const redis = getRedis();
  const dedupKey = `followup:click:${adId}:${userId}`;

  // Check if already scheduled
  const exists = await redis.get(dedupKey);
  if (exists) return;

  try {
    // Get ad details
    const ad = await AdCampaign.findById(adId).select('title merchantId ctaText').lean();
    if (!ad) return;

    // Get merchant name
    const merchant = await mongoose.connection
      .collection('merchants')
      .findOne({ _id: new Types.ObjectId(merchantId) }, { projection: { businessName: 1 } });

    const merchantName = (merchant as any)?.businessName || 'a store';
    const scheduledFor = new Date(Date.now() + FOLLOWUP_DELAY_MS);

    // Schedule the notification
    await notifyClickedNoConvert(
      userId,
      adId,
      ad.title,
      merchantName,
      ad.ctaText || 'Shop now',
      scheduledFor
    );

    // Mark as scheduled to prevent duplicates
    await redis.set(dedupKey, scheduledFor.toISOString(), 'EX', FOLLOWUP_DELAY_MS + 3600000);

    logger.debug('[ReEngagement] Scheduled follow-up click notification', {
      userId,
      adId,
      scheduledFor: scheduledFor.toISOString(),
    });
  } catch (error) {
    logger.error('[ReEngagement] Failed to schedule follow-up click', {
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
export async function markUserConverted(
  userId: string,
  adId: string
): Promise<void> {
  const redis = getRedis();

  // Remove pending retarget/followup notifications
  await redis.del(`retarget:view:${adId}:${userId}`);
  await redis.del(`followup:click:${adId}:${userId}`);

  // Track conversion for future engagement analysis
  const convertKey = `ad:converted:${adId}:${userId}`;
  await redis.set(convertKey, Date.now().toString(), 'EX', 7 * 86400000);

  logger.debug('[ReEngagement] User marked as converted', { userId, adId });
}

/**
 * Process interaction to trigger re-engagement flows
 * Call this after recording an impression or click
 */
export async function processInteractionForReengagement(
  userId: string,
  adId: string,
  interactionType: 'impression' | 'click'
): Promise<void> {
  try {
    // Get ad details for scheduling
    const ad = await AdCampaign.findById(adId)
      .select('merchantId status')
      .lean();

    if (!ad || ad.status !== 'active') return;

    const merchantId = ad.merchantId.toString();

    if (interactionType === 'impression') {
      // Check if user already clicked (skip retarget if they did)
      const clicked = await AdInteraction.findOne({
        campaignId: new Types.ObjectId(adId),
        userId,
        type: 'click',
      }).lean();

      if (!clicked) {
        await scheduleRetargetView(userId, adId, merchantId);
      }
    } else if (interactionType === 'click') {
      // Schedule follow-up if no conversion within 48h
      await scheduleFollowupClick(userId, adId, merchantId);
    }
  } catch (error) {
    logger.error('[ReEngagement] Failed to process interaction', {
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
export async function processSpendUpdate(
  merchantId: string,
  adId: string,
  adTitle: string,
  dailyBudget: number,
  totalBudget: number,
  totalSpent: number
): Promise<void> {
  const redis = getRedis();

  try {
    // Calculate daily spent (since midnight UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const dailySpentAgg = await AdInteraction.aggregate([
      {
        $match: {
          campaignId: new Types.ObjectId(adId),
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
    const ad = await AdCampaign.findById(adId).select('bidType bidAmount').lean();
    if (!ad) return;

    let dailySpent = 0;
    if (ad.bidType === 'CPM') {
      dailySpent = (dailyStats.impressions / 1000) * ad.bidAmount;
    } else {
      dailySpent = dailyStats.clicks * ad.bidAmount;
    }

    // Check spend milestones
    await checkSpendMilestones(merchantId, adId, adTitle, totalBudget, totalSpent);

    // Check budget alerts
    await checkBudgetAlerts(merchantId, adId, adTitle, dailyBudget, totalBudget, dailySpent, totalSpent);
  } catch (error) {
    logger.error('[ReEngagement] Failed to process spend update', {
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
export async function checkEngagementSpikes(): Promise<void> {
  try {
    const redis = getRedis();

    // Get all active campaigns
    const activeCampaigns = await AdCampaign.find({ status: 'active' })
      .select('_id merchantId title impressions clicks')
      .lean();

    for (const campaign of activeCampaigns) {
      const adId = campaign._id.toString();
      const merchantId = campaign.merchantId.toString();

      // Get today's stats
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const todayStats = await AdInteraction.aggregate([
        {
          $match: {
            campaignId: new Types.ObjectId(adId),
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
      const historicalStats = await AdInteraction.aggregate([
        {
          $match: {
            campaignId: new Types.ObjectId(adId),
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
          await notifyEngagementSpike(
            merchantId,
            adId,
            campaign.title,
            'impression',
            impressions,
            avgImpressions,
            (impressions / avgImpressions - 1) * 100
          );
        }
      }

      if (avgClicks > 0 && clicks >= avgClicks * SPIKE_THRESHOLD && clicks >= MIN_THRESHOLD) {
        const spikeKey = `spike:click:${adId}:${today.toISOString().split('T')[0]}`;
        const alreadyAlerted = await redis.get(spikeKey);
        if (!alreadyAlerted) {
          await redis.set(spikeKey, '1', 'EX', 86400);
          await notifyEngagementSpike(
            merchantId,
            adId,
            campaign.title,
            'click',
            clicks,
            avgClicks,
            (clicks / avgClicks - 1) * 100
          );
        }
      }
    }
  } catch (error) {
    logger.error('[ReEngagement] Failed to check engagement spikes', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Start the re-engagement scheduler worker
 * Processes periodic tasks like engagement spike checks
 */
export async function startReengagementScheduler(): Promise<void> {
  const queue = getReengagementQueue();

  // Schedule hourly engagement spike check
  await queue.upsertJobScheduler(
    'engagement-spike-check',
    { pattern: '0 * * * *' }, // Every hour
    {
      name: 'check_engagement_spikes',
      data: {},
      opts: { attempts: 2, backoff: { type: 'exponential', delay: 10000 } },
    }
  );

  logger.info('[ReEngagement] Scheduler started');
}

/**
 * Stop the re-engagement scheduler
 */
export async function stopReengagementScheduler(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
  logger.info('[ReEngagement] Scheduler stopped');
}
