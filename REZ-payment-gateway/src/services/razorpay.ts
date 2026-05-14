/**
 * RABTUL Payment Service - Replaces local Razorpay SDK
 *
 * Uses centralized RABTUL Payment Service for all payment operations.
 * This prevents duplicate Razorpay instances across services.
 *
 * @see RABTUL-Technologies/RAP.md
 * @see RABTUL-Technologies/MIGRATION-GUIDE.md
 */

import { v4 as uuidv4 } from 'uuid';

// RABTUL Payment Service Configuration
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface RABTULHeaders {
  'Content-Type': string;
  'X-Internal-Token': string;
  'X-Internal-Service': string;
}

const headers: RABTULHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
  'X-Internal-Service': 'REZ-payment-gateway',
};

// Idempotency cache (use Redis in production)
const idempotencyCache = new Map<string, { result: any; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function cleanupIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}

setInterval(cleanupIdempotencyCache, 60 * 60 * 1000);

function getIdempotentResult<T>(idempotencyKey: string): T | null {
  const cached = idempotencyCache.get(idempotencyKey);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
    return cached.result as T;
  }
  return null;
}

function setIdempotentResult<T>(idempotencyKey: string, result: T): void {
  idempotencyCache.set(idempotencyKey, { result, timestamp: Date.now() });
}

// RABTUL API wrapper
async function rabtulRequest<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`${PAYMENT_SERVICE_URL}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`RABTUL Payment Error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Create order for wallet top-up via RABTUL
 */
export async function createWalletOrder(
  amount: number,
  userId: string,
  idempotencyKey?: string
): Promise<{ orderId: string; amount: number; currency: string }> {
  const key = idempotencyKey || uuidv4();

  // Check idempotency
  const cached = getIdempotentResult<{ orderId: string; amount: number; currency: string }>(key);
  if (cached) return cached;

  const result = await rabtulRequest<any>('/api/payments/initiate', {
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: `wallet_${userId}_${key}`,
    notes: { userId, type: 'wallet_topup' },
  });

  const order = {
    orderId: result.orderId || result.id,
    amount: (result.amount || amount * 100) / 100,
    currency: result.currency || 'INR',
  };

  setIdempotentResult(key, order);
  return order;
}

/**
 * Verify payment signature via RABTUL
 */
export async function verifyPayment(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<{ success: boolean; status?: string }> {
  const result = await rabtulRequest<{ success: boolean; status?: string }>('/api/payments/verify', {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  });

  return result;
}

/**
 * Get payment details via RABTUL
 */
export async function getPaymentDetails(paymentId: string): Promise<any> {
  return rabtulRequest(`/api/payments/${paymentId}`);
}

/**
 * Get order status via RABTUL
 */
export async function getOrderStatus(orderId: string): Promise<any> {
  return rabtulRequest(`/api/payments/status/${orderId}`);
}

/**
 * Create payout via RABTUL
 */
export async function createPayout(params: {
  accountNumber: string;
  ifsc: string;
  name: string;
  amount: number;
  purpose?: string;
}): Promise<{ payoutId: string; status: string }> {
  const result = await rabtulRequest<any>('/api/payments/payout', params);
  return {
    payoutId: result.payoutId || result.id,
    status: result.status || 'pending',
  };
}

/**
 * Create refund via RABTUL
 */
export async function createRefund(
  paymentId: string,
  amount?: number
): Promise<{ refundId: string; status: string }> {
  const result = await rabtulRequest<any>('/api/payments/refund', {
    payment_id: paymentId,
    amount: amount ? Math.round(amount * 100) : undefined,
  });

  return {
    refundId: result.refundId || result.id,
    status: result.status || 'processed',
  };
}

/**
 * Create ad payment order via RABTUL
 */
export async function createAdPaymentOrder(
  amount: number,
  campaignId: string,
  advertiserId: string,
  idempotencyKey?: string
): Promise<{ orderId: string; amount: number; currency: string }> {
  const key = idempotencyKey || uuidv4();

  const result = await rabtulRequest<any>('/api/payments/initiate', {
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: `ad_${campaignId}_${key}`,
    notes: { campaignId, advertiserId, type: 'ad_payment' },
  });

  return {
    orderId: result.orderId || result.id,
    amount: (result.amount || amount * 100) / 100,
    currency: result.currency || 'INR',
  };
}

// Re-export for backward compatibility
export const razorpayService = {
  createOrder: createWalletOrder,
  verifyPayment,
  getPayment: getPaymentDetails,
  createPayout,
  createRefund,
};

export type WalletOrderResult = { orderId: string; amount: number; currency: string };
export type PayoutResult = { payoutId: string; status: string };
export type RefundResult = { refundId: string; status: string };
