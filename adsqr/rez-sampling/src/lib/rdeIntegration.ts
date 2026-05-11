/**
 * RDE Integration for adsqr
 *
 * Connects adsqr to RDE Core for:
 * - Real-time trigger events
 * - Supreme Controller approval
 * - Attribution tracking
 */

const RDE_URL = process.env.RDE_URL || 'http://localhost:4027';

// ============================================
// TYPES
// ============================================

export interface ScanTriggerData {
  userId: string;
  campaignId: string;
  merchantId: string;
  qrId: string;
  location?: { lat: number; lng: number };
  category?: string;
  coins?: number;
}

export interface TriggerResult {
  triggered: boolean;
  actions: {
    action: string;
    delay?: number;
    coins?: number;
  }[];
  latencyMs: number;
}

export interface DecisionResult {
  approved: boolean;
  decisionId: string;
  reason: string;
  approvedAction?: {
    channel: string;
    content?: string;
    timing: string;
    coins?: number;
  };
  rejectedReason?: string;
}

// ============================================
// REAL-TIME TRIGGERS
// ============================================

/**
 * Fire scan event to RDE Triggers
 * This triggers the scan → coin credit flow
 */
export async function fireScanTrigger(data: ScanTriggerData): Promise<TriggerResult> {
  try {
    const start = Date.now();

    const response = await fetch(`${RDE_URL}/api/triggers/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: data.userId,
        campaignId: data.campaignId,
        merchantId: data.merchantId,
        location: data.location,
        category: data.category || 'general'
      })
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      console.error('[adsqr→RDE] Trigger failed:', response.status);
      return {
        triggered: false,
        actions: [],
        latencyMs: latency
      };
    }

    const result = await response.json();

    return {
      triggered: result.data?.triggered > 0,
      actions: result.data?.actions || [],
      latencyMs: result.data?.latencyMs || latency
    };

  } catch (error) {
    console.error('[adsqr→RDE] Trigger error:', error);
    return {
      triggered: false,
      actions: [],
      latencyMs: 0
    };
  }
}

/**
 * Fire purchase event to RDE Triggers
 */
export async function firePurchaseTrigger(
  userId: string,
  merchantId: string,
  orderId: string,
  amount: number
): Promise<TriggerResult> {
  try {
    const start = Date.now();

    const response = await fetch(`${RDE_URL}/api/triggers/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        orderId,
        merchantId,
        amount
      })
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        triggered: false,
        actions: [],
        latencyMs: latency
      };
    }

    const result = await response.json();

    return {
      triggered: result.data?.triggered > 0,
      actions: result.data?.actions || [],
      latencyMs: result.data?.latencyMs || latency
    };

  } catch (error) {
    console.error('[adsqr→RDE] Purchase trigger error:', error);
    return {
      triggered: false,
      actions: [],
      latencyMs: 0
    };
  }
}

// ============================================
// SUPREME CONTROLLER
// ============================================

/**
 * Request approval from RDE Supreme Controller
 * Required before any coin credit
 */
export async function requestRDEDecision(
  userId: string,
  action: string,
  channel: string,
  context: Record<string, any>
): Promise<DecisionResult> {
  try {
    const response = await fetch(`${RDE_URL}/api/rde/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action,
        channel,
        context
      })
    });

    if (!response.ok) {
      console.error('[adsqr→RDE] Decision failed:', response.status);
      return {
        approved: false,
        decisionId: '',
        reason: 'error'
      };
    }

    const result = await response.json();

    return result.data || {
      approved: false,
      decisionId: '',
      reason: 'no_response'
    };

  } catch (error) {
    console.error('[adsqr→RDE] Decision error:', error);
    return {
      approved: false,
      decisionId: '',
      reason: 'connection_error'
    };
  }
}

/**
 * Record action result to RDE
 */
export async function recordRDAResult(
  decisionId: string,
  result: 'sent' | 'clicked' | 'converted' | 'failed'
): Promise<void> {
  try {
    await fetch(`${RDE_URL}/api/rde/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisionId, result })
    });
  } catch (error) {
    console.error('[adsqr→RDE] Result record error:', error);
  }
}

// ============================================
// INTEGRATED SCAN FLOW
// ============================================

export interface IntegratedScanResult {
  approved: boolean;
  coins: number;
  coinType: 'try' | 'brand';
  decisionId?: string;
  triggerResult?: TriggerResult;
  rdeDecision?: DecisionResult;
  redirectUrl: string;
}

/**
 * Complete integrated scan flow:
 * 1. Fire trigger to RDE
 * 2. Request approval from Supreme Controller
 * 3. Return decision
 */
export async function processIntegratedScan(
  data: ScanTriggerData,
  baseCoins: number
): Promise<IntegratedScanResult> {
  // Step 1: Fire real-time trigger
  const triggerResult = await fireScanTrigger(data);

  // Step 2: Request RDE decision
  const rdeDecision = await requestRDEDecision(
    data.userId,
    'show_qr_reward',
    'qr',
    {
      campaignId: data.campaignId,
      merchantId: data.merchantId,
      qrId: data.qrId,
      location: data.location,
      baseCoins
    }
  );

  // Step 3: Determine coins and redirect
  let coins = 0;
  let coinType: 'try' | 'brand' = 'try';
  let approved = false;
  let redirectUrl = `${REZ_TRY_URL}/scan-error?reason=rejected`;

  if (rdeDecision.approved) {
    approved = true;
    coins = rdeDecision.approvedAction?.coins || baseCoins;
    coinType = 'brand'; // Default to brand coins from merchants
    redirectUrl = `${REZ_TRY_URL}/scan-reward?coins=${coins}&type=${coinType}&campaign=${data.campaignId}&merchant=${data.merchantId}`;
  }

  return {
    approved,
    coins,
    coinType,
    decisionId: rdeDecision.decisionId,
    triggerResult,
    rdeDecision,
    redirectUrl
  };
}

// REZ TRY URL
const REZ_TRY_URL = process.env.REZ_TRY_URL || 'https://try.rez.money';
