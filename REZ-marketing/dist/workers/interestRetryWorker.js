"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interestRetryWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const InterestEngine_1 = require("../audience/InterestEngine");
const logger_1 = require("../config/logger");
exports.interestRetryWorker = new bullmq_1.Worker('mkt-interest-retry', async (job) => {
    const { userId } = job.data;
    logger_1.logger.info('[InterestRetry] Processing retry', { jobId: job.id, userId, attempt: job.attemptsMade });
    await InterestEngine_1.interestEngine.rebuildForUser(userId);
    logger_1.logger.info('[InterestRetry] Retry succeeded', { jobId: job.id, userId });
}, {
    connection: (0, redis_1.getRedisBullMQConnection)(),
    concurrency: 5, // Process 5 retries concurrently
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 7 * 86400 }, // DLQ — keep failed jobs for 7 days
});
exports.interestRetryWorker.on('error', (err) => logger_1.logger.error('[InterestRetry] Worker error', err));
exports.interestRetryWorker.on('completed', (job) => logger_1.logger.info('[InterestRetry] Job completed', { jobId: job.id, userId: job.data.userId }));
exports.interestRetryWorker.on('failed', (job, err) => logger_1.logger.error('[InterestRetry] Job failed after all retries', {
    jobId: job?.id,
    userId: job?.data.userId,
    attemptsMade: job?.attemptsMade,
    error: err.message,
}));
exports.default = exports.interestRetryWorker;
//# sourceMappingURL=interestRetryWorker.js.map