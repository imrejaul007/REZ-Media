import { v4 as uuidv4 } from 'uuid';
import { CampaignModel, ICampaign } from '../models/Campaign';
import { CallModel } from '../models/Call';
import { dncService } from './dncService';
import { voiceService } from './voiceService';
import { conversationEngine } from './conversationEngine';
import {
  CampaignStatus,
  CampaignTrigger,
  CallPriority,
  CreateCampaignSchema,
  CampaignExecutionStats,
  CallContext
} from '../types';
import { CampaignQueueJob } from '../types';

interface TargetData {
  phone: string;
  customerId?: string;
  cartId?: string;
  orderId?: string;
  context: CallContext;
}

export class CampaignService {
  private executionStats: Record<string, CampaignExecutionStats> = {} as Record<string, CampaignExecutionStats>;

  /**
   * Create a new campaign
   */
  async createCampaign(data: {
    name: string;
    trigger: CampaignTrigger;
    templateId: string;
    priority?: CallPriority;
    maxAttempts?: number;
    retryDelayMinutes?: number;
    businessHours?: any;
    callingWindow?: any;
    filters?: any;
    schedule?: any;
  }): Promise<ICampaign> {
    const campaign = await CampaignModel.create({
      name: data.name,
      trigger: data.trigger,
      templateId: data.templateId,
      status: CampaignStatus.DRAFT,
      priority: data.priority || CallPriority.MEDIUM,
      businessHours: data.businessHours || {
        enabled: true,
        timezone: 'Asia/Kolkata',
        startHour: 9,
        endHour: 21
      },
      callingWindow: data.callingWindow || {
        enabled: true,
        maxCallsPerHour: 60
      },
      filters: data.filters || {
        excludeDnc: true
      },
      schedule: data.schedule
    });

    return campaign;
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId: string): Promise<ICampaign | null> {
    return CampaignModel.findById(campaignId);
  }

  /**
   * List all campaigns
   */
  async listCampaigns(options: {
    status?: CampaignStatus;
    trigger?: CampaignTrigger;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    campaigns: ICampaign[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);

    const query: any = {};
    if (options.status) {
      query.status = options.status;
    }
    if (options.trigger) {
      query.trigger = options.trigger;
    }

    const [campaigns, total] = await Promise.all([
      CampaignModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      CampaignModel.countDocuments(query)
    ]);

    return { campaigns, total, page, limit };
  }

  /**
   * Update campaign
   */
  async updateCampaign(
    campaignId: string,
    updates: Partial<{
      name: string;
      templateId: string;
      priority: CallPriority;
      businessHours: any;
      callingWindow: any;
      filters: any;
      schedule: any;
    }>
  ): Promise<ICampaign | null> {
    const campaign = await CampaignModel.findByIdAndUpdate(
      campaignId,
      { $set: updates },
      { new: true }
    );
    return campaign;
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    campaignId: string,
    status: CampaignStatus
  ): Promise<ICampaign | null> {
    const campaign = await CampaignModel.findByIdAndUpdate(
      campaignId,
      { $set: { status } },
      { new: true }
    );

    if (campaign && status === CampaignStatus.RUNNING) {
      await this.startCampaignExecution(campaignId);
    }

    return campaign;
  }

  /**
   * Start campaign execution
   */
  async startCampaignExecution(campaignId: string): Promise<void> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Initialize execution stats
    this.executionStats[campaignId] = {
      campaignId,
      startedAt: new Date(),
      totalTargets: 0,
      processedCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      pendingCalls: 0
    });

    // Update campaign status
    campaign.status = CampaignStatus.RUNNING;
    await campaign.save();
  }

  /**
   * Execute a campaign - add targets and process calls
   */
  async executeCampaign(
    campaignId: string,
    targets: TargetData[]
  ): Promise<{
    queued: number;
    skipped: number;
    errors: string[];
  }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    if (!campaign.isActive()) {
      throw new Error(`Campaign is not active: ${campaign.status}`);
    }

    const results = {
      queued: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // Update stats
    const stats = this.executionStats[campaignId];
    if (stats) {
      stats.totalTargets = targets.length;
      stats.pendingCalls = targets.length;
    }

    for (const target of targets) {
      try {
        // Apply filters
        const shouldSkip = await this.applyFilters(campaign, target);
        if (shouldSkip) {
          results.skipped++;
          continue;
        }

        // Check business hours
        if (campaign.businessHours.enabled) {
          const isWithinHours = this.isWithinBusinessHours(campaign.businessHours);
          if (!isWithinHours) {
            // Schedule for next business hour
            target.context.scheduledAt = this.getNextBusinessHour(campaign.businessHours);
          }
        }

        // Create call record
        await CallModel.create({
          to: target.phone,
          from: '',
          status: 'initiated',
          campaignId: campaign._id,
          trigger: campaign.trigger,
          customerId: target.customerId,
          cartId: target.cartId,
          orderId: target.orderId,
          priority: campaign.priority,
          context: target.context,
          attempts: 0,
          maxAttempts: 3,
          scheduledAt: target.context.scheduledAt || new Date()
        });

        results.queued++;
      } catch (error) {
        results.errors.push(
          `Failed to queue call for ${target.phone}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Update campaign stats
    await campaign.updateStats();

    return results;
  }

  /**
   * Apply campaign filters to a target
   */
  private async applyFilters(campaign: ICampaign, target: TargetData): Promise<boolean> {
    const filters = campaign.filters;

    // DNC filter
    if (filters.excludeDnc) {
      const isDnc = await dncService.isPhoneDnc(target.phone);
      if (isDnc) {
        return true;
      }
    }

    // Min order value filter
    if (filters.minOrderValue && target.context.totalAmount) {
      const amount = parseFloat(target.context.totalAmount.replace(/[^0-9.]/g, ''));
      if (isNaN(amount) || amount < filters.minOrderValue) {
        return true;
      }
    }

    // Customer tags filter
    if (filters.customerTags && filters.customerTags.length > 0) {
      // Would need to fetch customer data to check tags
      // This is a placeholder for the actual implementation
    }

    return false;
  }

  /**
   * Check if current time is within business hours
   */
  private isWithinBusinessHours(businessHours: {
    timezone: string;
    startHour: number;
    endHour: number;
  }): boolean {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: businessHours.timezone,
      hour: 'numeric',
      hour12: false
    };

    const hour = parseInt(
      new Intl.DateTimeFormat('en-US', options).format(new Date()),
      10
    );

    return hour >= businessHours.startHour && hour < businessHours.endHour;
  }

  /**
   * Get next business hour datetime
   */
  private getNextBusinessHour(businessHours: {
    timezone: string;
    startHour: number;
    endHour: number;
  }): Date {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: businessHours.timezone,
      hour: 'numeric',
      hour12: false
    };

    const currentHour = parseInt(
      new Intl.DateTimeFormat('en-US', options).format(now),
      10
    );

    let nextDate = new Date(now);

    if (currentHour >= businessHours.endHour) {
      // Move to next day
      nextDate.setDate(nextDate.getDate() + 1);
    }

    // Set to start of day in the target timezone
    nextDate.setHours(businessHours.startHour, 0, 0, 0);

    return nextDate;
  }

  /**
   * Process scheduled calls
   */
  async processScheduledCalls(limit: number = 50): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const results = {
      processed: 0,
      successful: 0,
      failed: 0
    };

    // Find due calls
    const dueCalls = await CallModel.findDueCalls(limit);

    for (const call of dueCalls) {
      try {
        // Get campaign if exists
        let context = call.context;
        if (call.campaignId) {
          const campaign = await CampaignModel.findById(call.campaignId);

          // Check if within business hours
          if (campaign?.businessHours.enabled) {
            if (!this.isWithinBusinessHours(campaign.businessHours)) {
              // Reschedule for next business hour
              call.scheduledAt = this.getNextBusinessHour(campaign.businessHours);
              await call.save();
              continue;
            }
          }

          // Get template
          const template = conversationEngine.getTemplate(campaign?.trigger || 'cart_abandoned');

          // Interpolate template with context
          context = {
            ...context,
            customerName: context.customerName || 'there',
            storeName: context.storeName || 'our store'
          };
        }

        // Make the call
        const { callSid } = await voiceService.initiateCall(
          call.to,
          context,
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

        // Update call record
        call.twilioCallSid = callSid;
        call.status = 'ringing';
        await call.save();

        results.processed++;
        results.successful++;
      } catch (error) {
        call.status = 'failed';
        call.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await call.save();

        results.processed++;
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Get campaign execution stats
   */
  getExecutionStats(campaignId: string): CampaignExecutionStats | undefined {
    return this.executionStats[campaignId];
  }

  /**
   * Pause a running campaign
   */
  async pauseCampaign(campaignId: string): Promise<ICampaign | null> {
    return this.updateCampaignStatus(campaignId, CampaignStatus.PAUSED);
  }

  /**
   * Resume a paused campaign
   */
  async resumeCampaign(campaignId: string): Promise<ICampaign | null> {
    return this.updateCampaignStatus(campaignId, CampaignStatus.RUNNING);
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(campaignId: string): Promise<ICampaign | null> {
    // Cancel all pending calls for this campaign
    await CallModel.updateMany(
      {
        campaignId,
        status: { $in: ['initiated', 'ringing'] }
      },
      { $set: { status: 'cancelled' } }
    );

    return this.updateCampaignStatus(campaignId, CampaignStatus.CANCELLED);
  }

  /**
   * Get campaign call history
   */
  async getCampaignCalls(
    campaignId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
    } = {}
  ): Promise<{
    calls: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);

    const query: any = { campaignId };
    if (options.status) {
      query.status = options.status;
    }

    const [calls, total] = await Promise.all([
      CallModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('campaignId'),
      CallModel.countDocuments(query)
    ]);

    return { calls, total, page, limit };
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<any> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const [callStats, transcriptStats] = await Promise.all([
      voiceService.getCallStats(),
      this.getTranscriptStats(campaignId)
    ]);

    return {
      campaign: {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        trigger: campaign.trigger
      },
      callStats,
      transcriptStats,
      executionStats: this.executionStats[campaignId]
    };
  }

  /**
   * Get transcript statistics for a campaign
   */
  private async getTranscriptStats(campaignId: string): Promise<any> {
    const calls = await CallModel.find({ campaignId, transcriptId: { $exists: true } });
    const transcriptIds = calls.map(c => c.transcriptId).filter(Boolean);

    if (transcriptIds.length === 0) {
      return {
        totalTranscripts: 0,
        avgConfidence: 0,
        sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 }
      };
    }

    const { TranscriptModel } = await import('../models/Transcript');

    const aggregation = await TranscriptModel.aggregate([
      { $match: { _id: { $in: transcriptIds } } },
      {
        $group: {
          _id: null,
          totalTranscripts: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          positive: { $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] } },
          negative: { $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] } },
          neutral: { $sum: { $cond: [{ $eq: ['$sentiment', 'neutral'] }, 1, 0] } }
        }
      }
    ]);

    if (aggregation.length === 0) {
      return {
        totalTranscripts: 0,
        avgConfidence: 0,
        sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 }
      };
    }

    return {
      totalTranscripts: aggregation[0].totalTranscripts,
      avgConfidence: aggregation[0].avgConfidence || 0,
      sentimentBreakdown: {
        positive: aggregation[0].positive,
        negative: aggregation[0].negative,
        neutral: aggregation[0].neutral
      }
    };
  }

  /**
   * Schedule campaign based on trigger
   */
  async scheduleCampaign(
    campaignId: string,
    targets: TargetData[],
    trigger: CampaignTrigger
  ): Promise<void> {
    const delayMinutes = this.getTriggerDelay(trigger);

    for (const target of targets) {
      const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

      await CallModel.create({
        to: target.phone,
        from: '',
        status: 'initiated',
        campaignId,
        trigger,
        customerId: target.customerId,
        cartId: target.cartId,
        orderId: target.orderId,
        priority: this.getTriggerPriority(trigger),
        context: target.context,
        attempts: 0,
        maxAttempts: 3,
        scheduledAt
      });
    }
  }

  /**
   * Get delay in minutes for a trigger type
   */
  private getTriggerDelay(trigger: CampaignTrigger): number {
    const delays: Record<CampaignTrigger, number> = {
      [CampaignTrigger.CART_ABANDONED]: 60,      // 60 minutes
      [CampaignTrigger.COD_UNCONFIRMED]: 30,     // 30 minutes
      [CampaignTrigger.APPOINTMENT_REMINDER]: 1440, // 24 hours
      [CampaignTrigger.ORDER_DELAYED]: 5         // 5 minutes
    };
    return delays[trigger] || 60;
  }

  /**
   * Get priority for a trigger type
   */
  private getTriggerPriority(trigger: CampaignTrigger): CallPriority {
    const priorities: Record<CampaignTrigger, CallPriority> = {
      [CampaignTrigger.CART_ABANDONED]: CallPriority.HIGH,
      [CampaignTrigger.COD_UNCONFIRMED]: CallPriority.CRITICAL,
      [CampaignTrigger.APPOINTMENT_REMINDER]: CallPriority.MEDIUM,
      [CampaignTrigger.ORDER_DELAYED]: CallPriority.HIGH
    };
    return priorities[trigger] || CallPriority.MEDIUM;
  }
}

export const campaignService = new CampaignService();
