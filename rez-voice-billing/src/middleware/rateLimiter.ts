/**
 * Rate Limiter Middleware
 */

import rateLimit from 'express-rate-limit';
import { getRateLimitConfig } from '../config';
import { logger } from '../utils/logger';

const rateLimitConfig = getRateLimitConfig();

export const rateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/ready' || req.path === '/live';
  },
});
