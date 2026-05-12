import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { logger } from '../utils/logger';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: { errors },
          },
        });
        return;
      }
      next(error);
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query validation failed',
            details: { errors },
          },
        });
        return;
      }
      next(error);
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parameter validation failed',
            details: { errors },
          },
        });
        return;
      }
      next(error);
    }
  };
}

export const merchantProvisionSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  businessName: z.string().min(1, 'Business name is required').max(100),
  businessEmail: z.string().email('Valid email is required'),
  businessPhone: z.string().min(10, 'Valid phone number is required'),
  industry: z.string().min(1, 'Industry is required'),
  useCase: z.string().min(1, 'Use case is required'),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const phoneNumberProvisionSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  subaccountSid: z.string().min(1, 'Subaccount SID is required'),
  countryCode: z.string().length(2, 'Country code must be 2 characters'),
  type: z.enum(['local', 'mobile', 'toll_free']).optional().default('local'),
  areaCode: z.string().max(6).optional(),
  phoneNumber: z.string().optional(),
  friendlyName: z.string().max(100).optional(),
  capabilities: z
    .object({
      voice: z.boolean().optional(),
      sms: z.boolean().optional(),
      mms: z.boolean().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const templateCreateSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  subaccountSid: z.string().min(1, 'Subaccount SID is required'),
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, 'Template name must be lowercase alphanumeric with underscores'),
  language: z.string().length(2, 'Language code must be 2 characters'),
  category: z.enum(['marketing', 'utility', 'authentication']),
  components: z
    .array(
      z.object({
        type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
        format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
        text: z.string().max(1024).optional(),
        mediaUrl: z.string().url().optional(),
        buttons: z
          .array(
            z.object({
              type: z.enum(['PHONE_NUMBER', 'URL', 'QUICK_REPLY']),
              text: z.string().max(25),
              phoneNumber: z.string().optional(),
              url: z.string().optional(),
            })
          )
          .max(3)
          .optional(),
        example: z
          .object({
            header_text: z.array(z.string()).optional(),
            body_text: z.array(z.array(z.string())).optional(),
          })
          .optional(),
      })
    )
    .min(1, 'At least one component is required'),
  metadata: z.record(z.unknown()).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const phoneNumberSearchSchema = z.object({
  countryCode: z.string().length(2, 'Country code must be 2 characters'),
  type: z.enum(['local', 'mobile', 'toll_free']).optional(),
  areaCode: z.string().max(6).optional(),
  contains: z.string().max(10).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
