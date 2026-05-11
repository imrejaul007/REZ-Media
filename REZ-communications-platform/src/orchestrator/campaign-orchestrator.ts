/**
 * Campaign Orchestrator - Multi-channel campaign management
 * Coordinates campaigns across Email, SMS, WhatsApp, and Push channels
 */

import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import Redis from 'ioredis';
import {
  ICampaignOrchestrator,
  Campaign,
  CampaignResult,
  CampaignExecutionResult,
  CampaignStatusResult,
  ChannelType,
  MessageStatus,
  Priority,
  Recipient,
  DeliveryResult,
  PlatformConfig,
  QueuedMessage
} from '../types';
import { CampaignError, QueueError } from '../utils/errors';
import { logger, LogContext } from '../utils/logger';
import { EmailService } from '../email/email-service';
import { SMSService } from '../sms/sms-service';
import { WhatsAppService } from '../whatsapp/whatsapp-service';
import { PushService } from '../push/push-service';
import { TemplateEngine } from '../templates/template-engine';

interface CampaignState {
  id: string;
  status: string;
  progress: number;
  processedCount: number;
  totalCount: number;
  errors: Array<{ recipientId: string; error: string }>;
  startTime: Date;
  endTime?: Date;
  results: Map<string, DeliveryResult[]>;
}

export class CampaignOrchestrator implements ICampaignOrchestrator {
  private config: PlatformConfig;
  private log: LogContext;
  private emailService: EmailService;
  private smsService: SMSService;
  private whatsAppService: WhatsAppService;
  private pushService: PushService;
  private templateEngine: TemplateEngine;
  private redis: Redis | null = null;
  private campaignStates: Map<string, CampaignState>;
  private isRunning: boolean = false;

  constructor(
    config: PlatformConfig,
    emailService: EmailService,
    smsService: SMSService,
    whatsAppService: WhatsAppService,
    pushService: PushService,
    templateEngine: TemplateEngine
  ) {
    this.config = config;
    this.log = new LogContext(logger, { service: 'CampaignOrchestrator' });
    this.emailService = emailService;
    this.smsService = smsService;
    this.whatsAppService = whatsAppService;
    this.pushService = pushService;
    this.templateEngine = templateEngine;
    this.campaignStates = new Map();

    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    if (!this.config.queue) {
      this.log.warn('Redis config not provided, running without queue');
      return;
    }

    try {
      this.redis = new Redis({
        host: this.config.queue.host,
        port: this.config.queue.port,
        password: this.config.queue.password,
        db: this.config.queue.db || 0,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 100, 3000);
        }
      });

      this.redis.on('error', (error) => {
        this.log.error('Redis connection error', error);
      });

      this.redis.on('connect', () => {
        this.log.info('Redis connected');
      });
    } catch (error) {
      this.log.error('Failed to initialize Redis', error);
    }
  }

  /**
   * Create a new campaign
   */
  async createCampaign(campaign: Campaign): Promise<CampaignResult> {
    const campaignId = uuidv4();
    this.log.info('Creating campaign', { campaignId, name: campaign.name, channels: campaign.channels });

    // Initialize campaign state
    const state: CampaignState = {
      id: campaignId,
      status: 'draft',
      progress: 0,
      processedCount: 0,
      totalCount: 0,
      errors: [],
      startTime: new Date(),
      results: new Map()
    };

    this.campaignStates.set(campaignId, state);

    // Store in Redis if available
    if (this.redis) {
      try {
        await this.redis.setex(`campaign:${campaignId}`, 86400, JSON.stringify({
          ...campaign,
          id: campaignId,
          status: 'draft',
          createdAt: new Date().toISOString()
        }));
      } catch (error) {
        this.log.error('Failed to store campaign in Redis', error, { campaignId });
      }
    }

    return {
      campaignId,
      status: 'draft',
      createdAt: new Date(),
      metadata: { channels: campaign.channels, priority: campaign.priority }
    };
  }

  /**
   * Execute a campaign
   */
  async executeCampaign(campaignId: string): Promise<CampaignExecutionResult> {
    this.log.info('Executing campaign', { campaignId });

    const state = this.campaignStates.get(campaignId);
    if (!state) {
      throw new CampaignError(`Campaign not found: ${campaignId}`, campaignId, 'CAMPAIGN_NOT_FOUND');
    }

    if (state.status === 'running') {
      throw new CampaignError('Campaign is already running', campaignId, 'CAMPAIGN_RUNNING');
    }

    // Get campaign data from Redis
    let campaignData: Campaign;
    if (this.redis) {
      const data = await this.redis!.get(`campaign:${campaignId}`);
      if (!data) {
        throw new CampaignError(`Campaign data not found: ${campaignId}`, campaignId, 'CAMPAIGN_NOT_FOUND');
      }
      campaignData = JSON.parse(data);
    } else {
      throw new CampaignError('Redis not configured', campaignId, 'REDIS_NOT_CONFIGURED');
    }

    // Update state
    state.status = 'running';
    state.startTime = new Date();

    try {
      // Get recipients (in production, fetch from segment service)
      const recipients = await this.getRecipients(campaignData.segmentId);
      state.totalCount = recipients.length;

      this.log.info('Campaign recipients loaded', { campaignId, count: recipients.length });

      // Execute across all channels
      const results: DeliveryResult[] = [];

      for (const channel of campaignData.channels) {
        this.log.info('Processing channel', { campaignId, channel });

        const channelResults = await this.executeChannel(
          campaignId,
          channel,
          recipients,
          campaignData.priority || Priority.NORMAL
        );

        results.push(...channelResults);
        state.results.set(channel, channelResults);
      }

      // Calculate statistics
      const successful = results.filter(r => r.status !== MessageStatus.FAILED).length;
      const failed = results.filter(r => r.status === MessageStatus.FAILED).length;

      state.status = 'completed';
      state.progress = 100;
      state.endTime = new Date();

      const executionResult: CampaignExecutionResult = {
        campaignId,
        totalRecipients: recipients.length,
        successfulDeliveries: successful,
        failedDeliveries: failed,
        startTime: state.startTime,
        endTime: state.endTime,
        errors: state.errors
      };

      // Update Redis
      if (this.redis) {
        await this.redis.setex(`campaign:${campaignId}:result`, 86400, JSON.stringify(executionResult));
        await this.redis.setex(`campaign:${campaignId}:status`, 86400, JSON.stringify({
          status: 'completed',
          progress: 100,
          ...executionResult
        }));
      }

      this.log.info('Campaign completed', {
        campaignId,
        total: recipients.length,
        successful,
        failed,
        duration: state.endTime.getTime() - state.startTime.getTime()
      });

      return executionResult;
    } catch (error) {
      state.status = 'failed';
      state.endTime = new Date();
      this.log.error('Campaign execution failed', error, { campaignId });
      throw new CampaignError(
        `Campaign execution failed: ${(error as Error).message}`,
        campaignId,
        'EXECUTION_FAILED'
      );
    }
  }

  /**
   * Execute campaign for a specific channel
   */
  private async executeChannel(
    campaignId: string,
    channel: ChannelType,
    recipients: Recipient[],
    priority: Priority
  ): Promise<DeliveryResult[]> {
    const concurrencyLimit = this.getConcurrencyLimit(channel);
    const limit = pLimit(concurrencyLimit);

    this.log.info('Executing channel', { campaignId, channel, recipients: recipients.length, concurrencyLimit });

    const results = await Promise.allSettled(
      recipients.map(recipient =>
        limit(() => this.sendToRecipient(campaignId, channel, recipient))
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          messageId: uuidv4(),
          channel,
          status: MessageStatus.FAILED,
          timestamp: new Date(),
          error: result.reason?.message || 'Unknown error',
          metadata: { recipientId: recipients[index].id }
        };
      }
    });
  }

  /**
   * Send message to a single recipient
   */
  private async sendToRecipient(campaignId: string, channel: ChannelType, recipient: Recipient): Promise<DeliveryResult> {
    const state = this.campaignStates.get(campaignId);
    const messageId = uuidv4();

    // Get template content
    const templateId = `campaign-${campaignId}`; // In production, store this
    const variables = {
      ...recipient,
      campaignId,
      timestamp: new Date().toISOString()
    };

    try {
      let result: DeliveryResult;

      switch (channel) {
        case ChannelType.EMAIL:
          if (!recipient.email) {
            throw new Error('Recipient has no email address');
          }
          const emailContent = await this.templateEngine.render(`${templateId}-email`, variables);
          result = await this.emailService.send({
            to: recipient.email,
            subject: 'Campaign Message',
            body: emailContent,
            html: emailContent
          });
          break;

        case ChannelType.SMS:
          if (!recipient.phone) {
            throw new Error('Recipient has no phone number');
          }
          const smsContent = await this.templateEngine.render(`${templateId}-sms`, variables);
          result = await this.smsService.send({
            to: recipient.phone,
            body: smsContent
          });
          break;

        case ChannelType.WHATSAPP:
          if (!recipient.whatsapp) {
            throw new Error('Recipient has no WhatsApp number');
          }
          const whatsappContent = await this.templateEngine.render(`${templateId}-whatsapp`, variables);
          result = await this.whatsAppService.send({
            to: recipient.whatsapp,
            body: whatsappContent
          });
          break;

        case ChannelType.PUSH:
          if (!recipient.deviceToken) {
            throw new Error('Recipient has no device token');
          }
          const pushContent = await this.templateEngine.render(`${templateId}-push`, variables);
          result = await this.pushService.send({
            to: recipient.deviceToken,
            title: 'Campaign Notification',
            body: pushContent
          });
          break;

        default:
          throw new Error(`Unknown channel: ${channel}`);
      }

      if (state) {
        state.processedCount++;
        state.progress = Math.round((state.processedCount / state.totalCount) * 100);
      }

      return result;
    } catch (error) {
      if (state) {
        state.errors.push({
          recipientId: recipient.id,
          error: (error as Error).message
        });
      }
      throw error;
    }
  }

  /**
   * Get concurrency limit based on channel
   */
  private getConcurrencyLimit(channel: ChannelType): number {
    switch (channel) {
      case ChannelType.EMAIL: return 10;
      case ChannelType.SMS: return 5;
      case ChannelType.WHATSAPP: return 3;
      case ChannelType.PUSH: return 20;
      default: return 5;
    }
  }

  /**
   * Cancel a running campaign
   */
  async cancelCampaign(campaignId: string): Promise<void> {
    this.log.info('Cancelling campaign', { campaignId });

    const state = this.campaignStates.get(campaignId);
    if (!state) {
      throw new CampaignError(`Campaign not found: ${campaignId}`, campaignId, 'CAMPAIGN_NOT_FOUND');
    }

    if (state.status === 'completed' || state.status === 'failed') {
      throw new CampaignError('Cannot cancel completed or failed campaign', campaignId, 'INVALID_STATE');
    }

    state.status = 'cancelled';
    state.endTime = new Date();

    // Update Redis
    if (this.redis) {
      await this.redis.setex(`campaign:${campaignId}:status`, 86400, JSON.stringify({
        status: 'cancelled',
        progress: state.progress,
        processedCount: state.processedCount,
        totalCount: state.totalCount
      }));
    }

    this.log.info('Campaign cancelled', { campaignId, processedCount: state.processedCount });
  }

  /**
   * Get campaign status
   */
  async getCampaignStatus(campaignId: string): Promise<CampaignStatusResult> {
    const state = this.campaignStates.get(campaignId);

    if (!state) {
      throw new CampaignError(`Campaign not found: ${campaignId}`, campaignId, 'CAMPAIGN_NOT_FOUND');
    }

    // Calculate estimated completion time
    let estimatedCompletion: Date | undefined;
    if (state.status === 'running' && state.processedCount > 0) {
      const elapsed = Date.now() - state.startTime.getTime();
      const rate = state.processedCount / elapsed;
      const remaining = state.totalCount - state.processedCount;
      const remainingTime = remaining / rate;
      estimatedCompletion = new Date(Date.now() + remainingTime);
    }

    return {
      campaignId: state.id,
      status: state.status as CampaignStatusResult['status'],
      progress: state.progress,
      processedCount: state.processedCount,
      totalCount: state.totalCount,
      estimatedCompletion
    };
  }

  /**
   * Schedule a campaign for future execution
   */
  async scheduleCampaign(campaign: Campaign, scheduledAt: Date): Promise<CampaignResult> {
    const campaignId = uuidv4();
    const now = new Date();

    if (scheduledAt <= now) {
      throw new CampaignError('Scheduled time must be in the future', undefined, 'INVALID_SCHEDULE');
    }

    this.log.info('Scheduling campaign', {
      campaignId,
      name: campaign.name,
      scheduledAt: scheduledAt.toISOString()
    });

    // Store in Redis with schedule time
    if (this.redis) {
      await this.redis.setex(`campaign:${campaignId}`, 86400 * 30, JSON.stringify({
        ...campaign,
        id: campaignId,
        status: 'scheduled',
        scheduledAt: scheduledAt.toISOString(),
        createdAt: now.toISOString()
      }));

      // Add to sorted set for scheduling
      await this.redis!.zadd('campaign:scheduled', scheduledAt.getTime(), campaignId);
    }

    return {
      campaignId,
      status: 'scheduled',
      createdAt: now,
      metadata: {
        scheduledAt: scheduledAt.toISOString(),
        channels: campaign.channels,
        priority: campaign.priority
      }
    };
  }

  /**
   * Get recipients for a segment (placeholder - implement with actual segment service)
   */
  private async getRecipients(segmentId?: string): Promise<Recipient[]> {
    // In production, fetch from segment service or database
    // This is a placeholder implementation
    if (segmentId) {
      this.log.debug('Fetching recipients for segment', { segmentId });
    }

    return [];
  }

  /**
   * Queue a message for processing
   */
  async queueMessage(message: QueuedMessage): Promise<void> {
    if (!this.redis) {
      throw new QueueError('Redis not configured');
    }

    const queueKey = `queue:${message.channel}:${message.priority}`;
    await this.redis.rpush(queueKey, JSON.stringify({
      ...message,
      createdAt: message.createdAt.toISOString(),
      lastAttemptAt: message.lastAttemptAt?.toISOString()
    }));

    this.log.debug('Message queued', { queueKey, messageId: message.id });
  }

  /**
   * Process queued messages (worker function)
   */
  async processQueue(channel: ChannelType, priority: Priority = Priority.NORMAL): Promise<void> {
    if (!this.redis) return;

    const queueKey = `queue:${channel}:${priority}`;

    while (true) {
      const messageJson = await this.redis.lpop(queueKey);
      if (!messageJson) break;

      const message: QueuedMessage = JSON.parse(messageJson);

      try {
        // Process message based on channel
        switch (channel) {
          case ChannelType.EMAIL:
            await this.emailService.send(message.payload as any);
            break;
          case ChannelType.SMS:
            await this.smsService.send(message.payload as any);
            break;
          case ChannelType.WHATSAPP:
            await this.whatsAppService.send(message.payload as any);
            break;
          case ChannelType.PUSH:
            await this.pushService.send(message.payload as any);
            break;
        }

        this.log.info('Queued message processed', { messageId: message.id, channel });
      } catch (error) {
        // Re-queue if retries remaining
        if (message.attempts < message.maxAttempts) {
          message.attempts++;
          message.lastAttemptAt = new Date();
          message.error = (error as Error).message;

          await this.redis!.rpush(queueKey, JSON.stringify({
            ...message,
            lastAttemptAt: message.lastAttemptAt.toISOString()
          }));
        } else {
          this.log.error('Message failed after max retries', error, { messageId: message.id });
        }
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; components: Record<string, unknown> }> {
    const components: Record<string, unknown> = {
      orchestrator: { healthy: true }
    };

    if (this.redis) {
      try {
        await this.redis.ping();
        components.redis = { healthy: true };
      } catch (error) {
        components.redis = { healthy: false, error: (error as Error).message };
      }
    }

    const allHealthy = Object.values(components).every(c =>
      (c as Record<string, unknown>).healthy === true
    );

    return { healthy: allHealthy, components };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.isRunning = false;
    if (this.redis) {
      await this.redis.quit();
      this.log.info('Redis connection closed');
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createCampaignOrchestrator(
  config: PlatformConfig,
  emailService: EmailService,
  smsService: SMSService,
  whatsAppService: WhatsAppService,
  pushService: PushService,
  templateEngine: TemplateEngine
): CampaignOrchestrator {
  return new CampaignOrchestrator(
    config,
    emailService,
    smsService,
    whatsAppService,
    pushService,
    templateEngine
  );
}
