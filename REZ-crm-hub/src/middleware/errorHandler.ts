import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }

  static badRequest(message: string, code?: string, details?: unknown): ApiError {
    return new ApiError(message, 400, code, details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Not found', code?: string): ApiError {
    return new ApiError(message, 404, code);
  }

  static conflict(message: string, code?: string): ApiError {
    return new ApiError(message, 409, code);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(message, 500, 'INTERNAL_ERROR');
  }
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.message,
    });
    return;
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: 'Invalid ID format',
    });
    return;
  }

  // Handle duplicate key errors
  if ((err as unknown as { code: number }).code === 11000) {
    res.status(409).json({
      success: false,
      error: 'Duplicate entry',
    });
    return;
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;
