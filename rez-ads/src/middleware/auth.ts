import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        advertiserId?: string;
        publisherId?: string;
      };
      isInternalCall?: boolean;
    }
  }
}

interface JWTPayload {
  userId: string;
  role: string;
  advertiserId?: string;
  publisherId?: string;
  iat?: number;
  exp?: number;
}

// Validation schemas
export const AuthHeadersSchema = z.object({
  authorization: z.string().startsWith('Bearer ').optional(),
  'x-internal-token': z.string().optional(),
});

// Get tokens from environment
const INTERNAL_TOKENS = JSON.parse(
  process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}'
);
const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * JWT Authentication middleware
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Check for internal service token first
  const internalToken = req.headers['x-internal-token'] as string;
  if (internalToken && INTERNAL_TOKENS[req.headers['x-service-name'] as string] === internalToken) {
    req.isInternalCall = true;
    next();
    return;
  }

  // Check for JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      advertiserId: decoded.advertiserId,
      publisherId: decoded.publisherId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
      return;
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication - sets user if token present, continues otherwise
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      advertiserId: decoded.advertiserId,
      publisherId: decoded.publisherId,
    };
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}

/**
 * Role-based authorization middleware factory
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Advertiser authorization - ensures user can only access their own campaigns/ads
 */
export function authorizeAdvertiser(req: Request, res: Response, next: NextFunction): void {
  if (req.isInternalCall) {
    next();
    return;
  }

  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Admin can access all
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Advertisers can only access their own resources
  if (req.user.role === 'advertiser' && !req.user.advertiserId) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Advertiser ID not found in token',
    });
    return;
  }

  next();
}

/**
 * Publisher authorization - ensures user can only access their own placements
 */
export function authorizePublisher(req: Request, res: Response, next: NextFunction): void {
  if (req.isInternalCall) {
    next();
    return;
  }

  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Admin can access all
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Publishers can only access their own resources
  if (req.user.role === 'publisher' && !req.user.publisherId) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Publisher ID not found in token',
    });
    return;
  }

  next();
}

/**
 * Internal service authentication
 */
export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const internalToken = req.headers['x-internal-token'] as string;
  const serviceName = req.headers['x-service-name'] as string;

  if (!internalToken || !serviceName) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Internal token and service name required',
    });
    return;
  }

  const expectedToken = INTERNAL_TOKENS[serviceName];
  if (!expectedToken || expectedToken !== internalToken) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid internal token',
    });
    return;
  }

  req.isInternalCall = true;
  next();
}

/**
 * Generate JWT token for a user
 */
export function generateToken(payload: {
  userId: string;
  role: string;
  advertiserId?: string;
  publisherId?: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
  });
}

/**
 * Verify and decode token without middleware
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
