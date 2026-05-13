import logger from '@/lib/logger'

const ADS_SERVICE_URL = process.env.REZ_ADS_SERVICE_URL
const ADBAZAAR_INTERNAL_KEY = process.env.ADBAZAAR_INTERNAL_KEY

export interface AdCampaignPayload {
  merchantId: string
  merchantName: string
  adBazaarBookingId: string
  title: string
  description: string
  targetUrl: string
  budget: number
  startDate: string
  endDate?: string
  targeting: {
    interests?: string[]
    locations?: string[]
    ageGroup?: string
  }
}

export interface AdInteractionPayload {
  adBazaarBookingId: string
  userId: string
  type: 'impression' | 'click' | 'conversion'
  metadata?: Record<string, unknown>
}

export async function createAdCampaign(
  payload: AdCampaignPayload
): Promise<{ campaignId: string; status: string } | null> {
  if (!ADS_SERVICE_URL || !ADBAZAAR_INTERNAL_KEY) {
    logger.warn('createAdCampaign: REZ_ADS_SERVICE_URL or ADBAZAAR_INTERNAL_KEY not set')
    return null
  }
  try {
    const url = ADS_SERVICE_URL?.startsWith('https://')
      ? ADS_SERVICE_URL
      : ADS_SERVICE_URL?.replace(/^http:/, 'https:') ?? ''
    const res = await fetch(`${url}/adbazaar/campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': ADBAZAAR_INTERNAL_KEY,
      },
      body: JSON.stringify({
        ...payload,
        source: 'adbazaar',
        type: 'display', // AdBazaar is offline ad space
      }),
    })
    if (!res.ok) {
      logger.error('createAdCampaign: non-2xx response', null, { status: res.status })
      return null
    }
    return res.json()
  } catch (e) {
    logger.error('createAdCampaign: request failed', e)
    return null
  }
}

export async function trackAdInteraction(
  payload: AdInteractionPayload
): Promise<boolean> {
  if (!ADS_SERVICE_URL || !ADBAZAAR_INTERNAL_KEY) {
    logger.warn('trackAdInteraction: REZ_ADS_SERVICE_URL not set')
    return false
  }
  try {
    const url = ADS_SERVICE_URL?.startsWith('https://')
      ? ADS_SERVICE_URL
      : ADS_SERVICE_URL?.replace(/^http:/, 'https:') ?? ''
    const endpoint = payload.type === 'conversion'
      ? '/adbazaar/conversion'
      : payload.type === 'click'
        ? '/adbazaar/click'
        : '/adbazaar/impression'

    const res = await fetch(`${url}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': ADBAZAAR_INTERNAL_KEY,
      },
      body: JSON.stringify({
        adBazaarBookingId: payload.adBazaarBookingId,
        userId: payload.userId,
        metadata: payload.metadata,
      }),
    })
    return res.ok
  } catch (e) {
    logger.error('trackAdInteraction: request failed', e)
    return false
  }
}

export async function getAdCampaignAnalytics(
  merchantId: string
): Promise<{
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  spend: number
} | null> {
  if (!ADS_SERVICE_URL || !ADBAZAAR_INTERNAL_KEY) {
    logger.warn('getAdCampaignAnalytics: REZ_ADS_SERVICE_URL not set')
    return null
  }
  try {
    const url = ADS_SERVICE_URL?.startsWith('https://')
      ? ADS_SERVICE_URL
      : ADS_SERVICE_URL?.replace(/^http:/, 'https:') ?? ''
    const res = await fetch(
      `${url}/adbazaar/analytics?merchantId=${merchantId}`,
      {
        headers: {
          'x-internal-key': ADBAZAAR_INTERNAL_KEY,
        },
      }
    )
    if (!res.ok) {
      logger.error('getAdCampaignAnalytics: non-2xx response', null, { status: res.status })
      return null
    }
    return res.json()
  } catch (e) {
    logger.error('getAdCampaignAnalytics: request failed', e)
    return null
  }
}
