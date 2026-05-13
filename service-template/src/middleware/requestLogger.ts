import { Request, Response, NextFunction } from 'express';

/**
 * Adds request ID to request object
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string) || `req-${Date.now()}`;
  next();
}
