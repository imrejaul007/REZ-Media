/**
 * RABTUL Payment Service HTTP client for Razorpay operations
 * Routes all payment operations through the canonical RABTUL Payment Service
 * instead of direct Razorpay SDK calls.
 */

const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL ?? 'https://rez-payment-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? '';

const commonHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
  'X-Internal-Service': 'ad-bazaar',
} as const;

const HTTP_TIMEOUT_MS = 10_000;

async function post<T>(path: string, body: unknown, options?: { timeout?: number }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeout ?? HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(`${PAYMENT_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw Object.assign(new Error(err.message ?? `HTTP ${res.status}`), { status: res.status, body: err });
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch payment details from Razorpay via RABTUL Payment Service.
 * AB-C5 FIX: This prevents "pay Rs 1 for Rs 50,000 booking" attacks
 * by fetching the actual payment amount from Razorpay.
 */
export async function fetchRazorpayPayment(paymentId: string): Promise<{
  amount: number
  currency: string
  status: string
  order_id: string
} | null> {
  try {
    const result = await post<{
      success: boolean;
      data?: {
        amount: number;
        currency: string;
        status: string;
        order_id: string;
      };
    }>('/api/razorpay/fetch-payment', { paymentId });

    if (!result.success || !result.data) {
      return null;
    }

    return {
      amount: result.data.amount,
      currency: result.data.currency,
      status: result.data.status,
      order_id: result.data.order_id,
    };
  } catch (error) {
    console.error('[razorpay] Failed to fetch payment via RABTUL service:', error);
    return null;
  }
}

/**
 * Verify Razorpay payment signature via RABTUL Payment Service.
 * The service has the secret and performs timing-safe comparison.
 * https://razorpay.com/docs/payments/server-integration/nodejs/payment-gateway/build-integration/#verify-payment-signature
 */
export async function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  try {
    const result = await post<{ success: boolean; data?: { valid: boolean } }>(
      '/api/razorpay/verify-signature',
      { orderId, paymentId, signature },
    );
    return result.success && result.data?.valid === true;
  } catch (error) {
    console.error('[razorpay] Failed to verify signature via RABTUL service:', error);
    return false;
  }
}

/**
 * Get Razorpay key ID from RABTUL Payment Service for client-side checkout.
 */
export async function getRazorpayKeyId(): Promise<string> {
  try {
    const result = await post<{ success: boolean; data?: { keyId: string } }>(
      '/api/razorpay/key-id',
      {},
    );
    return result.data?.keyId ?? '';
  } catch (error) {
    console.error('[razorpay] Failed to get key ID:', error);
    return '';
  }
}

export const RAZORPAY_KEY_ID = '';
