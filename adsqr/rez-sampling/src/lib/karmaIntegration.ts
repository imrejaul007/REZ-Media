/**
 * Karma Integration for Ads QR Service
 *
 * Awards karma points for ad engagement:
 * - QR scan
 * - Store visit
 * - Purchase attributed to ad
 */

const KARMA_API_URL = process.env.KARMA_API_URL || 'http://localhost:4001';

export interface KarmaEarnPayload {
  userId: string;
  eventType: 'ad_qr_scan' | 'ad_visit' | 'ad_purchase';
  karmaPoints: number;
  source: string;
  campaignId?: string;
  adId?: string;
  merchantId?: string;
  metadata?: Record<string, unknown>;
}

export interface KarmaResult {
  success: boolean;
  karmaEarned?: number;
  totalKarma?: number;
  error?: string;
}

/**
 * Award karma points for ad engagement
 */
export async function awardAdKarma(payload: KarmaEarnPayload): Promise<KarmaResult> {
  try {
    const response = await fetch(`${KARMA_API_URL}/api/karma/micro-actions/ad-engagement/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
      },
      body: JSON.stringify({
        userId: payload.userId,
        actionKey: `ad_${payload.eventType}`,
        metadata: {
          campaignId: payload.campaignId,
          adId: payload.adId,
          merchantId: payload.merchantId,
          ...payload.metadata,
        },
        source: 'ads-qr',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        error: error.message || 'Karma service unavailable',
      };
    }

    const result = await response.json();
    return {
      success: true,
      karmaEarned: result.karmaEarned,
      totalKarma: result.totalKarma,
    };
  } catch (error) {
    console.error('[AdsQR] Karma award error:', error);
    // Don't fail the main flow if karma is unavailable
    return {
      success: false,
      error: 'Karma service unavailable',
    };
  }
}

/**
 * Award karma for QR scan
 */
export async function awardScanKarma(
  userId: string,
  campaignId: string,
  adId?: string,
  merchantId?: string
): Promise<KarmaResult> {
  return awardAdKarma({
    userId,
    eventType: 'ad_qr_scan',
    karmaPoints: 5, // Base karma for ad scan
    source: 'ads-qr',
    campaignId,
    adId,
    merchantId,
  });
}

/**
 * Award karma for verified store visit
 */
export async function awardVisitKarma(
  userId: string,
  campaignId: string,
  merchantId: string,
  adId?: string
): Promise<KarmaResult> {
  return awardAdKarma({
    userId,
    eventType: 'ad_visit',
    karmaPoints: 10, // Higher karma for visit
    source: 'ads-qr',
    campaignId,
    adId,
    merchantId,
  });
}

/**
 * Award karma for purchase attributed to ad
 */
export async function awardPurchaseKarma(
  userId: string,
  campaignId: string,
  merchantId: string,
  purchaseAmount: number,
  adId?: string
): Promise<KarmaResult> {
  // Karma scales with purchase amount
  const karmaPoints = Math.floor(purchaseAmount / 100) + 5;

  return awardAdKarma({
    userId,
    eventType: 'ad_purchase',
    karmaPoints,
    source: 'ads-qr',
    campaignId,
    adId,
    merchantId,
    metadata: { purchaseAmount },
  });
}

/**
 * Get user's karma level for ad engagement
 */
export async function getAdEngagementKarma(
  userId: string
): Promise<{ eligible: boolean; multiplier: number; tier: string }> {
  try {
    const response = await fetch(`${KARMA_API_URL}/api/karma/user/${userId}`, {
      headers: {
        'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
      },
    });

    if (!response.ok) {
      return { eligible: true, multiplier: 1.0, tier: 'default' };
    }

    const data = await response.json();
    const level = data.level || 'bronze';

    // Karma multipliers
    const multipliers: Record<string, number> = {
      bronze: 1.0,
      silver: 1.25,
      gold: 1.5,
      platinum: 2.0,
    };

    return {
      eligible: true,
      multiplier: multipliers[level] || 1.0,
      tier: level,
    };
  } catch {
    return { eligible: true, multiplier: 1.0, tier: 'default' };
  }
}
