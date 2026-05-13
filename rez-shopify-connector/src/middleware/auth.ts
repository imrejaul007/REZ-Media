import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getInternalToken } from '../config';
import type { AuthenticatedRequest } from '../types';

// ── Express Request Extension ───────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      storeId?: string;
      storeDomain?: string;
      isInternal?: boolean;
      isAdmin?: boolean;
    }
  }
}

// ── Internal Service Authentication ─────────────────────────────────────────────

export function verifyInternal(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Accept both header names for compatibility
  const key = req.headers['x-internal-token'] || req.headers['x-internal-key'];

  if (!key) {
    res.status(401).json({
      success: false,
      error: 'Missing internal service token',
    });
    return;
  }

  try {
    const expected = getInternalToken();

    // Handle both string and array cases
    const keyStr = Array.isArray(key) ? key[0] : key;

    // Blank token check
    if (!keyStr || keyStr.trim().length === 0) {
      res.status(401).json({
        success: false,
        error: 'Invalid internal service token',
      });
      return;
    }

    // Constant-time comparison
    const keyBuffer = Buffer.from(keyStr);
    const expectedBuffer = Buffer.from(expected);

    const keysMatch = crypto.timingSafeEqual(keyBuffer, expectedBuffer);

    if (!keysMatch) {
      res.status(401).json({
        success: false,
        error: 'Invalid internal service token',
      });
      return;
    }

    (req as AuthenticatedRequest).isInternal = true;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Internal service token verification failed',
    });
  }
}

// ── Store Context Middleware ────────────────────────────────────────────────────

export function extractStoreContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const storeId = req.headers['x-shopify-store-id'] as string;
  const storeDomain = req.headers['x-shopify-store-domain'] as string;

  if (storeId) {
    (req as AuthenticatedRequest).storeId = storeId;
  }

  if (storeDomain) {
    (req as AuthenticatedRequest).storeDomain = storeDomain;
  }

  next();
}

// ── Combined Internal + Store Context ───────────────────────────────────────────

export function verifyInternalWithStoreContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  verifyInternal(req, res, () => {
    extractStoreContext(req, res, next);
  });
}

// ── Optional Authentication ─────────────────────────────────────────────────────

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const key = req.headers['x-internal-token'] || req.headers['x-internal-key'];

  if (key) {
    try {
      const expected = getInternalToken();
      const keyStr = Array.isArray(key) ? key[0] : key;

      if (keyStr && keyStr.trim().length > 0) {
        const keyBuffer = Buffer.from(keyStr);
        const expectedBuffer = Buffer.from(expected);

        if (crypto.timingSafeEqual(keyBuffer, expectedBuffer)) {
          (req as AuthenticatedRequest).isInternal = true;
        }
      }
    } catch {
      // Ignore errors for optional auth
    }
  }

  extractStoreContext(req, _res, next);
}
