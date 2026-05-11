/**
 * REZ Payment Integration for Ads QR
 * Handles coin purchases, payment gateway, and transaction history
 */

const PAYMENT_SERVICE_URL = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL || 'https://api.rez.money';

// Types
export interface PaymentInitiateRequest {
  orderId: string;
  amount: number;
  paymentMethod: 'upi' | 'card' | 'wallet' | 'netbanking';
  purpose?: 'wallet_topup' | 'order_payment';
  userDetails?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitiateResponse {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  status?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
}

export interface PaymentCaptureRequest {
  paymentId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  amount: number;
  paymentMethod: string;
  createdAt: string;
  completedAt?: string;
}

export interface CoinPurchaseOption {
  coins: number;
  price: number;
  bonusCoins?: number;
  pricePerCoin?: number;
}

export interface CoinPurchasePackage {
  id: string;
  coins: number;
  bonusCoins: number;
  totalCoins: number;
  priceInr: number;
  pricePerCoin: number;
  isPopular?: boolean;
  paymentMethods: string[];
}

// Default coin packages
export const COIN_PACKAGES: CoinPurchasePackage[] = [
  {
    id: 'coins_100',
    coins: 100,
    bonusCoins: 0,
    totalCoins: 100,
    priceInr: 10,
    pricePerCoin: 0.10,
    paymentMethods: ['upi', 'wallet'],
  },
  {
    id: 'coins_500',
    coins: 500,
    bonusCoins: 25,
    totalCoins: 525,
    priceInr: 50,
    pricePerCoin: 0.10,
    paymentMethods: ['upi', 'card', 'wallet', 'netbanking'],
  },
  {
    id: 'coins_1000',
    coins: 1000,
    bonusCoins: 100,
    totalCoins: 1100,
    priceInr: 100,
    pricePerCoin: 0.10,
    isPopular: true,
    paymentMethods: ['upi', 'card', 'wallet', 'netbanking'],
  },
  {
    id: 'coins_5000',
    coins: 5000,
    bonusCoins: 750,
    totalCoins: 5750,
    priceInr: 500,
    pricePerCoin: 0.10,
    paymentMethods: ['upi', 'card', 'wallet', 'netbanking'],
  },
  {
    id: 'coins_10000',
    coins: 10000,
    bonusCoins: 2000,
    totalCoins: 12000,
    priceInr: 1000,
    pricePerCoin: 0.10,
    paymentMethods: ['upi', 'card', 'wallet', 'netbanking'],
  },
];

/**
 * Get authorization headers
 */
function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adsqr_access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

/**
 * Get Razorpay configuration
 */
export async function getRazorpayConfig(): Promise<{ keyId: string } | null> {
  try {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/api/razorpay/config`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (data.success && data.data) {
      return { keyId: data.data.key_id };
    }

    return null;
  } catch (error) {
    console.error('Get Razorpay config error:', error);
    return null;
  }
}

/**
 * Create a Razorpay order for coin purchase
 */
export async function createRazorpayOrder(
  amount: number,
  receipt: string
): Promise<{ success: boolean; orderId?: string; amount?: number }> {
  try {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/api/razorpay/create-order`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        amount,
        receipt,
        notes: { type: 'coin_purchase', source: 'adsqr' },
      }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      return {
        success: true,
        orderId: data.data.id,
        amount: data.data.amount,
      };
    }

    return { success: false };
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    return { success: false };
  }
}

/**
 * Initiate payment
 */
export async function initiatePayment(
  request: PaymentInitiateRequest
): Promise<PaymentInitiateResponse> {
  try {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/pay/initiate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...request,
        purpose: request.purpose || 'wallet_topup',
        metadata: {
          ...request.metadata,
          source: 'adsqr',
          app: 'adsqr',
        },
      }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      return {
        success: true,
        paymentId: data.data.paymentId,
        orderId: data.data.orderId,
        amount: data.data.amount,
        status: data.data.status,
        razorpayOrderId: data.data.razorpayOrderId,
        razorpayKeyId: data.data.key_id,
      };
    }

    return { success: false };
  } catch (error) {
    console.error('Initiate payment error:', error);
    return { success: false };
  }
}

/**
 * Capture payment after Razorpay success
 */
export async function capturePayment(
  request: PaymentCaptureRequest
): Promise<{ success: boolean; paymentId?: string; status?: string }> {
  try {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/pay/capture`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (data.success && data.data) {
      return {
        success: true,
        paymentId: data.data.paymentId,
        status: data.data.status,
      };
    }

    return { success: false };
  } catch (error) {
    console.error('Capture payment error:', error);
    return { success: false };
  }
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
  try {
    const response = await fetch(`${PAYMENT_SERVICE_URL}/pay/status/${paymentId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (data.success && data.data?.payment) {
      return data.data.payment;
    }

    return null;
  } catch (error) {
    console.error('Get payment status error:', error);
    return null;
  }
}

/**
 * Purchase coins using Razorpay
 */
export async function purchaseCoins(
  packageId: string,
  paymentMethod: 'upi' | 'card' | 'wallet' | 'netbanking' = 'upi'
): Promise<{
  success: boolean;
  orderId?: string;
  razorpayOrderId?: string;
  keyId?: string;
  amount?: number;
  coins?: number;
  message?: string;
}> {
  const pkg = COIN_PACKAGES.find(p => p.id === packageId);
  if (!pkg) {
    return { success: false, message: 'Invalid package' };
  }

  if (!pkg.paymentMethods.includes(paymentMethod)) {
    return { success: false, message: `${paymentMethod} not supported for this package` };
  }

  try {
    // Create order with Razorpay
    const receipt = `adsqr_coins_${Date.now()}`;
    const orderResult = await createRazorpayOrder(pkg.priceInr * 100, receipt);

    if (!orderResult.success || !orderResult.orderId) {
      return { success: false, message: 'Failed to create order' };
    }

    // Get Razorpay config
    const config = await getRazorpayConfig();
    if (!config) {
      return { success: false, message: 'Payment gateway not configured' };
    }

    return {
      success: true,
      orderId: receipt,
      razorpayOrderId: orderResult.orderId,
      keyId: config.keyId,
      amount: pkg.priceInr,
      coins: pkg.totalCoins,
    };
  } catch (error) {
    console.error('Purchase coins error:', error);
    return { success: false, message: 'Failed to initiate purchase' };
  }
}

/**
 * Verify payment signature
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean {
  // This should be done server-side, but we can do a basic check here
  return !!(razorpayOrderId && razorpayPaymentId && razorpaySignature);
}

/**
 * Get price display for coins
 */
export function getPriceDisplay(pkg: CoinPurchasePackage): string {
  if (pkg.bonusCoins > 0) {
    return `₹${pkg.priceInr} (${pkg.coins} + ${pkg.bonusCoins} bonus)`;
  }
  return `₹${pkg.priceInr}`;
}

/**
 * Calculate effective price per coin
 */
export function calculateEffectivePrice(pkg: CoinPurchasePackage): number {
  if (pkg.priceInr === 0) return 0;
  return pkg.priceInr / pkg.totalCoins;
}
