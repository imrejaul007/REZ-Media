import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Validate request body against Zod schema
 */
export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        logger.warn('Request validation failed', {
          path: req.path,
          errors,
        });
        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      req.body = result.data;
      next();
    } catch (error) {
      logger.error('Validation middleware error', { error });
      res.status(500).json({ error: 'Validation error' });
    }
  };
}

/**
 * Validate request query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        logger.warn('Query validation failed', {
          path: req.path,
          errors,
        });
        res.status(400).json({
          error: 'Invalid query parameters',
          details: errors,
        });
        return;
      }

      req.query = result.data;
      next();
    } catch (error) {
      logger.error('Query validation middleware error', { error });
      res.status(500).json({ error: 'Validation error' });
    }
  };
}

/**
 * Validate request parameters
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        logger.warn('Params validation failed', {
          path: req.path,
          errors,
        });
        res.status(400).json({
          error: 'Invalid parameters',
          details: errors,
        });
        return;
      }

      req.params = result.data;
      next();
    } catch (error) {
      logger.error('Params validation middleware error', { error });
      res.status(500).json({ error: 'Validation error' });
    }
  };
}

/**
 * Format Zod errors into a readable format
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

// Common validation schemas
export const schemas = {
  pagination: z.object({
    limit: z.coerce.number().min(1).max(100).optional().default(50),
    offset: z.coerce.number().min(0).optional().default(0),
  }),

  instagramId: z.object({
    instagramId: z.string().min(1),
  }),

  threadId: z.object({
    threadId: z.string().min(1),
  }),

  commentId: z.object({
    commentId: z.string().min(1),
  }),

  message: z.object({
    message: z.string().min(1).max(2000),
  }),
};
