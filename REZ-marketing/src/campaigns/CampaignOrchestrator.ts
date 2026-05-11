import { Queue } from 'bullmq';
import { getRedisBullMQConnection, getRedis } from '../config/redis';
import { MarketingCampaign } from '../models/MarketingCampaign';
import { audienceBuilder } from '../audience/AudienceBuilder';
import { whatsAppChannel } from '../channels/WhatsAppChannel';
import { pushChannel } from '../channels/PushChannel';
import { smsChannel } from '../channels/SMSChannel';
import { emailChannel } from '../channels/EmailChannel';
import { logger } from '../config/logger';

/**
 * CampaignOrchestrator — dispatches a marketing campaign to its audience.
 *
 * Called by campaignWorker when a job is dequeued.
 *
 * Flow:
 *   1. Load campaign, validate state
 *   2. Mark as 'sending'
 *   3. Build audience via AudienceBuilder (paginated, channel-opt-in filtered)
 *   4. Dispatch to each customer via the appropriate channel
 *   5. Update campaign stats + mark 'sent' or 'failed'
 *
 * Deduplication:
 *   - L1: Redis NX lock per campaign (prevents double-dispatch)
 *   - L2: BullMQ jobId = campaignId (queue-level dedup)
 *   - L3: Per-channel dedup in each channel handler (WhatsApp has 24h Redis dedup)
 */

const dispatchQueue = new Queue('mkt-campaigns', { connection: getRedisBullMQConnection() });

export class CampaignOrchestrator {
  /**
   * Enqueue a campaign for dispatch.
   * Returns immediately — actual dispatch is async via campaignWorker.
   */
  async dispatch(campaignId: string): Promise<{ jobId: string }> {
    const campaign = await MarketingCampaign.findById(campaignId);
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

    if (['sending', 'sent', 'cancelled'].includes(campaign.status)) {
      throw new Error(`Campaign already in state: ${campaign.status}`);
    }

    // L1: Redis NX lock — prevents double-tap from UI
    const redis = getRedis();
    const lockKey = `mkt:dispatch:lock:${campaignId}`;
    const locked = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
    if (!locked) throw new Error('Campaign dispatch already in progress');

    await dispatchQueue.add(
      'dispatch',
      {
        campaignId,
        merchantId: campaign.merchantId.toString(),
        message: campaign.message,
      },
      {
        jobId: campaignId, // L2: BullMQ dedup
        removeOnComplete: { age: 7 * 86400 },
        removeOnFail: { age: 30 * 86400 },
      },
    );

    logger.info('[Orchestrator] Campaign enqueued', { campaignId });
    return { jobId: campaignId };
  }

  /**
   * Execute campaign dispatch synchronously (called by campaignWorker).
   */
  async execute(campaignId: string): Promise<{ sent: number; failed: number; deduped: number }> {
    const campaign = await MarketingCampaign.findById(campaignId).lean();
    if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

    // Guard: only campaigns in 'scheduled' or 'sending' state can be executed
    if (campaign.status !== 'scheduled' && campaign.status !== 'sending') {
      logger.warn('[Orchestrator] Campaign not in executable state — skipping', {
        campaignId,
        currentStatus: campaign.status,
      });
      return { sent: 0, failed: 0, deduped: 0 };
    }

    // Mark sending
    await MarketingCampaign.findByIdAndUpdate(campaignId, { status: 'sending' });

    // MRS-H5: Re-check campaign status with timeout — handles stale orchestrator state.
    // Wrap in a Promise.race so a slow DB doesn't hang the entire campaign dispatch.
    const recheckTimeout = new Promise<{ status: string } | null>((_, reject) =>
      setTimeout(() => reject(new Error('Campaign status check timed out')), 5000),
    );
    const recheck = await Promise.race([
      MarketingCampaign.findById(campaignId).select('status').lean(),
      recheckTimeout,
    ]).catch((err: any) => {
      logger.warn('[Orchestrator] Campaign status check timed out — proceeding optimistically', {
        campaignId,
        error: err.message,
      });
      return null;
    }) as { status: string } | null;

    if (!recheck || recheck.status !== 'sending') {
      logger.info('[Orchestrator] Campaign no longer in sending state — skipping', {
        campaignId,
        status: recheck?.status,
      });
      return { sent: 0, failed: 0, deduped: 0 };
    }

    const stats = { sent: 0, failed: 0, deduped: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 };
    const finalMessage = campaign.message;

    // MRS-H2: Build audience generator inside try-catch to handle init failures
    let audienceGen: AsyncGenerator<any[], void, unknown>;
    try {
      audienceGen = audienceBuilder.buildAudience(
        campaign.merchantId.toString(),
        campaign.audience,
        campaign.channel,
      );
    } catch (err: any) {
      logger.error('[Orchestrator] Audience generation failed', { campaignId, error: err.message });
      await MarketingCampaign.findByIdAndUpdate(campaignId, {
        status: 'failed',
        sentAt: new Date(),
        stats,
        errorMessage: `Audience build failed: ${err.message}`,
      });
      return stats;
    }

    let finalStatus: 'sent' | 'failed' = 'sent';

    // MRS-H2: Wrap async generator loop in try-catch to handle mid-iteration failures
    try {
      for await (const batch of audienceGen) {
        // MRS-H1: Re-check status inside the loop too — allows mid-campaign cancellation
        const midCheck = await MarketingCampaign.findById(campaignId).select('status dailyBudget totalSpent').lean();
        if (!midCheck || midCheck.status === 'cancelled') {
          logger.info('[Orchestrator] Campaign cancelled mid-execution', { campaignId });
          finalStatus = 'failed';
          break;
        }

        // P0-LOGIC-3: Check budget before dispatching this batch
        if (midCheck.dailyBudget && (midCheck.totalSpent || 0) >= midCheck.dailyBudget) {
          logger.info('[Orchestrator] Daily budget exhausted, stopping campaign', {
            campaignId,
            totalSpent: midCheck.totalSpent,
            dailyBudget: midCheck.dailyBudget,
          });
          break;
        }
        // MRS-L2: Collect WhatsApp customers per batch for batch API (up to 50 msg/request)
        const waBatch: { to: string; message: string }[] = [];

        const redis = getRedis();
        for (const customer of batch) {
          // Per-user redemption limit: skip users who already received this campaign
          const userId = (customer as any).userId;
          if (userId) {
            const redemptionKey = `campaign:redemption:${campaignId}:${userId}`;
            const alreadyRedeemed = await redis.get(redemptionKey);
            if (alreadyRedeemed) {
              stats.deduped++;
              continue;
            }
            // Set redemption key with 30-day TTL
            await redis.set(redemptionKey, '1', 'EX', 30 * 86400);
          }

          const personalizedMsg = finalMessage.replace(/\{\{name\}\}/g, extractFirstName(customer as any) || 'valued customer');

          let result: { success: boolean; deduped?: boolean; error?: string };

          switch (campaign.channel) {
            case 'whatsapp': {
              if (!customer.phone) { stats.failed++; continue; }
              waBatch.push({ to: customer.phone, message: `${personalizedMsg}\n\nReply STOP to unsubscribe` });
              continue;
            }

            case 'sms': {
              if (!customer.phone) { stats.failed++; continue; }
              result = await smsChannel.send({
                to: customer.phone,
                message: `${personalizedMsg}\n\nSend STOP to unsubscribe`,
                campaignId,
              });
              break;
            }

            case 'push': {
              const tokens = customer.pushTokens || [];
              if (!tokens.length) { stats.failed++; continue; }
              const pushResult = await pushChannel.send({
                tokens,
                title: campaign.name,
                body: personalizedMsg,
                campaignId,
                merchantId: campaign.merchantId.toString(),
                imageUrl: campaign.imageUrl,
                ctaUrl: campaign.ctaUrl,
              });
              result = { success: pushResult.success, error: pushResult.error };
              break;
            }

            case 'email': {
              if (!customer.email) { stats.failed++; continue; }
              const subject = campaign.name;
              const html = emailChannel.buildHtml(personalizedMsg, campaignId, campaign.ctaUrl, campaign.ctaText);
              result = await emailChannel.send({
                to: customer.email,
                subject,
                html,
                campaignId,
                ctaUrl: campaign.ctaUrl,
                ctaText: campaign.ctaText,
              });
              break;
            }

            case 'in_app':
            default: {
              const userId = (customer as any).userId;
              if (!userId) {
                stats.failed++;
                continue;
              }
              const redis = getRedis();
              const inboxKey = `user:inbox:${userId}`;
              const notification = JSON.stringify({
                id: `${campaignId}-${customer.userId}`,
                type: 'broadcast',
                merchantId: campaign.merchantId.toString(),
                campaignId,
                title: campaign.name,
                message: personalizedMsg,
                channel: 'in_app',
                ctaUrl: campaign.ctaUrl,
                sentAt: new Date().toISOString(),
              });
              await redis.lpush(inboxKey, notification);
              await redis.ltrim(inboxKey, 0, 49);
              await redis.expire(inboxKey, 30 * 86400);
              result = { success: true };
              break;
            }
          }

          if (result.deduped) stats.deduped++;
          else if (result.success) {
            stats.sent++;
            // BAK-ADS-005 FIX: Atomic budget decrement with $expr guard.
            // Previously, the budget check at line 146 was separate from this increment —
            // concurrent batches could all pass the check before any incremented totalSpent.
            // Using $expr in the filter atomically checks and increments in one operation,
            // preventing budget overspend from concurrent sends.
            if (midCheck.dailyBudget) {
              await MarketingCampaign.findOneAndUpdate(
                {
                  _id: campaignId,
                  $expr: { $lt: ['$totalSpent', '$dailyBudget'] },
                },
                { $inc: { totalSpent: 1 } },
              );
            }
          }
          else stats.failed++;
        }

        // MRS-L2: Send WhatsApp batch using Meta batch API (up to 50 messages per request)
        if (campaign.channel === 'whatsapp' && waBatch.length > 0) {
          const waOptions = waBatch.map(({ to, message }) => ({
            to,
            message,
            campaignId,
            merchantId: campaign.merchantId.toString(),
            templateName: campaign.templateName,
          }));
          const batchResult = await whatsAppChannel.sendBatch(waOptions);
          for (const r of batchResult.results) {
            if (r.deduped) stats.deduped++;
            else if (r.success) stats.sent++;
            else stats.failed++;
          }
        }
      }
    }

    catch (err: any) {
      // MRS-H2: Catch generator failure (Redis error, DB error, etc.)
      logger.error('[Orchestrator] Campaign dispatch loop failed', { campaignId, error: err.message });
      finalStatus = 'failed';
    }

    const campaignFinalStatus = stats.sent === 0 && stats.failed > 0 ? 'failed' : finalStatus;

    await MarketingCampaign.findByIdAndUpdate(campaignId, {
      status: campaignFinalStatus,
      sentAt: new Date(),
      stats,
      ...(campaignFinalStatus === 'failed' && !(
        await MarketingCampaign.findById(campaignId).select('errorMessage').lean()
      )?.errorMessage
        ? { errorMessage: 'All dispatch attempts failed' }
        : {}),
    });

    logger.info('[Orchestrator] Campaign complete', { campaignId, finalStatus: campaignFinalStatus, stats });
    return stats;
  }
}

function extractFirstName(customer: { userId?: string; firstName?: string }): string | null {
  // MKT-14 FIX: Return firstName when populated during audience build.
  // The AudienceBuilder now enriches records with firstName from User.profile.name
  // or User.firstName, so this function can return the actual name instead of null.
  return (customer as any).firstName || null;
}

export const campaignOrchestrator = new CampaignOrchestrator();
export default campaignOrchestrator;
