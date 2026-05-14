import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExperimentService } from '../services/experimentService';
import { CreateExperimentDTO, UpdateExperimentDTO, ExperimentStatus } from '../types';

const router = Router();

// Validation schemas
const createExperimentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['ab', 'multivariate', 'bandit']).optional(),
  variants: z.array(z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    weight: z.number().min(0).max(100),
    isControl: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })).min(2),
  primaryMetric: z.enum(['conversion_rate', 'revenue', 'ctr', 'engagement']),
  secondaryMetrics: z.array(z.enum(['conversion_rate', 'revenue', 'ctr', 'engagement'])).optional(),
  targetingRules: z.record(z.unknown()).optional(),
  trafficAllocation: z.number().min(0).max(100).optional(),
  statisticalSettings: z.object({
    confidenceLevel: z.number().min(0.8).max(0.999).optional(),
    minimumSampleSize: z.number().min(100).optional(),
    testType: z.enum(['frequentist', 'bayesian']).optional(),
    sequentialTesting: z.boolean().optional(),
  }).optional(),
  autoStopSettings: z.object({
    enabled: z.boolean().optional(),
    maxDuration: z.number().min(1).optional(),
    maxImpressions: z.number().min(1000).optional(),
    stopOnSignificance: z.boolean().optional(),
  }).optional(),
  winnerSettings: z.object({
    autoWinner: z.boolean().optional(),
    confidenceThreshold: z.number().min(0.8).max(0.999).optional(),
    holdoutPeriod: z.number().min(0).optional(),
  }).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdBy: z.string().min(1),
});

const updateExperimentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'running', 'paused', 'completed', 'archived']).optional(),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    weight: z.number().min(0).max(100),
    isControl: z.boolean(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
  targetingRules: z.record(z.unknown()).optional(),
  trafficAllocation: z.number().min(0).max(100).optional(),
  statisticalSettings: z.object({
    confidenceLevel: z.number().min(0.8).max(0.999).optional(),
    minimumSampleSize: z.number().min(100).optional(),
    testType: z.enum(['frequentist', 'bayesian']).optional(),
    sequentialTesting: z.boolean().optional(),
  }).optional(),
  autoStopSettings: z.object({
    enabled: z.boolean().optional(),
    maxDuration: z.number().min(1).optional(),
    maxImpressions: z.number().min(1000).optional(),
    stopOnSignificance: z.boolean().optional(),
  }).optional(),
  winnerSettings: z.object({
    autoWinner: z.boolean().optional(),
    confidenceThreshold: z.number().min(0.8).max(0.999).optional(),
    holdoutPeriod: z.number().min(0).optional(),
  }).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  status: z.enum(['draft', 'running', 'paused', 'completed', 'archived']).optional(),
  createdBy: z.string().optional(),
  tags: z.string().transform(s => s.split(',')).optional(),
});

// Error handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Create experiment
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createExperimentSchema.parse(req.body) as CreateExperimentDTO;

  const experiment = await ExperimentService.createExperiment(validatedData);

  res.status(201).json({
    success: true,
    data: experiment,
    message: 'Experiment created successfully',
  });
}));

// List experiments
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = listQuerySchema.parse(req.query);

  const result = await ExperimentService.listExperiments({
    page: query.page,
    limit: query.limit,
    status: query.status,
    createdBy: query.createdBy,
    tags: query.tags as string[] | undefined,
  });

  res.json({
    success: true,
    data: result.experiments,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit),
    },
  });
}));

// Get single experiment
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await ExperimentService.getExperiment(req.params.id);

  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found',
    });
    return;
  }

  res.json({
    success: true,
    data: experiment,
  });
}));

// Update experiment
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = updateExperimentSchema.parse(req.body) as UpdateExperimentDTO;

  const experiment = await ExperimentService.updateExperiment(req.params.id, validatedData);

  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found',
    });
    return;
  }

  res.json({
    success: true,
    data: experiment,
    message: 'Experiment updated successfully',
  });
}));

// Delete experiment
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await ExperimentService.deleteExperiment(req.params.id);

  res.json({
    success: true,
    message: 'Experiment deleted successfully',
  });
}));

// Start experiment
router.post('/:id/start', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await ExperimentService.startExperiment(req.params.id);

  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found',
    });
    return;
  }

  res.json({
    success: true,
    data: experiment,
    message: 'Experiment started successfully',
  });
}));

// Pause experiment
router.post('/:id/pause', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await ExperimentService.pauseExperiment(req.params.id);

  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found',
    });
    return;
  }

  res.json({
    success: true,
    data: experiment,
    message: 'Experiment paused successfully',
  });
}));

// Complete experiment
router.post('/:id/complete', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await ExperimentService.completeExperiment(req.params.id);

  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found',
    });
    return;
  }

  res.json({
    success: true,
    data: experiment,
    message: 'Experiment completed successfully',
  });
}));

// Archive experiment
router.post('/:id/archive', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await ExperimentService.archiveExperiment(req.params.id);

  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found',
    });
    return;
  }

  res.json({
    success: true,
    data: experiment,
    message: 'Experiment archived successfully',
  });
}));

export default router;
