import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      serviceName?: string;
      userId?: string;
    }
  }
}

/**
 * Verify internal service token for service-to-service communication
 */
export function verifyInternalToken(req: Request, res: Response, next: NextFunction): void {
  const internalToken = req.headers['x-internal-token'] as string;

  if (!internalToken) {
    res.status(401).json({
      success: false,
      error: 'Missing internal token',
    });
    return;
  }

  try {
    // Parse service tokens from environment variable
    const serviceTokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    const serviceTokens: Record<string, string> = JSON.parse(serviceTokensJson);

    // Find which service this token belongs to
    const serviceName = Object.entries(serviceTokens).find(
      ([, token]) => token === internalToken
    )?.[0];

    if (!serviceName) {
      res.status(401).json({
        success: false,
        error: 'Invalid internal token',
      });
      return;
    }

    req.serviceName = serviceName;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Verify JWT token for user authentication
 */
export function verifyJwtToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication - sets userId if token present, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    req.userId = decoded.userId;
  } catch {
    // Token invalid, but auth is optional
  }

  next();
}

/**
 * Verify HMAC-SHA256 webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf-8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Rate limiting middleware helper (simple in-memory implementation)
 * For production, use Redis-based rate limiting
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number
): (req: Request, res: Response, next: NextFunction) => void {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = requests.get(key);

    if (!record || now > record.resetTime) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    record.count++;

    if (record.count > maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      serviceName: req.serviceName || 'external',
      userId: req.userId || 'anonymous',
      ip: req.ip,
    };

    if (res.statusCode >= 400) {
      console.error('[ERROR]', JSON.stringify(logData));
    } else {
      console.log('[INFO]', JSON.stringify(logData));
    }
  });

  next();
}

/**
 * CORS configuration middleware helper
 */
export function corsConfig(origin: string | string[] | boolean): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allowedOrigins = typeof origin === 'string'
      ? [origin]
      : Array.isArray(origin)
        ? origin
        : ['*'];

    const requestOrigin = req.headers.origin;

    if (allowedOrigins.includes('*') || (requestOrigin && allowedOrigins.includes(requestOrigin))) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Token');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
