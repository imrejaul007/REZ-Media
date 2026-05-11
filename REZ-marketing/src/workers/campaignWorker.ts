import { Worker, Job, Queue } from 'bullmq';
import { getRedisBullMQConnection } from '../config/redis';
import { campaignOrchestrator } from '../campaigns/CampaignOrchestrator';
import { MarketingCampaign } from '../models/MarketingCampaign';
import { logger } from '../config/logger';

/**
 * campaignWorker — processes campaign dispatch jobs from 'mkt-campaigns' BullMQ queue.
 *
 * Job payload: { campaignId, merchantId, message }
 * Concurrency: 3 — marketing jobs are audience-query heavy
 * Limiter: max 20 campaigns/min to avoid channel provider floods
 */

const MKT_DLQ_NAME = 'mkt-campaigns-dlq';

let _dlqQueue: Queue | null = null;

function getDlqQueue(): Queue {
  if (!_dlqQueue) {
    _dlqQueue = new Queue(MKT_DLQ_NAME, {
      connection: getRedisBullMQConnection(),
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }
  return _dlqQueue;
}

export const campaignWorker = new Worker(
  'mkt-campaigns',
  async (job: Job) => {
    const { campaignId } = job.data as { campaignId: string; merchantId: string };

    logger.info('[CampaignWorker] Processing', { campaignId, jobId: job.id });

    const stats = await campaignOrchestrator.execute(campaignId);

    await job.updateProgress(100);
    return stats;
  },
  {
    connection: getRedisBullMQConnection(),
    concurrency: 3,
    limiter: { max: 20, duration: 60_000 },
    removeOnComplete: { age: 7 * 86400 },
    removeOnFail: { age: 30 * 86400 },
    stalledInterval: 30_000,
    maxStalledCount: 2,
  },
);

campaignWorker.on('error', (err) => {
  logger.error('[CampaignWorker] Worker error', err);
});

campaignWorker.on('failed', async (job, err) => {
  if (!job) return;

  const campaignId = job.data?.campaignId;

  logger.error('[CampaignWorker] Job failed permanently', {
    jobId: job.id,
    campaignId,
    err: err?.message,
  });

  await MarketingCampaign.findByIdAndUpdate(campaignId, {
    status: 'failed',
    errorMessage: err?.message || 'Worker failure',
  }).catch((updateErr) => {
    logger.error('[CampaignWorker] Failed to update campaign status on job failure', {
      campaignId,
      error: updateErr?.message,
    });
  });

  // BAK-ADS-009 FIX: Forward permanently-failed jobs to DLQ for retention and inspection.
  const dlqQueue = getDlqQueue();
  const configuredAttempts: number | undefined = (job.opts as any)?.attempts ?? undefined;
  const maxAttempts = configuredAttempts ?? 1;

  if (job.attemptsMade >= maxAttempts) {
    try {
      await dlqQueue.add('dlq-entry', {
        originalJob: job.data,
        failedAt: new Date().toISOString(),
        error: err?.message,
        attempts: job.attemptsMade,
        sourceQueue: 'mkt-campaigns',
        originalJobId: job.id,
      }, {
        removeOnComplete: false,
        removeOnFail: false,
      });
      logger.warn('[CampaignWorker] Failed job forwarded to DLQ', { jobId: job.id, campaignId });
    } catch (dlqErr: any) {
      logger.error('[CampaignWorker] Failed to forward to DLQ', {
        jobId: job.id,
        error: dlqErr.message,
      });
    }
  }
});

campaignWorker.on('completed', (job) => {
  logger.info('[CampaignWorker] Job completed', { jobId: job.id, campaignId: job.data?.campaignId });
});

export default campaignWorker;
