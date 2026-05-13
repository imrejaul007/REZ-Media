import { Request, Response, NextFunction } from 'express';

/**
 * Internal service authentication middleware
 * Validates X-Internal-Token header against configured token
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;
  const validToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token) {
    res.status(401).json({ error: 'Missing authentication token' });
    return;
  }

  if (!validToken) {
    // In development without token configured, log warning and continue
    if (process.env.NODE_ENV === 'development') {
      console.warn('WARNING: INTERNAL_SERVICE_TOKEN not configured - bypassing auth');
      next();
      return;
    }
    res.status(500).json({ error: 'Server authentication not configured' });
    return;
  }

  // Timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(token, validToken)) {
    res.status(401).json({ error: 'Invalid authentication token' });
    return;
  }

  next();
}

/**
 * Optional auth middleware - continues without token but sets req.service if valid
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;
  const validToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (token && validToken && timingSafeEqual(token, validToken)) {
    req.headers['x-authenticated'] = 'true';
  }

  next();
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      serviceId?: string;
      requestId?: string;
    }
  }
}
