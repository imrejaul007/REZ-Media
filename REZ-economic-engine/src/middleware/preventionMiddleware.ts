/**
 * Abuse Prevention Middleware
 *
 * Express middleware for integrating abuse prevention checks
 * into API routes for cashback/rewards endpoints
 */

import { Request, Response, NextFunction } from 'express';
import {
  AbusePreventionService,
  AbuseCheckResult,
  AbuseStorage,
  DEFAULT_ABUSE_CONFIG,
  VPNProxyHook,
} from '../services/AbusePrevention';

// ============================================================================
// REQUEST EXTENSIONS
// ============================================================================

declare global {
  namespace Express {
    interface Request {
      abuseCheckResult?: AbuseCheckResult;
      deviceId?: string;
      userId?: string;
      clientIP?: string;
    }
  }
}

// ============================================================================
// MIDDLEWARE OPTIONS
// ============================================================================

export interface PreventionMiddlewareOptions {
  service: AbusePreventionService;
  checkOnRoutes?: ('accountCreation' | 'rewardClaim' | 'promoCode' | 'all')[];
  logViolations?: boolean;
  customIPExtractor?: (req: Request) => string;
  onBlock?: (req: Request, res: Response, result: AbuseCheckResult) => void;
  onFlag?: (req: Request, result: AbuseCheckResult) => void;
  onChallenge?: (req: Request, res: Response, result: AbuseCheckResult) => void;
}

// ============================================================================
// IP EXTRACTION UTILITIES
// ============================================================================

export function extractClientIP(req: Request): string {
  // Check various headers in order of preference
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare

  let ip: string | undefined;

  if (cfConnectingIP) {
    ip = Array.isArray(cfConnectingIP) ? cfConnectingIP[0] : cfConnectingIP;
  } else if (forwardedFor) {
    const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    // Get the outermost (original) IP
    ip = forwarded.split(',')[0].trim();
  } else if (realIP) {
    ip = Array.isArray(realIP) ? realIP[0] : realIP;
  } else {
    ip = req.ip || req.socket.remoteAddress;
  }

  // Remove IPv6 prefix if present
  if (ip?.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip || '0.0.0.0';
}

// ============================================================================
// DEVICE FINGERPRINT EXTRACTION
// ============================================================================

export function extractDeviceFingerprint(req: Request): {
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
} {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const acceptLanguage = req.headers['accept-language'];
  const acceptEncoding = req.headers['accept-encoding'];

  // Try to extract from custom headers
  const screenResolution = req.headers['x-screen-resolution'] as string | undefined;
  const timezone = req.headers['x-timezone'] as string | undefined;
  const language = acceptLanguage?.split(',')[0]?.trim();
  const platform = req.headers['x-platform'] as string | undefined;

  return {
    userAgent,
    screenResolution,
    timezone,
    language,
    platform,
  };
}

// ============================================================================
// ACCOUNT CREATION PREVENTION MIDDLEWARE
// ============================================================================

export function createAccountCreationPrevention(options: PreventionMiddlewareOptions) {
  const { service, logViolations = true, customIPExtractor, onBlock, onFlag } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = customIPExtractor ? customIPExtractor(req) : extractClientIP(req);
      const fingerprint = extractDeviceFingerprint(req);
      const userId = req.body?.userId || req.params?.userId || req.headers['x-user-id'] as string;
      const deviceId = req.body?.deviceId || req.headers['x-device-id'] as string || `device_${ip}`;

      // Store for downstream use
      req.clientIP = ip;
      req.deviceId = deviceId;
      req.userId = userId;

      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          code: 'MISSING_USER_ID',
        });
      }

      const result = await service.checkAccountCreation({
        userId,
        deviceId,
        ip,
        userAgent: fingerprint.userAgent,
        screenResolution: fingerprint.screenResolution,
        timezone: fingerprint.timezone,
        language: fingerprint.language,
        platform: fingerprint.platform,
      });

      req.abuseCheckResult = result;

      if (logViolations && result.triggeredRules.length > 0) {
        console.warn('[ABUSE PREVENTION]', {
          type: 'account_creation',
          userId,
          deviceId,
          ip,
          riskLevel: result.riskLevel,
          action: result.action,
          rules: result.triggeredRules.map(r => r.id),
          processingTimeMs: result.processingTimeMs,
        });
      }

      switch (result.action) {
        case 'block':
          if (onBlock) {
            onBlock(req, res, result);
          } else {
            return res.status(403).json({
              error: 'Access denied due to suspicious activity',
              code: 'ABUSE_DETECTED',
              riskLevel: result.riskLevel,
              rules: result.triggeredRules.map(r => r.id),
            });
          }
          return;

        case 'flag':
          if (onFlag) {
            onFlag(req, result);
          }
          // Continue but mark as flagged
          res.setHeader('X-Abuse-Flagged', 'true');
          break;

        case 'challenge':
          // Require additional verification
          res.setHeader('X-Abuse-Challenge', 'true');
          res.setHeader('X-Abuse-Risk-Level', result.riskLevel);
          break;

        case 'allow':
        default:
          break;
      }

      next();
    } catch (error) {
      console.error('[ABUSE PREVENTION] Error:', error);
      // Fail open but log the error - don't block legitimate users
      next();
    }
  };
}

// ============================================================================
// REWARD CLAIM PREVENTION MIDDLEWARE
// ============================================================================

export function createRewardClaimPrevention(options: PreventionMiddlewareOptions) {
  const { service, logViolations = true, customIPExtractor, onBlock, onFlag, onChallenge } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = customIPExtractor ? customIPExtractor(req) : extractClientIP(req);
      const userId = req.body?.userId || req.params?.userId || req.user?.id || req.headers['x-user-id'] as string;
      const rewardId = req.body?.rewardId || req.params?.rewardId;
      const campaignId = req.body?.campaignId || req.params?.campaignId;
      const amount = req.body?.amount || req.body?.rewardAmount;
      const deviceId = req.body?.deviceId || req.headers['x-device-id'] as string || `device_${ip}`;

      // Store for downstream use
      req.clientIP = ip;
      req.deviceId = deviceId;
      req.userId = userId;

      if (!userId || !rewardId) {
        return res.status(400).json({
          error: 'User ID and Reward ID are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      const result = await service.checkRewardClaim({
        userId,
        rewardId,
        campaignId: campaignId || 'default',
        amount: typeof amount === 'number' ? amount : 0,
        deviceId,
        ip,
      });

      req.abuseCheckResult = result;

      if (logViolations && result.triggeredRules.length > 0) {
        console.warn('[ABUSE PREVENTION]', {
          type: 'reward_claim',
          userId,
          rewardId,
          campaignId,
          ip,
          riskLevel: result.riskLevel,
          action: result.action,
          rules: result.triggeredRules.map(r => r.id),
          processingTimeMs: result.processingTimeMs,
        });
      }

      switch (result.action) {
        case 'block':
          if (onBlock) {
            onBlock(req, res, result);
          } else {
            return res.status(403).json({
              error: 'Reward claim blocked due to suspicious activity',
              code: 'CLAIM_ABUSE_DETECTED',
              riskLevel: result.riskLevel,
              rules: result.triggeredRules.map(r => r.id),
            });
          }
          return;

        case 'flag':
          if (onFlag) {
            onFlag(req, result);
          }
          res.setHeader('X-Abuse-Flagged', 'true');
          break;

        case 'challenge':
          if (onChallenge) {
            onChallenge(req, res, result);
          } else {
            res.setHeader('X-Abuse-Challenge', 'true');
            res.setHeader('X-Abuse-Risk-Level', result.riskLevel);
          }
          break;

        case 'allow':
        default:
          break;
      }

      next();
    } catch (error) {
      console.error('[ABUSE PREVENTION] Error:', error);
      next();
    }
  };
}

// ============================================================================
// PROMO CODE PREVENTION MIDDLEWARE
// ============================================================================

export function createPromoCodePrevention(options: PreventionMiddlewareOptions) {
  const { service, logViolations = true, customIPExtractor, onBlock, onFlag, onChallenge } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = customIPExtractor ? customIPExtractor(req) : extractClientIP(req);
      const userId = req.body?.userId || req.params?.userId || req.user?.id || req.headers['x-user-id'] as string;
      const code = req.body?.code || req.params?.code || req.body?.promoCode;
      const orderId = req.body?.orderId;
      const discount = req.body?.discount || req.body?.discountAmount || 0;
      const deviceId = req.body?.deviceId || req.headers['x-device-id'] as string || `device_${ip}`;

      // Store for downstream use
      req.clientIP = ip;
      req.deviceId = deviceId;
      req.userId = userId;

      if (!userId || !code) {
        return res.status(400).json({
          error: 'User ID and Promo Code are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      const result = await service.checkPromoCodeUsage({
        code,
        userId,
        deviceId,
        ip,
        orderId,
        discount: typeof discount === 'number' ? discount : 0,
      });

      req.abuseCheckResult = result;

      if (logViolations && result.triggeredRules.length > 0) {
        console.warn('[ABUSE PREVENTION]', {
          type: 'promo_code',
          userId,
          code: code.substring(0, 4) + '****', // Mask code
          ip,
          riskLevel: result.riskLevel,
          action: result.action,
          rules: result.triggeredRules.map(r => r.id),
          processingTimeMs: result.processingTimeMs,
        });
      }

      switch (result.action) {
        case 'block':
          if (onBlock) {
            onBlock(req, res, result);
          } else {
            return res.status(403).json({
              error: 'Promo code usage blocked due to suspicious activity',
              code: 'PROMO_ABUSE_DETECTED',
              riskLevel: result.riskLevel,
              rules: result.triggeredRules.map(r => r.id),
            });
          }
          return;

        case 'flag':
          if (onFlag) {
            onFlag(req, result);
          }
          res.setHeader('X-Abuse-Flagged', 'true');
          break;

        case 'challenge':
          if (onChallenge) {
            onChallenge(req, res, result);
          } else {
            res.setHeader('X-Abuse-Challenge', 'true');
            res.setHeader('X-Abuse-Risk-Level', result.riskLevel);
          }
          break;

        case 'allow':
        default:
          break;
      }

      next();
    } catch (error) {
      console.error('[ABUSE PREVENTION] Error:', error);
      next();
    }
  };
}

// ============================================================================
// COMBINED PREVENTION MIDDLEWARE
// ============================================================================

export interface CombinedPreventionOptions extends PreventionMiddlewareOptions {
  checks: ('accountCreation' | 'rewardClaim' | 'promoCode')[];
}

export function createCombinedPrevention(options: CombinedPreventionOptions) {
  const { checks, ...rest } = options;

  const accountCreationMW = checks.includes('accountCreation')
    ? createAccountCreationPrevention(rest)
    : null;
  const rewardClaimMW = checks.includes('rewardClaim')
    ? createRewardClaimPrevention(rest)
    : null;
  const promoCodeMW = checks.includes('promoCode')
    ? createPromoCodePrevention(rest)
    : null;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Route-based middleware selection
    const path = req.path.toLowerCase();

    if (path.includes('/account') || path.includes('/register') || path.includes('/signup')) {
      if (accountCreationMW) return accountCreationMW(req, res, next);
    }

    if (path.includes('/claim') || path.includes('/reward')) {
      if (rewardClaimMW) return rewardClaimMW(req, res, next);
    }

    if (path.includes('/promo') || path.includes('/coupon') || path.includes('/code')) {
      if (promoCodeMW) return promoCodeMW(req, res, next);
    }

    next();
  };
}

// ============================================================================
// VPN/PROXY CHECK ONLY MIDDLEWARE
// ============================================================================

export function createVPNProxyCheck(options: Omit<PreventionMiddlewareOptions, 'checkOnRoutes'>) {
  const { service, logViolations = true, customIPExtractor, onBlock } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = customIPExtractor ? customIPExtractor(req) : extractClientIP(req);
      req.clientIP = ip;

      const vpnService = service.getVPNProxyService();
      const result = await vpnService.checkAndBlock(ip);

      req.abuseCheckResult = result;

      if (logViolations && result.triggeredRules.length > 0) {
        console.warn('[VPN/PROXY DETECTION]', {
          ip,
          riskLevel: result.riskLevel,
          action: result.action,
          rules: result.triggeredRules.map(r => r.id),
        });
      }

      if (result.action === 'block') {
        if (onBlock) {
          onBlock(req, res, result);
        } else {
          return res.status(403).json({
            error: 'Connection from untrusted source',
            code: 'VPN_PROXY_BLOCKED',
            riskLevel: result.riskLevel,
          });
        }
        return;
      }

      // Add headers for downstream use
      res.setHeader('X-VPN-Check', result.passed ? 'clean' : 'suspicious');
      res.setHeader('X-Connection-Type', getConnectionType(result));

      next();
    } catch (error) {
      console.error('[VPN/PROXY DETECTION] Error:', error);
      next();
    }
  };
}

function getConnectionType(result: AbuseCheckResult): string {
  const meta = result.metadata as Record<string, boolean | string | undefined>;
  if (meta.isTor) return 'tor';
  if (meta.isVPN) return 'vpn';
  if (meta.isProxy) return 'proxy';
  if (meta.isDataCenter) return 'datacenter';
  return 'residential';
}

// ============================================================================
// STATS/HEALTH MIDDLEWARE
// ============================================================================

export function createAbuseStatsMiddleware(service: AbusePreventionService) {
  return async (_req: Request, res: Response) => {
    try {
      const stats = {
        service: 'abuse-prevention',
        timestamp: new Date().toISOString(),
        subServices: {
          deviceFingerprinting: service.getDeviceService() ? 'active' : 'disabled',
          accountVelocity: service.getVelocityService() ? 'active' : 'disabled',
          rewardClaims: service.getClaimService() ? 'active' : 'disabled',
          promoCodes: service.getPromoService() ? 'active' : 'disabled',
          multiAccount: service.getMultiAccountService() ? 'active' : 'disabled',
          vpnProxy: service.getVPNProxyService() ? 'active' : 'disabled',
        },
        config: DEFAULT_ABUSE_CONFIG,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  };
}

// ============================================================================
// DEFAULT EXPORTS
// ============================================================================

export {
  extractClientIP,
  extractDeviceFingerprint,
};

export default {
  createAccountCreationPrevention,
  createRewardClaimPrevention,
  createPromoCodePrevention,
  createCombinedPrevention,
  createVPNProxyCheck,
  createAbuseStatsMiddleware,
  extractClientIP,
  extractDeviceFingerprint,
};
