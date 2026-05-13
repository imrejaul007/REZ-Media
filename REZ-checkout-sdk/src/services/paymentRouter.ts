import axios from 'axios';
import Redis from 'ioredis';

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Payment configuration
const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || 'http://localhost:4001';
const PAYMENT_GATEWAY_API_KEY = process.env.PAYMENT_GATEWAY_API_KEY || '';

// Preferred payment methods in order
const DEFAULT_PAYMENT_PREFERENCES = ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD'];

// Payment method configuration
interface PaymentMethodConfig {
  enabled: boolean;
  minAmount?: number;
  maxAmount?: number;
  priority: number;
  requiresVerification?: boolean;
}

const PAYMENT_METHODS: Record<string, PaymentMethodConfig> = {
  UPI: {
    enabled: true,
    minAmount: 1,
    maxAmount: 100000,
    priority: 1,
  },
  CARD: {
    enabled: true,
    minAmount: 1,
    maxAmount: 500000,
    priority: 2,
  },
  NETBANKING: {
    enabled: true,
    minAmount: 1,
    maxAmount: 500000,
    priority: 3,
  },
  WALLET: {
    enabled: true,
    minAmount: 1,
    maxAmount: 50000,
    priority: 4,
  },
  COD: {
    enabled: true,
    minAmount: 1,
    maxAmount: 50000,
    priority: 5,
    requiresVerification: true,
  },
};

// Payment routing request
export interface PaymentRoutingRequest {
  amount: number;
  userId?: string;
  sessionId?: string;
  preferredMethod?: string;
  cartTotal?: number;
  isGuest?: boolean;
  previousPaymentMethods?: string[];
}

// Payment routing response
export interface PaymentRoutingResponse {
  recommendedMethod: string;
  provider: string;
  availableMethods: string[];
  shouldRedirect: boolean;
  redirectUrl?: string;
  reason: string;
}

/**
 * Check if a payment method is available
 */
const isMethodAvailable = (
  method: string,
  amount: number,
  isGuest: boolean
): boolean => {
  const config = PAYMENT_METHODS[method];
  if (!config || !config.enabled) return false;
  if (amount < (config.minAmount || 0)) return false;
  if (amount > (config.maxAmount || Infinity)) return false;
  if (method === 'COD' && !isGuest && amount > 10000) return false; // COD limit for returning customers
  return true;
};

/**
 * Get user's preferred payment method from history
 */
export const getPreferredPaymentMethod = async (userId: string): Promise<string | null> => {
  try {
    const key = `payment:preferred:${userId}`;
    const method = await redis.get(key);
    return method || null;
  } catch {
    return null;
  }
};

/**
 * Save user's preferred payment method
 */
export const setPreferredPaymentMethod = async (
  userId: string,
  method: string
): Promise<void> => {
  try {
    const key = `payment:preferred:${userId}`;
    await redis.set(key, method, 'EX', 86400 * 30); // 30 days
  } catch (error) {
    console.error('Error saving preferred payment method:', error);
  }
};

/**
 * Track payment method usage
 */
const trackPaymentUsage = async (
  userId: string,
  method: string,
  success: boolean
): Promise<void> => {
  try {
    const key = `payment:usage:${userId}:${method}`;
    await redis.zadd(key, Date.now(), `${Date.now()}-${success ? 'success' : 'failed'}`);
    await redis.expire(key, 86400 * 90); // 90 days
  } catch (error) {
    console.error('Error tracking payment usage:', error);
  }
};

/**
 * Get successful payment methods for a user
 */
const getSuccessfulPaymentMethods = async (userId: string): Promise<string[]> => {
  try {
    const methods: string[] = [];

    for (const method of DEFAULT_PAYMENT_PREFERENCES) {
      const key = `payment:usage:${userId}:${method}`;
      const count = await redis.zcard(key);
      if (count > 0) {
        methods.push(method);
      }
    }

    return methods;
  } catch {
    return [];
  }
};

/**
 * Route payment to appropriate gateway/method
 */
export const routePayment = async (
  request: PaymentRoutingRequest
): Promise<PaymentRoutingResponse> => {
  const {
    amount,
    userId,
    sessionId,
    preferredMethod,
    isGuest = false,
  } = request;

  // Determine available methods
  const availableMethods: string[] = [];

  for (const method of DEFAULT_PAYMENT_PREFERENCES) {
    if (isMethodAvailable(method, amount, isGuest)) {
      availableMethods.push(method);
    }
  }

  if (availableMethods.length === 0) {
    return {
      recommendedMethod: 'CARD',
      provider: 'razorpay',
      availableMethods: ['CARD'],
      shouldRedirect: true,
      reason: 'No payment method available for this amount',
    };
  }

  // Determine recommended method
  let recommendedMethod: string;

  // Priority 1: User's previous successful method
  if (userId) {
    const successfulMethods = await getSuccessfulPaymentMethods(userId);
    if (successfulMethods.length > 0 && successfulMethods.some(m => availableMethods.includes(m))) {
      recommendedMethod = successfulMethods.find(m => availableMethods.includes(m))!;
      return {
        recommendedMethod,
        provider: getProviderForMethod(recommendedMethod),
        availableMethods,
        shouldRedirect: recommendedMethod !== 'COD',
        redirectUrl: recommendedMethod !== 'COD' ? await getPaymentRedirectUrl(recommendedMethod, amount, userId) : undefined,
        reason: 'Using your preferred payment method',
      };
    }
  }

  // Priority 2: Explicitly requested method
  if (preferredMethod && availableMethods.includes(preferredMethod)) {
    recommendedMethod = preferredMethod;
    return {
      recommendedMethod,
      provider: getProviderForMethod(recommendedMethod),
      availableMethods,
      shouldRedirect: recommendedMethod !== 'COD',
      redirectUrl: recommendedMethod !== 'COD' ? await getPaymentRedirectUrl(recommendedMethod, amount, userId) : undefined,
      reason: 'Requested payment method',
    };
  }

  // Priority 3: Best available method based on amount and user profile
  // For guests or low amounts, prefer UPI/COD
  if (isGuest || amount < 1000) {
    if (availableMethods.includes('UPI')) {
      recommendedMethod = 'UPI';
    } else if (availableMethods.includes('COD')) {
      recommendedMethod = 'COD';
    } else {
      recommendedMethod = availableMethods[0];
    }
  } else {
    // For authenticated users with higher amounts, prefer saved methods
    recommendedMethod = availableMethods[0];
  }

  // Generate redirect URL for non-COD methods
  const shouldRedirect = recommendedMethod !== 'COD';
  let redirectUrl: string | undefined;

  if (shouldRedirect) {
    redirectUrl = await getPaymentRedirectUrl(recommendedMethod, amount, userId);
  }

  return {
    recommendedMethod,
    provider: getProviderForMethod(recommendedMethod),
    availableMethods,
    shouldRedirect,
    redirectUrl,
    reason: 'Recommended based on amount and availability',
  };
};

/**
 * Get provider name for payment method
 */
const getProviderForMethod = (method: string): string => {
  switch (method) {
    case 'UPI':
    case 'CARD':
    case 'NETBANKING':
    case 'WALLET':
      return 'razorpay';
    case 'COD':
      return 'internal';
    default:
      return 'razorpay';
  }
};

/**
 * Generate payment redirect URL
 */
const getPaymentRedirectUrl = async (
  method: string,
  amount: number,
  userId?: string
): Promise<string> => {
  // In production, this would create a payment order with the gateway
  try {
    const response = await axios.post(
      `${PAYMENT_GATEWAY_URL}/orders`,
      {
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        method,
        customerId: userId,
      },
      {
        headers: {
          'X-API-Key': PAYMENT_GATEWAY_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    return response.data.short_url || response.data.payment_url;
  } catch (error) {
    // Return internal checkout page as fallback
    return `/checkout/pay?method=${method}&amount=${amount}`;
  }
};

/**
 * Get available payment methods for an amount
 */
export const getAvailablePaymentMethods = async (
  amount: number,
  userId?: string,
  isGuest?: boolean
): Promise<string[]> => {
  const availableMethods: string[] = [];

  for (const method of DEFAULT_PAYMENT_PREFERENCES) {
    if (isMethodAvailable(method, amount, isGuest || !userId)) {
      availableMethods.push(method);
    }
  }

  return availableMethods;
};

/**
 * Validate payment completion
 */
export const validatePaymentCompletion = async (
  transactionId: string,
  expectedAmount: number
): Promise<{
  valid: boolean;
  status?: string;
  error?: string;
}> => {
  try {
    // Verify with payment gateway
    const response = await axios.get(
      `${PAYMENT_GATEWAY_URL}/orders/${transactionId}`,
      {
        headers: {
          'X-API-Key': PAYMENT_GATEWAY_API_KEY,
        },
        timeout: 5000,
      }
    );

    const payment = response.data;

    if (payment.amount / 100 !== expectedAmount) {
      return {
        valid: false,
        error: 'Amount mismatch',
      };
    }

    return {
      valid: true,
      status: payment.status,
    };
  } catch (error) {
    console.error('Payment validation error:', error);
    return {
      valid: false,
      error: 'Failed to validate payment',
    };
  }
};

/**
 * Process refund
 */
export const processRefund = async (
  transactionId: string,
  amount: number,
  reason?: string
): Promise<{
  success: boolean;
  refundId?: string;
  error?: string;
}> => {
  try {
    const response = await axios.post(
      `${PAYMENT_GATEWAY_URL}/refunds`,
      {
        transaction_id: transactionId,
        amount: amount * 100,
        reason,
      },
      {
        headers: {
          'X-API-Key': PAYMENT_GATEWAY_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return {
      success: true,
      refundId: response.data.refund_id,
    };
  } catch (error) {
    console.error('Refund error:', error);
    return {
      success: false,
      error: 'Failed to process refund',
    };
  }
};

/**
 * Get COD eligibility
 */
export const checkCODEligibility = async (
  amount: number,
  userId?: string,
  location?: { city: string; state: string }
): Promise<{
  eligible: boolean;
  reason?: string;
  maxAmount?: number;
}> => {
  // COD not available for high-value orders
  if (amount > 50000) {
    return {
      eligible: false,
      reason: 'Cash on Delivery is not available for orders above Rs. 50,000',
    };
  }

  // Check restricted locations
  const restrictedStates = ['Nagaland', 'Meghalaya', 'Mizoram', 'Sikkim'];
  if (location?.state && restrictedStates.includes(location.state)) {
    return {
      eligible: false,
      reason: 'Cash on Delivery is not available in your state',
    };
  }

  // New guests have lower COD limit
  if (!userId && amount > 10000) {
    return {
      eligible: false,
      reason: 'Please login or add a phone number to use Cash on Delivery for orders above Rs. 10,000',
      maxAmount: 10000,
    };
  }

  return { eligible: true };
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
});
