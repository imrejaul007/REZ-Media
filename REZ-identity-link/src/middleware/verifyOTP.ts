/**
 * OTP Verification Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { linkRequestService } from '../models/LinkRequest';

// Extend Express Request to include optional auth
declare global {
  namespace Express {
    interface Request {
      linkRequestId?: string;
      verifiedIdentifier?: {
        phone?: string;
        email?: string;
        deviceId?: string;
      };
    }
  }
}

/**
 * Generate OTP code
 */
export function generateOTP(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

/**
 * Generate OTP expiry time
 */
export function getOTPExpiry(minutes: number = 5): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Verify OTP middleware
 * Must be used after creating a link request
 */
export function verifyOTPMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { requestId, code } = req.body;

  if (!requestId || !code) {
    res.status(400).json({
      success: false,
      error: 'requestId and code are required',
    });
    return;
  }

  // Verify the OTP
  linkRequestService.verifyOTP(requestId, code)
    .then(result => {
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      // Attach verified info to request
      req.linkRequestId = requestId;
      req.verifiedIdentifier = result.request?.identifier;

      next();
    })
    .catch(error => {
      res.status(500).json({
        success: false,
        error: `OTP verification failed: ${error.message}`,
      });
    });
}

/**
 * Verify OTP via query params (for URL-based verification)
 */
export function verifyOTPQueryMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.query.requestId as string;
  const code = req.query.code as string;

  if (!requestId || !code) {
    res.status(400).json({
      success: false,
      error: 'requestId and code query parameters are required',
    });
    return;
  }

  linkRequestService.verifyOTP(requestId, code)
    .then(result => {
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
        });
        return;
      }

      req.linkRequestId = requestId;
      req.verifiedIdentifier = result.request?.identifier;

      next();
    })
    .catch(error => {
      res.status(500).json({
        success: false,
        error: `OTP verification failed: ${error.message}`,
      });
    });
}

/**
 * OTP Rate Limiter - In-memory store for rate limiting
 * In production, use Redis
 */
interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up old rate limit entries
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 1 hour
    if (now - entry.firstAttempt > 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

/**
 * Check rate limit for OTP requests
 */
export function checkOTPRequestRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfter?: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No previous attempts
  if (!entry) {
    return { allowed: true, remainingAttempts: 5 };
  }

  // Still locked
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Check if window expired (1 hour)
  if (now - entry.firstAttempt > 60 * 60 * 1000) {
    return { allowed: true, remainingAttempts: 5 };
  }

  // Within window, check count
  const remaining = Math.max(0, 5 - entry.count);
  if (entry.count >= 5) {
    // Lock for 15 minutes
    entry.lockedUntil = now + 15 * 60 * 1000;
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter: 15 * 60,
    };
  }

  return { allowed: true, remainingAttempts: remaining };
}

/**
 * Record OTP request
 */
export function recordOTPRequest(identifier: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now - entry.firstAttempt > 60 * 60 * 1000) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      firstAttempt: now,
    });
  } else {
    entry.count++;
  }
}

/**
 * OTP Request Rate Limit Middleware
 */
export function otpRequestRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Get identifier from body
  const identifier = req.body.phone || req.body.email || req.body.deviceId;

  if (!identifier) {
    res.status(400).json({
      success: false,
      error: 'phone, email, or deviceId required for rate limiting',
    });
    return;
  }

  const rateLimit = checkOTPRequestRateLimit(identifier);

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', '5');
  res.setHeader('X-RateLimit-Remaining', rateLimit.remainingAttempts.toString());

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.retryAfter?.toString() || '900');
    res.status(429).json({
      success: false,
      error: 'Too many OTP requests. Please try again later.',
      retryAfter: rateLimit.retryAfter,
    });
    return;
  }

  next();
}

/**
 * Generate and send OTP
 * This is a placeholder - integrate with actual SMS/Email service
 */
export async function generateAndSendOTP(
  requestId: string,
  phone?: string,
  email?: string
): Promise<{ success: boolean; otpCode?: string; error?: string }> {
  try {
    const otpCode = generateOTP(6);
    const expiresAt = getOTPExpiry(5);

    // Update the request with the OTP
    await linkRequestService.updateOTP(requestId, {
      code: otpCode,
      sentAt: new Date(),
      expiresAt,
    });

    // In production, send via SMS/Email
    // For now, we'll log it (development only - remove in production!)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV ONLY] OTP for ${phone || email}: ${otpCode}`);
    }

    // TODO: Integrate with actual SMS/Email service
    // Example with Twilio:
    // if (phone) {
    //   await twilioClient.messages.create({
    //     body: `Your ReZ verification code is: ${otpCode}`,
    //     to: phone,
    //     from: process.env.TWILIO_PHONE_NUMBER,
    //   });
    // }

    return { success: true, otpCode };
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate OTP: ${error.message}`,
    };
  }
}

/**
 * Resend OTP middleware
 */
export function resendOTPMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { requestId } = req.body;

  if (!requestId) {
    res.status(400).json({
      success: false,
      error: 'requestId is required',
    });
    return;
  }

  linkRequestService.findById(requestId)
    .then(request => {
      if (!request) {
        res.status(404).json({
          success: false,
          error: 'Request not found',
        });
        return;
      }

      if (request.status === 'completed') {
        res.status(400).json({
          success: false,
          error: 'Request already completed',
        });
        return;
      }

      if (request.status === 'expired') {
        res.status(400).json({
          success: false,
          error: 'Request expired',
        });
        return;
      }

      // Generate new OTP
      const phone = request.identifier.phone;
      const email = request.identifier.email;

      generateAndSendOTP(requestId, phone, email)
        .then(result => {
          if (!result.success) {
            res.status(500).json({
              success: false,
              error: result.error,
            });
            return;
          }

          res.json({
            success: true,
            message: 'OTP resent successfully',
            requestId,
          });
        });
    })
    .catch(error => {
      res.status(500).json({
        success: false,
        error: `Failed to resend OTP: ${error.message}`,
      });
    });
}

/**
 * OTP Verification Result Handler
 * Use this to process the verified request
 */
export function otpVerificationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // After verifyOTPMiddleware succeeds, this handler processes the result
  const verifiedIdentifier = req.verifiedIdentifier;

  if (!verifiedIdentifier) {
    res.status(400).json({
      success: false,
      error: 'No verified identifier found',
    });
    return;
  }

  // Check rate limit
  const identifier = verifiedIdentifier.phone || verifiedIdentifier.email || verifiedIdentifier.deviceId;
  if (identifier) {
    const rateLimit = checkOTPRequestRateLimit(identifier);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remainingAttempts.toString());
  }

  next();
}

/**
 * Mask phone number for display
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}

/**
 * Mask email for display
 */
export function maskEmail(email: string): string {
  if (!email) return '****';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '****';
  const maskedLocal = local[0] + '***' + (local.length > 1 ? local[local.length - 1] : '');
  return `${maskedLocal}@${domain}`;
}
