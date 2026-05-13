import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate route parameters against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid route parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

// ============================================
// Common Schemas
// ============================================

export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const ContactQuerySchema = PaginationSchema.extend({
  provider: z.enum(['hubspot', 'zoho']).optional(),
  syncStatus: z.enum(['synced', 'pending', 'conflict', 'error']).optional(),
  search: z.string().optional(),
  linkedRezUserId: z.string().optional(),
});

export const DealQuerySchema = PaginationSchema.extend({
  provider: z.enum(['hubspot', 'zoho']).optional(),
  stage: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});

export const CreateDealSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive().optional(),
  currency: z.string().default('USD'),
  stage: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  closeDate: z.string().datetime().optional(),
  contactId: z.string().optional(),
  companyName: z.string().optional(),
  description: z.string().optional(),
  provider: z.enum(['hubspot', 'zoho']).default('hubspot'),
});

export const LinkContactSchema = z.object({
  contactId: z.string(),
  rezUserId: z.string(),
});

export const SyncTriggerSchema = z.object({
  provider: z.enum(['hubspot', 'zoho']).optional(),
  entityType: z.enum(['contact', 'deal']).optional(),
  force: z.boolean().default(false),
});

export const ContactIdSchema = z.object({
  id: z.string(),
});

export default {
  validateBody,
  validateQuery,
  validateParams,
  ObjectIdSchema,
  PaginationSchema,
  ContactQuerySchema,
  DealQuerySchema,
  CreateDealSchema,
  LinkContactSchema,
  SyncTriggerSchema,
  ContactIdSchema,
};
