import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ── TypeScript declaration merging ────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      merchantId?: string;
      isAdmin?: boolean;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');
  return secret;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

// ── verifyConsumer — decodes userId from Bearer token ────────────────────────

export function verifyConsumer(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Missing authorization token' });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as Record<string, unknown>;
    req.userId = (payload.userId || payload._id || payload.id) as string | undefined;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// ── verifyMerchant — decodes merchant._id from Bearer token ──────────────────

export function verifyMerchant(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Missing authorization token' });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as Record<string, unknown>;

    // Support both flat and nested merchant payload shapes
    const merchant = payload.merchant as Record<string, unknown> | undefined;
    const merchantId =
      (merchant?._id as string | undefined) ||
      (payload.merchantId as string | undefined) ||
      (payload._id as string | undefined);

    if (!merchantId) {
      res.status(401).json({ success: false, message: 'Merchant identity not found in token' });
      return;
    }

    req.merchantId = String(merchantId);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// ── verifyAdmin — checks role === 'admin' ──────────────────────────────────

export function verifyAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Missing authorization token' });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as Record<string, unknown>;

    // SECURITY FIX: Only accept role === 'admin', removed isAdmin bypass
    // Previously allowed privilege escalation via isAdmin field
    const isAdmin = payload.role === 'admin';

    if (!isAdmin) {
      res.status(401).json({ success: false, message: 'Admin access required' });
      return;
    }

    req.isAdmin = true;
    req.userId = (payload._id || payload.userId || payload.id) as string | undefined;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// ── verifyInternal — checks x-internal-key header (constant-time comparison) ──

export function verifyInternal(req: Request, res: Response, next: NextFunction): void {
  // Accept both header names for compatibility with all REZ services
  const key = req.headers['x-internal-token'] || req.headers['x-internal-key'];
  // Accept both env var names
  const expected = process.env.INTERNAL_SERVICE_KEY || process.env.INTERNAL_SERVICE_TOKEN;

  if (!expected) {
    // If no key configured, block all internal requests
    res.status(401).json({ success: false, message: 'Internal service key not configured' });
    return;
  }

  // FIX C-4: Use constant-time comparison to prevent timing attacks
  const keyStr = typeof key === 'string' ? key : String(key || '');
  // Reject blank tokens — a zero-length string padded to the expected length
  // creates a buffer of length === expected.length (all spaces), which matches
  // timingSafeEqual even though the token is empty.
  if (keyStr.trim().length === 0) {
    res.status(401).json({ success: false, message: 'Invalid internal service key' });
    return;
  }
  const keyBuffer = Buffer.from(keyStr);
  const expectedBuffer = Buffer.from(expected);

  let keysMatch: boolean;
  try {
    keysMatch = crypto.timingSafeEqual(keyBuffer, expectedBuffer);
  } catch (error) {
    keysMatch = false;
  }

  if (!keysMatch) {
    res.status(401).json({ success: false, message: 'Invalid internal service key' });
    return;
  }

  next();
}
