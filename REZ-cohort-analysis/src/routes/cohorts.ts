import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CohortRequest,
  CohortPeriod,
  CohortType,
  validateCohortRequest,
  UserActivity,
} from '../models/Cohort';
import {
  generateCohortGrid,
  generateRetentionCurve,
  calculateRevenueCohorts,
  analyzeTimeToConvert,
  compareSegmentsByRetention,
  createCohortDefinition,
  getCohortDefinition,
  listCohortDefinitions,
  deleteCohortDefinition,
} from '../services/cohortService';
import { getPeriodStart, getPeriodEnd } from '../services/retentionEngine';

const router = Router();

// ============= Request Validation Schemas =============

const CreateCohortSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['retention', 'revenue', 'conversion']),
  period: z.enum(['daily', 'weekly', 'monthly']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  segmentIds: z.array(z.string()).optional(),
  metrics: z.array(z.enum(['users', 'revenue', 'orders', 'conversions'])).optional(),
  maxPeriods: z.number().int().min(1).max(52).optional().default(12),
});

const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  period: z.enum(['daily', 'weekly', 'monthly']).optional().default('weekly'),
  segmentIds: z.array(z.string()).optional(),
});

const SegmentComparisonSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  period: z.enum(['daily', 'weekly', 'monthly']).optional().default('weekly'),
  segmentIds: z.array(z.string()).min(2).max(10),
});

// ============= Validation Middleware =============

function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
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

function validateQueryParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
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

// ============= Cohort Grid Endpoints =============

/**
 * POST /api/cohorts/generate
 * Generate a cohort grid with retention/revenue/conversion data
 */
router.post(
  '/generate',
  validateRequest(CreateCohortSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = req.body as z.infer<typeof CreateCohortSchema>;

      // Fetch user activities for the date range
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);

      const query: Record<string, unknown> = {
        cohortDate: { $gte: startDate, $lte: endDate },
        period: request.period,
      };

      if (request.segmentIds && request.segmentIds.length > 0) {
        query.segmentId = { $in: request.segmentIds };
      }

      const userActivities = await UserActivity.find(query).lean();

      if (userActivities.length === 0) {
        res.status(200).json({
          success: true,
          data: null,
          message: 'No activities found for the specified date range',
        });
        return;
      }

      const cohortGrid = await generateCohortGrid({
        request: {
          ...request,
          startDate: request.startDate,
          endDate: request.endDate,
        },
        userActivities,
        maxPeriods: request.maxPeriods,
      });

      res.status(200).json({
        success: true,
        data: cohortGrid,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cohorts/grid/:id
 * Retrieve a previously generated cohort grid
 */
router.get('/grid/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // In production, this would fetch from cache/database
    // For now, return a not found response
    res.status(404).json({
      success: false,
      error: 'Cohort grid not found',
      gridId: id,
    });
  } catch (error) {
    next(error);
  }
});

// ============= Retention Curve Endpoints =============

/**
 * GET /api/cohorts/retention-curve
 * Get aggregated retention curve data
 */
router.get(
  '/retention-curve',
  validateQueryParams(DateRangeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, period, segmentId } = req.query as {
        startDate?: string;
        endDate?: string;
        period?: CohortPeriod;
        segmentId?: string;
      };

      const cohortType: CohortType = 'retention';

      const result = await generateRetentionCurve(
        cohortType,
        period || 'weekly',
        segmentId
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cohorts/retention-curve/:cohortType
 * Get retention curve for specific cohort type
 */
router.get('/retention-curve/:cohortType', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cohortType } = req.params;
    const { period, segmentId } = req.query as {
      period?: CohortPeriod;
      segmentId?: string;
    };

    if (!['retention', 'revenue', 'conversion'].includes(cohortType)) {
      res.status(400).json({
        success: false,
        error: 'Invalid cohort type',
      });
      return;
    }

    const result = await generateRetentionCurve(
      cohortType as CohortType,
      period || 'weekly',
      segmentId
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ============= Revenue Cohort Endpoints =============

/**
 * GET /api/cohorts/revenue
 * Get revenue cohort analysis
 */
router.get(
  '/revenue',
  validateQueryParams(DateRangeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, period } = req.query as {
        startDate: string;
        endDate: string;
        period?: CohortPeriod;
      };

      const result = await calculateRevenueCohorts(
        new Date(startDate),
        new Date(endDate),
        period || 'monthly',
        6
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============= Time-to-Convert Endpoints =============

/**
 * GET /api/cohorts/time-to-convert
 * Analyze time taken for users to convert
 */
router.get(
  '/time-to-convert',
  validateQueryParams(DateRangeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query as {
        startDate: string;
        endDate: string;
      };

      const result = await analyzeTimeToConvert(
        new Date(startDate),
        new Date(endDate)
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============= Segment Comparison Endpoints =============

/**
 * POST /api/cohorts/compare-segments
 * Compare retention metrics across segments
 */
router.post(
  '/compare-segments',
  validateRequest(SegmentComparisonSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, period, segmentIds } = req.body as {
        startDate: string;
        endDate: string;
        period: CohortPeriod;
        segmentIds: string[];
      };

      const result = await compareSegmentsByRetention(
        new Date(startDate),
        new Date(endDate),
        period,
        segmentIds
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============= Cohort Definition CRUD =============

/**
 * POST /api/cohorts/definitions
 * Create a saved cohort definition
 */
router.post(
  '/definitions',
  validateRequest(CreateCohortSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = req.body as z.infer<typeof CreateCohortSchema>;

      const definition = await createCohortDefinition({
        name: request.name,
        type: request.type,
        period: request.period,
        startDate: request.startDate,
        endDate: request.endDate,
        segmentIds: request.segmentIds,
        metrics: request.metrics,
      });

      res.status(201).json({
        success: true,
        data: definition,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cohorts/definitions
 * List saved cohort definitions
 */
router.get('/definitions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, period, startDate, endDate } = req.query as {
      type?: CohortType;
      period?: CohortPeriod;
      startDate?: string;
      endDate?: string;
    };

    const filters: {
      type?: CohortType;
      period?: CohortPeriod;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (type) filters.type = type;
    if (period) filters.period = period;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const definitions = await listCohortDefinitions(filters);

    res.status(200).json({
      success: true,
      data: definitions,
      count: definitions.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cohorts/definitions/:id
 * Get a specific cohort definition
 */
router.get('/definitions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const definition = await getCohortDefinition(id);

    if (!definition) {
      res.status(404).json({
        success: false,
        error: 'Cohort definition not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: definition,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/cohorts/definitions/:id
 * Delete a cohort definition
 */
router.delete('/definitions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await deleteCohortDefinition(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Cohort definition not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Cohort definition deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ============= Export Endpoints =============

/**
 * POST /api/cohorts/export
 * Export cohort data in various formats
 */
router.post('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gridId, format } = req.body as {
      gridId: string;
      format: 'csv' | 'json';
    };

    if (!gridId) {
      res.status(400).json({
        success: false,
        error: 'Grid ID is required',
      });
      return;
    }

    if (format === 'csv') {
      const csv = await import('../services/cohortService').then(m => m.exportCohortAsCSV(gridId));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="cohort-${gridId}.csv"`);
      res.status(200).send(csv);
    } else {
      const json = await import('../services/cohortService').then(m => m.exportCohortAsJSON(gridId));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="cohort-${gridId}.json"`);
      res.status(200).send(json);
    }
  } catch (error) {
    next(error);
  }
});

// ============= Health Check =============

/**
 * GET /api/cohorts/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'cohort-analysis',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
