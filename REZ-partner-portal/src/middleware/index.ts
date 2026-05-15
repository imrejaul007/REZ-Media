/**
 * REZ Partner Portal - Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'partner-portal-secret-change-me';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    partnerId: string;
    role: string;
  };
}

/**
 * Authentication middleware
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      partnerId: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

/**
 * Error handler middleware
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    res.status(400).json({ success: false, error: err.message });
    return;
  }

  res.status(500).json({ success: false, error: 'Internal server error' });
};

/**
 * Not found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
};
