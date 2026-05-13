import rateLimit from 'express-rate-limit';

/**
 * Default rate limiter - 100 requests per 15 minutes
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter - 10 requests per 15 minutes
 */
export const strictRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests' },
});

/**
 * Webhook rate limiter - 1000 requests per minute
 */
export const webhookRateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: { error: 'Webhook rate limit exceeded' },
});
