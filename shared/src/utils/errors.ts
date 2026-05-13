/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factories
export const errors = {
  badRequest: (message = 'Bad request') =>
    new AppError(message, 400, 'BAD_REQUEST'),

  unauthorized: (message = 'Unauthorized') =>
    new AppError(message, 401, 'UNAUTHORIZED'),

  forbidden: (message = 'Forbidden') =>
    new AppError(message, 403, 'FORBIDDEN'),

  notFound: (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),

  conflict: (message = 'Conflict') =>
    new AppError(message, 409, 'CONFLICT'),

  validation: (message = 'Validation error') =>
    new AppError(message, 400, 'VALIDATION_ERROR'),

  tooManyRequests: (message = 'Too many requests') =>
    new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'),

  internal: (message = 'Internal server error') =>
    new AppError(message, 500, 'INTERNAL_ERROR'),

  serviceUnavailable: (message = 'Service unavailable') =>
    new AppError(message, 503, 'SERVICE_UNAVAILABLE'),
};
