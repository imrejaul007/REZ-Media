import cron from 'node-cron';
import { Queue } from 'bullmq';
import { logger } from '../config/logger';
import { getRedisBullMQConnection } from '../config/redis';

const birthdayQueue = new Queue('mkt-campaigns', { connection: getRedisBullMQConnection() });

/**
 * BirthdayScheduler — schedules birthday campaigns.
 *
 * Runs daily at 8 AM IST (2:30 AM UTC).
 * For each merchant with an active birthday campaign configuration,
 * enqueues a campaign dispatch job targeting users whose birthday is today
 * (or N days ahead, per merchant config).
 *
 * Campaign dispatch itself is handled by campaignWorker (BullMQ).
 *
 * Each BullMQ Queue instance connects to Redis independently — BullMQ uses the
 * queue *name* as the key prefix in Redis, so multiple Queue('mkt-campaigns')
 * instances share the same job stream. No duplicate sends occur.
 */

export function startBirthdayScheduler(): void {
  // 8:00 AM IST = 2:30 AM UTC
  cron.schedule('30 2 * * *', async () => {
    logger.info('[BirthdayScheduler] Running daily birthday campaign trigger');

    try {
      // Import here to avoid loading models before DB is connected
      const { MarketingCampaign } = await import('../models/MarketingCampaign');

      // Find all scheduled birthday campaigns (merchants who set up recurring birthday sends)
      const birthdayCampaigns = await MarketingCampaign.find({
        'audience.segment': 'birthday',
        status: 'scheduled',
      }).lean();

      logger.info('[BirthdayScheduler] Found birthday campaigns', { count: birthdayCampaigns.length });

      for (const campaign of birthdayCampaigns) {
        await birthdayQueue.add(
          'dispatch',
          {
            campaignId: campaign._id.toString(),
            merchantId: campaign.merchantId.toString(),
            message: campaign.message,
            triggeredBy: 'birthday_scheduler',
          },
          {
            jobId: `birthday-${campaign._id}-${todayKey()}`,
            removeOnComplete: { age: 7 * 86400 },
            removeOnFail: { age: 30 * 86400 },
          },
        );
      }

      logger.info('[BirthdayScheduler] Birthday jobs enqueued', { count: birthdayCampaigns.length });
    } catch (err: any) {
      logger.error('[BirthdayScheduler] Cron failed', { err: err.message });
    }
  });

  logger.info('[BirthdayScheduler] Scheduled — runs daily at 8:00 AM IST');
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
