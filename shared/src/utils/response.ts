import { Response } from 'express';

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  requestId?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  res: Response,
  data: T,
  meta?: SuccessResponse['meta']
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  if (res.locals.requestId) {
    response.requestId = res.locals.requestId;
  }

  return res.json(response);
}

/**
 * Create an error response
 */
export function createErrorResponse(
  res: Response,
  statusCode: number,
  error: string,
  code?: string,
  details?: unknown
): Response {
  const response: ErrorResponse = {
    success: false,
    error,
  };

  if (code) {
    response.code = code;
  }

  if (details) {
    response.details = details;
  }

  if (res.locals.requestId) {
    response.requestId = res.locals.requestId;
  }

  return res.status(statusCode).json(response);
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  res: Response,
  data: T[],
  meta: {
    page: number;
    limit: number;
    total: number;
  }
): Response {
  return createSuccessResponse(res, data, {
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    totalPages: Math.ceil(meta.total / meta.limit),
  });
}
