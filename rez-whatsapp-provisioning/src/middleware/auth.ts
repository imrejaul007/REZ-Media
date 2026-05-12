import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  merchantId?: string;
  internalServiceToken?: string;
}

const internalServiceTokens: Record<string, string> = {};

export function initializeServiceTokens(): void {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
  try {
    const parsed = JSON.parse(tokensJson);
    Object.assign(internalServiceTokens, parsed);
    logger.info('Internal service tokens initialized', {
      serviceCount: Object.keys(parsed).length,
    });
  } catch (error) {
    logger.error('Failed to parse INTERNAL_SERVICE_TOKENS_JSON', { error });
  }
}

export function validateInternalServiceToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing internal service token',
      },
    });
    return;
  }

  const validServices = Object.values(internalServiceTokens);
  if (!validServices.includes(token)) {
    logger.warn('Invalid internal service token attempt', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid internal service token',
      },
    });
    return;
  }

  const serviceName = Object.entries(internalServiceTokens).find(
    ([, t]) => t === token
  )?.[0];

  req.internalServiceToken = token;
  req.merchantId = serviceName;

  next();
}

export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;

  if (token) {
    const validServices = Object.values(internalServiceTokens);
    if (validServices.includes(token)) {
      const serviceName = Object.entries(internalServiceTokens).find(
        ([, t]) => t === token
      )?.[0];
      req.internalServiceToken = token;
      req.merchantId = serviceName;
    }
  }

  next();
}

export const merchantIdSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
});

export function extractMerchantId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const merchantId = req.params.merchantId || req.body.merchantId || req.query.merchantId;

  if (!merchantId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Merchant ID is required',
      },
    });
    return;
  }

  (req as AuthenticatedRequest).merchantId = merchantId as string;
  next();
}
