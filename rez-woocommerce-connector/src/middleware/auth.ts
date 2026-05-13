/**
 * Authentication Middleware
 *
 * Validates X-Internal-Token header for inter-service communication.
 * Uses timing-safe comparison to prevent timing attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { getServiceTokens, appConfig } from '../config';

/**
 * Timing-safe string comparison
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
 * Authentication middleware for internal service calls
 */
export function auth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'X-Internal-Token header is required',
    });
    return;
  }

  const serviceTokens = getServiceTokens();
  const isValid = Object.values(serviceTokens).some((t) =>
    timingSafeEqual(t, token)
  );

  // Also check single token from INTERNAL_SERVICE_TOKEN
  if (!isValid && appConfig.internalServiceToken) {
    const isSingleTokenValid = timingSafeEqual(
      appConfig.internalServiceToken,
      token
    );
    if (isSingleTokenValid) {
      return next();
    }
  }

  if (!isValid) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid token',
    });
    return;
  }

  next();
}

export default auth;
