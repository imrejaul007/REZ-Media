import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Configuration
const FRAUD_CHECK_ENABLED = process.env.FRAUD_CHECK_ENABLED !== 'false';
const MAX_ORDERS_PER_HOUR = parseInt(process.env.MAX_ORDERS_PER_HOUR || '10', 10);
const MAX_ORDER_VALUE = parseInt(process.env.MAX_ORDER_VALUE || '100000', 10);

// Fraud indicators interface
interface FraudIndicators {
  ipVelocity: number;
  userVelocity: number;
  orderValue: number;
  newDevice: boolean;
  addressMismatch: boolean;
  highRiskLocation: boolean;
}

// Fraud check result
interface FraudCheckResult {
  passed: boolean;
  riskScore: number;
  flags: string[];
  recommendation: 'allow' | 'review' | 'block';
}

/**
 * Track activity in Redis
 */
const trackActivity = async (
  identifier: string,
  action: string,
  windowSeconds: number = 3600
): Promise<number> => {
  const key = `fraud:${identifier}:${action}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // Use Redis sorted set for time-based tracking
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.zremrangebyscore(key, 0, windowStart);
  const count = await redis.zcard(key);
  await redis.expire(key, windowSeconds);

  return count;
};

/**
 * Check if IP/device is suspicious
 */
export const checkFraudIndicators = async (req: Request): Promise<FraudIndicators> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = req.userId || 'anonymous';
  const sessionId = req.sessionId || 'unknown';
  const userAgent = req.headers['user-agent'] || '';

  // Check IP velocity (orders from same IP in last hour)
  const ipVelocity = await trackActivity(ip, 'request', 3600);

  // Check user velocity
  const userVelocity = await trackActivity(userId, 'order', 3600);

  // Check for new device (simplified check)
  const deviceKey = `device:${userId}:${userAgent.substring(0, 50)}`;
  const isNewDevice = !(await redis.exists(deviceKey));

  if (isNewDevice) {
    await redis.setex(deviceKey, 86400 * 30, '1'); // 30 days
  }

  return {
    ipVelocity,
    userVelocity,
    orderValue: 0, // Will be set by the caller
    newDevice: isNewDevice,
    addressMismatch: false, // Will be set by the caller
    highRiskLocation: false, // Would integrate with geo-IP service
  };
};

/**
 * Calculate fraud risk score
 */
const calculateRiskScore = (indicators: FraudIndicators): { score: number; flags: string[] } => {
  let score = 0;
  const flags: string[] = [];

  // High IP velocity
  if (indicators.ipVelocity > 50) {
    score += 40;
    flags.push('HIGH_IP_VELOCITY');
  } else if (indicators.ipVelocity > 20) {
    score += 20;
    flags.push('MODERATE_IP_VELOCITY');
  }

  // High user velocity
  if (indicators.userVelocity > MAX_ORDERS_PER_HOUR) {
    score += 50;
    flags.push('HIGH_USER_VELOCITY');
  } else if (indicators.userVelocity > 5) {
    score += 15;
    flags.push('MODERATE_USER_VELOCITY');
  }

  // New device
  if (indicators.newDevice) {
    score += 15;
    flags.push('NEW_DEVICE');
  }

  // High order value
  if (indicators.orderValue > MAX_ORDER_VALUE) {
    score += 30;
    flags.push('HIGH_ORDER_VALUE');
  }

  // Address mismatch
  if (indicators.addressMismatch) {
    score += 25;
    flags.push('ADDRESS_MISMATCH');
  }

  // High risk location
  if (indicators.highRiskLocation) {
    score += 30;
    flags.push('HIGH_RISK_LOCATION');
  }

  return { score: Math.min(score, 100), flags };
};

/**
 * Get fraud recommendation based on risk score
 */
const getRecommendation = (
  score: number,
  flags: string[]
): FraudCheckResult['recommendation'] => {
  // Block if any critical flags
  if (
    flags.includes('HIGH_IP_VELOCITY') ||
    flags.includes('HIGH_USER_VELOCITY') ||
    flags.includes('HIGH_RISK_LOCATION')
  ) {
    return 'block';
  }

  // Block if very high score
  if (score >= 80) {
    return 'block';
  }

  // Review if moderate score or flags
  if (score >= 40 || flags.length >= 3) {
    return 'review';
  }

  // Allow otherwise
  return 'allow';
};

/**
 * Main fraud check middleware
 */
export const fraudCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!FRAUD_CHECK_ENABLED) {
    return next();
  }

  try {
    const indicators = await checkFraudIndicators(req);

    // Store indicators for later use (e.g., in checkout)
    req.body._fraudIndicators = indicators;

    next();
  } catch (error) {
    console.error('Fraud check error:', error);
    // Fail open for availability, but log the error
    next();
  }
};

/**
 * Fraud check for checkout (with order value)
 */
export const checkoutFraudCheck = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!FRAUD_CHECK_ENABLED) {
    return next();
  }

  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = req.userId || 'anonymous';

    // Get order value from request
    const orderValue = req.body.total || req.body.subtotal || 0;

    // Track this checkout attempt
    await trackActivity(userId, 'checkout', 3600);
    await trackActivity(ip, 'checkout', 3600);

    // Check IP velocity for checkouts
    const ipCheckoutCount = await trackActivity(ip, 'checkout', 3600);
    const userCheckoutCount = await trackActivity(userId, 'checkout', 3600);

    const indicators: FraudIndicators = {
      ipVelocity: ipCheckoutCount,
      userVelocity: userCheckoutCount,
      orderValue,
      newDevice: false,
      addressMismatch: false,
      highRiskLocation: false,
    };

    const { score, flags } = calculateRiskScore(indicators);
    const recommendation = getRecommendation(score, flags);

    const result: FraudCheckResult = {
      passed: recommendation !== 'block',
      riskScore: score,
      flags,
      recommendation,
    };

    // Store fraud check result
    req.body._fraudCheckResult = result;

    if (recommendation === 'block') {
      _res.status(403).json({
        success: false,
        error: 'Order blocked due to security concerns',
        code: 'FRAUD_BLOCKED',
        flags,
      });
      return;
    }

    if (recommendation === 'review') {
      // Add header to flag for manual review
      _res.setHeader('X-Fraud-Review', 'true');
    }

    next();
  } catch (error) {
    console.error('Checkout fraud check error:', error);
    // Fail open
    next();
  }
};

/**
 * High-value order fraud check
 */
export const highValueOrderCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const orderValue = req.body.total || 0;
  const HIGH_VALUE_THRESHOLD = 10000; // Rs. 10,000

  if (orderValue < HIGH_VALUE_THRESHOLD) {
    return next();
  }

  const userId = req.userId;

  // Check if user has previous orders
  if (!userId) {
    // Guest with high-value order needs extra verification
    req.body._requiresVerification = true;
    return next();
  }

  // Check order history (simplified)
  // In production, this would check actual order history
  const orderHistoryKey = `orders:${userId}:count`;
  const orderCount = parseInt(await redis.get(orderHistoryKey) || '0', 10);

  if (orderCount < 3 && orderValue > HIGH_VALUE_THRESHOLD * 2) {
    // New customer with very high value order
    req.body._requiresVerification = true;
    req.body._verificationReason = 'NEW_CUSTOMER_HIGH_VALUE';
  }

  next();
};

/**
 * Reset fraud counters (for testing)
 */
export const resetFraudCounters = async (userId: string): Promise<void> => {
  await redis.del(`fraud:${userId}:order`);
  await redis.del(`fraud:${userId}:checkout`);
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
});
