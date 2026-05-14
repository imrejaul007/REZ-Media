"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const CampaignOrchestrator_1 = require("../campaigns/CampaignOrchestrator");
const MarketingCampaign_1 = require("../models/MarketingCampaign");
const logger_1 = require("../config/logger");
/**
 * campaignWorker — processes campaign dispatch jobs from 'mkt-campaigns' BullMQ queue.
 *
 * Job payload: { campaignId, merchantId, message }
 * Concurrency: 3 — marketing jobs are audience-query heavy
 * Limiter: max 20 campaigns/min to avoid channel provider floods
 */
const MKT_DLQ_NAME = 'mkt-campaigns-dlq';
let _dlqQueue = null;
function getDlqQueue() {
    if (!_dlqQueue) {
        _dlqQueue = new bullmq_1.Queue(MKT_DLQ_NAME, {
            connection: (0, redis_1.getRedisBullMQConnection)(),
            defaultJobOptions: {
                removeOnComplete: false,
                removeOnFail: false,
            },
        });
    }
    return _dlqQueue;
}
exports.campaignWorker = new bullmq_1.Worker('mkt-campaigns', async (job) => {
    const { campaignId } = job.data;
    logger_1.logger.info('[CampaignWorker] Processing', { campaignId, jobId: job.id });
    const stats = await CampaignOrchestrator_1.campaignOrchestrator.execute(campaignId);
    await job.updateProgress(100);
    return stats;
}, {
    connection: (0, redis_1.getRedisBullMQConnection)(),
    concurrency: 3,
    limiter: { max: 20, duration: 60000 },
    removeOnComplete: { age: 7 * 86400 },
    removeOnFail: { age: 30 * 86400 },
    stalledInterval: 30000,
    maxStalledCount: 2,
});
exports.campaignWorker.on('error', (err) => {
    logger_1.logger.error('[CampaignWorker] Worker error', err);
});
exports.campaignWorker.on('failed', async (job, err) => {
    if (!job)
        return;
    const campaignId = job.data?.campaignId;
    logger_1.logger.error('[CampaignWorker] Job failed permanently', {
        jobId: job.id,
        campaignId,
        err: err?.message,
    });
    await MarketingCampaign_1.MarketingCampaign.findByIdAndUpdate(campaignId, {
        status: 'failed',
        errorMessage: err?.message || 'Worker failure',
    }).catch((updateErr) => {
        logger_1.logger.error('[CampaignWorker] Failed to update campaign status on job failure', {
            campaignId,
            error: updateErr?.message,
        });
    });
    // BAK-ADS-009 FIX: Forward permanently-failed jobs to DLQ for retention and inspection.
    const dlqQueue = getDlqQueue();
    const configuredAttempts = job.opts?.attempts ?? undefined;
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
            logger_1.logger.warn('[CampaignWorker] Failed job forwarded to DLQ', { jobId: job.id, campaignId });
        }
        catch (dlqErr) {
            logger_1.logger.error('[CampaignWorker] Failed to forward to DLQ', {
                jobId: job.id,
                error: dlqErr.message,
            });
        }
    }
});
exports.campaignWorker.on('completed', (job) => {
    logger_1.logger.info('[CampaignWorker] Job completed', { jobId: job.id, campaignId: job.data?.campaignId });
});
exports.default = exports.campaignWorker;
//# sourceMappingURL=campaignWorker.js.map