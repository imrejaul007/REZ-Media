import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  // Log error
  console.error(JSON.stringify({
    level: 'error',
    requestId,
    path: req.path,
    method: req.method,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
    timestamp: new Date().toISOString(),
  }));

  // Handle AppError (our custom error class)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId,
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'Validation error',
      details: (err as unknown as { errors: unknown[] }).errors,
      requestId,
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation error',
      details: err.message,
      requestId,
    });
    return;
  }

  // Handle MongoDB duplicate key errors
  if ((err as unknown as { code: number }).code === 11000) {
    res.status(409).json({
      error: 'Duplicate entry',
      requestId,
    });
    return;
  }

  // Default to 500 Internal Server Error
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    requestId,
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    requestId: req.requestId,
  });
}
