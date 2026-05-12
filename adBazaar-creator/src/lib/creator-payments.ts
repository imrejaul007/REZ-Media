/**
 * Creator Payment System - RABTUL Payment Service Client
 * Handles payouts to creators via centralized RABTUL Payment Service
 */

const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL ?? 'https://rez-payment-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? '';

const commonHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
  'X-Internal-Service': 'ad-bazaar-creator',
} as const;

const HTTP_TIMEOUT_MS = 10_000;

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(`${PAYMENT_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw Object.assign(new Error(err.message ?? `HTTP ${res.status}`), { status: res.status });
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

// Payment rates
const PAYMENT_MODELS = {
  sponsored_post: {
    min: 1000,
    max: 1000000,
    escrow_days: 7,
  },
  sponsored_story: {
    min: 500,
    max: 500000,
    escrow_days: 3,
  },
  sponsored_reel: {
    min: 2000,
    max: 2000000,
    escrow_days: 7,
  },
  dooh_scan: {
    min: 1,
    max: 100,
    escrow_days: 0, // Instant
  },
  retainer: {
    min: 10000,
    max: 1000000,
    escrow_days: 0,
  },
}

export interface PayoutRequest {
  creator_id: string
  amount: number
  method: 'bank_transfer' | 'upi' | 'razorpay'
  bank_account?: {
    account_number: string
    ifsc_code: string
    account_holder: string
  }
  upi_id?: string
}

export interface PaymentRecord {
  id: string
  creator_id: string
  campaign_id?: string
  amount: number
  type: 'sponsored_post' | 'story' | 'reel' | 'dooh_scan'
  status: 'pending' | 'escrow' | 'released' | 'paid' | 'failed'
  escrow_release_at?: string
  paid_at?: string
  razorpay_transfer_id?: string
}

/**
 * Create payment for creator via RABTUL Payment Service
 */
export async function createPayment(data: {
  creator_id: string
  campaign_id: string
  type: 'sponsored_post' | 'story' | 'reel' | 'dooh_scan'
  amount: number
}): Promise<{ success: boolean; payment_id?: string; error?: string }> {
  const model = PAYMENT_MODELS[data.type]

  // Validate amount
  if (data.amount < model.min || data.amount > model.max) {
    return { success: false, error: `Amount must be between Rs ${model.min} and Rs ${model.max}` }
  }

  try {
    const result = await post<{
      success: boolean;
      data?: { paymentId: string };
      message?: string;
    }>('/api/creator-payments/create', {
      creator_id: data.creator_id,
      campaign_id: data.campaign_id,
      type: data.type,
      amount: data.amount,
      escrow_days: model.escrow_days,
    });

    if (!result.success || !result.data?.paymentId) {
      return { success: false, error: result.message ?? 'Failed to create payment' };
    }

    return { success: true, payment_id: result.data.paymentId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Release escrow payments (run daily cron) via RABTUL Payment Service
 */
export async function releaseEscrowPayments(): Promise<{ released: number }> {
  try {
    const result = await post<{ success: boolean; data?: { released: number } }>(
      '/api/creator-payments/release-escrow',
      {},
    );
    return { released: result.data?.released ?? 0 };
  } catch (error) {
    console.error('[creator-payments] Failed to release escrow:', error);
    return { released: 0 };
  }
}

/**
 * Process payout to creator via RABTUL Payment Service
 */
export async function processPayout(
  payment_id: string,
  method: 'bank_transfer' | 'upi' | 'razorpay',
  destination: string
): Promise<{ success: boolean; transfer_id?: string; error?: string }> {
  try {
    const result = await post<{
      success: boolean;
      data?: { transferId: string };
      message?: string;
    }>('/api/creator-payments/payout', {
      payment_id,
      method,
      destination,
    });

    if (!result.success || !result.data?.transferId) {
      return { success: false, error: result.message ?? 'Failed to process payout' };
    }

    return { success: true, transfer_id: result.data.transferId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get creator's pending balance via RABTUL Payment Service
 */
export async function getPendingBalance(creator_id: string): Promise<number> {
  try {
    const result = await get<{
      success: boolean;
      data?: { balance: number };
    }>(`/api/creator-payments/balance/${encodeURIComponent(creator_id)}`);
    return result.data?.balance ?? 0;
  } catch (error) {
    console.error('[creator-payments] Failed to get balance:', error);
    return 0;
  }
}

/**
 * Get payment history via RABTUL Payment Service
 */
export async function getPaymentHistory(creator_id: string, limit = 20) {
  try {
    const result = await get<{
      success: boolean;
      data?: PaymentRecord[];
    }>(`/api/creator-payments/history/${encodeURIComponent(creator_id)}?limit=${limit}`);
    return result.data ?? [];
  } catch (error) {
    console.error('[creator-payments] Failed to get history:', error);
    return [];
  }
}
