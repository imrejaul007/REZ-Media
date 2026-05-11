/**
 * REE Client for AdsQR Service
 *
 * Connects to REE for:
 * - Karma scoring
 * - Fraud detection
 * - Reward calculation
 * - Campaign settings
 */

const REE_URL = process.env.REE_URL || 'http://localhost:4000/api'

interface REEVerifyResult {
  success: boolean
  rulesMatched: number
  actionsTriggered: Array<{
    actionType: string
    params: Record<string, any>
  }>
  fraudResult?: {
    isFraud: boolean
    action: 'allow' | 'flag' | 'block'
  }
}

interface REEReward {
  coinType: 'rez' | 'branded'
  baseReward: number
  karmaMultiplier: number
  finalAmount: number
}

/**
 * Record ad scan event to REE
 */
export async function recordAdScan(
  userId: string,
  campaignId: string,
  adId: string,
  merchantId: string,
  location?: { lat: number; lng: number }
): Promise<{
  success: boolean
  fraud: { isFraud: boolean; action: string }
  karma: { earned: number; total: number }
}> {
  try {
    // 1. Record event to REE
    const eventRes = await fetch(`${REE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'qr.scanned',
        source: 'adsqr',
        userId,
        data: {
          campaignId,
          adId,
          merchantId,
          location,
        },
      }),
    })

    const eventData = await eventRes.json()

    // 2. Get karma multiplier
    const karmaRes = await fetch(`${REE_URL}/query/karma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        baseKarma: 5,
        userTier: 'L2',
      }),
    })

    const karmaData = await karmaRes.json()

    return {
      success: true,
      fraud: {
        isFraud: eventData.data?.fraudResult?.isFraud || false,
        action: eventData.data?.fraudResult?.action || 'allow',
      },
      karma: {
        earned: karmaData.data?.karmaEarned || 5,
        total: karmaData.data?.karmaTotal || 0,
      },
    }
  } catch (error) {
    console.error('[REE Client] Ad scan error:', error)
    return {
      success: false,
      fraud: { isFraud: false, action: 'allow' },
      karma: { earned: 5, total: 0 },
    }
  }
}

/**
 * Calculate ad reward from REE
 */
export async function getAdReward(
  userId: string,
  campaignId: string,
  baseReward: number
): Promise<REEReward> {
  try {
    const res = await fetch(`${REE_URL}/query/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'ads_qr',
        context: {
          user: { id: userId },
          campaign: { id: campaignId },
        },
      }),
    })

    const data = await res.json()

    // Calculate final reward with karma multiplier
    const multiplier = data.results?.[0]?.calculatedValues?.karmaMultiplier || 1

    return {
      coinType: 'rez',
      baseReward: baseReward,
      karmaMultiplier: multiplier,
      finalAmount: Math.round(baseReward * multiplier),
    }
  } catch (error) {
    console.error('[REE Client] Reward error:', error)
    return {
      coinType: 'rez',
      baseReward: baseReward,
      karmaMultiplier: 1,
      finalAmount: baseReward,
    }
  }
}

/**
 * Check fraud for ad scan
 */
export async function checkFraud(
  userId: string,
  ip: string,
  userAgent: string,
  location?: { lat: number; lng: number }
): Promise<{
  allowed: boolean
  action: 'allow' | 'flag' | 'block'
  reason?: string
}> {
  try {
    const res = await fetch(`${REE_URL}/query/fraud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          userId,
          device: { ip, userAgent },
          location,
        },
      }),
    })

    const data = await res.json()

    if (data.data?.isFraud) {
      return {
        allowed: data.data.action !== 'block',
        action: data.data.action,
        reason: data.data.reasons?.join(', ') || 'Fraud detected',
      }
    }

    return { allowed: true, action: 'allow' }
  } catch (error) {
    console.error('[REE Client] Fraud check error:', error)
    return { allowed: true, action: 'allow' }
  }
}

/**
 * Get campaign settings from REE
 */
export async function getCampaignSettings(
  campaignId: string
): Promise<{
  maxRewardsPerDay: number
  maxPerUser: number
  minTimeBetweenRewards: number
  fraudRules: string[]
} | null> {
  try {
    const res = await fetch(`${REE_URL}/query/rules/campaign/${campaignId}`, {
      method: 'GET',
    })

    if (!res.ok) return null

    const data = await res.json()
    return data.settings || null
  } catch (error) {
    console.error('[REE Client] Campaign settings error:', error)
    return null
  }
}

/**
 * Record conversion (visit/purchase after ad)
 */
export async function recordConversion(
  userId: string,
  campaignId: string,
  type: 'visit' | 'purchase' | 'signup',
  amount?: number
): Promise<void> {
  try {
    await fetch(`${REE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'conversion',
        source: 'adsqr',
        userId,
        data: {
          campaignId,
          type,
          amount,
        },
      }),
    })
  } catch (error) {
    console.error('[REE Client] Conversion record error:', error)
  }
}
