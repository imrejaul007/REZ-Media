import Redis from 'ioredis';
import { CampaignModel } from '../models/Campaign';
import { CallModel } from '../models/Call';
import { voiceService } from '../services/voiceService';
import { campaignService } from '../services/campaignService';
import { dncService } from '../services/dncService';
import config from '../config';
import { CallStatus, CampaignStatus, CampaignTrigger } from '../types';

interface WorkerConfig {
  pollIntervalMs: number;
  batchSize: number;
  maxConcurrentCalls: number;
  retryDelayMs: number;
  maxRetries: number;
}

interface QueueItem {
  id: string;
  callId: string;
  priority: number;
  scheduledFor: number;
  attempts: number;
}

export class CampaignWorker {
  private redis: Redis | null = null;
  private isRunning: boolean = false;
  private isProcessing: boolean = false;
  private config: WorkerConfig;
  private currentCalls: Set<string> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<WorkerConfig>) {
    this.config = {
      pollIntervalMs: config?.pollIntervalMs || 5000,
      batchSize: config?.batchSize || 50,
      maxConcurrentCalls: config?.maxConcurrentCalls || 10,
      retryDelayMs: config?.retryDelayMs || 30000,
      maxRetries: config?.maxRetries || 3
    };
  }

  /**
   * Initialize the worker
   */
  async initialize(): Promise<void> {
    try {
      // Try to connect to Redis, but continue without it if unavailable
      this.redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('Redis connection failed, running without Redis');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true
      });

      await this.redis.connect().catch(() => {
        console.warn('Redis not available, using MongoDB-based queue');
      });

      console.log('Campaign worker initialized');
    } catch (error) {
      console.warn('Failed to initialize Redis, using MongoDB fallback');
      this.redis = null;
    }
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Campaign worker is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Campaign worker started (poll interval: ${this.config.pollIntervalMs}ms)`);

    // Start polling
    this.poll();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Wait for current processing to complete
    while (this.isProcessing) {
      await this.sleep(100);
    }

    if (this.redis) {
      await this.redis.quit();
    }

    console.log('Campaign worker stopped');
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.processScheduledCalls();
        await this.processFailedCalls();
        await this.updateCampaignStatuses();
      } catch (error) {
        console.error('Worker poll error:', error);
      }
    }, this.config.pollIntervalMs);
  }

  /**
   * Process scheduled calls
   */
  private async processScheduledCalls(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Check if we can process more calls
      if (this.currentCalls.size >= this.config.maxConcurrentCalls) {
        return;
      }

      // Find due calls
      const dueCalls = await CallModel.find({
        status: CallStatus.INITIATED,
        scheduledAt: { $lte: new Date() }
      })
        .sort({ priority: -1, scheduledAt: 1 })
        .limit(this.config.batchSize);

      for (const call of dueCalls) {
        if (!this.isRunning) break;
        if (this.currentCalls.size >= this.config.maxConcurrentCalls) break;

        try {
          await this.processCall(call);
        } catch (error) {
          console.error(`Failed to process call ${call._id}:`, error);
          await this.handleCallFailure(call._id.toString(), error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single call
   */
  private async processCall(call: any): Promise<void> {
    const callId = call._id.toString();

    // Add to current calls set
    this.currentCalls.add(callId);

    try {
      // Check DNC again before calling
      const isDnc = await dncService.isPhoneDnc(call.to);
      if (isDnc) {
        await CallModel.findByIdAndUpdate(callId, {
          status: CallStatus.CANCELLED,
          errorMessage: 'Phone number is on DNC list'
        });
        return;
      }

      // Update status to ringing
      call.status = CallStatus.RINGING;
      call.attempts = (call.attempts || 0) + 1;
      await call.save();

      // Make the call
      const { callSid } = await voiceService.initiateCall(
        call.to,
        call.context,
        {
          campaignId: call.campaignId?.toString(),
          trigger: call.trigger,
          customerId: call.customerId,
          cartId: call.cartId,
          orderId: call.orderId,
          priority: call.priority,
          maxAttempts: call.maxAttempts
        }
      );

      // Update with Twilio SID
      call.twilioCallSid = callSid;
      await call.save();

      // If using Redis, add to tracking
      if (this.redis) {
        await this.redis.set(`call:${callSid}`, callId, 'EX', 3600);
      }
    } catch (error) {
      throw error;
    } finally {
      // Remove from current calls (with delay to track active calls)
      setTimeout(() => {
        this.currentCalls.delete(callId);
      }, 5000);
    }
  }

  /**
   * Handle call failure
   */
  private async handleCallFailure(callId: string, error: unknown): Promise<void> {
    const call = await CallModel.findById(callId);
    if (!call) return;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if we should retry
    if (call.attempts < call.maxAttempts) {
      // Schedule retry
      const retryAt = new Date(Date.now() + this.config.retryDelayMs);
      call.status = CallStatus.INITIATED;
      call.scheduledAt = retryAt;
      call.errorMessage = `Retry scheduled: ${errorMessage}`;
    } else {
      // Max retries reached
      call.status = CallStatus.FAILED;
      call.errorMessage = `Max retries reached: ${errorMessage}`;
    }

    await call.save();
  }

  /**
   * Process failed calls for retry
   */
  private async processFailedCalls(): Promise<void> {
    // Find failed calls that are due for retry
    const failedCalls = await CallModel.find({
      status: CallStatus.FAILED,
      scheduledAt: { $lte: new Date() },
      attempts: { $lt: config.maxRetries || 3 }
    }).limit(this.config.batchSize);

    for (const call of failedCalls) {
      if (!this.isRunning) break;

      try {
        await this.processCall(call);
      } catch (error) {
        await this.handleCallFailure(call._id.toString(), error);
      }
    }
  }

  /**
   * Update campaign statuses based on completion
   */
  private async updateCampaignStatuses(): Promise<void> {
    const campaigns = await CampaignModel.findActiveCampaigns();

    for (const campaign of campaigns) {
      const pendingCalls = await CallModel.countDocuments({
        campaignId: campaign._id,
        status: { $in: [CallStatus.INITIATED, CallStatus.RINGING] }
      });

      if (pendingCalls === 0) {
        // All calls processed, mark campaign as completed
        campaign.status = CampaignStatus.COMPLETED;
        await campaign.save();

        console.log(`Campaign ${campaign.name} completed`);
      }
    }
  }

  /**
   * Add calls to the queue (Redis-based)
   */
  async addToQueue(items: QueueItem[]): Promise<void> {
    if (!this.redis) {
      console.warn('Redis not available, cannot add to queue');
      return;
    }

    const pipeline = this.redis.pipeline();
    for (const item of items) {
      pipeline.zadd('campaign:queue', item.scheduledFor, JSON.stringify(item));
    }
    await pipeline.exec();
  }

  /**
   * Get queue stats
   */
  async getQueueStats(): Promise<{
    queueSize: number;
    currentProcessing: number;
    activeCampaigns: number;
  }> {
    let queueSize = 0;

    if (this.redis) {
      queueSize = await this.redis.zcard('campaign:queue');
    }

    const activeCampaigns = await CampaignModel.countDocuments({
      status: { $in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED] }
    });

    return {
      queueSize,
      currentProcessing: this.currentCalls.size,
      activeCampaigns
    };
  }

  /**
   * Listen for cart.abandoned events
   */
  async listenToAutomationEvents(): Promise<void> {
    // This would integrate with the automation service via webhook or message queue
    // For now, it's a placeholder for the event listener
    console.log('Listening for automation events...');

    // In production, this would:
    // 1. Connect to a message queue (Redis pub/sub, RabbitMQ, etc.)
    // 2. Listen for 'cart.abandoned' events
    // 3. Create call records and add to queue
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    isProcessing: boolean;
    currentCalls: number;
    maxConcurrentCalls: number;
  } {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      currentCalls: this.currentCalls.size,
      maxConcurrentCalls: this.config.maxConcurrentCalls
    };
  }
}

// Singleton instance
export const campaignWorker = new CampaignWorker();
