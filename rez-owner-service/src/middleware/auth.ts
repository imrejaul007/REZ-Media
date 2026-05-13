/**
 * REZ Owner Service - Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  serviceToken?: string;
}

export function authenticateRequest(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid authorization format' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      role: decoded.role || 'owner'
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireServiceToken(req: AuthRequest, res: Response, next: NextFunction) {
  const serviceToken = req.headers['x-internal-token'] as string;

  if (!serviceToken) {
    return res.status(401).json({ error: 'Service token required' });
  }

  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS || '{}';

  try {
    const tokens = JSON.parse(tokensJson);
    const isValid = Object.values(tokens).includes(serviceToken);

    if (!isValid) {
      return res.status(403).json({ error: 'Invalid service token' });
    }

    req.serviceToken = serviceToken;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Service token configuration error' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
