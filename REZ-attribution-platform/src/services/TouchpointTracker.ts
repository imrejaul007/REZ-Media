import { v4 as uuidv4 } from 'uuid';
import { Touchpoint, ITouchpoint, TouchpointType, Channel } from '../models/Touchpoint';
import logger from '../utils/logger';

// Type for lean query results
type LeanTouchpoint = Omit<ITouchpoint, 'save' | 'delete' | 'validate'>;

export interface CreateTouchpointDTO {
  userId: string;
  sessionId: string;
  type: TouchpointType;
  channel: Channel;
  campaignId?: string;
  adId?: string;
  creativeId?: string;
  merchantId?: string;
  storeId?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface TouchpointQueryOptions {
  userId?: string;
  merchantId?: string;
  campaignId?: string;
  storeId?: string;
  channel?: Channel;
  type?: TouchpointType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
}

export class TouchpointTracker {
  /**
   * Create a new touchpoint
   */
  async createTouchpoint(data: CreateTouchpointDTO): Promise<ITouchpoint> {
    const touchpointId = uuidv4();
    const timestamp = data.timestamp || new Date();

    const touchpoint = new Touchpoint({
      id: touchpointId,
      userId: data.userId,
      sessionId: data.sessionId,
      type: data.type,
      channel: data.channel,
      campaignId: data.campaignId,
      adId: data.adId,
      creativeId: data.creativeId,
      merchantId: data.merchantId,
      storeId: data.storeId,
      location: data.location,
      deviceFingerprint: data.deviceFingerprint,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata || {},
      timestamp
    });

    await touchpoint.save();

    logger.info('Touchpoint created', {
      touchpointId,
      userId: data.userId,
      type: data.type,
      channel: data.channel
    });

    return touchpoint;
  }

  /**
   * Get touchpoints with filtering options
   */
  async getTouchpoints(options: TouchpointQueryOptions): Promise<{
    touchpoints: LeanTouchpoint[];
    total: number;
  }> {
    const filter: Record<string, unknown> = {};

    if (options.userId) filter.userId = options.userId;
    if (options.merchantId) filter.merchantId = options.merchantId;
    if (options.campaignId) filter.campaignId = options.campaignId;
    if (options.storeId) filter.storeId = options.storeId;
    if (options.channel) filter.channel = options.channel;
    if (options.type) filter.type = options.type;

    if (options.startDate || options.endDate) {
      filter.timestamp = {};
      if (options.startDate) {
        (filter.timestamp as Record<string, Date>).$gte = options.startDate;
      }
      if (options.endDate) {
        (filter.timestamp as Record<string, Date>).$lte = options.endDate;
      }
    }

    const limit = options.limit || 100;
    const skip = options.skip || 0;

    const [touchpoints, total] = await Promise.all([
      Touchpoint.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Touchpoint.countDocuments(filter)
    ]);

    return { touchpoints: touchpoints as unknown as LeanTouchpoint[], total };
  }

  /**
   * Get touchpoints for a user within a time window (for attribution)
   */
  async getUserTouchpointsForAttribution(
    userId: string,
    conversionTimestamp: Date,
    lookbackDays: number
  ): Promise<LeanTouchpoint[]> {
    const startDate = new Date(conversionTimestamp);
    startDate.setDate(startDate.getDate() - lookbackDays);

    const touchpoints = await Touchpoint.find({
      userId,
      timestamp: {
        $gte: startDate,
        $lte: conversionTimestamp
      }
    })
      .sort({ timestamp: 1 })
      .lean();

    return touchpoints as unknown as LeanTouchpoint[];
  }

  /**
   * Get touchpoints by campaign
   */
  async getCampaignTouchpoints(
    campaignId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LeanTouchpoint[]> {
    const filter: Record<string, unknown> = { campaignId };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        (filter.timestamp as Record<string, Date>).$gte = startDate;
      }
      if (endDate) {
        (filter.timestamp as Record<string, Date>).$lte = endDate;
      }
    }

    const touchpoints = await Touchpoint.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    return touchpoints as unknown as LeanTouchpoint[];
  }

  /**
   * Get touchpoints by merchant
   */
  async getMerchantTouchpoints(
    merchantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LeanTouchpoint[]> {
    const filter: Record<string, unknown> = { merchantId };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        (filter.timestamp as Record<string, Date>).$gte = startDate;
      }
      if (endDate) {
        (filter.timestamp as Record<string, Date>).$lte = endDate;
      }
    }

    const touchpoints = await Touchpoint.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    return touchpoints as unknown as LeanTouchpoint[];
  }

  /**
   * Get unique user count for a campaign
   */
  async getCampaignUniqueUsers(
    campaignId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const filter: Record<string, unknown> = { campaignId };

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        (filter.timestamp as Record<string, Date>).$gte = startDate;
      }
      if (endDate) {
        (filter.timestamp as Record<string, Date>).$lte = endDate;
      }
    }

    return Touchpoint.distinct('userId', filter).then(users => users.length);
  }

  /**
   * Get touchpoint statistics
   */
  async getTouchpointStats(
    merchantId?: string,
    campaignId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    byChannel: Record<string, number>;
    byType: Record<string, number>;
    uniqueUsers: number;
  }> {
    const filter: Record<string, unknown> = {};

    if (merchantId) filter.merchantId = merchantId;
    if (campaignId) filter.campaignId = campaignId;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        (filter.timestamp as Record<string, Date>).$gte = startDate;
      }
      if (endDate) {
        (filter.timestamp as Record<string, Date>).$lte = endDate;
      }
    }

    const [touchpoints, uniqueUsers] = await Promise.all([
      Touchpoint.find(filter).lean(),
      Touchpoint.distinct('userId', filter)
    ]);

    const byChannel: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const tp of touchpoints) {
      byChannel[tp.channel] = (byChannel[tp.channel] || 0) + 1;
      byType[tp.type] = (byType[tp.type] || 0) + 1;
    }

    return {
      total: touchpoints.length,
      byChannel,
      byType,
      uniqueUsers: uniqueUsers.length
    };
  }

  /**
   * Delete touchpoint by ID
   */
  async deleteTouchpoint(touchpointId: string): Promise<boolean> {
    const result = await Touchpoint.deleteOne({ id: touchpointId });
    return result.deletedCount > 0;
  }

  /**
   * Batch create touchpoints for efficiency
   */
  async createTouchpointsBatch(data: CreateTouchpointDTO[]): Promise<ITouchpoint[]> {
    const touchpoints = data.map(item => {
      const touchpointId = uuidv4();
      const timestamp = item.timestamp || new Date();
      return {
        id: touchpointId,
        userId: item.userId,
        sessionId: item.sessionId,
        type: item.type,
        channel: item.channel,
        campaignId: item.campaignId,
        adId: item.adId,
        creativeId: item.creativeId,
        merchantId: item.merchantId,
        storeId: item.storeId,
        location: item.location,
        deviceFingerprint: item.deviceFingerprint,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        metadata: item.metadata || {},
        timestamp
      };
    });

    await Touchpoint.insertMany(touchpoints);

    logger.info('Batch touchpoints created', { count: touchpoints.length });

    return touchpoints as unknown as ITouchpoint[];
  }
}

export const touchpointTracker = new TouchpointTracker();
