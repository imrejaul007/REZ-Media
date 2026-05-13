/**
 * Feedback Service - Authentication & Security Middleware
 */

import { Request, Response, NextFunction } from 'express';

// Timing-safe comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Get service tokens
function getServiceTokens(): Record<string, string> {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (!tokensJson) return {};
  try {
    return JSON.parse(tokensJson);
  } catch {
    return {};
  }
}

const SERVICE_TOKENS = getServiceTokens();

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 100;

// Allowed CORS origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://rezapp.com', 'https://www.rezapp.com'];

/**
 * Authentication middleware
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health' || req.path === '/health/live' || req.path === '/health/ready') {
    return next();
  }

  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Token required' });
    return;
  }

  const isValid = Object.values(SERVICE_TOKENS).some(t => timingSafeEqual(t, token));
  if (!isValid) {
    console.warn(`[AUTH] Invalid token from ${req.ip} for ${req.path}`);
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    return;
  }

  next();
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = `ratelimit:${req.ip || 'unknown'}:${req.path}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, record);
  }

  record.count++;

  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - record.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

  if (record.count > RATE_LIMIT_MAX) {
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
 * Request ID middleware
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ||
    `fb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;
  next();
}

/**
 * Error handler
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.error(`[${errorId}] Error:`, err.message, err.stack);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    errorId,
  });
}

export { ALLOWED_ORIGINS };
