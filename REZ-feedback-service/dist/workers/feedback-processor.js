"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackProcessor = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const feedback_1 = require("../models/feedback");
const rez_mind_1 = require("../integrations/rez-mind");
const logger_1 = require("../utils/logger");
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const connection = new ioredis_1.default({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null
});
const FEEDBACK_QUEUE_NAME = 'feedback-processing';
class FeedbackProcessor {
    queue;
    worker = null;
    isProcessing = false;
    constructor() {
        this.queue = new bullmq_1.Queue(FEEDBACK_QUEUE_NAME, { connection });
        // Initialize worker when processor is created
        this.initializeWorker();
    }
    initializeWorker() {
        this.worker = new bullmq_1.Worker(FEEDBACK_QUEUE_NAME, async (job) => {
            await this.processFeedbackJob(job.data);
        }, {
            connection,
            concurrency: 5,
            limiter: {
                max: 100,
                duration: 1000
            }
        });
        this.worker.on('completed', (job) => {
            logger_1.logger.info(`Job ${job.id} completed`, { actionId: job.data.action_id });
        });
        this.worker.on('failed', (job, err) => {
            logger_1.logger.error(`Job ${job?.id} failed`, { error: err.message });
        });
        this.isProcessing = true;
        logger_1.logger.info('Feedback processor worker started');
    }
    /**
     * Queue a single feedback item for processing
     */
    async queueFeedback(feedback) {
        await this.queue.add('process-feedback', feedback, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            },
            removeOnComplete: true,
            removeOnFail: false
        });
        logger_1.logger.debug('Feedback queued', { actionId: feedback.action_id });
    }
    /**
     * Queue multiple feedback items as a batch
     */
    async queueBatchFeedback(feedbacks) {
        const jobs = feedbacks.map(feedback => ({
            name: 'process-feedback',
            data: feedback,
            opts: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                removeOnComplete: true,
                removeOnFail: false
            }
        }));
        await this.queue.addBulk(jobs);
        logger_1.logger.debug('Batch feedback queued', { count: feedbacks.length });
    }
    /**
     * Process a single feedback job
     */
    async processFeedbackJob(feedback) {
        try {
            // Store in MongoDB
            await this.storeFeedback(feedback);
            // Aggregate patterns (async, non-blocking)
            this.aggregatePattern(feedback).catch(err => {
                logger_1.logger.error('Pattern aggregation failed', { error: err.message });
            });
            // Send to ReZ Mind for model updates
            await this.sendToMind(feedback);
            // Check if this indicates drift
            await this.checkDrift(feedback);
        }
        catch (error) {
            logger_1.logger.error('Feedback processing failed', {
                actionId: feedback.action_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Store feedback in MongoDB
     */
    async storeFeedback(feedback) {
        const doc = new feedback_1.FeedbackModel(feedback);
        await doc.save();
        logger_1.logger.debug('Feedback stored', { actionId: feedback.action_id });
    }
    /**
     * Aggregate feedback patterns
     */
    async aggregatePattern(feedback) {
        // Store aggregated metrics for quick access
        // This could update a separate aggregation collection
        // for faster pattern queries
        const key = `pattern:${feedback.merchant_id}:${feedback.event_type}`;
        // In production, this would update a Redis or MongoDB aggregation
        logger_1.logger.debug('Pattern aggregated', { key });
    }
    /**
     * Send feedback to ReZ Mind for model updates
     */
    async sendToMind(feedback) {
        try {
            await rez_mind_1.rezMindClient.sendFeedback(feedback);
        }
        catch (error) {
            // Log but don't fail - ReZ Mind update is async
            logger_1.logger.warn('Failed to send to ReZ Mind', { error });
        }
    }
    /**
     * Check for drift based on recent feedback
     */
    async checkDrift(feedback) {
        // Get recent feedback for same merchant/event
        const recentFeedback = await feedback_1.FeedbackModel.find({
            merchant_id: feedback.merchant_id,
            event_type: feedback.event_type,
            timestamp: { $gte: Date.now() - 3600000 } // Last hour
        }).limit(20);
        if (recentFeedback.length < 10)
            return;
        // Check rejection rate
        const rejections = recentFeedback.filter(f => f.outcome === 'rejected').length;
        const rejectionRate = rejections / recentFeedback.length;
        if (rejectionRate > 0.5) {
            logger_1.logger.warn('High rejection rate detected', {
                merchantId: feedback.merchant_id,
                eventType: feedback.event_type,
                rejectionRate
            });
            // Alert ReZ Mind
            await rez_mind_1.rezMindClient.sendAlert({
                type: 'high_rejection_rate',
                merchantId: feedback.merchant_id,
                eventType: feedback.event_type,
                metric: rejectionRate,
                threshold: 0.5
            });
        }
    }
    /**
     * Get feedback history for an action
     */
    async getActionHistory(actionId, limit = 50) {
        return feedback_1.FeedbackModel.find({
            action_id: { $regex: `^${actionId}` }
        })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    }
    /**
     * Get queue statistics
     */
    async getQueueStats() {
        const counts = await this.queue.getJobCounts();
        return {
            waiting: counts.waiting,
            active: counts.active,
            completed: counts.completed,
            failed: counts.failed,
            delayed: counts.delayed
        };
    }
    /**
     * Stop the processor gracefully
     */
    async shutdown() {
        if (this.worker) {
            await this.worker.close();
            this.isProcessing = false;
            logger_1.logger.info('Feedback processor worker stopped');
        }
        await this.queue.close();
    }
}
exports.feedbackProcessor = new FeedbackProcessor();
//# sourceMappingURL=feedback-processor.js.map