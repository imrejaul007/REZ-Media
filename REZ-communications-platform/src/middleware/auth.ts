/**
 * Authentication Middleware for REZ Communications Platform
 *
 * Validates service-to-service communication using internal service tokens.
 * This follows the security pattern from CLAUDE.md:
 * "Internal endpoints use X-Internal-Token header for authentication"
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

export interface AuthenticatedRequest extends Request {
  serviceName?: string;
  isInternalService?: boolean;
}

// Service tokens stored as JSON map: {"service-name": "token"}
interface ServiceTokensMap {
  [serviceName: string]: string;
}

let serviceTokens: ServiceTokensMap = {};

/**
 * Initialize service tokens from environment variable
 */
export function initializeServiceTokens(): void {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (tokensJson) {
    try {
      serviceTokens = JSON.parse(tokensJson);
    } catch (error) {
      console.error('Failed to parse INTERNAL_SERVICE_TOKENS_JSON:', error);
      serviceTokens = {};
    }
  }
}

/**
 * Get all registered service names
 */
export function getRegisteredServices(): string[] {
  return Object.keys(serviceTokens);
}

/**
 * Validates the internal service token from the X-Internal-Token header.
 *
 * The token should be in format: "Bearer <token>" or just the token directly.
 * When a token matches, we return the associated service name.
 */
function validateToken(token: string | undefined): string | null {
  if (!token) return null;

  // Remove "Bearer " prefix if present
  const cleanToken = token.startsWith('Bearer ')
    ? token.slice(7)
    : token;

  // Check against all registered service tokens
  for (const [serviceName, serviceToken] of Object.entries(serviceTokens)) {
    if (serviceToken === cleanToken) {
      return serviceName;
    }
  }

  return null;
}

/**
 * Authentication middleware for internal service-to-service calls.
 * Validates X-Internal-Token header against registered service tokens.
 */
export function internalServiceAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing X-Internal-Token header'
      }
    });
    return;
  }

  const serviceName = validateToken(token);

  if (!serviceName) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid service token'
      }
    });
    return;
  }

  // Attach service info to request for downstream use
  req.serviceName = serviceName;
  req.isInternalService = true;

  next();
}

/**
 * Optional authentication middleware - allows unauthenticated requests
 * but attaches service info if token is present.
 */
export function optionalInternalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (token) {
    const serviceName = validateToken(token);
    if (serviceName) {
      req.serviceName = serviceName;
      req.isInternalService = true;
    }
  }

  next();
}

/**
 * Combined auth middleware that:
 * 1. Checks for internal service token (service-to-service)
 * 2. Falls back to JWT verification (user requests)
 *
 * For the marketing hub, we primarily use internal service auth.
 */
export function combinedAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const internalToken = req.headers['x-internal-token'] as string | undefined;

  if (internalToken) {
    const serviceName = validateToken(internalToken);
    if (serviceName) {
      req.serviceName = serviceName;
      req.isInternalService = true;
      return next();
    }
  }

  // For user-facing endpoints that need JWT auth, add JWT verification here
  // For now, if no internal token, check for JWT in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // TODO: Add JWT verification logic here if needed
    // For marketing hub, we primarily rely on internal service tokens
  }

  // If no valid auth, return error for protected routes
  res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Valid authentication required'
    }
  });
}

/**
 * Rate limiting middleware per service
 */
const serviceRateLimits: Map<string, { count: number; resetTime: number }> = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 1000; // Adjust based on requirements

export function rateLimitByService(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const serviceName = req.serviceName || 'anonymous';

  const now = Date.now();
  const record = serviceRateLimits.get(serviceName);

  if (!record || now > record.resetTime) {
    // New window
    serviceRateLimits.set(serviceName, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    });
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX_REQUESTS - 1);
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + RATE_LIMIT_WINDOW_MS) / 1000));
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      }
    });
    return;
  }

  record.count++;
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX_REQUESTS - record.count);
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

  next();
}

/**
 * Audit logging middleware for tracking service calls
 */
export function auditLogger(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      service: req.serviceName || 'unknown',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };

    if (res.statusCode >= 400) {
      console.error('AUDIT_FAILURE:', JSON.stringify(logData));
    } else {
      console.log('AUDIT_SUCCESS:', JSON.stringify(logData));
    }
  });

  next();
}

/**
 * CORS configuration for REZ services
 */
export function corsConfig(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const origin = req.headers.origin;

  // Allow REZ domains
  const allowedOrigins = [
    'http://localhost:*',
    'https://rez.io',
    'https://*.rez.io',
    process.env.ALLOWED_ORIGIN
  ].filter(Boolean);

  const isAllowed = allowedOrigins.some(allowed =>
    allowed?.includes('*')
      ? origin?.includes('rez.io') || origin?.includes('localhost')
      : origin === allowed
  );

  if (isAllowed || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Token, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
