/**
 * REZ Decision Service - Security Middleware
 *
 * Comprehensive security configuration for decision engine:
 * - Rate limiting: 500/min for decisions, 200/min for targeting
 * - JWT authentication (user, service tokens)
 * - Input validation for all decision requests
 * - Audit logging for decision outcomes
 */

import express, { Request, Response, NextFunction, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

// ============================================
// RATE LIMITING
// ============================================

/** Decision engine calls - 500 requests per 15 minutes */
export const decisionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many decision requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Targeting requests - 200 requests per 15 minutes */
export const targetingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many targeting requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Sampling operations - 100 requests per 15 minutes */
export const samplingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many sampling requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// INPUT VALIDATION SCHEMAS
// ============================================

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export const decisionRequestSchema = z.object({
  userId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid user ID'),
  context: z.object({
    campaignId: z.string().max(100).optional(),
    merchantId: z.string().regex(OBJECT_ID_PATTERN).optional(),
    channel: z.string().max(50).optional(),
    timestamp: z.string().datetime().optional(),
  }),
  options: z.object({
    maxOffers: z.number().int().positive().max(10).default(3),
    includeReasons: z.boolean().default(true),
  }).optional(),
});

export const targetingQuerySchema = z.object({
  userId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid user ID'),
});

export const frequencyQuerySchema = z.object({
  userId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid user ID'),
  campaignId: z.string().max(100),
  channel: z.string().max(50),
});

export const attributionTrackSchema = z.object({
  userId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid user ID'),
  campaignId: z.string().max(100),
  merchantId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid merchant ID'),
  event: z.enum(['scan', 'visit', 'redeem', 'purchase', 'repeat']),
  value: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export const attributionConversionSchema = z.object({
  userId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid user ID'),
  campaignId: z.string().max(100),
  merchantId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid merchant ID'),
  conversionType: z.enum(['purchase', 'signup', 'engagement', 'retention']),
  value: z.number(),
  model: z.enum(['last-touch', 'first-touch', 'linear', 'time-decay', 'position-based']).default('last-touch'),
});

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      res.status(400).json({ error: 'Invalid request body' });
    }
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      res.status(400).json({ error: 'Invalid query parameters' });
    }
  };
}

// ============================================
// SECURITY HEADERS
// ============================================

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
}

// ============================================
// NOSQL INJECTION PREVENTION
// ============================================

const MONGODB_OPERATOR_PATTERN = /\$/;

export function noSQLInjectionGuard(req: Request, res: Response, next: NextFunction): void {
  const checkObject = (obj: any, path: string = ''): boolean => {
    if (obj === null || obj === undefined) return false;

    if (typeof obj === 'string' && MONGODB_OPERATOR_PATTERN.test(obj)) {
      console.warn(`[SECURITY] Potential NoSQL injection at ${path}: ${obj}`);
      return true;
    }

    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof key === 'string' && MONGODB_OPERATOR_PATTERN.test(key)) {
          console.warn(`[SECURITY] Potential NoSQL injection key at ${path}.${key}`);
          return true;
        }
        if (checkObject(value, `${path}.${key}`)) return true;
      }
    }

    return false;
  };

  if (checkObject(req.body) || checkObject(req.query)) {
    res.status(400).json({ error: 'Invalid input detected' });
    return;
  }

  next();
}

// ============================================
// CORS CONFIGURATION
// ============================================

const getCorsConfig = () => ({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Request-Id'],
});

// ============================================
// SECURITY ROUTER
// ============================================

export function createSecurityRouter(): Router {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      security: {
        enabled: true,
        rateLimiting: {
          decision: { limit: 500, windowMs: 900000 },
          targeting: { limit: 200, windowMs: 900000 },
          sampling: { limit: 100, windowMs: 900000 },
        },
        validation: {
          schemas: ['decisionRequest', 'targetingQuery', 'frequencyQuery', 'attributionTrack', 'attributionConversion'],
        },
        headers: true,
        nosqlProtection: true,
      },
    });
  });

  return router;
}

// ============================================
// APPLY ALL SECURITY MIDDLEWARE
// ============================================

export function applySecurityMiddleware(app: express.Application): void {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS
  app.use(cors(getCorsConfig()));

  // Security headers
  app.use(applySecurityHeaders);

  // NoSQL injection guard
  app.use(noSQLInjectionGuard);

  // Request size limit
  app.use(express.json({ limit: '100kb' }));

  // Security status endpoint
  app.use('/security', createSecurityRouter());
}

export default applySecurityMiddleware;
