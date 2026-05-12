import { v4 as uuidv4 } from 'uuid';
import { Conversion, IConversion, ConversionType, ConversionStatus } from '../models/Conversion';
import logger from '../utils/logger';

// Type for lean query results
type LeanConversion = Omit<IConversion, 'save' | 'delete' | 'validate'>;

export interface CreateConversionDTO {
  userId: string;
  sessionId: string;
  type: ConversionType;
  merchantId: string;
  storeId?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  items?: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    category?: string;
  }>;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  metadata?: Record<string, unknown>;
  conversionTimestamp?: Date;
}

export interface ConversionQueryOptions {
  userId?: string;
  merchantId?: string;
  storeId?: string;
  type?: ConversionType;
  status?: ConversionStatus;
  startDate?: Date;
  endDate?: Date;
  minValue?: number;
  maxValue?: number;
  limit?: number;
  skip?: number;
}

export interface ConversionStats {
  totalConversions: number;
  totalValue: number;
  averageValue: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  uniqueUsers: number;
  conversionRate?: number;
}

export class ConversionTracker {
  /**
   * Create a new conversion
   */
  async createConversion(data: CreateConversionDTO): Promise<IConversion> {
    const conversionId = uuidv4();
    const conversionTimestamp = data.conversionTimestamp || new Date();

    const conversion = new Conversion({
      id: conversionId,
      userId: data.userId,
      sessionId: data.sessionId,
      type: data.type,
      status: ConversionStatus.COMPLETED,
      merchantId: data.merchantId,
      storeId: data.storeId,
      orderId: data.orderId,
      value: data.value || 0,
      currency: data.currency || 'USD',
      items: data.items,
      location: data.location,
      metadata: data.metadata || {},
      conversionTimestamp
    });

    await conversion.save();

    logger.info('Conversion created', {
      conversionId,
      userId: data.userId,
      type: data.type,
      value: data.value
    });

    return conversion;
  }

  /**
   * Get conversion by ID
   */
  async getConversion(conversionId: string): Promise<LeanConversion | null> {
    const result = await Conversion.findOne({ id: conversionId }).lean();
    return result as unknown as LeanConversion | null;
  }

  /**
   * Get conversions with filtering options
   */
  async getConversions(options: ConversionQueryOptions): Promise<{
    conversions: LeanConversion[];
    total: number;
  }> {
    const filter: Record<string, unknown> = {};

    if (options.userId) filter.userId = options.userId;
    if (options.merchantId) filter.merchantId = options.merchantId;
    if (options.storeId) filter.storeId = options.storeId;
    if (options.type) filter.type = options.type;
    if (options.status) filter.status = options.status;

    if (options.startDate || options.endDate) {
      filter.conversionTimestamp = {};
      if (options.startDate) {
        (filter.conversionTimestamp as Record<string, Date>).$gte = options.startDate;
      }
      if (options.endDate) {
        (filter.conversionTimestamp as Record<string, Date>).$lte = options.endDate;
      }
    }

    if (options.minValue !== undefined || options.maxValue !== undefined) {
      filter.value = {};
      if (options.minValue !== undefined) {
        (filter.value as Record<string, number>).$gte = options.minValue;
      }
      if (options.maxValue !== undefined) {
        (filter.value as Record<string, number>).$lte = options.maxValue;
      }
    }

    const limit = options.limit || 100;
    const skip = options.skip || 0;

    const [conversions, total] = await Promise.all([
      Conversion.find(filter)
        .sort({ conversionTimestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Conversion.countDocuments(filter)
    ]);

    return { conversions: conversions as unknown as LeanConversion[], total };
  }

  /**
   * Get conversions for a user
   */
  async getUserConversions(userId: string): Promise<LeanConversion[]> {
    const result = await Conversion.find({ userId })
      .sort({ conversionTimestamp: -1 })
      .lean();
    return result as unknown as LeanConversion[];
  }

  /**
   * Get conversions by merchant
   */
  async getMerchantConversions(
    merchantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LeanConversion[]> {
    const filter: Record<string, unknown> = { merchantId };

    if (startDate || endDate) {
      filter.conversionTimestamp = {};
      if (startDate) {
        (filter.conversionTimestamp as Record<string, Date>).$gte = startDate;
      }
      if (endDate) {
        (filter.conversionTimestamp as Record<string, Date>).$lte = endDate;
      }
    }

    const result = await Conversion.find(filter)
      .sort({ conversionTimestamp: -1 })
      .lean();
    return result as unknown as LeanConversion[];
  }

  /**
   * Update conversion status
   */
  async updateConversionStatus(
    conversionId: string,
    status: ConversionStatus
  ): Promise<LeanConversion | null> {
    const conversion = await Conversion.findOneAndUpdate(
      { id: conversionId },
      { status },
      { new: true }
    ).lean();

    if (conversion) {
      logger.info('Conversion status updated', {
        conversionId,
        newStatus: status
      });
    }

    return conversion as unknown as LeanConversion | null;
  }

  /**
   * Add attribution data to a conversion
   */
  async addAttributionData(
    conversionId: string,
    attributionData: {
      touchpointIds: string[];
      attributionModel: string;
      attributedChannel: string;
      attributedCampaignId?: string;
    }
  ): Promise<LeanConversion | null> {
    const conversion = await Conversion.findOneAndUpdate(
      { id: conversionId },
      { attributionData },
      { new: true }
    ).lean();

    if (conversion) {
      logger.info('Attribution data added to conversion', {
        conversionId,
        attributionModel: attributionData.attributionModel
      });
    }

    return conversion as unknown as LeanConversion | null;
  }

  /**
   * Get conversion statistics
   */
  async getConversionStats(
    merchantId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ConversionStats> {
    const filter: Record<string, unknown> = {};

    if (merchantId) filter.merchantId = merchantId;

    if (startDate || endDate) {
      filter.conversionTimestamp = {};
      if (startDate) {
        (filter.conversionTimestamp as Record<string, Date>).$gte = startDate;
      }
      if (endDate) {
        (filter.conversionTimestamp as Record<string, Date>).$lte = endDate;
      }
    }

    const conversions = await Conversion.find(filter).lean();

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalValue = 0;
    const uniqueUsers = new Set<string>();

    for (const conv of conversions) {
      byStatus[conv.status] = (byStatus[conv.status] || 0) + 1;
      byType[conv.type] = (byType[conv.type] || 0) + 1;
      totalValue += conv.value || 0;
      uniqueUsers.add(conv.userId);
    }

    return {
      totalConversions: conversions.length,
      totalValue,
      averageValue: conversions.length > 0 ? totalValue / conversions.length : 0,
      byStatus,
      byType,
      uniqueUsers: uniqueUsers.size
    };
  }

  /**
   * Get recent conversions for a merchant
   */
  async getRecentConversions(
    merchantId: string,
    limit: number = 10
  ): Promise<LeanConversion[]> {
    const result = await Conversion.find({ merchantId })
      .sort({ conversionTimestamp: -1 })
      .limit(limit)
      .lean();
    return result as unknown as LeanConversion[];
  }

  /**
   * Delete conversion by ID
   */
  async deleteConversion(conversionId: string): Promise<boolean> {
    const result = await Conversion.deleteOne({ id: conversionId });
    return result.deletedCount > 0;
  }

  /**
   * Batch create conversions
   */
  async createConversionsBatch(data: CreateConversionDTO[]): Promise<LeanConversion[]> {
    const conversions = data.map(item => {
      const conversionId = uuidv4();
      const conversionTimestamp = item.conversionTimestamp || new Date();
      return {
        id: conversionId,
        userId: item.userId,
        sessionId: item.sessionId,
        type: item.type,
        status: ConversionStatus.COMPLETED,
        merchantId: item.merchantId,
        storeId: item.storeId,
        orderId: item.orderId,
        value: item.value || 0,
        currency: item.currency || 'USD',
        items: item.items,
        location: item.location,
        metadata: item.metadata || {},
        conversionTimestamp
      };
    });

    await Conversion.insertMany(conversions);

    logger.info('Batch conversions created', { count: conversions.length });

    return conversions as unknown as LeanConversion[];
  }

  /**
   * Get conversions by order ID
   */
  async getConversionsByOrderId(orderId: string): Promise<LeanConversion[]> {
    const result = await Conversion.find({ orderId }).lean();
    return result as unknown as LeanConversion[];
  }

  /**
   * Track refund
   */
  async processRefund(conversionId: string): Promise<LeanConversion | null> {
    const conversion = await Conversion.findOneAndUpdate(
      { id: conversionId },
      { status: ConversionStatus.REFUNDED },
      { new: true }
    ).lean();

    if (conversion) {
      logger.info('Conversion refunded', {
        conversionId,
        originalValue: conversion.value
      });
    }

    return conversion as unknown as LeanConversion | null;
  }
}

export const conversionTracker = new ConversionTracker();
