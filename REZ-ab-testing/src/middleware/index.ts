import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      serviceToken?: string;
      serviceName?: string;
    }
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

/**
 * Authentication middleware for internal service-to-service calls
 */
export const authenticateInternal = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing X-Internal-Token header',
    } as ErrorResponse);
    return;
  }

  // Validate token against environment variable
  const validToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!validToken || token !== validToken) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
    } as ErrorResponse);
    return;
  }

  req.serviceToken = token;
  next();
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token = req.headers['x-internal-token'] as string;

  if (token) {
    const validToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (validToken && token === validToken) {
      req.serviceToken = token;
    }
  }

  next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${_res.statusCode} - ${duration}ms`
    );
  });

  next();
};

/**
 * Global error handler
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e: mongoose.Error.ValidatorError) => e.message);
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: messages,
    } as ErrorResponse);
    return;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: `Invalid ${err.path}: ${err.value}`,
    } as ErrorResponse);
    return;
  }

  // Zod validation error
  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: (err as unknown as { errors: unknown[] }).errors,
    } as ErrorResponse);
    return;
  }

  // Custom application error
  if (err.message && !err.stack) {
    res.status(400).json({
      success: false,
      error: err.message,
    } as ErrorResponse);
    return;
  }

  // Default server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  } as ErrorResponse);
};

/**
 * Not found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  } as ErrorResponse);
};

/**
 * Rate limiting headers middleware
 */
export const rateLimitHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add rate limit headers (actual rate limiting should be done by a reverse proxy or dedicated middleware)
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '95');
  res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + 60);
  next();
};

/**
 * CORS headers middleware
 */
export const corsHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

  const origin = req.headers.origin;
  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Token');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
};
