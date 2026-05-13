import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      internalServiceAuthenticated?: boolean;
    }
  }
}

/**
 * Middleware to verify internal service token
 */
export function internalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing internal service token',
    });
    return;
  }

  // Use timing-safe comparison
  const expectedToken = config.internalServiceToken;
  if (!timingSafeEqual(token, expectedToken)) {
    res.status(401).json({
      success: false,
      error: 'Invalid internal service token',
    });
    return;
  }

  req.internalServiceAuthenticated = true;
  next();
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Optional internal auth - doesn't fail if token is missing
 */
export function optionalInternalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (token) {
    const expectedToken = config.internalServiceToken;
    if (timingSafeEqual(token, expectedToken)) {
      req.internalServiceAuthenticated = true;
    }
  }

  next();
}

export default internalAuthMiddleware;
