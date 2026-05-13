import logger from '@/lib/logger'

const MARKETING_SERVICE_URL = process.env.REZ_MARKETING_SERVICE_URL
const ADBAZAAR_INTERNAL_KEY = process.env.ADBAZAAR_INTERNAL_KEY

export interface BroadcastTrigger {
  adBazaarBookingId: string
  rezMerchantId: string
  channel: 'whatsapp' | 'push' | 'sms'
  segment: 'all' | 'high_value' | 'at_risk' | 'new_users'
  title: string
  body: string
  qrCodeUrl?: string
  coinsPerScan?: number
  scheduledAt?: string
}

export async function triggerMarketingBroadcast(
  payload: BroadcastTrigger
): Promise<{ broadcastId: string; estimatedReach: number } | null> {
  if (!MARKETING_SERVICE_URL || !ADBAZAAR_INTERNAL_KEY) {
    logger.warn('triggerMarketingBroadcast: REZ_MARKETING_SERVICE_URL or ADBAZAAR_INTERNAL_KEY not set')
    return null
  }
  try {
    // I2 Fix: auto-upgrade to https — only replace http: prefix when not already https
    const url = MARKETING_SERVICE_URL?.startsWith('https://')
      ? MARKETING_SERVICE_URL
      : MARKETING_SERVICE_URL?.replace(/^http:/, 'https:') ?? ''
    const res = await fetch(`${url}/adbazaar/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': ADBAZAAR_INTERNAL_KEY,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      logger.error('triggerMarketingBroadcast: non-2xx response', null, { status: res.status })
      return null
    }
    return res.json()
  } catch (e) {
    logger.error('triggerMarketingBroadcast: request failed', e)
    return null
  }
}
