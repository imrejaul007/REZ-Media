/**
 * Authentication middleware - Validates internal service tokens
 */

import { Request, Response, NextFunction } from 'express';
import { getServiceTokens } from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  serviceId?: string;
  userId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Check for internal service token
  const internalToken = req.headers['x-internal-token'] as string;

  if (internalToken) {
    const tokens = getServiceTokens();
    const serviceEntry = Object.entries(tokens).find(([, token]) => token === internalToken);

    if (serviceEntry) {
      req.serviceId = serviceEntry[0];
      next();
      return;
    }
  }

  // Check for user JWT token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      // In production, verify JWT here
      // For now, just check if token exists and extract user ID
      const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64').toString());
      req.userId = payload.sub || payload.userId || payload.id;
      next();
      return;
    } catch {
      // Token verification failed
    }
  }

  // Check for API key
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    // In production, verify API key against database
    // For now, accept any non-empty key
    next();
    return;
  }

  logger.warn('Authentication failed', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(401).json({
    success: false,
    error: 'Unauthorized - Invalid or missing authentication',
  });
}

export function optionalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Similar to authMiddleware but doesn't reject if no auth
  const internalToken = req.headers['x-internal-token'] as string;

  if (internalToken) {
    const tokens = getServiceTokens();
    const serviceEntry = Object.entries(tokens).find(([, token]) => token === internalToken);

    if (serviceEntry) {
      req.serviceId = serviceEntry[0];
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64').toString());
      req.userId = payload.sub || payload.userId || payload.id;
    } catch {
      // Ignore token parse errors
    }
  }

  next();
}

export function serviceAuthMiddleware(requiredServices: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const internalToken = req.headers['x-internal-token'] as string;

    if (!internalToken) {
      res.status(401).json({
        success: false,
        error: 'Internal service token required',
      });
      return;
    }

    const tokens = getServiceTokens();
    const serviceEntry = Object.entries(tokens).find(([, token]) => token === internalToken);

    if (!serviceEntry) {
      res.status(401).json({
        success: false,
        error: 'Invalid internal service token',
      });
      return;
    }

    if (!requiredServices.includes(serviceEntry[0])) {
      res.status(403).json({
        success: false,
        error: `Service not authorized. Required: ${requiredServices.join(', ')}`,
      });
      return;
    }

    req.serviceId = serviceEntry[0];
    next();
  };
}
