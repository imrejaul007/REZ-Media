"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interestSyncWorker = void 0;
exports.startInterestSyncScheduler = startInterestSyncScheduler;
const bullmq_1 = require("bullmq");
const node_cron_1 = __importDefault(require("node-cron"));
const redis_1 = require("../config/redis");
const InterestEngine_1 = require("../audience/InterestEngine");
const logger_1 = require("../config/logger");
/**
 * interestSyncWorker — nightly rebuild of UserInterestProfile.
 *
 * Cron triggers a BullMQ job at 1 AM IST (7:30 PM UTC previous day).
 * The job calls InterestEngine.rebuildBatch() for all users with orders
 * in the last 7 days. Full rebuild runs weekly (Sunday).
 */
const syncQueue = new bullmq_1.Queue('mkt-interest-sync', {
    connection: (0, redis_1.getRedisBullMQConnection)(),
});
exports.interestSyncWorker = new bullmq_1.Worker('mkt-interest-sync', async (job) => {
    const { sinceDays } = job.data;
    logger_1.logger.info('[InterestSync] Starting rebuild', { sinceDays });
    const result = await InterestEngine_1.interestEngine.rebuildBatch(sinceDays);
    logger_1.logger.info('[InterestSync] Rebuild complete', result);
    return result;
}, {
    connection: (0, redis_1.getRedisBullMQConnection)(),
    concurrency: 1, // CPU-heavy — single concurrent job
    removeOnComplete: { age: 3 * 86400 },
    removeOnFail: { age: 7 * 86400 },
});
function startInterestSyncScheduler() {
    // Daily at 1 AM IST (7:30 PM UTC) — incremental sync (7 days)
    node_cron_1.default.schedule('30 19 * * *', async () => {
        await syncQueue.add('sync', { sinceDays: 7 }, {
            jobId: `interest-sync-daily-${dateKey()}`,
            removeOnComplete: true,
        });
        logger_1.logger.info('[InterestSync] Daily sync job enqueued');
    });
    // Weekly full rebuild on Sunday at midnight IST (6:30 PM UTC Saturday)
    node_cron_1.default.schedule('30 18 * * 0', async () => {
        await syncQueue.add('sync', { sinceDays: 180 }, {
            jobId: `interest-sync-weekly-${dateKey()}`,
            removeOnComplete: true,
        });
        logger_1.logger.info('[InterestSync] Weekly full rebuild job enqueued');
    });
    logger_1.logger.info('[InterestSync] Schedulers started');
}
function dateKey() {
    return new Date().toISOString().slice(0, 10);
}
exports.interestSyncWorker.on('error', (err) => logger_1.logger.error('[InterestSync] Worker error', err));
exports.interestSyncWorker.on('completed', (job) => logger_1.logger.info('[InterestSync] Job done', { jobId: job.id }));
exports.default = exports.interestSyncWorker;
//# sourceMappingURL=interestSyncWorker.js.map