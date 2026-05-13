import { Request, Response, NextFunction } from 'express';

/**
 * Internal service authentication middleware
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;
  const validToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token) {
    res.status(401).json({ error: 'Missing authentication token', requestId: req.requestId });
    return;
  }

  if (!validToken) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('WARNING: INTERNAL_SERVICE_TOKEN not configured');
      next();
      return;
    }
    res.status(500).json({ error: 'Server authentication not configured', requestId: req.requestId });
    return;
  }

  if (token !== validToken) {
    res.status(401).json({ error: 'Invalid authentication token', requestId: req.requestId });
    return;
  }

  next();
}
