/**
 * Authentication Middleware for REZ-Decision-Service
 *
 * Provides constant-time authentication for internal service-to-service communication.
 * Uses INTERNAL_SERVICE_TOKENS_JSON (JSON map of service tokens) with fallback to
 * INTERNAL_SERVICE_TOKEN (single shared token).
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface ServiceTokens {
  [serviceName: string]: string;
}

function resolveServiceTokens(): ServiceTokens | null {
  try {
    const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
    if (raw) {
      return JSON.parse(raw) as ServiceTokens;
    }
    return null;
  } catch {
    console.error('[AUTH] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return null;
  }
}

function getLegacyToken(): string | undefined {
  return process.env.INTERNAL_SERVICE_TOKEN;
}

/**
 * Verify internal service token using constant-time comparison.
 * Prevents timing attacks by using crypto.timingSafeEqual().
 */
export function verifyInternal(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;
  const callerService = req.headers['x-internal-service'] as string | undefined;
  const scopedTokens = resolveServiceTokens();

  // Check if any auth is configured
  const hasScopedAuth = scopedTokens && Object.keys(scopedTokens).length > 0;
  const hasLegacyAuth = !!getLegacyToken();

  if (!hasScopedAuth && !hasLegacyAuth) {
    console.error('[AUTH] No internal service tokens configured');
    res.status(503).json({
      success: false,
      error: 'Internal auth not configured — set INTERNAL_SERVICE_TOKENS_JSON or INTERNAL_SERVICE_TOKEN'
    });
    return;
  }

  // Get the expected token(s)
  let expected: string | undefined;
  if (callerService && scopedTokens && scopedTokens[callerService]) {
    expected = scopedTokens[callerService];
  } else if (hasLegacyAuth) {
    expected = getLegacyToken();
  }

  // If no expected token found, deny access
  if (!expected) {
    console.warn('[AUTH] No token found for service', { callerService });
    res.status(401).json({ success: false, error: 'Invalid internal token' });
    return;
  }

  // Reject blank tokens — zero-length string padded to expected length
  // matches timingSafeEqual even though token is empty
  const tokenStr = token || '';
  if (tokenStr.trim().length === 0) {
    console.warn('[AUTH] Blank token rejected', { callerService, ip: req.ip });
    res.status(401).json({ success: false, error: 'Invalid internal token' });
    return;
  }

  // Constant-time comparison
  const tokenBuf = Buffer.from(tokenStr);
  const expectedBuf = Buffer.from(expected);

  let keysMatch: boolean;
  try {
    // timingSafeEqual throws if Buffer lengths differ
    // Use length check first to avoid throwing
    if (tokenBuf.length !== expectedBuf.length) {
      keysMatch = false;
    } else {
      keysMatch = crypto.timingSafeEqual(tokenBuf, expectedBuf);
    }
  } catch {
    keysMatch = false;
  }

  if (!keysMatch) {
    console.warn('[AUTH] Token mismatch', { callerService, ip: req.ip });
    res.status(401).json({ success: false, error: 'Invalid internal token' });
    return;
  }

  next();
}

/**
 * Verify admin JWT token.
 * Checks for role === 'admin' in the token payload.
 */
export function verifyAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing authorization token' });
    return;
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('[AUTH] JWT_SECRET not configured');
    res.status(503).json({ success: false, error: 'Auth not configured' });
    return;
  }

  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as Record<string, unknown>;

    // Only accept role === 'admin'
    if (payload.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    // Attach user info to request
    (req as any).userId = (payload._id || payload.userId || payload.id) as string | undefined;
    (req as any).isAdmin = true;

    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Verify consumer/user JWT token.
 * Extracts userId from the token payload.
 */
export function verifyConsumer(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing authorization token' });
    return;
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET || process.env.ADS_JWT_SECRET;

  if (!secret) {
    console.error('[AUTH] JWT_SECRET not configured');
    res.status(503).json({ success: false, error: 'Auth not configured' });
    return;
  }

  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as Record<string, unknown>;

    // Attach userId to request
    (req as any).userId = (payload.userId || payload._id || payload.id) as string | undefined;

    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
