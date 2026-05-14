import { v4 as uuidv4 } from 'uuid';
import {
  Experiment,
  ConversionEvent,
  ImpressionEvent,
  IExperimentDocument,
} from '../models/Experiment';
import {
  CreateExperimentDTO,
  UpdateExperimentDTO,
  AddVariantDTO,
  TrackEventDTO,
  IVariant,
  IVariantStats,
  ExperimentResults,
  ExperimentStatus,
  PrimaryMetric,
} from '../types';
import { Allocator, AllocationResult } from './allocator';
import { StatsEngine, RevenueImpact } from './statsEngine';

/**
 * Service for managing A/B experiments
 */
export class ExperimentService {
  /**
   * Create a new experiment
   */
  static async createExperiment(dto: CreateExperimentDTO): Promise<IExperimentDocument> {
    // Generate variant IDs
    const variants: IVariant[] = dto.variants.map((v, index) => ({
      id: uuidv4(),
      name: v.name,
      description: v.description,
      weight: v.weight,
      isControl: v.isControl ?? index === 0,
      metadata: v.metadata,
    }));

    // Validate weights
    const weightValidation = Allocator.validateWeights(variants);
    if (!weightValidation.valid) {
      throw new Error(weightValidation.error);
    }

    // Create experiment document
    const experiment = new Experiment({
      name: dto.name,
      description: dto.description,
      type: dto.type ?? 'ab',
      status: 'draft',
      variants,
      primaryMetric: dto.primaryMetric,
      secondaryMetrics: dto.secondaryMetrics,
      targetingRules: dto.targetingRules,
      trafficAllocation: dto.trafficAllocation ?? 100,
      statisticalSettings: {
        confidenceLevel: dto.statisticalSettings?.confidenceLevel ?? 0.95,
        minimumSampleSize: dto.statisticalSettings?.minimumSampleSize ?? 1000,
        testType: dto.statisticalSettings?.testType ?? 'frequentist',
        sequentialTesting: dto.statisticalSettings?.sequentialTesting ?? false,
      },
      autoStopSettings: {
        enabled: dto.autoStopSettings?.enabled ?? true,
        maxDuration: dto.autoStopSettings?.maxDuration ?? 30,
        maxImpressions: dto.autoStopSettings?.maxImpressions ?? 100000,
        stopOnSignificance: dto.autoStopSettings?.stopOnSignificance ?? true,
      },
      winnerSettings: {
        autoWinner: dto.winnerSettings?.autoWinner ?? false,
        confidenceThreshold: dto.winnerSettings?.confidenceThreshold ?? 0.95,
        holdoutPeriod: dto.winnerSettings?.holdoutPeriod ?? 7,
      },
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      createdBy: dto.createdBy,
      tags: dto.tags,
      metadata: dto.metadata,
    });

    return experiment.save();
  }

  /**
   * Get experiment by ID
   */
  static async getExperiment(id: string): Promise<IExperimentDocument | null> {
    return Experiment.findById(id);
  }

  /**
   * List experiments with pagination and filters
   */
  static async listExperiments(options: {
    page?: number;
    limit?: number;
    status?: ExperimentStatus;
    createdBy?: string;
    tags?: string[];
  }): Promise<{
    experiments: IExperimentDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);

    const query: Record<string, unknown> = {};

    if (options.status) {
      query.status = options.status;
    }

    if (options.createdBy) {
      query.createdBy = options.createdBy;
    }

    if (options.tags && options.tags.length > 0) {
      query.tags = { $in: options.tags };
    }

    const [experiments, total] = await Promise.all([
      Experiment.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Experiment.countDocuments(query),
    ]);

    return { experiments, total, page, limit };
  }

  /**
   * Update experiment
   */
  static async updateExperiment(
    id: string,
    dto: UpdateExperimentDTO
  ): Promise<IExperimentDocument | null> {
    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.targetingRules !== undefined) updateData.targetingRules = dto.targetingRules;
    if (dto.trafficAllocation !== undefined) updateData.trafficAllocation = dto.trafficAllocation;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

    if (dto.variants !== undefined) {
      const weightValidation = Allocator.validateWeights(dto.variants);
      if (!weightValidation.valid) {
        throw new Error(weightValidation.error);
      }
      updateData.variants = dto.variants;
    }

    if (dto.statisticalSettings) {
      updateData.statisticalSettings = { $merge: dto.statisticalSettings };
    }

    if (dto.autoStopSettings) {
      updateData.autoStopSettings = { $merge: dto.autoStopSettings };
    }

    if (dto.winnerSettings) {
      updateData.winnerSettings = { $merge: dto.winnerSettings };
    }

    if (dto.startDate !== undefined) {
      updateData.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }

    if (dto.endDate !== undefined) {
      updateData.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }

    return Experiment.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
  }

  /**
   * Start experiment
   */
  static async startExperiment(id: string): Promise<IExperimentDocument | null> {
    const experiment = await Experiment.findById(id);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'draft' && experiment.status !== 'paused') {
      throw new Error(`Cannot start experiment with status: ${experiment.status}`);
    }

    experiment.status = 'running';
    experiment.startDate = experiment.startDate ?? new Date();
    experiment.endDate = undefined;

    return experiment.save();
  }

  /**
   * Pause experiment
   */
  static async pauseExperiment(id: string): Promise<IExperimentDocument | null> {
    const experiment = await Experiment.findById(id);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'running') {
      throw new Error(`Cannot pause experiment with status: ${experiment.status}`);
    }

    experiment.status = 'paused';
    return experiment.save();
  }

  /**
   * Complete experiment
   */
  static async completeExperiment(id: string): Promise<IExperimentDocument | null> {
    const experiment = await Experiment.findById(id);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'running') {
      throw new Error(`Cannot complete experiment with status: ${experiment.status}`);
    }

    // Run auto-winner detection if enabled
    if (experiment.winnerSettings.autoWinner) {
      const winner = await this.detectWinner(id);
      if (winner) {
        experiment.winnerId = winner.variantId;
        experiment.winnerDetectedAt = winner.detectedAt;
      }
    }

    experiment.status = 'completed';
    experiment.endDate = new Date();

    return experiment.save();
  }

  /**
   * Archive experiment
   */
  static async archiveExperiment(id: string): Promise<IExperimentDocument | null> {
    return Experiment.findByIdAndUpdate(
      id,
      { $set: { status: 'archived' } },
      { new: true }
    );
  }

  /**
   * Delete experiment (only drafts)
   */
  static async deleteExperiment(id: string): Promise<boolean> {
    const experiment = await Experiment.findById(id);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'draft') {
      throw new Error('Can only delete draft experiments');
    }

    // Delete related events
    await Promise.all([
      ConversionEvent.deleteMany({ experimentId: experiment._id }),
      ImpressionEvent.deleteMany({ experimentId: experiment._id }),
      Experiment.findByIdAndDelete(id),
    ]);

    return true;
  }

  /**
   * Add variant to experiment
   */
  static async addVariant(experimentId: string, dto: AddVariantDTO): Promise<IExperimentDocument | null> {
    const experiment = await Experiment.findById(experimentId);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status === 'running') {
      throw new Error('Cannot add variants to running experiments');
    }

    const newVariant: IVariant = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      weight: dto.weight,
      isControl: dto.isControl ?? false,
      metadata: dto.metadata,
    };

    // Update weights proportionally
    const variants = Allocator.rebalanceWeights(
      [...experiment.variants, newVariant],
      newVariant.id,
      dto.weight
    );

    experiment.variants = variants;
    return experiment.save();
  }

  /**
   * Remove variant from experiment
   */
  static async removeVariant(
    experimentId: string,
    variantId: string
  ): Promise<IExperimentDocument | null> {
    const experiment = await Experiment.findById(experimentId);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status === 'running') {
      throw new Error('Cannot remove variants from running experiments');
    }

    const variant = experiment.variants.find(v => v.id === variantId);
    if (!variant) {
      throw new Error('Variant not found');
    }

    if (variant.isControl) {
      throw new Error('Cannot remove control variant');
    }

    // Redistribute weight to control
    const remainingVariants = experiment.variants.filter(v => v.id !== variantId);
    const newControlWeight = variant.weight + experiment.variants.find(v => v.isControl)?.weight ?? 0;

    experiment.variants = experiment.variants
      .filter(v => v.id !== variantId)
      .map(v => ({
        ...v,
        weight: v.isControl ? newControlWeight : v.weight,
      }));

    return experiment.save();
  }

  /**
   * Allocate user to variant
   */
  static async allocate(
    experimentId: string,
    userId: string
  ): Promise<AllocationResult> {
    const experiment = await Experiment.findById(experimentId);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    if (experiment.status !== 'running') {
      return {
        variantId: '',
        variantName: '',
        bucket: 0,
        hash: '',
        inExperiment: false,
        reason: 'Experiment is not running',
      };
    }

    // Check if user matches targeting rules (placeholder - implement actual targeting)
    // const matchesTargeting = this.evaluateTargeting(experiment.targetingRules, userContext);
    // if (!matchesTargeting) { ... }

    return Allocator.allocate(
      experimentId,
      userId,
      experiment.variants,
      experiment.trafficAllocation
    );
  }

  /**
   * Track impression
   */
  static async trackImpression(
    experimentId: string,
    variantId: string,
    dto: TrackEventDTO
  ): Promise<void> {
    const experiment = await Experiment.findById(experimentId);

    if (!experiment || experiment.status !== 'running') {
      return;
    }

    const impression = new ImpressionEvent({
      experimentId: experiment._id,
      variantId,
      userId: dto.userId,
      sessionId: dto.sessionId,
      timestamp: new Date(),
    });

    await impression.save();
  }

  /**
   * Track conversion
   */
  static async trackConversion(
    experimentId: string,
    variantId: string,
    dto: TrackEventDTO
  ): Promise<void> {
    const experiment = await Experiment.findById(experimentId);

    if (!experiment || experiment.status !== 'running') {
      return;
    }

    const conversion = new ConversionEvent({
      experimentId: experiment._id,
      variantId,
      userId: dto.userId,
      sessionId: dto.sessionId,
      value: dto.value ?? 0,
      metadata: dto.metadata,
      timestamp: new Date(),
    });

    await conversion.save();

    // Check for auto-stop conditions
    if (experiment.autoStopSettings.stopOnSignificance) {
      const results = await this.getResults(experimentId);
      if (results.significance.isSignificant && results.winner) {
        // Could trigger auto-stop here
        console.log(`Winner detected for experiment ${experimentId}: ${results.winner.variantName}`);
      }
    }
  }

  /**
   * Get variant statistics
   */
  static async getVariantStats(experimentId: string): Promise<Map<string, IVariantStats>> {
    const experiment = await Experiment.findById(experimentId);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const variantStats = new Map<string, IVariantStats>();

    // Aggregate impression and conversion data
    const impressions = await ImpressionEvent.aggregate([
      { $match: { experimentId: experiment._id } },
      { $group: { _id: '$variantId', count: { $sum: 1 } } },
    ]);

    const conversions = await ConversionEvent.aggregate([
      { $match: { experimentId: experiment._id } },
      {
        $group: {
          _id: '$variantId',
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$value', 0] } },
        },
      },
    ]);

    // Create lookup maps
    const impressionMap = new Map(impressions.map(i => [i._id, i.count]));
    const conversionMap = new Map(conversions.map(c => [c._id, { count: c.count, revenue: c.revenue }]));

    // Find control conversion rate
    const controlVariant = experiment.variants.find(v => v.isControl);
    const controlImpressions = impressionMap.get(controlVariant?.id ?? '') ?? 0;
    const controlConversions = conversionMap.get(controlVariant?.id ?? '')?.count ?? 0;
    const controlRate = controlImpressions > 0 ? controlConversions / controlImpressions : 0;

    // Calculate stats for each variant
    for (const variant of experiment.variants) {
      const imp = impressionMap.get(variant.id) ?? 0;
      const conv = conversionMap.get(variant.id) ?? { count: 0, revenue: 0 };
      const rate = imp > 0 ? conv.count / imp : 0;
      const aov = conv.count > 0 ? conv.revenue / conv.count : 0;

      variantStats.set(variant.id, {
        variantId: variant.id,
        variantName: variant.name,
        impressions: imp,
        conversions: conv.count,
        conversionRate: rate,
        revenue: conv.revenue,
        averageOrderValue: aov,
        confidence: 0,
        isWinner: experiment.winnerId === variant.id,
        uplift: controlRate > 0 ? ((rate - controlRate) / controlRate) * 100 : 0,
      });
    }

    return variantStats;
  }

  /**
   * Detect winner
   */
  static async detectWinner(experimentId: string): Promise<{
    variantId: string;
    variantName: string;
    uplift: number;
    confidence: number;
    detectedAt: Date;
  } | null> {
    const experiment = await Experiment.findById(experimentId);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const variantStats = await this.getVariantStats(experimentId);

    // Find control and best performing variant
    const control = experiment.variants.find(v => v.isControl);
    if (!control) return null;

    const controlStats = variantStats.get(control.id);
    if (!controlStats) return null;

    let bestVariant: IVariantStats | null = null;
    let bestScore = -Infinity;

    for (const variant of experiment.variants) {
      if (variant.isControl) continue;

      const stats = variantStats.get(variant.id);
      if (!stats) continue;

      // Calculate score based on primary metric
      let score = 0;
      switch (experiment.primaryMetric) {
        case 'conversion_rate':
          score = stats.conversionRate;
          break;
        case 'revenue':
          score = stats.revenue;
          break;
        case 'ctr':
          score = stats.conversionRate; // Using conversion as proxy
          break;
        case 'engagement':
          score = stats.conversionRate;
          break;
      }

      if (score > bestScore) {
        bestScore = score;
        bestVariant = stats;
      }
    }

    if (!bestVariant) return null;

    // Run statistical test
    const significance = StatsEngine.twoProportionZTest(
      controlStats.conversions,
      controlStats.impressions,
      bestVariant.conversions,
      bestVariant.impressions,
      experiment.statisticalSettings.confidenceLevel
    );

    // Check if statistically significant
    if (!significance.isSignificant) {
      return null;
    }

    // Check if improvement is positive
    if (bestVariant.conversionRate <= controlStats.conversionRate) {
      return null;
    }

    return {
      variantId: bestVariant.variantId,
      variantName: bestVariant.variantName,
      uplift: bestVariant.uplift,
      confidence: significance.confidenceLevel,
      detectedAt: new Date(),
    };
  }

  /**
   * Get experiment results
   */
  static async getResults(experimentId: string): Promise<ExperimentResults> {
    const experiment = await Experiment.findById(experimentId);

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const variantStatsMap = await this.getVariantStats(experimentId);
    const variantStats = Array.from(variantStatsMap.values());

    // Calculate total impressions and conversions
    const totalImpressions = variantStats.reduce((sum, v) => sum + v.impressions, 0);
    const totalConversions = variantStats.reduce((sum, v) => sum + v.conversions, 0);
    const totalRevenue = variantStats.reduce((sum, v) => sum + v.revenue, 0);

    // Find control and treatment
    const control = experiment.variants.find(v => v.isControl);
    const controlStats = control ? variantStatsMap.get(control.id) : null;

    // Run statistical test
    let significance = {
      pValue: 1,
      confidenceLevel: experiment.statisticalSettings.confidenceLevel,
      isSignificant: false,
      testType: experiment.statisticalSettings.testType,
    };

    if (controlStats && experiment.variants.length > 1) {
      // Find best treatment
      const treatments = variantStats.filter(v => !v.isControl);
      const bestTreatment = treatments.reduce(
        (best, current) =>
          current.conversionRate > best.conversionRate ? current : best,
        treatments[0]
      );

      if (bestTreatment) {
        if (experiment.statisticalSettings.testType === 'bayesian') {
          const bayesian = StatsEngine.bayesianAnalysis(
            controlStats.conversions,
            controlStats.impressions,
            bestTreatment.conversions,
            bestTreatment.impressions,
            experiment.statisticalSettings.confidenceLevel
          );

          significance = {
            pValue: 1 - bayesian.probabilityOfBeingBetter,
            confidenceLevel: experiment.statisticalSettings.confidenceLevel,
            isSignificant: bayesian.isSignificant,
            testType: 'bayesian',
          };

          // Update variant stats with bayesian confidence
          controlStats.confidence = bayesian.control.mean;
          bestTreatment.confidence = bayesian.probabilityOfBeingBetter;
        } else {
          const frequentist = StatsEngine.twoProportionZTest(
            controlStats.conversions,
            controlStats.impressions,
            bestTreatment.conversions,
            bestTreatment.impressions,
            experiment.statisticalSettings.confidenceLevel
          );

          significance = {
            pValue: frequentist.pValue,
            confidenceLevel: frequentist.confidenceLevel,
            isSignificant: frequentist.isSignificant,
            testType: 'frequentist',
          };

          controlStats.confidence = 1 - frequentist.pValue;
          bestTreatment.confidence = 1 - frequentist.pValue;
        }

        // Mark winner
        if (significance.isSignificant && bestTreatment.conversionRate > controlStats.conversionRate) {
          bestTreatment.isWinner = true;
        }
      }
    }

    // Calculate revenue impact
    let revenueImpact: RevenueImpact | undefined;
    if (controlStats) {
      const treatments = variantStats.filter(v => !v.isControl);
      const bestTreatment = treatments.reduce(
        (best, current) =>
          current.revenue > best.revenue ? current : best,
        treatments[0]
      );

      if (bestTreatment) {
        revenueImpact = StatsEngine.calculateRevenueImpact(
          controlStats.revenue,
          controlStats.impressions,
          bestTreatment.revenue,
          bestTreatment.impressions,
          experiment.trafficAllocation,
          experiment.statisticalSettings.confidenceLevel
        );
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (totalImpressions < experiment.statisticalSettings.minimumSampleSize) {
      recommendations.push(
        `Need ${experiment.statisticalSettings.minimumSampleSize - totalImpressions} more impressions to reach statistical significance`
      );
    }

    if (significance.isSignificant) {
      const winner = variantStats.find(v => v.isWinner);
      if (winner) {
        recommendations.push(
          `${winner.variantName} is winning with ${winner.uplift.toFixed(2)}% improvement`
        );
        if (experiment.winnerSettings.autoWinner && !experiment.winnerId) {
          recommendations.push('Consider declaring a winner and rolling out the winning variant');
        }
      }
    } else {
      recommendations.push('Experiment has not reached statistical significance yet');
    }

    if (!significance.isSignificant && totalImpressions > experiment.statisticalSettings.minimumSampleSize) {
      recommendations.push('Consider extending the experiment duration or increasing traffic allocation');
    }

    // Calculate duration
    const duration = experiment.startDate
      ? Math.ceil(
          ((experiment.endDate?.getTime() ?? Date.now()) - experiment.startDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    return {
      experimentId: experiment._id.toString(),
      name: experiment.name,
      status: experiment.status,
      startDate: experiment.startDate,
      endDate: experiment.endDate,
      duration,
      totalImpressions,
      totalConversions,
      variantStats,
      significance,
      winner: experiment.winnerId
        ? {
            variantId: experiment.winnerId,
            variantName: experiment.variants.find(v => v.id === experiment.winnerId)?.name ?? '',
            uplift: variantStatsMap.get(experiment.winnerId)?.uplift ?? 0,
            confidence: significance.confidenceLevel,
            detectedAt: experiment.winnerDetectedAt,
          }
        : undefined,
      revenueImpact,
      recommendations,
    };
  }
}
