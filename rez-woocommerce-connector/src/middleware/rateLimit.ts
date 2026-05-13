/**
 * Rate Limiting Middleware
 *
 * In-memory rate limiter with configurable limits per IP.
 * For production, use Redis-backed rate limiting.
 */

import { Request, Response, NextFunction } from 'express';
import { appConfig, REDIS_KEYS, CACHE_TTL } from '../config';

// Default rate limit: 100 requests per minute
const DEFAULT_LIMIT = 100;
const WINDOW_MS = 60 * 1000;

// In-memory store for rate limiting
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

/**
 * Clean up expired rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, WINDOW_MS);

/**
 * Get client identifier for rate limiting
 */
function getClientId(req: Request): string {
  // Use X-Forwarded-For if behind a proxy, otherwise use IP
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor.split(',')[0];
    return ips.trim();
  }
  return req.ip || 'unknown';
}

/**
 * Rate limiting middleware
 */
export function rateLimit(
  options: {
    limit?: number;
    windowMs?: number;
  } = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const limit = options.limit || DEFAULT_LIMIT;
  const windowMs = options.windowMs || WINDOW_MS;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = getClientId(req);
    const key = `${clientId}:${req.path}`;
    const now = Date.now();

    // Get or create rate limit record
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
    }

    // Increment counter
    record.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, limit - record.count))
    );
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(record.resetTime / 1000))
    );

    // Check if limit exceeded
    if (record.count > limit) {
      const retryAfter = Math.ceil(
        (record.resetTime - now) / 1000
      );
      res.setHeader('Retry-After', String(retryAfter));

      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
        retryAfter,
      });
      return;
    }

    next();
  };
}

/**
 * Strict rate limiting for webhook endpoints
 */
export function webhookRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientId = getClientId(req);
  const key = `webhook:${clientId}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + WINDOW_MS,
    };
    rateLimitStore.set(key, record);
  }

  record.count++;

  // Stricter limit for webhooks: 60 requests per minute
  const WEBHOOK_LIMIT = 60;
  res.setHeader('X-RateLimit-Limit', String(WEBHOOK_LIMIT));
  res.setHeader(
    'X-RateLimit-Remaining',
    String(Math.max(0, WEBHOOK_LIMIT - record.count))
  );

  if (record.count > WEBHOOK_LIMIT) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));

    res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Webhook rate limit exceeded',
      retryAfter,
    });
    return;
  }

  next();
}

export default rateLimit;
