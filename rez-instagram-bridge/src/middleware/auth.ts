import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Verify Instagram webhook signature
 */
export function verifySignature(req: Request, signature: string): boolean {
  try {
    if (!signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.instagram.appSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    // Instagram sends signature in format "sha256=..."
    const receivedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch (error) {
    logger.error('Signature verification error', { error });
    return false;
  }
}

/**
 * Verify internal service token for service-to-service communication
 */
export function verifyInternalToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    logger.warn('Missing internal token', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Missing internal token' });
    return;
  }

  try {
    const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    const tokens = JSON.parse(tokensJson);
    const validTokens = Object.values(tokens);

    if (!validTokens.includes(token)) {
      logger.warn('Invalid internal token', {
        path: req.path,
        ip: req.ip,
      });
      res.status(401).json({ error: 'Invalid internal token' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Token verification error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Verify JWT token for user authentication
 */
export function verifyJwtToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid auth header', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // In production, verify JWT token properly
    // For now, just check if token exists
    if (!token || token.length < 10) {
      throw new Error('Invalid token');
    }

    // Attach user info to request (in production, decode JWT)
    (req as any).user = {
      id: 'decoded_user_id',
      authenticated: true,
    };

    next();
  } catch (error) {
    logger.warn('JWT verification failed', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Optional auth - doesn't fail if no token
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  verifyJwtToken(req, res, next);
}
