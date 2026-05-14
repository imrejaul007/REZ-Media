import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExperimentService } from '../services/experimentService';
import { StatsEngine } from '../services/statsEngine';
import { Experiment, ConversionEvent, ImpressionEvent } from '../models/Experiment';

const router = Router();

// Error handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Query schemas
const timeSeriesSchema = z.object({
  interval: z.enum(['hour', 'day', 'week']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Get experiment results
router.get(
  '/experiments/:experimentId/results',
  asyncHandler(async (req: Request, res: Response) => {
    const results = await ExperimentService.getResults(req.params.experimentId);

    res.json({
      success: true,
      data: results,
    });
  })
);

// Get variant statistics
router.get(
  '/experiments/:experimentId/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    const variantStats = await ExperimentService.getVariantStats(req.params.experimentId);

    res.json({
      success: true,
      data: {
        experimentId: req.params.experimentId,
        experimentName: experiment.name,
        primaryMetric: experiment.primaryMetric,
        variants: Array.from(variantStats.values()),
      },
    });
  })
);

// Get time series data
router.get(
  '/experiments/:experimentId/timeseries',
  asyncHandler(async (req: Request, res: Response) => {
    const query = timeSeriesSchema.parse(req.query);

    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    const matchStage: Record<string, unknown> = {
      experimentId: experiment._id,
    };

    // Date range filter
    if (query.startDate || query.endDate) {
      matchStage.timestamp = {};
      if (query.startDate) {
        (matchStage.timestamp as Record<string, unknown>).$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (matchStage.timestamp as Record<string, unknown>).$lte = new Date(query.endDate);
      }
    }

    // Determine date grouping based on interval
    let dateFormat: string;
    let dateUnit: string;

    switch (query.interval) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00';
        dateUnit = '$hour';
        break;
      case 'week':
        dateFormat = '%Y-W%V';
        dateUnit = '$week';
        break;
      default: // day
        dateFormat = '%Y-%m-%d';
        dateUnit = '$dayOfYear';
    }

    // Aggregate impressions over time
    const impressionsPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$timestamp' } },
            variantId: '$variantId',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    // Aggregate conversions over time
    const conversionsPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$timestamp' } },
            variantId: '$variantId',
          },
          count: { $sum: 1 },
          revenue: { $sum: '$value' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ];

    const [impressionsData, conversionsData] = await Promise.all([
      ImpressionEvent.aggregate(impressionsPipeline),
      ConversionEvent.aggregate(conversionsPipeline),
    ]);

    // Organize data by date and variant
    const timeSeriesMap = new Map<string, Map<string, {
      impressions: number;
      conversions: number;
      revenue: number;
    }>>();

    for (const imp of impressionsData) {
      const date = imp._id.date;
      const variantId = imp._id.variantId;

      if (!timeSeriesMap.has(date)) {
        timeSeriesMap.set(date, new Map());
      }

      const dayMap = timeSeriesMap.get(date)!;
      if (!dayMap.has(variantId)) {
        dayMap.set(variantId, { impressions: 0, conversions: 0, revenue: 0 });
      }

      dayMap.get(variantId)!.impressions += imp.count;
    }

    for (const conv of conversionsData) {
      const date = conv._id.date;
      const variantId = conv._id.variantId;

      if (!timeSeriesMap.has(date)) {
        timeSeriesMap.set(date, new Map());
      }

      const dayMap = timeSeriesMap.get(date)!;
      if (!dayMap.has(variantId)) {
        dayMap.set(variantId, { impressions: 0, conversions: 0, revenue: 0 });
      }

      dayMap.get(variantId)!.conversions += conv.count;
      dayMap.get(variantId)!.revenue += conv.revenue;
    }

    // Format response
    const timeSeries: Array<{
      date: string;
      variants: Array<{
        variantId: string;
        variantName: string;
        impressions: number;
        conversions: number;
        conversionRate: number;
        revenue: number;
      }>;
      total: {
        impressions: number;
        conversions: number;
        conversionRate: number;
        revenue: number;
      };
    }> = [];

    for (const [date, variantData] of timeSeriesMap) {
      const variantStats: Array<{
        variantId: string;
        variantName: string;
        impressions: number;
        conversions: number;
        conversionRate: number;
        revenue: number;
      }> = [];

      let totalImpressions = 0;
      let totalConversions = 0;
      let totalRevenue = 0;

      for (const variant of experiment.variants) {
        const stats = variantData.get(variant.id) || { impressions: 0, conversions: 0, revenue: 0 };
        const conversionRate = stats.impressions > 0 ? stats.conversions / stats.impressions : 0;

        variantStats.push({
          variantId: variant.id,
          variantName: variant.name,
          impressions: stats.impressions,
          conversions: stats.conversions,
          conversionRate,
          revenue: stats.revenue,
        });

        totalImpressions += stats.impressions;
        totalConversions += stats.conversions;
        totalRevenue += stats.revenue;
      }

      timeSeries.push({
        date,
        variants: variantStats,
        total: {
          impressions: totalImpressions,
          conversions: totalConversions,
          conversionRate: totalImpressions > 0 ? totalConversions / totalImpressions : 0,
          revenue: totalRevenue,
        },
      });
    }

    res.json({
      success: true,
      data: {
        experimentId: req.params.experimentId,
        experimentName: experiment.name,
        interval: query.interval || 'day',
        timeSeries,
      },
    });
  })
);

// Get revenue breakdown
router.get(
  '/experiments/:experimentId/revenue',
  asyncHandler(async (req: Request, res: Response) => {
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    const variantStats = await ExperimentService.getVariantStats(req.params.experimentId);

    const revenueBreakdown: Array<{
      variantId: string;
      variantName: string;
      isControl: boolean;
      totalRevenue: number;
      impressions: number;
      averageOrderValue: number;
      revenuePerImpression: number;
    }> = [];

    for (const variant of experiment.variants) {
      const stats = variantStats.get(variant.id);
      if (!stats) continue;

      revenueBreakdown.push({
        variantId: variant.id,
        variantName: variant.name,
        isControl: variant.isControl,
        totalRevenue: stats.revenue,
        impressions: stats.impressions,
        averageOrderValue: stats.averageOrderValue,
        revenuePerImpression: stats.impressions > 0 ? stats.revenue / stats.impressions : 0,
      });
    }

    res.json({
      success: true,
      data: {
        experimentId: req.params.experimentId,
        experimentName: experiment.name,
        trafficAllocation: experiment.trafficAllocation,
        revenueBreakdown,
      },
    });
  })
);

// Get sample size calculator
router.get(
  '/experiments/:experimentId/sample-size',
  asyncHandler(async (req: Request, res: Response) => {
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    const variantStats = await ExperimentService.getVariantStats(req.params.experimentId);

    // Find control conversion rate
    const control = experiment.variants.find(v => v.isControl);
    const controlStats = control ? variantStats.get(control.id) : null;
    const baselineRate = controlStats?.conversionRate ?? 0.05; // Default 5% if no data

    // Calculate for different effect sizes
    const effectSizes = [0.01, 0.02, 0.05, 0.1, 0.2]; // 1%, 2%, 5%, 10%, 20%

    const sampleSizes = effectSizes.map(effect => {
      const result = StatsEngine.calculateSampleSize(
        baselineRate,
        effect,
        0.05,
        0.8
      );

      return {
        effectSize: effect * 100,
        minimumSampleSize: result.requiredSampleSize,
        perVariant: result.perVariant,
        estimatedDays: estimateDays(result.requiredSampleSize),
      };
    });

    // Current status
    const totalImpressions = Array.from(variantStats.values())
      .reduce((sum, v) => sum + v.impressions, 0);

    const currentSampleSize = variantStats.size > 0 ? totalImpressions / experiment.variants.length : 0;

    res.json({
      success: true,
      data: {
        experimentId: req.params.experimentId,
        experimentName: experiment.name,
        baselineConversionRate: baselineRate,
        currentSampleSizePerVariant: Math.round(currentSampleSize),
        currentTotalImpressions: totalImpressions,
        sampleSizes,
        statisticalSettings: experiment.statisticalSettings,
      },
    });
  })
);

// Get significance analysis
router.get(
  '/experiments/:experimentId/significance',
  asyncHandler(async (req: Request, res: Response) => {
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    const variantStats = await ExperimentService.getVariantStats(req.params.experimentId);

    const control = experiment.variants.find(v => v.isControl);
    const controlStats = control ? variantStats.get(control.id) : null;

    if (!controlStats) {
      res.json({
        success: true,
        data: {
          message: 'No control variant data available',
          significance: null,
        },
      });
      return;
    }

    // Calculate significance for each treatment
    const treatments: Array<{
      variantId: string;
      variantName: string;
      impressions: number;
      conversions: number;
      conversionRate: number;
      uplift: number;
      frequentist: {
        pValue: number;
        isSignificant: boolean;
        confidenceInterval: { lower: number; upper: number };
      };
      bayesian: {
        probabilityOfBeingBetter: number;
        expectedLift: number;
        isSignificant: boolean;
      };
    }> = [];

    for (const variant of experiment.variants) {
      if (variant.isControl) continue;

      const stats = variantStats.get(variant.id);
      if (!stats) continue;

      const frequentist = StatsEngine.twoProportionZTest(
        controlStats.conversions,
        controlStats.impressions,
        stats.conversions,
        stats.impressions,
        experiment.statisticalSettings.confidenceLevel
      );

      const bayesian = StatsEngine.bayesianAnalysis(
        controlStats.conversions,
        controlStats.impressions,
        stats.conversions,
        stats.impressions,
        experiment.statisticalSettings.confidenceLevel
      );

      treatments.push({
        variantId: variant.id,
        variantName: variant.name,
        impressions: stats.impressions,
        conversions: stats.conversions,
        conversionRate: stats.conversionRate,
        uplift: stats.uplift,
        frequentist: {
          pValue: frequentist.pValue,
          isSignificant: frequentist.isSignificant,
          confidenceInterval: frequentist.confidenceInterval,
        },
        bayesian: {
          probabilityOfBeingBetter: bayesian.probabilityOfBeingBetter,
          expectedLift: bayesian.expectedLift,
          isSignificant: bayesian.isSignificant,
        },
      });
    }

    res.json({
      success: true,
      data: {
        experimentId: req.params.experimentId,
        experimentName: experiment.name,
        testType: experiment.statisticalSettings.testType,
        confidenceLevel: experiment.statisticalSettings.confidenceLevel,
        control: {
          variantId: control.id,
          variantName: control.name,
          impressions: controlStats.impressions,
          conversions: controlStats.conversions,
          conversionRate: controlStats.conversionRate,
        },
        treatments,
      },
    });
  })
);

// Get daily summary
router.get(
  '/experiments/:experimentId/daily',
  asyncHandler(async (req: Request, res: Response) => {
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const impressions = await ImpressionEvent.aggregate([
      {
        $match: {
          experimentId: experiment._id,
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const conversions = await ConversionEvent.aggregate([
      {
        $match: {
          experimentId: experiment._id,
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          count: { $sum: 1 },
          revenue: { $sum: '$value' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Merge data
    const impressionMap = new Map(impressions.map(i => [i._id, i.count]));
    const conversionMap = new Map(conversions.map(c => [c._id, { count: c.count, revenue: c.revenue }]));

    const allDates = new Set([...impressionMap.keys(), ...conversionMap.keys()]);
    const dailyData = Array.from(allDates)
      .sort()
      .map(date => {
        const imp = impressionMap.get(date) ?? 0;
        const conv = conversionMap.get(date) ?? { count: 0, revenue: 0 };

        return {
          date,
          impressions: imp,
          conversions: conv.count,
          conversionRate: imp > 0 ? conv.count / imp : 0,
          revenue: conv.revenue,
        };
      });

    res.json({
      success: true,
      data: {
        experimentId: req.params.experimentId,
        experimentName: experiment.name,
        period: '30 days',
        dailyData,
      },
    });
  })
);

// Helper function to estimate days needed
function estimateDays(requiredSampleSize: number, dailyTraffic: number = 1000): number {
  if (dailyTraffic <= 0) return Infinity;
  return Math.ceil(requiredSampleSize / dailyTraffic);
}

export default router;
