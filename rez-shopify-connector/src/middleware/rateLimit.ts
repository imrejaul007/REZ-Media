import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../config/redis';
import { rateLimitConfig, logger } from '../config';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  skipFailedRequests?: boolean;
  handler?: (req: Request, res: Response) => void;
  message?: string;
  statusCode?: number;
}

/**
 * Create a rate limiting middleware
 */
export function rateLimit(options?: Partial<RateLimitConfig>) {
  const config: Required<RateLimitConfig> = {
    windowMs: options?.windowMs ?? rateLimitConfig.windowMs,
    max: options?.max ?? rateLimitConfig.requests,
    keyPrefix: options?.keyPrefix ?? 'rl',
    skipFailedRequests: options?.skipFailedRequests ?? false,
    handler: options?.handler ?? defaultRateLimitHandler,
    message: options?.message ?? 'Too many requests, please try again later.',
    statusCode: options?.statusCode ?? 429,
  };

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const redis = getRedis();

    // Get client identifier
    const clientId = getClientIdentifier(req);
    const key = `${config.keyPrefix}:${clientId}`;

    try {
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Use Redis sorted set for sliding window rate limiting
      const multi = redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      multi.zcard(key);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry on the key
      multi.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        next();
        return;
      }

      const currentCount = (results[1]?.[1] as number) || 0;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, config.max - currentCount - 1)
      );
      res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil((now + config.windowMs) / 1000)
      );

      if (currentCount >= config.max) {
        logger.warn(`[RateLimit] Rate limit exceeded for ${clientId}`);
        config.handler(req, res);
        return;
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request but log the error
      logger.error('[RateLimit] Redis error, allowing request:', error);
      next();
    }
  };
}

/**
 * Get a unique identifier for the client
 */
function getClientIdentifier(req: Request): string {
  // Prefer X-Forwarded-For if behind a proxy
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim();

  const identifier = ip || req.ip || req.socket.remoteAddress || 'unknown';

  // Include store ID if present for more granular limiting
  const storeId = req.headers['x-shopify-store-id'];
  if (storeId) {
    return `${identifier}:${storeId}`;
  }

  return identifier;
}

/**
 * Default rate limit exceeded handler
 */
function defaultRateLimitHandler(req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
  });
}

/**
 * Create a per-store rate limiter
 */
export function storeRateLimit(options?: Partial<RateLimitConfig>) {
  const config: Required<RateLimitConfig> = {
    windowMs: options?.windowMs ?? rateLimitConfig.windowMs,
    max: options?.max ?? rateLimitConfig.requests,
    keyPrefix: options?.keyPrefix ?? 'rl:store',
    skipFailedRequests: options?.skipFailedRequests ?? false,
    handler: options?.handler ?? defaultRateLimitHandler,
    message: options?.message ?? 'Too many requests for this store.',
    statusCode: options?.statusCode ?? 429,
  };

  return async function storeRateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const storeId = req.headers['x-shopify-store-id'] as string;

    if (!storeId) {
      // If no store ID, skip store-specific rate limiting
      next();
      return;
    }

    const redis = getRedis();
    const key = `${config.keyPrefix}:${storeId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      multi.zadd(key, now, `${now}-${Math.random()}`);
      multi.expire(key, Math.ceil(config.windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        next();
        return;
      }

      const currentCount = (results[1]?.[1] as number) || 0;

      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, config.max - currentCount - 1)
      );
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + config.windowMs) / 1000));

      if (currentCount >= config.max) {
        logger.warn(`[RateLimit] Store rate limit exceeded for ${storeId}`);
        config.handler(req, res);
        return;
      }

      next();
    } catch (error) {
      logger.error('[RateLimit] Redis error:', error);
      next();
    }
  };
}

/**
 * Create a burst rate limiter (higher limits for short bursts)
 */
export function burstRateLimit(options?: { max?: number; windowMs?: number }) {
  return rateLimit({
    max: options?.max ?? rateLimitConfig.requests * 2,
    windowMs: options?.windowMs ?? 10000, // 10 second window for bursts
    keyPrefix: 'rl:burst',
  });
}
