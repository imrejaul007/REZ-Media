/**
 * API Routes for Prompt-to-Workflow AI Service
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getWorkflowGenerator, WorkflowGeneratorError } from '../services/workflowGenerator';
import { validateWorkflow } from '../services/schemaValidator';
import { optimizeWorkflow } from '../services/optimizationService';
import {
  getAllTemplates,
  getTemplatesByCategory,
  getPopularTemplates,
  getCategories,
  generateWorkflowFromTemplate,
  getTemplateById,
} from '../services/templateService';
import {
  generateWorkflowRequestSchema,
  generateStepRequestSchema,
  validateWorkflowRequestSchema,
  optimizeWorkflowRequestSchema,
  generateTemplateRequestSchema,
  templateWithPromptRequestSchema,
  importWorkflowRequestSchema,
} from '../utils/schema';
import config from '../config';
import logger from '../utils/logger';
import type {
  GenerateWorkflowRequest,
  ValidateWorkflowRequest,
  OptimizeWorkflowRequest,
  ImportWorkflowRequest,
} from '../types';

const router = Router();

/**
 * Error handler wrapper
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validate request body against schema
 */
function validateRequest<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  return schema.parse(data);
}

/**
 * POST /api/generate
 * Generate workflow from natural language prompt
 */
router.post(
  '/generate',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const generator = getWorkflowGenerator();

    const body = validateRequest(generateWorkflowRequestSchema, req.body);
    const { prompt, options } = body as GenerateWorkflowRequest;

    logger.info('Received workflow generation request', {
      promptLength: prompt.length,
      options,
    });

    const result = await generator.generateWorkflow(prompt, options);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/generate/step
 * Generate a single workflow step
 */
router.post(
  '/generate/step',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const generator = getWorkflowGenerator();

    const body = validateRequest(generateStepRequestSchema, req.body);
    const { prompt, context } = body;

    logger.info('Received step generation request', {
      promptLength: prompt.length,
      hasContext: !!context,
    });

    const result = await generator.generateStep(prompt, context);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/validate
 * Validate a generated workflow
 */
router.post(
  '/validate',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = validateRequest(validateWorkflowRequestSchema, req.body);
    const { workflow } = body as ValidateWorkflowRequest;

    logger.info('Validating workflow', { name: workflow.name });

    const result = validateWorkflow(workflow);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/optimize
 * Optimize an existing workflow
 */
router.post(
  '/optimize',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const generator = getWorkflowGenerator();

    const body = validateRequest(optimizeWorkflowRequestSchema, req.body);
    const { workflow, goals } = body as OptimizeWorkflowRequest;

    logger.info('Optimizing workflow', {
      name: workflow.name,
      goals: goals?.join(', '),
    });

    const result = await generator.optimizeWorkflow(workflow, goals);

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/templates
 * Get suggested workflow templates
 */
router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { category, popular, limit } = req.query;

    let templates = getAllTemplates();

    if (category) {
      templates = getTemplatesByCategory(category as string);
    }

    if (popular === 'true') {
      templates = getPopularTemplates(limit ? parseInt(limit as string, 10) : 5);
    }

    res.json({
      success: true,
      data: {
        templates,
        categories: getCategories(),
      },
    });
  })
);

/**
 * GET /api/templates/:id
 * Get a specific template
 */
router.get(
  '/templates/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const template = getTemplateById(id);

    if (!template) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: `Template not found: ${id}`,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: template,
    });
  })
);

/**
 * POST /api/templates/from-prompt
 * Generate workflow from template with prompt modifications
 */
router.post(
  '/templates/from-prompt',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const generator = getWorkflowGenerator();

    const body = validateRequest(templateWithPromptRequestSchema, req.body);
    const { templateId, prompt, modifications } = body;

    logger.info('Generating workflow from template with prompt', {
      templateId,
      promptLength: prompt.length,
    });

    // First, try to use the template
    let result = generator.generateFromTemplate(templateId, {
      name: modifications?.name,
      description: modifications?.description,
      triggerDays: modifications?.trigger?.days,
    });

    // Then, use AI to apply the prompt modifications
    if (prompt) {
      try {
        const fullPrompt = `Modify the following workflow according to these instructions: ${prompt}

Current workflow:
${JSON.stringify(result.workflow, null, 2)}

Return the modified workflow as JSON.`;

        const aiResult = await generator.generateWorkflow(fullPrompt);
        result = aiResult;
      } catch (error) {
        logger.warn('Failed to apply prompt modifications, returning template as-is', {
          error,
        });
      }
    }

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/journeys/import
 * Import generated workflow to journey service
 */
router.post(
  '/journeys/import',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = validateRequest(importWorkflowRequestSchema, req.body);
    const { workflow, targetJourneyId, duplicateCheck } = body as ImportWorkflowRequest;

    logger.info('Importing workflow to journey service', {
      workflowName: workflow.name,
      targetJourneyId,
    });

    // Validate workflow before import
    const validation = validateWorkflow(workflow);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_WORKFLOW',
          message: 'Cannot import invalid workflow',
          details: validation.errors,
        },
      });
      return;
    }

    // Check for duplicates if requested
    if (duplicateCheck) {
      // TODO: Implement duplicate check with journey service
      logger.info('Duplicate check requested', { workflowName: workflow.name });
    }

    // Import to journey service
    try {
      const response = await fetch(`${config.journeyServiceUrl}/api/journeys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': config.internalServiceToken,
        },
        body: JSON.stringify({
          workflow,
          source: 'prompt-workflow-ai',
          importedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Journey service returned ${response.status}`);
      }

      const data = await response.json();

      res.json({
        success: true,
        data: {
          success: true,
          journeyId: data.journeyId || data.id,
          workflowId: data.workflowId,
          warnings: validation.warnings,
        },
      });
    } catch (error) {
      logger.error('Failed to import workflow to journey service', { error });

      // If journey service is unavailable, return workflow for manual import
      res.json({
        success: true,
        data: {
          success: false,
          journeyId: null,
          workflow: workflow,
          warning:
            'Journey service unavailable. Workflow returned for manual import.',
          validation: validation,
        },
      });
    }
  })
);

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    service: 'rez-prompt-workflow-ai',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/metrics
 * Service metrics (placeholder)
 */
router.get('/metrics', (_req: Request, res: Response): void => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Error handling middleware
 */
router.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    logger.error('API Error', {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    if (err instanceof WorkflowGeneratorError) {
      res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
      return;
    }

    if (err.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: err,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      },
    });
  }
);

export default router;
