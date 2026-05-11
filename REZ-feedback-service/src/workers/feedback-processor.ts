import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { ActionFeedback } from '../types';
import { FeedbackModel } from '../models/feedback';
import { rezMindClient } from '../integrations/rez-mind';
import { logger } from '../utils/logger';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const connection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null
});

const FEEDBACK_QUEUE_NAME = 'feedback-processing';

class FeedbackProcessor {
  private queue: Queue;
  private worker: Worker | null = null;
  private isProcessing: boolean = false;

  constructor() {
    this.queue = new Queue(FEEDBACK_QUEUE_NAME, { connection });

    // Initialize worker when processor is created
    this.initializeWorker();
  }

  private initializeWorker(): void {
    this.worker = new Worker(
      FEEDBACK_QUEUE_NAME,
      async (job: Job) => {
        await this.processFeedbackJob(job.data);
      },
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 100,
          duration: 1000
        }
      }
    );

    this.worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed`, { actionId: job.data.action_id });
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed`, { error: err.message });
    });

    this.isProcessing = true;
    logger.info('Feedback processor worker started');
  }

  /**
   * Queue a single feedback item for processing
   */
  async queueFeedback(feedback: ActionFeedback): Promise<void> {
    await this.queue.add('process-feedback', feedback, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: true,
      removeOnFail: false
    });

    logger.debug('Feedback queued', { actionId: feedback.action_id });
  }

  /**
   * Queue multiple feedback items as a batch
   */
  async queueBatchFeedback(feedbacks: ActionFeedback[]): Promise<void> {
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
    logger.debug('Batch feedback queued', { count: feedbacks.length });
  }

  /**
   * Process a single feedback job
   */
  private async processFeedbackJob(feedback: ActionFeedback): Promise<void> {
    try {
      // Store in MongoDB
      await this.storeFeedback(feedback);

      // Aggregate patterns (async, non-blocking)
      this.aggregatePattern(feedback).catch(err => {
        logger.error('Pattern aggregation failed', { error: err.message });
      });

      // Send to ReZ Mind for model updates
      await this.sendToMind(feedback);

      // Check if this indicates drift
      await this.checkDrift(feedback);

    } catch (error) {
      logger.error('Feedback processing failed', {
        actionId: feedback.action_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Store feedback in MongoDB
   */
  private async storeFeedback(feedback: ActionFeedback): Promise<void> {
    const doc = new FeedbackModel(feedback);
    await doc.save();
    logger.debug('Feedback stored', { actionId: feedback.action_id });
  }

  /**
   * Aggregate feedback patterns
   */
  private async aggregatePattern(feedback: ActionFeedback): Promise<void> {
    // Store aggregated metrics for quick access
    // This could update a separate aggregation collection
    // for faster pattern queries

    const key = `pattern:${feedback.merchant_id}:${feedback.event_type}`;
    // In production, this would update a Redis or MongoDB aggregation
    logger.debug('Pattern aggregated', { key });
  }

  /**
   * Send feedback to ReZ Mind for model updates
   */
  private async sendToMind(feedback: ActionFeedback): Promise<void> {
    try {
      await rezMindClient.sendFeedback(feedback);
    } catch (error) {
      // Log but don't fail - ReZ Mind update is async
      logger.warn('Failed to send to ReZ Mind', { error });
    }
  }

  /**
   * Check for drift based on recent feedback
   */
  private async checkDrift(feedback: ActionFeedback): Promise<void> {
    // Get recent feedback for same merchant/event
    const recentFeedback = await FeedbackModel.find({
      merchant_id: feedback.merchant_id,
      event_type: feedback.event_type,
      timestamp: { $gte: Date.now() - 3600000 } // Last hour
    }).limit(20);

    if (recentFeedback.length < 10) return;

    // Check rejection rate
    const rejections = recentFeedback.filter(f => f.outcome === 'rejected').length;
    const rejectionRate = rejections / recentFeedback.length;

    if (rejectionRate > 0.5) {
      logger.warn('High rejection rate detected', {
        merchantId: feedback.merchant_id,
        eventType: feedback.event_type,
        rejectionRate
      });

      // Alert ReZ Mind
      await rezMindClient.sendAlert({
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
  async getActionHistory(actionId: string, limit: number = 50): Promise<ActionFeedback[]> {
    return FeedbackModel.find({
      action_id: { $regex: `^${actionId}` }
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<any> {
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
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.isProcessing = false;
      logger.info('Feedback processor worker stopped');
    }
    await this.queue.close();
  }
}

export const feedbackProcessor = new FeedbackProcessor();
