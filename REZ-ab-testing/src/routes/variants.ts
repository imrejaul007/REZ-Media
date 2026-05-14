import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExperimentService } from '../services/experimentService';
import { AddVariantDTO } from '../types';
import { Allocator } from '../services/allocator';

const router = Router();

// Validation schemas
const addVariantSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  weight: z.number().min(0).max(100),
  isControl: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const trackImpressionSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
});

const trackConversionSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  value: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const allocateSchema = z.object({
  userId: z.string().min(1),
});

// Error handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Get variant from experiment
const getVariant = async (req: Request, res: Response, next: NextFunction) => {
  const experiment = await ExperimentService.getExperiment(req.params.experimentId);

  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found',
    });
    return;
  }

  const variant = experiment.variants.find(v => v.id === req.params.variantId);

  if (!variant) {
    res.status(404).json({
      success: false,
      error: 'Variant not found',
    });
    return;
  }

  (req as Request & { variant: typeof variant; experiment: typeof experiment }).variant = variant;
  (req as Request & { variant: typeof variant; experiment: typeof experiment }).experiment = experiment;
  next();
};

// Add variant to experiment
router.post(
  '/experiments/:experimentId/variants',
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = addVariantSchema.parse(req.body) as AddVariantDTO;

    const experiment = await ExperimentService.addVariant(req.params.experimentId, validatedData);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    const newVariant = experiment.variants[experiment.variants.length - 1];

    res.status(201).json({
      success: true,
      data: newVariant,
      message: 'Variant added successfully',
    });
  })
);

// List variants for experiment
router.get(
  '/experiments/:experimentId/variants',
  asyncHandler(async (req: Request, res: Response) => {
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    // Get variant stats
    const variantStats = await ExperimentService.getVariantStats(req.params.experimentId);

    const variantsWithStats = experiment.variants.map(variant => {
      const stats = variantStats.get(variant.id);
      return {
        ...variant.toObject(),
        stats: stats ?? {
          impressions: 0,
          conversions: 0,
          conversionRate: 0,
          revenue: 0,
          averageOrderValue: 0,
          uplift: 0,
        },
      };
    });

    res.json({
      success: true,
      data: variantsWithStats,
    });
  })
);

// Get single variant
router.get(
  '/experiments/:experimentId/variants/:variantId',
  getVariant,
  asyncHandler(async (req: Request, res: Response) => {
    const { variant, experiment } = req as Request & {
      variant: typeof experiment.variants[0];
      experiment: typeof experiment;
    };

    const variantStats = await ExperimentService.getVariantStats(req.params.experimentId);
    const stats = variantStats.get(variant.id);

    res.json({
      success: true,
      data: {
        ...variant.toObject(),
        stats: stats ?? {
          impressions: 0,
          conversions: 0,
          conversionRate: 0,
          revenue: 0,
          averageOrderValue: 0,
          uplift: 0,
        },
      },
    });
  })
);

// Remove variant from experiment
router.delete(
  '/experiments/:experimentId/variants/:variantId',
  getVariant,
  asyncHandler(async (req: Request, res: Response) => {
    const experiment = await ExperimentService.removeVariant(
      req.params.experimentId,
      req.params.variantId
    );

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Variant removed successfully',
    });
  })
);

// Allocate user to variant
router.post(
  '/experiments/:experimentId/allocate',
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = allocateSchema.parse(req.body);

    const allocation = await ExperimentService.allocate(
      req.params.experimentId,
      validatedData.userId
    );

    res.json({
      success: true,
      data: allocation,
    });
  })
);

// Track impression
router.post(
  '/experiments/:experimentId/variants/:variantId/impression',
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = trackImpressionSchema.parse(req.body);

    await ExperimentService.trackImpression(
      req.params.experimentId,
      req.params.variantId,
      {
        userId: validatedData.userId,
        sessionId: validatedData.sessionId,
      }
    );

    res.json({
      success: true,
      message: 'Impression tracked successfully',
    });
  })
);

// Track conversion
router.post(
  '/experiments/:experimentId/variants/:variantId/conversion',
  asyncHandler(async (req: Request, res: Response) => {
    const validatedData = trackConversionSchema.parse(req.body);

    await ExperimentService.trackConversion(
      req.params.experimentId,
      req.params.variantId,
      {
        userId: validatedData.userId,
        sessionId: validatedData.sessionId,
        value: validatedData.value,
        metadata: validatedData.metadata,
      }
    );

    res.json({
      success: true,
      message: 'Conversion tracked successfully',
    });
  })
);

// Batch track impressions (for efficiency)
router.post(
  '/experiments/:experimentId/impressions',
  asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      impressions: z.array(z.object({
        variantId: z.string(),
        userId: z.string(),
        sessionId: z.string(),
      })),
    });

    const { impressions } = schema.parse(req.body);
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    // Track all impressions
    const promises = impressions.map(imp =>
      ExperimentService.trackImpression(
        req.params.experimentId,
        imp.variantId,
        {
          userId: imp.userId,
          sessionId: imp.sessionId,
        }
      )
    );

    await Promise.all(promises);

    res.json({
      success: true,
      message: `Tracked ${impressions.length} impressions`,
    });
  })
);

// Batch track conversions (for efficiency)
router.post(
  '/experiments/:experimentId/conversions',
  asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      conversions: z.array(z.object({
        variantId: z.string(),
        userId: z.string(),
        sessionId: z.string(),
        value: z.number().optional(),
        metadata: z.record(z.unknown()).optional(),
      })),
    });

    const { conversions } = schema.parse(req.body);
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    // Track all conversions
    const promises = conversions.map(conv =>
      ExperimentService.trackConversion(
        req.params.experimentId,
        conv.variantId,
        {
          userId: conv.userId,
          sessionId: conv.sessionId,
          value: conv.value,
          metadata: conv.metadata,
        }
      )
    );

    await Promise.all(promises);

    res.json({
      success: true,
      message: `Tracked ${conversions.length} conversions`,
    });
  })
);

// Get allocation preview (simulate allocation)
router.get(
  '/experiments/:experimentId/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const experiment = await ExperimentService.getExperiment(req.params.experimentId);

    if (!experiment) {
      res.status(404).json({
        success: false,
        error: 'Experiment not found',
      });
      return;
    }

    // Simulate with a sample of user IDs
    const sampleUsers = Array.from({ length: 100 }, (_, i) => `preview_user_${i}`);
    const allocationCounts = new Map<string, number>();

    for (const userId of sampleUsers) {
      const allocation = Allocator.allocate(
        req.params.experimentId,
        userId,
        experiment.variants,
        experiment.trafficAllocation
      );

      if (allocation.inExperiment) {
        allocationCounts.set(
          allocation.variantId,
          (allocationCounts.get(allocation.variantId) || 0) + 1
        );
      }
    }

    // Calculate actual percentages
    const total = Array.from(allocationCounts.values()).reduce((a, b) => a + b, 0);
    const preview = experiment.variants.map(variant => ({
      variantId: variant.id,
      variantName: variant.name,
      configuredWeight: variant.weight,
      simulatedWeight: total > 0
        ? ((allocationCounts.get(variant.id) || 0) / total) * 100
        : 0,
      simulatedCount: allocationCounts.get(variant.id) || 0,
    }));

    res.json({
      success: true,
      data: {
        trafficAllocation: experiment.trafficAllocation,
        preview,
      },
    });
  })
);

export default router;
