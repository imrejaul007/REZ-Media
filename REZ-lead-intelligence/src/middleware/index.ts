/**
 * Lead Intelligence Service - Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { logger } from '@rez/shared';

// ── TypeScript declaration merging ────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      merchantId?: string;
      isAdmin?: boolean;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env.LEAD_INTEL_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('LEAD_INTEL_JWT_SECRET or JWT_SECRET env var is required');
  }
  return secret;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/**
 * Validation error handler
 */
export const validationErrorHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array(),
      },
    });
    return;
  }
  next();
};

/**
 * Async handler wrapper to catch promise rejections
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};

/**
 * Global error handler
 */
export const errorHandler = (
  err: Error & { statusCode?: number; code?: string },
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  logger.error('[Error Handler]', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: statusCode === 500 ? 'Internal server error' : err.message,
    },
  });
};

/**
 * Request logger middleware
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('[Request]', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.headers['x-request-id'],
    });
  });

  next();
};

/**
 * Rate limiter helper (placeholder - use express-rate-limit in production)
 */
export const rateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 60000
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Placeholder implementation
    // In production, use express-rate-limit with Redis store
    next();
  };
};

/**
 * Auth middleware - validates JWT and attaches user to request
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = extractBearer(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as Record<string, unknown>;

    // Extract userId from various possible token shapes
    req.userId = (payload.userId || payload._id || payload.id) as string | undefined;

    // Extract merchantId if present
    const merchant = payload.merchant as Record<string, unknown> | undefined;
    if (merchant?._id) {
      req.merchantId = String(merchant._id);
    } else if (payload.merchantId) {
      req.merchantId = String(payload.merchantId);
    }

    // Check for admin role
    if (payload.role === 'admin') {
      req.isAdmin = true;
    }

    next();
  } catch (error) {
    logger.warn('[Auth] JWT verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
};

/**
 * Service-to-service auth middleware with timing-safe comparison
 */
export const serviceAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Accept both header names for compatibility with all REZ services
  const serviceToken = req.headers['x-internal-token'] || req.headers['x-internal-key'];

  if (!serviceToken) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Service token required',
      },
    });
    return;
  }

  // Accept both env var names
  const expectedToken = process.env.INTERNAL_SERVICE_KEY || process.env.INTERNAL_SERVICE_TOKEN;

  if (!expectedToken) {
    logger.error('[ServiceAuth] Internal service token not configured');
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Internal service key not configured',
      },
    });
    return;
  }

  // Convert to string and validate
  const tokenStr = typeof serviceToken === 'string' ? serviceToken : String(serviceToken);

  // Reject blank tokens to prevent timing-safe-equal bypass
  if (tokenStr.trim().length === 0) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid internal service key',
      },
    });
    return;
  }

  // Use timing-safe comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(tokenStr);
  const expectedBuffer = Buffer.from(expectedToken);

  let keysMatch: boolean;
  try {
    keysMatch = crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch {
    // Throws if buffers have different lengths
    keysMatch = false;
  }

  if (!keysMatch) {
    logger.warn('[ServiceAuth] Invalid service token attempt', { ip: req.ip });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid internal service key',
      },
    });
    return;
  }

  next();
};
