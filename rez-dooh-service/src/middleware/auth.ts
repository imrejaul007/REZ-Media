/**
 * DOOH Service - Authentication Middleware
 *
 * Validates internal service tokens and API keys for service-to-service communication.
 * Includes Redis-based rate limiting with in-memory fallback.
 */

import { Request, Response, NextFunction } from 'express';

// Lazy import Redis to avoid circular dependencies
let redisModule: typeof import('../cache') | null = null;

async function getRedisModule() {
  if (!redisModule) {
    redisModule = await import('../cache');
  }
  return redisModule;
}

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

// Timing-safe string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const internalToken = req.headers['x-internal-token'] as string;
    const apiKey = req.headers['x-api-key'] as string;

    // Skip auth for health/ready/metrics endpoints
    if (req.path === '/health' || req.path === '/ready' || req.path === '/metrics') {
      return next();
    }

    // Check internal service token
    if (internalToken) {
      // If specific service required, check against that service's token
      if (config.requiredService) {
        const expectedToken = SERVICE_TOKENS[config.requiredService];
        if (expectedToken && timingSafeEqual(internalToken, expectedToken)) {
          (req as any).authenticatedService = config.requiredService;
          return next();
        }
      }

      // Otherwise, accept any valid internal token
      const isValidInternalToken = Object.values(SERVICE_TOKENS).some(
        (token) => timingSafeEqual(token, internalToken)
      );

      if (isValidInternalToken) {
        return next();
      }
    }

    // Check API key for screen device auth
    if (config.allowApiKey && apiKey) {
      const validApiKey = process.env.DOOH_API_KEY;
      if (validApiKey && timingSafeEqual(apiKey, validApiKey)) {
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

  if (!timingSafeEqual(apiKey, validApiKey)) {
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
    `dooh-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;

  next();
}

// =============================================================================
// Rate Limiting (Redis with In-Memory Fallback)
// =============================================================================

const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Rate limiting middleware with Redis support
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = `ratelimit:${req.ip || 'unknown'}:${req.path}`;

  // Try Redis first, fallback to in-memory
  getRedisModule()
    .then((redis) => {
      return redis.checkRateLimit(key, {
        windowMs: RATE_LIMIT_WINDOW_MS,
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
      });
    })
    .then((result) => {
      setRateLimitHeaders(res, RATE_LIMIT_MAX_REQUESTS, result);

      if (!result.allowed) {
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: result.retryAfter,
        });
        return;
      }

      next();
    })
    .catch(() => {
      // Redis unavailable, use in-memory fallback
      applyInMemoryRateLimit(req, res, next, rateLimitStore, RATE_LIMIT_MAX_REQUESTS);
    });
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
  const WRITE_LIMIT = 30; // 30 writes per minute

  getRedisModule()
    .then((redis) => {
      return redis.checkRateLimit(key, {
        windowMs: RATE_LIMIT_WINDOW_MS,
        maxRequests: WRITE_LIMIT,
      });
    })
    .then((result) => {
      setRateLimitHeaders(res, WRITE_LIMIT, result);

      if (!result.allowed) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded for write operations',
          retryAfter: result.retryAfter,
        });
        return;
      }

      next();
    })
    .catch(() => {
      // Redis unavailable, use in-memory fallback
      applyInMemoryRateLimit(req, res, next, new Map(), WRITE_LIMIT);
    });
}

function setRateLimitHeaders(
  res: Response,
  limit: number,
  result: { remaining: number; resetAt: number }
): void {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
}

function applyInMemoryRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
  store: Map<string, { count: number; resetTime: number }>,
  maxRequests: number
): void {
  const key = `${req.ip || 'unknown'}:${req.path}`;
  const now = Date.now();

  let record = store.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    store.set(key, record);
  }

  record.count++;

  setRateLimitHeaders(res, maxRequests, {
    remaining: Math.max(0, maxRequests - record.count),
    resetAt: record.resetTime,
    allowed: record.count <= maxRequests,
  });

  if (record.count > maxRequests) {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
    return;
  }

  next();
}

// =============================================================================
// Idempotency Middleware
// =============================================================================

/**
 * Idempotency middleware for write operations
 */
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey) {
    next();
    return;
  }

  getRedisModule()
    .then((redis) => {
      return redis.checkIdempotency(idempotencyKey);
    })
    .then((result) => {
      if (!result.isNew && result.cachedResponse) {
        // Return cached response
        res.status(200).json(result.cachedResponse);
        return;
      }
      // Continue and cache the response
      next();
    })
    .catch(() => {
      // Redis unavailable, proceed without idempotency
      next();
    });
}
