import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IMerchant } from '../models/Merchant';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      merchant?: IMerchant;
      isAdmin?: boolean;
    }
  }
}

interface JwtPayload {
  id: string;
  email: string;
  role?: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

      // Import Merchant model here to avoid circular dependency
      const { default: Merchant } = await import('../models/Merchant');

      const merchant = await Merchant.findById(decoded.id);

      if (!merchant) {
        res.status(401).json({
          success: false,
          error: 'Invalid token. Merchant not found.'
        });
        return;
      }

      if (merchant.status === 'suspended') {
        res.status(403).json({
          success: false,
          error: 'Your account has been suspended.'
        });
        return;
      }

      req.merchant = merchant;
      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: 'Token has expired. Please login again.'
        });
        return;
      }
      res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error.'
    });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      const { default: Merchant } = await import('../models/Merchant');
      const merchant = await Merchant.findById(decoded.id);

      if (merchant) {
        req.merchant = merchant;
      }
    } catch {
      // Ignore invalid tokens for optional auth
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

export const requireEmailVerified = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.merchant?.emailVerified) {
    res.status(403).json({
      success: false,
      error: 'Please verify your email first.',
      code: 'EMAIL_NOT_VERIFIED'
    });
    return;
  }
  next();
};

export const requireStatus = (...allowedStatuses: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.merchant) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
      return;
    }

    if (!allowedStatuses.includes(req.merchant.status)) {
      res.status(403).json({
        success: false,
        error: `This action requires status: ${allowedStatuses.join(' or ')}. Current status: ${req.merchant.status}`,
        code: 'INVALID_STATUS'
      });
      return;
    }

    next();
  };
};

export const internalServiceAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const internalToken = req.headers['x-internal-token'] as string;
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!internalToken || !expectedToken) {
    res.status(401).json({
      success: false,
      error: 'Internal service token required.'
    });
    return;
  }

  if (internalToken !== expectedToken) {
    res.status(403).json({
      success: false,
      error: 'Invalid internal service token.'
    });
    return;
  }

  req.isAdmin = true;
  next();
};

export const generateToken = (merchant: IMerchant, role?: string): string => {
  return jwt.sign(
    {
      id: merchant._id,
      email: merchant.email,
      role: role || 'merchant'
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const generateAdminToken = (adminId: string, email: string): string => {
  return jwt.sign(
    {
      id: adminId,
      email,
      role: 'admin'
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};
