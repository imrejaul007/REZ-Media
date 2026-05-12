/**
 * DOOH Screen Owner Payments - RABTUL Payment Service Client
 * Pay screen owners based on impressions via centralized RABTUL Payment Service
 */

const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL ?? 'https://rez-payment-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? '';

const commonHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
  'X-Internal-Service': 'dooh-screen-app',
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

// Payment rates per 1000 impressions
const CPM_RATES: Record<string, number> = {
  cab_tablet: 15, // Rs 15 per 1000 impressions
  bus_shelter: 20,
  bus_interior: 12,
  train_display: 18,
  metro_screen: 25,
  flight_seatback: 50, // Premium
  flight_overhead: 45,
  airport_gate: 40,
  airport_lounge: 60, // Premium
  airport_display: 35,
  restaurant_tv: 10,
  hotel_lobby: 15,
  hotel_room: 8,
  mall_kiosk: 22,
  mall_directory: 18,
  gym_screen: 12,
  salon_display: 10,
  office_lobby: 20,
  generic_display: 10,
}

const PLATFORM_FEE = 0.20 // 20% platform fee

export interface PaymentSummary {
  screen_id: string
  impressions: number
  gross_revenue: number
  platform_fee: number
  owner_amount: number
}

/**
 * Calculate earnings for a screen via RABTUL Payment Service
 */
export async function calculateEarnings(screenId: string): Promise<PaymentSummary> {
  try {
    const result = await get<{
      success: boolean;
      data?: PaymentSummary;
    }>(`/api/dooh-payments/earnings/${encodeURIComponent(screenId)}`);

    if (!result.success || !result.data) {
      throw new Error('Failed to calculate earnings');
    }

    return result.data;
  } catch (error) {
    // Fallback to local calculation if service unavailable
    console.warn('[dooh-payments] Service unavailable, calculating locally:', error);
    return calculateEarningsLocally(screenId);
  }
}

/**
 * Local fallback for earnings calculation
 */
async function calculateEarningsLocally(screenId: string): Promise<PaymentSummary> {
  const cpm = CPM_RATES['generic_display'] || 10;
  const impressions = 0;
  const gross_revenue = (impressions / 1000) * cpm;
  const platform_fee = gross_revenue * PLATFORM_FEE;
  const owner_amount = gross_revenue - platform_fee;

  return {
    screen_id: screenId,
    impressions,
    gross_revenue,
    platform_fee,
    owner_amount,
  };
}

/**
 * Process monthly payout for all screens via RABTUL Payment Service
 */
export async function processMonthlyPayout(ownerId: string): Promise<{
  total: number
  screens: PaymentSummary[]
}> {
  try {
    const result = await post<{
      success: boolean;
      data?: {
        total: number;
        screens: PaymentSummary[];
      };
      message?: string;
    }>('/api/dooh-payments/monthly-payout', { ownerId });

    if (!result.success || !result.data) {
      throw new Error(result.message ?? 'Failed to process monthly payout');
    }

    return result.data;
  } catch (error) {
    console.error('[dooh-payments] Failed to process monthly payout:', error);
    return { total: 0, screens: [] };
  }
}

/**
 * Request payout via RABTUL Payment Service
 */
export async function requestPayout(
  screenId: string,
  method: 'bank_transfer' | 'upi' | 'wallet'
): Promise<{ success: boolean; payout_id?: string; error?: string }> {
  try {
    const result = await post<{
      success: boolean;
      data?: { payoutId: string };
      message?: string;
    }>('/api/dooh-payments/request-payout', {
      screenId,
      method,
    });

    if (!result.success || !result.data?.payoutId) {
      return { success: false, error: result.message ?? 'Failed to request payout' };
    }

    return { success: true, payout_id: result.data.payoutId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get payout history via RABTUL Payment Service
 */
export async function getPayoutHistory(ownerId: string) {
  try {
    const result = await get<{
      success: boolean;
      data?: Array<{
        id: string;
        screen_id: string;
        amount: number;
        method: string;
        status: string;
        created_at: string;
      }>;
    }>(`/api/dooh-payments/history/${encodeURIComponent(ownerId)}`);

    return result.data ?? [];
  } catch (error) {
    console.error('[dooh-payments] Failed to get payout history:', error);
    return [];
  }
}

/**
 * Get CPM rate for screen type
 */
export function getCPMRate(screenType: string): number {
  return CPM_RATES[screenType] || 10
}

/**
 * Get all screen types with rates
 */
export function getAllCPMRates() {
  return Object.entries(CPM_RATES).map(([type, rate]) => ({
    type,
    rate,
    description: getTypeDescription(type),
  }))
}

function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    cab_tablet: 'Taxi/Cab tablet',
    bus_shelter: 'Bus shelter display',
    flight_seatback: 'Flight seat-back entertainment',
    airport_lounge: 'Airport VIP lounge',
    restaurant_tv: 'Restaurant TV',
    hotel_lobby: 'Hotel lobby display',
    mall_kiosk: 'Mall directory/kiosk',
    generic_display: 'Generic display',
  }
  return descriptions[type] || type
}
