import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  userId: string;
  role: 'consumer' | 'admin' | 'service';
  permissions?: string[];
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  internalService?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const INTERNAL_SERVICE_TOKENS_JSON = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';

let INTERNAL_SERVICE_TOKENS: Record<string, string>;
try {
  INTERNAL_SERVICE_TOKENS = JSON.parse(INTERNAL_SERVICE_TOKENS_JSON);
} catch {
  INTERNAL_SERVICE_TOKENS = {};
}

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Verify internal service token for service-to-service communication
 */
export function authenticateInternal(req: AuthRequest, res: Response, next: NextFunction): void {
  const internalToken = req.headers['x-internal-token'] as string;

  if (!internalToken) {
    res.status(401).json({ error: 'Internal token required' });
    return;
  }

  // Find which service this token belongs to
  for (const [serviceName, token] of Object.entries(INTERNAL_SERVICE_TOKENS)) {
    if (token === internalToken) {
      req.internalService = serviceName;
      req.user = {
        userId: `service:${serviceName}`,
        role: 'service',
        permissions: [],
      };
      next();
      return;
    }
  }

  res.status(401).json({ error: 'Invalid internal token' });
}

/**
 * Optional authentication - sets user if token present but doesn't require it
 */
export function optionalAuthenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next();
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}

/**
 * Require specific role(s)
 */
export function requireRole(...allowedRoles: AuthUser['role'][]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Require specific permission(s)
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role === 'admin') {
      // Admins have all permissions
      next();
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasAllPermissions) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Get consumer ID from request (either from JWT user or from params)
 */
export function getConsumerId(req: AuthRequest): string | null {
  if (req.user?.role === 'consumer') {
    return req.user.userId;
  }
  return (req.params.consumerId || req.query.consumerId) as string || null;
}

/**
 * Generate JWT token for a user
 */
export function generateToken(user: AuthUser, expiresIn: string = '7d'): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn });
}

/**
 * Generate internal service token
 */
export function generateInternalToken(serviceName: string): string {
  const token = jwt.sign({ service: serviceName, type: 'internal' }, JWT_SECRET, { expiresIn: '365d' });
  return token;
}
