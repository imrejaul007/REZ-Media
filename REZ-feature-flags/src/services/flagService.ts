import mongoose, { Schema, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { FeatureFlag, UserContext, FlagEvaluation, Variation, FlagAnalyticsEvent, FlagStats } from '../types/flag';

// MongoDB Schema
const TargetRuleSchema = new Schema({
  attribute: { type: String, required: true },
  operator: { type: String, enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'regex'], required: true },
  value: { type: Schema.Types.Mixed, required: true },
}, { _id: false });

const VariationSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  weight: { type: Number, default: 0, min: 0, max: 100 },
}, { _id: false });

const TargetingRuleSchema = new Schema({
  id: { type: String, required: true },
  priority: { type: Number, default: 0 },
  conditions: [TargetRuleSchema],
  variationId: { type: String, required: true },
}, { _id: false });

const PercentageRolloutSchema = new Schema({
  enabled: { type: Boolean, default: false },
  percentage: { type: Number, default: 0, min: 0, max: 100 },
  seed: { type: String },
}, { _id: false });

const FeatureFlagSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  environment: { type: String, enum: ['development', 'staging', 'production'], default: 'production', index: true },
  variations: [VariationSchema],
  defaultVariation: { type: String, required: true },
  targeting: {
    enabled: { type: Boolean, default: false },
    rules: [TargetingRuleSchema],
  },
  percentageRollout: PercentageRolloutSchema,
  tags: [{ type: String }],
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Analytics Schema
const AnalyticsEventSchema = new Schema({
  flagKey: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  variationId: { type: String },
  enabled: { type: Boolean, required: true },
  reason: { type: String, required: true },
  environment: { type: String, required: true, index: true },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true },
});

// Stats Schema for aggregated data
const FlagStatsSchema = new Schema({
  flagKey: { type: String, required: true, unique: true },
  environment: { type: String, required: true },
  totalEvaluations: { type: Number, default: 0 },
  enabledCount: { type: Number, default: 0 },
  disabledCount: { type: Number, default: 0 },
  variations: { type: Map, of: Number, default: {} },
  last24hEvaluations: { type: Number, default: 0 },
  last7dEvaluations: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

interface IFeatureFlagDocument extends Document, FeatureFlag {}
interface IAnalyticsEventDocument extends Document, FlagAnalyticsEvent {}
interface IFlagStatsDocument extends Document, FlagStats {}

const FeatureFlagModel: Model<IFeatureFlagDocument> = mongoose.model<IFeatureFlagDocument>('FeatureFlag', FeatureFlagSchema);
const AnalyticsEventModel: Model<IAnalyticsEventDocument> = mongoose.model<IAnalyticsEventDocument>('AnalyticsEvent', AnalyticsEventSchema);
const FlagStatsModel: Model<IFlagStatsDocument> = mongoose.model<IFlagStatsDocument>('FlagStats', FlagStatsSchema);

export class FlagService {
  private redisClient: any = null;
  private cacheTTL: number = 60; // seconds

  constructor(redisClient?: any) {
    this.redisClient = redisClient;
  }

  // Hash function for consistent percentage assignment
  private hashUser(userId: string, flagKey: string, seed?: string): number {
    const input = `${userId}:${flagKey}:${seed || 'default'}`;
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    const numericHash = parseInt(hash.substring(0, 8), 16);
    return (numericHash % 10000) / 100; // Returns 0-100
  }

  // Evaluate targeting rules
  private evaluateConditions(conditions: any[], attributes: Record<string, unknown>): boolean {
    return conditions.every(condition => {
      const userValue = attributes[condition.attribute];
      if (userValue === undefined) return false;

      switch (condition.operator) {
        case 'eq':
          return userValue === condition.value;
        case 'neq':
          return userValue !== condition.value;
        case 'gt':
          return typeof userValue === 'number' && typeof condition.value === 'number' && userValue > condition.value;
        case 'gte':
          return typeof userValue === 'number' && typeof condition.value === 'number' && userValue >= condition.value;
        case 'lt':
          return typeof userValue === 'number' && typeof condition.value === 'number' && userValue < condition.value;
        case 'lte':
          return typeof userValue === 'number' && typeof condition.value === 'number' && userValue <= condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(userValue);
        case 'nin':
          return Array.isArray(condition.value) && !condition.value.includes(userValue);
        case 'contains':
          return typeof userValue === 'string' && userValue.includes(condition.value);
        case 'regex':
          try {
            const regex = new RegExp(condition.value as string);
            return typeof userValue === 'string' && regex.test(userValue);
          } catch {
            return false;
          }
        default:
          return false;
      }
    });
  }

  // Find matching variation for targeting rules
  private findTargetingVariation(flag: FeatureFlag, attributes: Record<string, unknown>): Variation | null {
    if (!flag.targeting.enabled || !flag.targeting.rules.length) {
      return null;
    }

    // Sort rules by priority (lower priority number = higher priority)
    const sortedRules = [...flag.targeting.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.evaluateConditions(rule.conditions, attributes)) {
        return flag.variations.find(v => v.id === rule.variationId) || null;
      }
    }

    return null;
  }

  // Determine variation by percentage rollout
  private evaluatePercentageRollout(flag: FeatureFlag, userId: string): boolean {
    if (!flag.percentageRollout.enabled) {
      return true; // All users get the feature if rollout is disabled
    }

    const hash = this.hashUser(userId, flag.key, flag.percentageRollout.seed);
    return hash < flag.percentageRollout.percentage;
  }

  // Main evaluation method
  async evaluateFlag(
    flagKey: string,
    userContext: UserContext,
    environment: string = 'production'
  ): Promise<FlagEvaluation> {
    try {
      // Try to get from cache first
      const cacheKey = `flag:${environment}:${flagKey}`;
      let flag = await this.getFromCache(cacheKey);

      if (!flag) {
        const flagDoc = await FeatureFlagModel.findOne({ key: flagKey, environment });
        if (!flagDoc) {
          return {
            flagKey,
            enabled: false,
            variation: null,
            reason: 'error',
            reasonDetails: 'Flag not found',
          };
        }
        flag = flagDoc.toObject() as FeatureFlag;
        await this.setCache(cacheKey, flag);
      }

      // Check if flag is disabled
      if (!flag.enabled) {
        const defaultVariation = flag.variations.find(v => v.id === flag.defaultVariation);
        return {
          flagKey,
          enabled: false,
          variation: defaultVariation || null,
          reason: 'disabled',
        };
      }

      // Evaluate targeting rules first (highest priority)
      const attributes = userContext.attributes || {};
      const targetingVariation = this.findTargetingVariation(flag, attributes);

      if (targetingVariation) {
        // Log analytics event
        await this.logAnalytics(flag, userContext, targetingVariation, true, 'targeting');
        return {
          flagKey,
          enabled: true,
          variation: targetingVariation,
          reason: 'targeting',
        };
      }

      // Evaluate percentage rollout
      const inRollout = this.evaluatePercentageRollout(flag, userContext.id);
      if (!inRollout) {
        const defaultVariation = flag.variations.find(v => v.id === flag.defaultVariation);
        await this.logAnalytics(flag, userContext, defaultVariation || null, false, 'percentage');
        return {
          flagKey,
          enabled: false,
          variation: defaultVariation || null,
          reason: 'percentage',
        };
      }

      // Return default variation
      const defaultVariation = flag.variations.find(v => v.id === flag.defaultVariation);
      await this.logAnalytics(flag, userContext, defaultVariation || null, true, 'default');
      return {
        flagKey,
        enabled: true,
        variation: defaultVariation || null,
        reason: 'default',
      };
    } catch (error) {
      console.error(`Error evaluating flag ${flagKey}:`, error);
      return {
        flagKey,
        enabled: false,
        variation: null,
        reason: 'error',
        reasonDetails: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Log analytics event
  private async logAnalytics(
    flag: FeatureFlag,
    userContext: UserContext,
    variation: Variation | null,
    enabled: boolean,
    reason: string
  ): Promise<void> {
    try {
      const event: FlagAnalyticsEvent = {
        flagKey: flag.key,
        userId: userContext.id,
        variationId: variation?.id || null,
        enabled,
        reason,
        timestamp: new Date(),
        environment: flag.environment,
      };

      // Insert analytics event
      await AnalyticsEventModel.create(event);

      // Update aggregated stats
      await FlagStatsModel.findOneAndUpdate(
        { flagKey: flag.key, environment: flag.environment },
        {
          $inc: {
            totalEvaluations: 1,
            enabledCount: enabled ? 1 : 0,
            disabledCount: enabled ? 0 : 1,
            ...(variation ? { [`variations.${variation.id}`]: 1 } : {}),
            last24hEvaluations: 1,
            last7dEvaluations: 1,
          },
          $set: { lastUpdated: new Date() },
        },
        { upsert: true }
      );
    } catch (error) {
      // Analytics should not break flag evaluation
      console.error('Failed to log analytics:', error);
    }
  }

  // Batch evaluate multiple flags
  async evaluateFlags(
    flagKeys: string[],
    userContext: UserContext,
    environment: string = 'production'
  ): Promise<Record<string, FlagEvaluation>> {
    const results: Record<string, FlagEvaluation> = {};

    await Promise.all(
      flagKeys.map(async (key) => {
        results[key] = await this.evaluateFlag(key, userContext, environment);
      })
    );

    return results;
  }

  // CRUD Operations

  async createFlag(flagData: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const flag = await FeatureFlagModel.create({
      ...flagData,
      key: flagData.key || uuidv4(),
    });
    await this.invalidateCache(flagData.environment || 'production', flagData.key || '');
    return flag.toObject() as FeatureFlag;
  }

  async getFlag(key: string, environment?: string): Promise<FeatureFlag | null> {
    const query: any = { key };
    if (environment) {
      query.environment = environment;
    }
    const flag = await FeatureFlagModel.findOne(query);
    return flag ? (flag.toObject() as FeatureFlag) : null;
  }

  async getAllFlags(environment?: string, tags?: string[]): Promise<FeatureFlag[]> {
    const query: any = {};
    if (environment) {
      query.environment = environment;
    }
    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }
    const flags = await FeatureFlagModel.find(query).sort({ key: 1 });
    return flags.map(f => f.toObject() as FeatureFlag);
  }

  async updateFlag(key: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
    const flag = await FeatureFlagModel.findOneAndUpdate(
      { key },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );
    if (flag) {
      await this.invalidateCache(flag.environment, key);
    }
    return flag ? (flag.toObject() as FeatureFlag) : null;
  }

  async deleteFlag(key: string): Promise<boolean> {
    const result = await FeatureFlagModel.deleteOne({ key });
    if (result.deletedCount > 0) {
      await this.invalidateCache('production', key);
      await this.invalidateCache('staging', key);
      await this.invalidateCache('development', key);
      return true;
    }
    return false;
  }

  async toggleFlag(key: string, enabled: boolean): Promise<FeatureFlag | null> {
    return this.updateFlag(key, { enabled });
  }

  // Analytics

  async getFlagAnalytics(
    flagKey: string,
    environment: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<FlagAnalyticsEvent[]> {
    const query: any = { flagKey, environment };
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }
    return AnalyticsEventModel.find(query).sort({ timestamp: -1 }).limit(1000);
  }

  async getFlagStats(flagKey: string, environment: string): Promise<FlagStats | null> {
    const stats = await FlagStatsModel.findOne({ flagKey, environment });
    return stats ? (stats.toObject() as FlagStats) : null;
  }

  async getAllStats(environment?: string): Promise<FlagStats[]> {
    const query: any = {};
    if (environment) {
      query.environment = environment;
    }
    return FlagStatsModel.find(query);
  }

  // Bulk operations

  async bulkCreateFlags(flags: Partial<FeatureFlag>[]): Promise<FeatureFlag[]> {
    const created = await FeatureFlagModel.insertMany(
      flags.map(f => ({
        ...f,
        key: f.key || uuidv4(),
      }))
    );
    return created.map(f => f.toObject() as FeatureFlag);
  }

  async copyFlags(
    fromEnvironment: string,
    toEnvironment: string,
    flagKeys?: string[]
  ): Promise<FeatureFlag[]> {
    const query: any = { environment: fromEnvironment };
    if (flagKeys) {
      query.key = { $in: flagKeys };
    }

    const flags = await FeatureFlagModel.find(query);
    const copied = await FeatureFlagModel.insertMany(
      flags.map(f => ({
        ...f.toObject(),
        _id: undefined,
        environment: toEnvironment,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );

    return copied.map(f => f.toObject() as FeatureFlag);
  }

  // Cache methods

  private async getFromCache(key: string): Promise<FeatureFlag | null> {
    if (!this.redisClient) return null;
    try {
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  private async setCache(key: string, value: FeatureFlag): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.setEx(key, this.cacheTTL, JSON.stringify(value));
    } catch {
      // Cache failures should not break the service
    }
  }

  private async invalidateCache(environment: string, key: string): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.del(`flag:${environment}:${key}`);
    } catch {
      // Cache failures should not break the service
    }
  }

  // Cleanup old analytics data
  async cleanupOldAnalytics(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await AnalyticsEventModel.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    return result.deletedCount;
  }
}

export default FlagService;
