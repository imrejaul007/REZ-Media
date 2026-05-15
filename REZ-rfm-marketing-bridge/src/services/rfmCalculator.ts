import mongoose, { ClientSession } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { config } from '../config';
import {
  RFMScore,
  RFMCalculationRequest,
  SegmentType,
  CustomerSegment,
} from '../types';
import { RFMScoreModel, CustomerSegmentModel, OrderModel, CustomerModel } from '../models';

// Recency quintile boundaries based on days since last purchase
const RECENCY_QUINTILES = {
  1: { min: 0, max: 7 },    // Purchased within last week
  2: { min: 8, max: 14 },   // Purchased within last 2 weeks
  3: { min: 15, max: 30 },  // Purchased within last month
  4: { min: 31, max: 60 },  // Purchased within last 2 months
  5: { min: 61, max: Infinity }, // Purchased more than 2 months ago
};

// Frequency quintile boundaries based on number of purchases
const FREQUENCY_QUINTILES = {
  1: { min: 1, max: 1 },    // 1 purchase
  2: { min: 2, max: 2 },    // 2 purchases
  3: { min: 3, max: 4 },    // 3-4 purchases
  4: { min: 5, max: 7 },    // 5-7 purchases
  5: { min: 8, max: Infinity }, // 8+ purchases
};

// Monetary quintile boundaries based on average order value
const MONETARY_QUINTILES = {
  1: { min: 0, max: 100 },        // Low value
  2: { min: 101, max: 300 },      // Below average
  3: { min: 301, max: 500 },     // Average
  4: { min: 501, max: 1000 },    // Above average
  5: { min: 1001, max: Infinity }, // High value
};

export interface RFMQuintileBoundaries {
  recency: { daysMin: number; daysMax: number; score: number }[];
  frequency: { purchasesMin: number; purchasesMax: number; score: number }[];
  monetary: { valueMin: number; valueMax: number; score: number }[];
}

export interface RFMCalculationResult {
  customerId: string;
  businessId: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfmScore: number;
  segmentType: SegmentType;
  lastPurchaseDate: Date;
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
  calculatedAt: Date;
}

export class RFMCalculator {
  private quintileBoundaries: RFMQuintileBoundaries;

  constructor() {
    this.quintileBoundaries = this.calculateQuintileBoundaries();
  }

  /**
   * Calculate quintile boundaries based on actual data distribution
   */
  private calculateQuintileBoundaries(): RFMQuintileBoundaries {
    return {
      recency: [
        { daysMin: 0, daysMax: 7, score: 5 },
        { daysMin: 8, daysMax: 14, score: 4 },
        { daysMin: 15, daysMax: 30, score: 3 },
        { daysMin: 31, daysMax: 60, score: 2 },
        { daysMin: 61, daysMax: Infinity, score: 1 },
      ],
      frequency: [
        { purchasesMin: 1, purchasesMax: 1, score: 1 },
        { purchasesMin: 2, purchasesMax: 2, score: 2 },
        { purchasesMin: 3, purchasesMax: 4, score: 3 },
        { purchasesMin: 5, purchasesMax: 7, score: 4 },
        { purchasesMin: 8, purchasesMax: Infinity, score: 5 },
      ],
      monetary: [
        { valueMin: 0, valueMax: 100, score: 1 },
        { valueMin: 101, valueMax: 300, score: 2 },
        { valueMin: 301, valueMax: 500, score: 3 },
        { valueMin: 501, valueMax: 1000, score: 4 },
        { valueMin: 1001, valueMax: Infinity, score: 5 },
      ],
    };
  }

  /**
   * Get days since last purchase
   */
  private getDaysSinceLastPurchase(lastPurchaseDate: Date, referenceDate: Date): number {
    const diffTime = Math.abs(referenceDate.getTime() - lastPurchaseDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate recency score (5 = most recent, 1 = least recent)
   */
  private calculateRecencyScore(daysSincePurchase: number): number {
    const quintiles = this.quintileBoundaries.recency;

    for (const quintile of quintiles) {
      if (daysSincePurchase >= quintile.daysMin && daysSincePurchase <= quintile.daysMax) {
        return quintile.score;
      }
    }

    return 1; // Default to lowest score
  }

  /**
   * Calculate frequency score (1 = least frequent, 5 = most frequent)
   */
  private calculateFrequencyScore(totalPurchases: number): number {
    const quintiles = this.quintileBoundaries.frequency;

    for (const quintile of quintiles) {
      if (totalPurchases >= quintile.purchasesMin && totalPurchases <= quintile.purchasesMax) {
        return quintile.score;
      }
    }

    return 5; // Default to highest for frequent buyers
  }

  /**
   * Calculate monetary score (1 = lowest value, 5 = highest value)
   */
  private calculateMonetaryScore(averageOrderValue: number): number {
    const quintiles = this.quintileBoundaries.monetary;

    for (const quintile of quintiles) {
      if (averageOrderValue >= quintile.valueMin && averageOrderValue <= quintile.valueMax) {
        return quintile.score;
      }
    }

    return 1; // Default to lowest
  }

  /**
   * Calculate composite RFM score
   */
  private calculateRFMScore(recency: number, frequency: number, monetary: number): number {
    const { RECENCY_WEIGHT, FREQUENCY_WEIGHT, MONETARY_WEIGHT } = config.RFM;

    return Math.round(
      (recency * RECENCY_WEIGHT) +
      (frequency * FREQUENCY_WEIGHT) +
      (monetary * MONETARY_WEIGHT) * 5
    );
  }

  /**
   * Determine segment type based on RFM score
   */
  public determineSegmentType(rfmScore: number, recency: number, frequency: number, monetary: number): SegmentType {
    // Champions: Best customers (high R, F, M)
    if (rfmScore >= 13 && recency >= 4 && frequency >= 4 && monetary >= 4) {
      return SegmentType.CHAMPIONS;
    }

    // Loyal: Good customers with decent frequency
    if (rfmScore >= 11 && rfmScore <= 12 && frequency >= 3) {
      return SegmentType.LOYAL;
    }

    // Potential Loyalist: Decent customers with potential
    if (rfmScore >= 9 && rfmScore <= 10 && frequency >= 2) {
      return SegmentType.POTENTIAL_LOYALIST;
    }

    // Recent Customers: New but promising
    if (recency === 5 && frequency === 1 && monetary >= 2) {
      return SegmentType.RECENT_CUSTOMERS;
    }

    // Promising: Growing engagement
    if (recency >= 3 && recency <= 4 && frequency >= 2 && monetary >= 2) {
      return SegmentType.PROMISING;
    }

    // At Risk: Declining engagement
    if (recency <= 2 && frequency >= 2 && monetary >= 2) {
      return SegmentType.AT_RISK;
    }

    // Can't Lose Them: High value but haven't purchased recently
    if (recency === 1 && frequency >= 4 && monetary >= 4) {
      return SegmentType.CANT_LOSE_THEM;
    }

    // Lost: Haven't purchased in a long time
    if (recency === 1 && frequency <= 2) {
      return SegmentType.LOST;
    }

    // Hesitant: Low engagement across the board
    if (rfmScore <= 5) {
      return SegmentType.HESITANT;
    }

    // Default: New Loyal for promising customers
    return SegmentType.NEWPOLLOYAL;
  }

  /**
   * Calculate RFM scores for a single customer
   */
  public async calculateCustomerRFM(
    customerId: string,
    businessId: string,
    lookbackDays: number = 90,
    referenceDate: Date = new Date()
  ): Promise<RFMCalculationResult | null> {
    try {
      const startDate = new Date(referenceDate);
      startDate.setDate(startDate.getDate() - lookbackDays);

      // Get customer's orders within the lookback period
      const orders = await OrderModel.find({
        customerId,
        businessId,
        status: { $in: ['completed', 'delivered'] },
        createdAt: { $gte: startDate, $lte: referenceDate },
      }).sort({ createdAt: -1 });

      if (orders.length === 0) {
        logger.debug(`No orders found for customer ${customerId}`);
        return null;
      }

      const lastPurchaseDate = orders[0].createdAt;
      const totalPurchases = orders.length;
      const totalSpent = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const averageOrderValue = totalSpent / totalPurchases;

      const daysSincePurchase = this.getDaysSinceLastPurchase(lastPurchaseDate, referenceDate);
      const recency = this.calculateRecencyScore(daysSincePurchase);
      const frequency = this.calculateFrequencyScore(totalPurchases);
      const monetary = this.calculateMonetaryScore(averageOrderValue);
      const rfmScore = this.calculateRFMScore(recency, frequency, monetary);
      const segmentType = this.determineSegmentType(rfmScore, recency, frequency, monetary);

      const result: RFMCalculationResult = {
        customerId,
        businessId,
        recency,
        frequency,
        monetary,
        rfmScore,
        segmentType,
        lastPurchaseDate,
        totalPurchases,
        totalSpent,
        averageOrderValue,
        calculatedAt: referenceDate,
      };

      return result;
    } catch (error) {
      logger.error(`Error calculating RFM for customer ${customerId}`, { error });
      throw error;
    }
  }

  /**
   * Calculate RFM scores for multiple customers
   */
  public async calculateBulkRFM(
    request: RFMCalculationRequest
  ): Promise<{ results: RFMCalculationResult[]; errors: string[] }> {
    const { businessId, customerIds, lookbackDays, referenceDate } = request;
    const results: RFMCalculationResult[] = [];
    const errors: string[] = [];

    try {
      // If no customer IDs provided, get all customers for the business
      let targetCustomerIds = customerIds;

      if (!targetCustomerIds || targetCustomerIds.length === 0) {
        const customers = await CustomerModel.find({ businessId }).select('_id');
        targetCustomerIds = customers.map(c => c._id.toString());
      }

      logger.info(`Calculating RFM for ${targetCustomerIds.length} customers`, {
        businessId,
        lookbackDays,
      });

      const refDate = referenceDate || new Date();

      // Process in batches to avoid memory issues
      const batchSize = config.CAMPAIGNS.BATCH_SIZE;

      for (let i = 0; i < targetCustomerIds.length; i += batchSize) {
        const batch = targetCustomerIds.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
          batch.map(customerId =>
            this.calculateCustomerRFM(customerId, businessId, lookbackDays || 90, refDate)
          )
        );

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          } else if (result.status === 'rejected') {
            errors.push(`Customer ${batch[index]}: ${result.reason}`);
          } else if (result.status === 'fulfilled' && !result.value) {
            errors.push(`Customer ${batch[index]}: No order data`);
          }
        });

        logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(targetCustomerIds.length / batchSize)}`);
      }

      // Save results to database
      await this.saveRFMScores(results);

      logger.info(`RFM calculation completed: ${results.length} successful, ${errors.length} errors`);

      return { results, errors };
    } catch (error) {
      logger.error('Error in bulk RFM calculation', { error, businessId });
      throw error;
    }
  }

  /**
   * Save RFM scores to database
   */
  private async saveRFMScores(scores: RFMCalculationResult[]): Promise<void> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      for (const score of scores) {
        // Upsert RFM score
        await RFMScoreModel.findOneAndUpdate(
          {
            customerId: score.customerId,
            businessId: score.businessId,
          },
          {
            $set: {
              recency: score.recency,
              frequency: score.frequency,
              monetary: score.monetary,
              rfmScore: score.rfmScore,
              lastPurchaseDate: score.lastPurchaseDate,
              totalPurchases: score.totalPurchases,
              totalSpent: score.totalSpent,
              averageOrderValue: score.averageOrderValue,
              calculatedAt: score.calculatedAt,
            },
          },
          { upsert: true, session }
        );

        // Update or create customer segment
        const previousSegment = await CustomerSegmentModel.findOne({
          customerId: score.customerId,
          businessId: score.businessId,
        }).session(session);

        const previousSegmentType = previousSegment?.segmentType;

        await CustomerSegmentModel.findOneAndUpdate(
          {
            customerId: score.customerId,
            businessId: score.businessId,
          },
          {
            $set: {
              segmentId: score.segmentType, // Using segment type as segmentId
              segmentType: score.segmentType,
              previousSegmentType: previousSegmentType !== score.segmentType ? previousSegmentType : undefined,
              transitionReason: previousSegmentType !== score.segmentType
                ? `RFM recalculation: ${previousSegmentType} -> ${score.segmentType}`
                : undefined,
              rfmScore: {
                recency: score.recency,
                frequency: score.frequency,
                monetary: score.monetary,
              },
              assignedAt: new Date(),
            },
            $setOnInsert: {
              customerId: score.customerId,
              businessId: score.businessId,
            },
          },
          { upsert: true, session }
        );
      }

      await session.commitTransaction();
      logger.info(`Saved ${scores.length} RFM scores to database`);
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error saving RFM scores', { error });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get RFM scores for a business
   */
  public async getRFMScores(
    businessId: string,
    options: {
      limit?: number;
      offset?: number;
      segmentType?: SegmentType;
      sortBy?: 'rfmScore' | 'recency' | 'frequency' | 'monetary';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ scores: RFMScore[]; total: number }> {
    const {
      limit = 100,
      offset = 0,
      segmentType,
      sortBy = 'rfmScore',
      sortOrder = 'desc',
    } = options;

    const query: any = { businessId };

    if (segmentType) {
      query.segmentType = segmentType;
    }

    const [scores, total] = await Promise.all([
      RFMScoreModel.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(offset)
        .limit(limit),
      RFMScoreModel.countDocuments(query),
    ]);

    return { scores: scores.map(s => s.toObject() as RFMScore), total };
  }

  /**
   * Get customer RFM score
   */
  public async getCustomerRFMScore(
    customerId: string,
    businessId: string
  ): Promise<RFMScore | null> {
    const score = await RFMScoreModel.findOne({ customerId, businessId });
    return score ? (score.toObject() as RFMScore) : null;
  }

  /**
   * Get segment distribution for a business
   */
  public async getSegmentDistribution(
    businessId: string
  ): Promise<{ segmentType: SegmentType; count: number; percentage: number }[]> {
    const distribution = await CustomerSegmentModel.aggregate([
      { $match: { businessId } },
      { $group: { _id: '$segmentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = distribution.reduce((sum, d) => sum + d.count, 0);

    return distribution.map(d => ({
      segmentType: d._id as SegmentType,
      count: d.count,
      percentage: total > 0 ? Math.round((d.count / total) * 100 * 100) / 100 : 0,
    }));
  }

  /**
   * Get RFM statistics for a business
   */
  public async getRFMStatistics(businessId: string): Promise<{
    averageRFM: number;
    averageRecency: number;
    averageFrequency: number;
    averageMonetary: number;
    totalCustomers: number;
    totalRevenue: number;
    segmentDistribution: { segmentType: SegmentType; count: number; percentage: number }[];
  }> {
    const [stats, distribution] = await Promise.all([
      RFMScoreModel.aggregate([
        { $match: { businessId } },
        {
          $group: {
            _id: null,
            avgRFM: { $avg: '$rfmScore' },
            avgRecency: { $avg: '$recency' },
            avgFrequency: { $avg: '$frequency' },
            avgMonetary: { $avg: '$monetary' },
            totalCustomers: { $sum: 1 },
            totalRevenue: { $sum: '$totalSpent' },
          },
        },
      ]),
      this.getSegmentDistribution(businessId),
    ]);

    const result = stats[0] || {
      avgRFM: 0,
      avgRecency: 0,
      avgFrequency: 0,
      avgMonetary: 0,
      totalCustomers: 0,
      totalRevenue: 0,
    };

    return {
      averageRFM: Math.round(result.avgRFM * 100) / 100,
      averageRecency: Math.round(result.avgRecency * 100) / 100,
      averageFrequency: Math.round(result.avgFrequency * 100) / 100,
      averageMonetary: Math.round(result.avgMonetary * 100) / 100,
      totalCustomers: result.totalCustomers,
      totalRevenue: result.totalRevenue,
      segmentDistribution: distribution,
    };
  }
}

export const rfmCalculator = new RFMCalculator();
export default rfmCalculator;
