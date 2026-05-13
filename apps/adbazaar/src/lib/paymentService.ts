/**
 * REZ Payment Service HTTP client
 * Routes all payment operations through the canonical REZ Payment Service
 * instead of direct Razorpay calls.
 *
 * REZ Payment Service is the SINGLE WRITER for payment records (payments collection).
 * AdBazaar manages booking records in Supabase; the payment service manages
 * payment lifecycle, replay protection, and wallet credits.
 *
 * See: REZ Payment Service paymentRoutes.ts for API contract.
 */

const PAYMENT_SERVICE_URL =
  process.env.REZ_PAYMENT_SERVICE_URL ?? 'https://rez-payment-service.onrender.com';
const INTERNAL_KEY = process.env.ADBAZAAR_INTERNAL_KEY ?? '';
const HTTP_TIMEOUT_MS = 10_000;

const commonHeaders = {
  'Content-Type': 'application/json',
  'x-internal-token': INTERNAL_KEY,
  'x-internal-service': 'ad-bazaar',
} as const;

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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${PAYMENT_SERVICE_URL}${path}`, {
    method: 'GET',
    headers: commonHeaders,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(err.message ?? `HTTP ${res.status}`), { status: res.status });
  }

  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CreateOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export interface CaptureResult {
  success: boolean;
  data?: {
    paymentId: string;
    status: string;
  };
  message?: string;
}

export interface PaymentStatusResult {
  success: boolean;
  data?: {
    payment: {
      paymentId: string;
      status: string;
      amount: number;
      razorpayPaymentId?: string;
      razorpayOrderId?: string;
    };
    auditTrail?: unknown[];
  };
}

export interface VerifyResult {
  success: boolean;
  data?: { valid: boolean };
}

export interface WebhookForwardResult {
  success: boolean;
  duplicate?: boolean;
  message?: string;
}

export interface InitiateResult {
  success: boolean;
  data?: {
    paymentId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    status: string;
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a Razorpay order via REZ Payment Service.
 * The service asserts the authoritative amount before creating the order.
 *
 * @param amount      Amount in rupees (not paise). Max 500,000.
 * @param receipt    Receipt identifier (use booking.id).
 * @param notes      Optional notes object (bookingId, listingId, buyerId).
 * @param orderId    AdBazaar booking id — used as orderId for the payment service.
 * @param orderNumber Alias for orderId.
 */
export async function createRazorpayOrder(
  amount: number,
  receipt: string,
  notes?: Record<string, string>,
  orderId?: string,
  orderNumber?: string,
): Promise<CreateOrderResult> {
  const result = await post<{ success: boolean; data: CreateOrderResult }>(
    '/api/razorpay/create-order',
    { amount, receipt, notes, orderId, orderNumber },
  );
  if (!result.success || !result.data) {
    throw new Error('Failed to create Razorpay order via payment service');
  }
  return result.data;
}

/**
 * Forward a Razorpay webhook event to REZ Payment Service.
 * The service handles deduplication, signature verification, and payment state updates.
 *
 * @param rawBody   Raw request body string (required for HMAC verification).
 * @param signature x-razorpay-signature header value.
 */
export async function forwardWebhook(
  rawBody: string,
  signature: string,
): Promise<WebhookForwardResult> {
  const res = await fetch(`${PAYMENT_SERVICE_URL}/api/payment/webhook/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-internal-token': INTERNAL_KEY,
      'x-internal-service': 'ad-bazaar',
    },
    body: rawBody,
  });

  return res.json() as Promise<WebhookForwardResult>;
}

/**
 * Capture a payment after client-side Razorpay checkout completes.
 * Verifies the signature via REZ Payment Service (which has the secret).
 *
 * @param paymentId          REZ Payment Service payment ID (returned from initiatePayment).
 * @param razorpayPaymentId Razorpay's pay_* ID.
 * @param razorpayOrderId   Razorpay's order_* ID.
 * @param razorpaySignature HMAC-SHA256 signature from client.
 */
export async function capturePayment(
  paymentId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string,
  razorpaySignature: string,
): Promise<CaptureResult> {
  return post('/api/payment/capture', {
    paymentId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
  });
}

/**
 * Verify a Razorpay payment signature.
 * Uses the internal endpoint — requires x-internal-token.
 */
export async function verifySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): Promise<boolean> {
  try {
    const result = await post<VerifyResult>(
      '/api/razorpay/verify-payment',
      { razorpayOrderId, razorpayPaymentId, razorpaySignature },
    );
    return result.success && result.data?.valid === true;
  } catch {
    return false;
  }
}

/**
 * Get payment status from REZ Payment Service.
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
  return get<PaymentStatusResult>(`/api/payment/status/${paymentId}`);
}

/**
 * Create a MongoDB payment document via the payment service's internal initiate endpoint.
 * This ensures the payment record exists before capture is called.
 *
 * AdBazaar creates bookings server-side (not via a user JWT), so we use the internal
 * initiate endpoint which trusts x-internal-token.
 *
 * @param razorpayOrderId The Razorpay order ID (order_*) to create a payment doc for.
 * @param amount         Amount in rupees.
 * @param userId         AdBazaar user ID (buyer's Supabase UID).
 * @param orderId        AdBazaar booking ID.
 */
export async function initiatePaymentForOrder(
  razorpayOrderId: string,
  amount: number,
  userId: string,
  orderId: string,
): Promise<{ paymentId: string }> {
  const result = await post<{ success: boolean; data?: { paymentId: string }; message?: string }>(
    '/internal/pay/initiate-for-order',
    { razorpayOrderId, amount, userId, orderId },
  );
  if (!result.success || !result.data?.paymentId) {
    throw new Error(result.message ?? 'Failed to initiate payment for order');
  }
  return { paymentId: result.data.paymentId };
}

/**
 * Look up a MongoDB payment by Razorpay payment ID and return its internal paymentId.
 * Used when we only have the razorpay_payment_id (pay_*) and need the MongoDB _id.
 */
export async function getPaymentByRazorpayPaymentId(
  razorpayPaymentId: string,
): Promise<string | null> {
  try {
    const result = await get<{ success: boolean; data?: { paymentId: string } }>(
      `/internal/pay/by-razorpay-payment/${encodeURIComponent(razorpayPaymentId)}`,
    );
    return result.success ? (result.data?.paymentId ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Process a refund via REZ Payment Service.
 * Requires admin/merchant auth — the caller must pass a valid user JWT.
 *
 * @param paymentId REZ Payment Service payment ID.
 * @param amount    Refund amount in rupees.
 * @param reason    Optional reason string.
 * @param userJwt   JWT access token from the authenticated admin.
 */
export async function processRefund(
  paymentId: string,
  amount: number,
  reason?: string,
  userJwt?: string,
): Promise<{ success: boolean; data?: unknown; message?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-internal-token': INTERNAL_KEY,
    'x-internal-service': 'ad-bazaar',
  };
  if (userJwt) {
    headers['Authorization'] = `Bearer ${userJwt}`;
  }

  const res = await fetch(`${PAYMENT_SERVICE_URL}/api/payment/refund`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ paymentId, amount, reason }),
  });

  return res.json() as Promise<{ success: boolean; data?: unknown; message?: string }>;
}
