import { Worker } from 'bullmq';
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
export declare const interestRetryWorker: Worker<InterestRetryJob, any, string>;
export default interestRetryWorker;
//# sourceMappingURL=interestRetryWorker.d.ts.map