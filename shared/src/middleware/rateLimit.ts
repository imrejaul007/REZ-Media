import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Default rate limit configuration
 */
const defaultOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Create a rate limiter with custom options
 */
export function createRateLimiter(options?: {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    ...defaultOptions,
    ...options,
  });
}

/**
 * Default rate limiter for all API routes
 */
export const rateLimitMiddleware = createRateLimiter();

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimitMiddleware = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

/**
 * Auth rate limiter - prevents brute force
 */
export const authRateLimitMiddleware = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts' },
});

/**
 * Webhook rate limiter - higher limits for webhooks
 */
export const webhookRateLimitMiddleware = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
  message: { error: 'Webhook rate limit exceeded' },
});
