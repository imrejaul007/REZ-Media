import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      internalService?: string;
    }
  }
}

/**
 * Internal service authentication middleware
 * Validates X-Internal-Token header for service-to-service communication
 */
export function internalServiceAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    logger.warn('Missing internal token', {
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'X-Internal-Token header is missing',
    });
    return;
  }

  // Parse service tokens from environment
  const serviceTokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';

  let serviceTokens: Record<string, string>;

  try {
    serviceTokens = JSON.parse(serviceTokensJson);
  } catch {
    logger.error('Invalid INTERNAL_SERVICE_TOKENS_JSON format');
    res.status(500).json({
      success: false,
      error: 'Server configuration error',
    });
    return;
  }

  // Find which service owns this token
  const callingService = Object.entries(serviceTokens).find(
    ([, tokenValue]) => tokenValue === token
  )?.[0];

  if (!callingService) {
    logger.warn('Invalid internal token', {
      path: req.path,
      ip: req.ip,
    });

    res.status(403).json({
      success: false,
      error: 'Invalid token',
      message: 'The provided internal token is not valid',
    });
    return;
  }

  // Attach calling service to request
  req.internalService = callingService;

  logger.debug('Internal service authenticated', {
    service: callingService,
    path: req.path,
  });

  next();
}

/**
 * Optional internal auth - doesn't block if no token provided
 * Useful for endpoints that can be called both internally and externally
 */
export function optionalInternalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    // No token provided, continue without authentication
    next();
    return;
  }

  // If token is provided, validate it
  internalServiceAuth(req, res, next);
}

/**
 * Rate limiting middleware for public endpoints
 */
export function publicRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Rate limiting is handled by express-rate-limit middleware
  // This is a placeholder for custom rate limiting logic
  next();
}

/**
 * Admin-only access middleware
 */
export function adminOnly(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminToken = req.headers['x-admin-token'] as string;
  const expectedAdminToken = process.env.ADMIN_TOKEN;

  if (!expectedAdminToken) {
    logger.error('Admin token not configured');
    res.status(500).json({
      success: false,
      error: 'Server configuration error',
    });
    return;
  }

  if (adminToken !== expectedAdminToken) {
    logger.warn('Unauthorized admin access attempt', {
      path: req.path,
      ip: req.ip,
    });

    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required',
    });
    return;
  }

  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    internalService: req.internalService,
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      internalService: req.internalService,
    });
  });

  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    internalService: req.internalService,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
}
