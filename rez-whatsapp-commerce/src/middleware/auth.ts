import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { CustomerSession } from '../models/CustomerSession';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      customerId?: string;
      customerPhone?: string;
      merchantId?: string;
      sessionId?: string;
      isInternalService?: boolean;
      serviceName?: string;
    }
  }
}

export interface JWTPayload {
  customerId: string;
  customerPhone: string;
  merchantId: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface InternalServiceToken {
  serviceName: string;
  token: string;
}

const JWT_SECRET = process.env.JWT_SECRET!;
const INTERNAL_SERVICE_TOKENS_JSON = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';

let internalServiceTokens: Record<string, string> = {};

try {
  internalServiceTokens = JSON.parse(INTERNAL_SERVICE_TOKENS_JSON);
} catch (error) {
  console.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON, using empty object');
}

/**
 * Generate JWT token for customer session
 */
export function generateCustomerToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Authenticate customer via JWT token
 */
export function authenticateCustomer(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.customerId = req.headers['x-customer-id'] as string;
    req.customerPhone = req.headers['x-customer-phone'] as string;
    req.merchantId = req.headers['x-merchant-id'] as string;

    if (req.customerId && req.customerPhone && req.merchantId) {
      next();
      return;
    }

    _res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    _res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
    return;
  }

  req.customerId = payload.customerId;
  req.customerPhone = payload.customerPhone;
  req.merchantId = payload.merchantId;
  req.sessionId = payload.sessionId;

  next();
}

/**
 * Authenticate internal service calls
 */
export function authenticateInternalService(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const internalToken = req.headers['x-internal-token'] as string;

  if (!internalToken) {
    res.status(401).json({
      success: false,
      error: 'Missing internal service token',
    });
    return;
  }

  // Find the service name for this token
  const serviceName = Object.entries(internalServiceTokens).find(
    ([, token]) => token === internalToken
  )?.[0];

  if (!serviceName) {
    res.status(401).json({
      success: false,
      error: 'Invalid internal service token',
    });
    return;
  }

  req.isInternalService = true;
  req.serviceName = serviceName;
  next();
}

/**
 * Verify Twilio webhook signature
 */
export function verifyTwilioWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const twilioSignature = req.headers['x-twilio-signature'] as string;
  const webhookUrl = process.env.WEBHOOK_URL || `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    console.warn('TWILIO_AUTH_TOKEN not configured, skipping webhook verification');
    next();
    return;
  }

  if (!twilioSignature) {
    res.status(401).json({
      success: false,
      error: 'Missing Twilio signature',
    });
    return;
  }

  // Build the full URL with query params
  const params = req.query as Record<string, string | string[] | undefined>;
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => {
      const value = params[key];
      return Array.isArray(value)
        ? value.map((v) => `${key}=${v}`).join(`&${key}=`)
        : `${key}=${value}`;
    })
    .join('&');

  const dataToSign = `${webhookUrl}${sortedParams ? `?${sortedParams}` : ''}`;

  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(dataToSign, 'utf-8'))
    .digest('base64');

  if (twilioSignature !== expectedSignature) {
    res.status(401).json({
      success: false,
      error: 'Invalid Twilio signature',
    });
    return;
  }

  next();
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyRazorpayWebhook(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const razorpaySignature = req.headers['x-razorpay-signature'] as string;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('RAZORPAY_WEBHOOK_SECRET not configured, skipping webhook verification');
    next();
    return;
  }

  if (!razorpaySignature) {
    _res.status(401).json({
      success: false,
      error: 'Missing Razorpay signature',
    });
    return;
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  if (razorpaySignature !== expectedSignature) {
    _res.status(401).json({
      success: false,
      error: 'Invalid Razorpay signature',
    });
    return;
  }

  next();
}

/**
 * Validate WhatsApp phone number format
 */
export function validateWhatsAppPhone(phone: string): string {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // Add country code if not present (assume India +91)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  // Format with plus sign
  return `+${cleaned}`;
}

/**
 * Extract customer info from Twilio WhatsApp message
 */
export function extractTwilioCustomerInfo(
  from: string
): { phone: string; waId: string } {
  // Format: whatsapp:+14155238886 or +14155238886
  const match = from.match(/whatsapp:?(.+)/);
  if (match) {
    const phone = match[1];
    return {
      phone: validateWhatsAppPhone(phone),
      waId: phone.replace('+', ''),
    };
  }
  return {
    phone: validateWhatsAppPhone(from),
    waId: from.replace('+', ''),
  };
}

/**
 * Load or create customer session
 */
export async function loadCustomerSession(
  customerId: string,
  customerPhone: string,
  merchantId: string,
  whatsappPhone: string
): Promise<string | null> {
  try {
    const session = await CustomerSession.findOrCreate(
      customerId,
      customerPhone,
      merchantId,
      whatsappPhone
    );
    return session.sessionId;
  } catch (error) {
    console.error('Failed to load/create customer session:', error);
    return null;
  }
}

/**
 * Rate limiter middleware factory
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, maxRequests, keyGenerator } = options;
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();
    const record = requests.get(key);

    if (!record || now > record.resetTime) {
      requests.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    record.count++;

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter,
      });
      return;
    }

    next();
  };
}
