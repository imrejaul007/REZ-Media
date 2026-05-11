import { Worker, Queue, Job } from 'bullmq';
import cron from 'node-cron';
import { getRedisBullMQConnection } from '../config/redis';
import { interestEngine } from '../audience/InterestEngine';
import { logger } from '../config/logger';

/**
 * interestSyncWorker — nightly rebuild of UserInterestProfile.
 *
 * Cron triggers a BullMQ job at 1 AM IST (7:30 PM UTC previous day).
 * The job calls InterestEngine.rebuildBatch() for all users with orders
 * in the last 7 days. Full rebuild runs weekly (Sunday).
 */

const syncQueue = new Queue('mkt-interest-sync', {
  connection: getRedisBullMQConnection(),
});

export const interestSyncWorker = new Worker(
  'mkt-interest-sync',
  async (job: Job) => {
    const { sinceDays } = job.data as { sinceDays: number };
    logger.info('[InterestSync] Starting rebuild', { sinceDays });

    const result = await interestEngine.rebuildBatch(sinceDays);

    logger.info('[InterestSync] Rebuild complete', result);
    return result;
  },
  {
    connection: getRedisBullMQConnection(),
    concurrency: 1, // CPU-heavy — single concurrent job
    removeOnComplete: { age: 3 * 86400 },
    removeOnFail: { age: 7 * 86400 },
  },
);

export function startInterestSyncScheduler(): void {
  // Daily at 1 AM IST (7:30 PM UTC) — incremental sync (7 days)
  cron.schedule('30 19 * * *', async () => {
    await syncQueue.add('sync', { sinceDays: 7 }, {
      jobId: `interest-sync-daily-${dateKey()}`,
      removeOnComplete: true,
    });
    logger.info('[InterestSync] Daily sync job enqueued');
  });

  // Weekly full rebuild on Sunday at midnight IST (6:30 PM UTC Saturday)
  cron.schedule('30 18 * * 0', async () => {
    await syncQueue.add('sync', { sinceDays: 180 }, {
      jobId: `interest-sync-weekly-${dateKey()}`,
      removeOnComplete: true,
    });
    logger.info('[InterestSync] Weekly full rebuild job enqueued');
  });

  logger.info('[InterestSync] Schedulers started');
}

function dateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interestSyncWorker.on('error', (err) => logger.error('[InterestSync] Worker error', err));
interestSyncWorker.on('completed', (job) => logger.info('[InterestSync] Job done', { jobId: job.id }));

export default interestSyncWorker;
