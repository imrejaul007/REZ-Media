/**
 * DOOH Service - Authentication Middleware
 *
 * Validates internal service tokens and API keys for service-to-service communication.
 */

import { Request, Response, NextFunction } from 'express';

// Parse internal service tokens from environment
function getServiceTokens(): Record<string, string> {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (!tokensJson) {
    return {};
  }
  try {
    return JSON.parse(tokensJson);
  } catch {
    console.error('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return {};
  }
}

const SERVICE_TOKENS = getServiceTokens();

export interface AuthConfig {
  requiredService?: string; // Required service name for service-to-service auth
  allowApiKey?: boolean; // Allow API key auth for screen devices
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const internalToken = req.headers['x-internal-token'] as string;
    const apiKey = req.headers['x-api-key'] as string;

    // Skip auth for health/ready endpoints
    if (req.path === '/health' || req.path === '/ready') {
      return next();
    }

    // Check internal service token
    if (internalToken) {
      // If specific service required, check against that service's token
      if (config.requiredService) {
        const expectedToken = SERVICE_TOKENS[config.requiredService];
        if (expectedToken && internalToken === expectedToken) {
          return next();
        }
      }

      // Otherwise, accept any valid internal token
      const isValidInternalToken = Object.values(SERVICE_TOKENS).some(
        (token) => token === internalToken
      );

      if (isValidInternalToken) {
        return next();
      }
    }

    // Check API key for screen device auth
    if (config.allowApiKey && apiKey) {
      const validApiKey = process.env.DOOH_API_KEY;
      if (validApiKey && apiKey === validApiKey) {
        return next();
      }
    }

    // Authentication failed
    console.warn(`[AUTH] Unauthorized access attempt: ${req.method} ${req.path} from ${req.ip}`);

    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Valid authentication token or API key required',
    });
  };
}

/**
 * Middleware for screen device authentication
 * Used for screen heartbeat and playlist endpoints
 */
export function screenAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key required',
    });
    return;
  }

  const validApiKey = process.env.DOOH_API_KEY;
  if (!validApiKey) {
    console.error('[AUTH] DOOH_API_KEY not configured');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
    return;
  }

  if (apiKey !== validApiKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  next();
}

/**
 * Request ID middleware - adds unique ID for tracing
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `dooh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;

  next();
}

/**
 * Rate limiting store (in-memory, use Redis in production)
 */
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = req.ip || 'unknown';
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, record);
  }

  record.count++;

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader(
    'X-RateLimit-Remaining',
    Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count)
  );
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
    return;
  }

  next();
}

/**
 * Stricter rate limit for write operations
 */
export function writeRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = `write:${req.ip || 'unknown'}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, record);
  }

  record.count++;

  const WRITE_LIMIT = 30; // 30 writes per minute

  res.setHeader('X-RateLimit-Limit', WRITE_LIMIT);
  res.setHeader(
    'X-RateLimit-Remaining',
    Math.max(0, WRITE_LIMIT - record.count)
  );
  res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

  if (record.count > WRITE_LIMIT) {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for write operations',
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
    return;
  }

  next();
}
