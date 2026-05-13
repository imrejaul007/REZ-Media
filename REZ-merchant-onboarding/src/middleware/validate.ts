import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validate = (options: ValidationOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (options.body) {
        req.body = await options.body.parseAsync(req.body);
      }
      if (options.query) {
        req.query = await options.query.parseAsync(req.query);
      }
      if (options.params) {
        req.params = await options.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors
        });
        return;
      }
      next(error);
    }
  };
};

// Common validation schemas
export const schemas = {
  // Auth schemas
  register: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          email: z.string().email('Invalid email format'),
          password: z.string().min(8, 'Password must be at least 8 characters'),
          phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
          fullName: z.string().min(2, 'Name must be at least 2 characters').max(100)
        });
        return schema.parse(data);
      }
    }
  },

  login: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          email: z.string().email('Invalid email format'),
          password: z.string().min(1, 'Password is required')
        });
        return schema.parse(data);
      }
    }
  },

  verifyEmail: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          token: z.string().min(1, 'Verification token is required')
        });
        return schema.parse(data);
      }
    }
  },

  resendVerification: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          email: z.string().email('Invalid email format')
        });
        return schema.parse(data);
      }
    }
  },

  // Business schemas
  updateBusiness: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          businessName: z.string().min(2).max(200).optional(),
          businessType: z.enum(['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited']).optional(),
          gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN').optional(),
          businessAddress: z.object({
            street: z.string().optional(),
            city: z.string().min(1),
            state: z.string().min(1),
            pincode: z.string().regex(/^\d{6}$/, 'Invalid 6-digit pincode'),
            country: z.string().default('India')
          }).optional()
        });
        return schema.parse(data);
      }
    }
  },

  // Bank details schema
  updateBankDetails: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          accountHolderName: z.string().min(2).max(100),
          accountNumber: z.string().regex(/^\d{9,18}$/, 'Invalid account number'),
          ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
          bankName: z.string().min(2).max(100),
          branchName: z.string().optional()
        });
        return schema.parse(data);
      }
    }
  },

  // KYC schemas
  submitKYC: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN number').optional(),
          aadhaarNumber: z.string().regex(/^\d{12}$/, 'Invalid 12-digit Aadhaar number').optional(),
          permanentAddress: z.object({
            street: z.string().optional(),
            city: z.string().min(1),
            state: z.string().min(1),
            pincode: z.string().regex(/^\d{6}$/, 'Invalid 6-digit pincode'),
            country: z.string().default('India')
          }).optional()
        });
        return schema.parse(data);
      }
    }
  },

  // Approval schemas
  reviewKYC: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          merchantId: z.string().min(1, 'Merchant ID is required'),
          action: z.enum(['approve', 'reject']),
          rejectionReason: z.string().optional()
        });
        return schema.parse(data);
      }
    }
  },

  reviewBusiness: {
    body: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          merchantId: z.string().min(1, 'Merchant ID is required'),
          action: z.enum(['approve', 'reject']),
          rejectionReason: z.string().optional()
        });
        return schema.parse(data);
      }
    }
  },

  // Pagination schemas
  pagination: {
    query: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          page: z.string().regex(/^\d+$/).transform(Number).default('1'),
          limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
          status: z.string().optional(),
          search: z.string().optional(),
          sortBy: z.string().default('createdAt'),
          sortOrder: z.enum(['asc', 'desc']).default('desc')
        });
        return schema.parse(data);
      }
    }
  },

  // MongoDB ID validation
  mongoId: {
    params: {
      parse: (data: unknown) => {
        const { z } = require('zod');
        const schema = z.object({
          id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format')
        });
        return schema.parse(data);
      }
    }
  }
};
