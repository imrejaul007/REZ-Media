import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
      isGuest?: boolean;
    }
  }
}

interface JwtPayload {
  userId: string;
  sessionId?: string;
  isGuest?: boolean;
  iat?: number;
  exp?: number;
}

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a JWT token for a user
 */
export const generateToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify a JWT token
 */
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};

/**
 * Authentication middleware - extracts user from token or session
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const sessionIdHeader = req.headers['x-session-id'];

  // Try to authenticate via JWT token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload) {
      req.userId = payload.userId;
      req.sessionId = payload.sessionId;
      req.isGuest = payload.isGuest || false;
      return next();
    }
  }

  // Fallback to session ID for guest users
  if (sessionIdHeader && typeof sessionIdHeader === 'string') {
    req.sessionId = sessionIdHeader;
    req.isGuest = true;
    return next();
  }

  // Generate a new session ID for anonymous users
  req.sessionId = uuidv4();
  req.isGuest = true;
  res.setHeader('X-Session-Id', req.sessionId);
  next();
};

/**
 * Require authentication middleware - must have valid user
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  req.userId = payload.userId;
  req.sessionId = payload.sessionId;
  req.isGuest = false;
  next();
};

/**
 * Optional authentication middleware - enhances user if token present
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const sessionIdHeader = req.headers['x-session-id'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload) {
      req.userId = payload.userId;
      req.sessionId = payload.sessionId;
      req.isGuest = false;
      return next();
    }
  }

  // Use existing session ID or generate new one
  if (sessionIdHeader && typeof sessionIdHeader === 'string') {
    req.sessionId = sessionIdHeader;
  } else {
    req.sessionId = uuidv4();
    res.setHeader('X-Session-Id', req.sessionId);
  }

  req.isGuest = true;
  next();
};

/**
 * Upgrade guest session to authenticated user
 */
export const upgradeGuestSession = async (
  guestSessionId: string,
  userId: string
): Promise<void> => {
  // This would be called by the auth service when a guest user logs in
  // It would transfer the guest cart to the authenticated user
  // Implementation depends on Cart model
  const { Cart } = await import('../models/Cart');
  const guestCart = await Cart.findOne({ sessionId: guestSessionId });

  if (guestCart) {
    // Check if user already has a cart
    const userCart = await Cart.findOne({ userId });

    if (userCart) {
      // Merge carts
      const existingItems = new Map(
        userCart.items.map((item) => [item.productId, item])
      );

      for (const item of guestCart.items) {
        const existing = existingItems.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          userCart.items.push(item);
        }
      }

      await userCart.save();
      await guestCart.deleteOne();
    } else {
      // Simply upgrade the guest cart to user cart
      guestCart.userId = userId;
      guestCart.isGuest = false;
      await guestCart.save();
    }
  }
};
