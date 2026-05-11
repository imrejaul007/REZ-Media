import { Worker, Job } from 'bullmq';
import { getRedisBullMQConnection } from '../config/redis';
import { interestEngine } from '../audience/InterestEngine';
import { logger } from '../config/logger';

/**
 * interestRetryWorker — processes failed user interest profile rebuilds.
 *
 * Consumes jobs from the 'mkt-interest-retry' queue that are retried up to
 * 3 times with 30s backoff. After all retries are exhausted, the job moves
 * to the DLQ for manual inspection.
 *
 * BAK-MKT-008 FIX: Previously, failed rebuildForUser calls were silently skipped
 * with no retry and no DLQ. Now every failed rebuild is enqueued for retry, and
 * persistent failures land in the DLQ for ops review.
 */

interface InterestRetryJob {
  userId: string;
}

export const interestRetryWorker = new Worker(
  'mkt-interest-retry',
  async (job: Job<InterestRetryJob>) => {
    const { userId } = job.data;
    logger.info('[InterestRetry] Processing retry', { jobId: job.id, userId, attempt: job.attemptsMade });

    await interestEngine.rebuildForUser(userId);

    logger.info('[InterestRetry] Retry succeeded', { jobId: job.id, userId });
  },
  {
    connection: getRedisBullMQConnection(),
    concurrency: 5, // Process 5 retries concurrently
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 7 * 86400 }, // DLQ — keep failed jobs for 7 days
  },
);

interestRetryWorker.on('error', (err) => logger.error('[InterestRetry] Worker error', err));
interestRetryWorker.on('completed', (job) =>
  logger.info('[InterestRetry] Job completed', { jobId: job.id, userId: job.data.userId }),
);
interestRetryWorker.on('failed', (job, err) =>
  logger.error('[InterestRetry] Job failed after all retries', {
    jobId: job?.id,
    userId: job?.data.userId,
    attemptsMade: job?.attemptsMade,
    error: err.message,
  }),
);

export default interestRetryWorker;
