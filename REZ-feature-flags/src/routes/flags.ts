import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FlagService } from '../services/flagService';
import { FeatureFlagSchema } from '../types/flag';

const router = Router();
let flagService: FlagService;

// Initialize with flag service
export function initRoutes(service: FlagService) {
  flagService = service;
}

// Allow setting flag service from outside
export function setFlagService(service: FlagService) {
  flagService = service;
}

// Validation schemas
const CreateFlagSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  enabled: z.boolean().default(true),
  environment: z.enum(['development', 'staging', 'production']).default('production'),
  variations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    value: z.union([z.boolean(), z.string(), z.number(), z.record(z.unknown())]),
    weight: z.number().min(0).max(100).default(0),
  })).min(1),
  defaultVariation: z.string(),
  targeting: z.object({
    enabled: z.boolean().default(false),
    rules: z.array(z.object({
      id: z.string(),
      priority: z.number().min(0),
      conditions: z.array(z.object({
        attribute: z.string(),
        operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'regex']),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      })),
      variationId: z.string(),
    })).default([]),
  }).default({ enabled: false, rules: [] }),
  percentageRollout: z.object({
    enabled: z.boolean().default(false),
    percentage: z.number().min(0).max(100).default(0),
    seed: z.string().optional(),
  }).default({ enabled: false, percentage: 0 }),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

const UpdateFlagSchema = CreateFlagSchema.partial();

const EvaluateFlagSchema = z.object({
  userId: z.string().min(1),
  attributes: z.record(z.unknown()).optional().default({}),
});

const BulkEvaluateSchema = z.object({
  userId: z.string().min(1),
  flagKeys: z.array(z.string()).min(1),
  attributes: z.record(z.unknown()).optional().default({}),
});

const CopyFlagsSchema = z.object({
  fromEnvironment: z.enum(['development', 'staging', 'production']),
  toEnvironment: z.enum(['development', 'staging', 'production']),
  flagKeys: z.array(z.string()).optional(),
});

const BulkCreateSchema = z.array(CreateFlagSchema);

// Middleware for validating request body
function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

// Error handler
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Route error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
}

// CRUD Routes

// Create a new flag
router.post('/',
  validateBody(CreateFlagSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flag = await flagService.createFlag(req.body);
      res.status(201).json({
        success: true,
        data: flag,
      });
    } catch (error: any) {
      if (error.code === 11000) {
        res.status(409).json({
          error: 'Flag already exists',
          message: `A flag with key "${req.body.key}" already exists`,
        });
        return;
      }
      next(error);
    }
  }
);

// Get all flags
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { environment, tags } = req.query;
    const tagsArray = tags ? (tags as string).split(',') : undefined;
    const flags = await flagService.getAllFlags(
      environment as string | undefined,
      tagsArray
    );
    res.json({
      success: true,
      data: flags,
      count: flags.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get a single flag by key
router.get('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { environment } = req.query;
    const flag = await flagService.getFlag(
      req.params.key,
      environment as string | undefined
    );

    if (!flag) {
      res.status(404).json({
        error: 'Flag not found',
        message: `No flag found with key "${req.params.key}"`,
      });
      return;
    }

    res.json({
      success: true,
      data: flag,
    });
  } catch (error) {
    next(error);
  }
});

// Update a flag
router.patch('/:key',
  validateBody(UpdateFlagSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flag = await flagService.updateFlag(req.params.key, req.body);

      if (!flag) {
        res.status(404).json({
          error: 'Flag not found',
          message: `No flag found with key "${req.params.key}"`,
        });
        return;
      }

      res.json({
        success: true,
        data: flag,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete a flag
router.delete('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await flagService.deleteFlag(req.params.key);

    if (!deleted) {
      res.status(404).json({
        error: 'Flag not found',
        message: `No flag found with key "${req.params.key}"`,
      });
      return;
    }

    res.json({
      success: true,
      message: `Flag "${req.params.key}" deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// Toggle flag enabled/disabled
router.post('/:key/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        error: 'Validation error',
        message: 'The "enabled" field must be a boolean',
      });
      return;
    }

    const flag = await flagService.toggleFlag(req.params.key, enabled);

    if (!flag) {
      res.status(404).json({
        error: 'Flag not found',
        message: `No flag found with key "${req.params.key}"`,
      });
      return;
    }

    res.json({
      success: true,
      data: flag,
    });
  } catch (error) {
    next(error);
  }
});

// Evaluation Routes

// Evaluate a single flag
router.post('/evaluate/:key',
  validateBody(EvaluateFlagSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { environment } = req.query;
      const env = (environment as string) || 'production';
      const { userId, attributes } = req.body;

      const result = await flagService.evaluateFlag(
        req.params.key,
        { id: userId, attributes },
        env
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Batch evaluate multiple flags
router.post('/evaluate',
  validateBody(BulkEvaluateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { environment } = req.query;
      const env = (environment as string) || 'production';
      const { userId, flagKeys, attributes } = req.body;

      const results = await flagService.evaluateFlags(
        flagKeys,
        { id: userId, attributes },
        env
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Analytics Routes

// Get flag analytics
router.get('/:key/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { environment, startDate, endDate } = req.query;

    if (!environment) {
      res.status(400).json({
        error: 'Validation error',
        message: 'The "environment" query parameter is required',
      });
      return;
    }

    const events = await flagService.getFlagAnalytics(
      req.params.key,
      environment as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get flag statistics
router.get('/:key/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { environment } = req.query;

    if (!environment) {
      res.status(400).json({
        error: 'Validation error',
        message: 'The "environment" query parameter is required',
      });
      return;
    }

    const stats = await flagService.getFlagStats(req.params.key, environment as string);

    if (!stats) {
      res.json({
        success: true,
        data: null,
        message: 'No statistics available for this flag',
      });
      return;
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// Get all flag statistics
router.get('/stats/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { environment } = req.query;
    const stats = await flagService.getAllStats(environment as string | undefined);

    res.json({
      success: true,
      data: stats,
      count: stats.length,
    });
  } catch (error) {
    next(error);
  }
});

// Bulk Operations

// Bulk create flags
router.post('/bulk', validateBody(BulkCreateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flags = await flagService.bulkCreateFlags(req.body);
    res.status(201).json({
      success: true,
      data: flags,
      count: flags.length,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        error: 'Duplicate flag key',
        message: 'One or more flags with the specified keys already exist',
      });
      return;
    }
    next(error);
  }
});

// Copy flags between environments
router.post('/copy', validateBody(CopyFlagsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromEnvironment, toEnvironment, flagKeys } = req.body;
    const flags = await flagService.copyFlags(fromEnvironment, toEnvironment, flagKeys);

    res.status(201).json({
      success: true,
      data: flags,
      count: flags.length,
      message: `Copied ${flags.length} flags from ${fromEnvironment} to ${toEnvironment}`,
    });
  } catch (error) {
    next(error);
  }
});

// Maintenance Routes

// Cleanup old analytics data
router.post('/maintenance/cleanup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { daysToKeep } = req.body;
    const days = typeof daysToKeep === 'number' ? daysToKeep : 30;

    const deletedCount = await flagService.cleanupOldAnalytics(days);

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old analytics events`,
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
});

// Health check
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

router.use(errorHandler);

export default router;
