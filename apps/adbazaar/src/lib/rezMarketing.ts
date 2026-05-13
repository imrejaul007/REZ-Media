/**
 * Unified Marketing API - Connects AdBazaar to ReZ Marketing Ecosystem
 *
 * This module provides a unified interface for:
 * - rez-ads-service: Digital ad campaigns, impressions, clicks, conversions
 * - rez-marketing-service: Broadcasts, audience targeting, automation
 * - rez-intent-graph: User intent capture
 */

import { triggerMarketingBroadcast, type BroadcastTrigger } from './marketing'
import { createAdCampaign, trackAdInteraction, getAdCampaignAnalytics, type AdCampaignPayload, type AdInteractionPayload } from './adsService'
import { captureIntent, type IntentPayload } from './intentCaptureService'
import logger from '@/lib/logger'

// ─── Unified Types ───────────────────────────────────────────────────────────

export interface UnifiedCampaignPayload {
  // Common fields
  merchantId: string
  merchantName: string
  adBazaarBookingId: string

  // Ad-specific
  adTitle: string
  adDescription: string
  adTargetUrl: string
  adBudget: number
  adStartDate: string
  adEndDate?: string

  // Marketing-specific
  broadcastTitle?: string
  broadcastBody?: string
  broadcastChannel?: 'whatsapp' | 'push' | 'sms'
  broadcastSegment?: 'all' | 'high_value' | 'at_risk' | 'new_users'

  // Targeting
  interests?: string[]
  locations?: string[]
  ageGroup?: string
}

// ─── Campaign Creation ───────────────────────────────────────────────────────

/**
 * Create ad campaign in rez-ads-service
 */
export async function createUnifiedAdCampaign(
  payload: UnifiedCampaignPayload
): Promise<{ campaignId: string; status: string } | null> {
  const adPayload: AdCampaignPayload = {
    merchantId: payload.merchantId,
    merchantName: payload.merchantName,
    adBazaarBookingId: payload.adBazaarBookingId,
    title: payload.adTitle,
    description: payload.adDescription,
    targetUrl: payload.adTargetUrl,
    budget: payload.adBudget,
    startDate: payload.adStartDate,
    endDate: payload.adEndDate,
    targeting: {
      interests: payload.interests,
      locations: payload.locations,
      ageGroup: payload.ageGroup,
    },
  }

  const result = await createAdCampaign(adPayload)

  if (result) {
    // Capture intent for campaign creation
    await captureIntent({
      userId: payload.merchantId,
      eventType: 'ad_campaign_created',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: {
        campaignId: result.campaignId,
        bookingId: payload.adBazaarBookingId,
        merchantId: payload.merchantId,
      },
    })
  }

  return result
}

// ─── Broadcast Creation ──────────────────────────────────────────────────────

/**
 * Create broadcast in rez-marketing-service
 */
export async function createUnifiedBroadcast(
  payload: UnifiedCampaignPayload
): Promise<{ broadcastId: string; estimatedReach: number } | null> {
  if (!payload.broadcastTitle || !payload.broadcastBody || !payload.broadcastChannel) {
    logger.warn('createUnifiedBroadcast: Missing broadcast fields')
    return null
  }

  const broadcastPayload: BroadcastTrigger = {
    adBazaarBookingId: payload.adBazaarBookingId,
    rezMerchantId: payload.merchantId,
    channel: payload.broadcastChannel,
    segment: payload.broadcastSegment || 'all',
    title: payload.broadcastTitle,
    body: payload.broadcastBody,
  }

  return triggerMarketingBroadcast(broadcastPayload)
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Get broadcast analytics from marketing service
 */
async function getBroadcastAnalytics(merchantId: string): Promise<{
  sent: number
  delivered: number
  opened: number
} | null> {
  try {
    const marketingServiceUrl = process.env.MARKETING_SERVICE_URL || 'http://localhost:4000'
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN || ''

    const response = await fetch(
      `${marketingServiceUrl}/api/analytics/broadcasts?merchantId=${merchantId}`,
      {
        headers: {
          'Authorization': `Bearer ${internalToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      logger.warn('[BroadcastAnalytics] Failed to fetch analytics', { status: response.status })
      return null
    }

    const data = await response.json() as {
      sent: number
      delivered: number
      opened: number
    }

    return data
  } catch (error) {
    logger.error('[BroadcastAnalytics] Error fetching analytics', { merchantId, error })
    return null
  }
}

/**
 * Get unified analytics from both services
 */
export async function getUnifiedAnalytics(
  merchantId: string
): Promise<{
  ads: {
    impressions: number
    clicks: number
    conversions: number
    ctr: number
    spend: number
  } | null
  broadcasts: {
    sent: number
    delivered: number
    opened: number
  } | null
}> {
  const [adsAnalytics, broadcastsAnalytics] = await Promise.all([
    getAdCampaignAnalytics(merchantId),
    // Fetch broadcast analytics from marketing service
    getBroadcastAnalytics(merchantId),
  ])

  return {
    ads: adsAnalytics,
    broadcasts: broadcastsAnalytics,
  }
}

// ─── Interaction Tracking ───────────────────────────────────────────────────

/**
 * Track user interaction with ad
 */
export async function trackUnifiedInteraction(
  bookingId: string,
  userId: string,
  type: 'impression' | 'click' | 'conversion',
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const result = await trackAdInteraction({
    adBazaarBookingId: bookingId,
    userId,
    type,
    metadata,
  })

  if (result) {
    // Also capture intent for the interaction
    await captureIntent({
      userId,
      eventType: type === 'impression' ? 'ad_impression'
        : type === 'click' ? 'ad_click'
        : 'ad_conversion',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: {
        bookingId,
        ...metadata,
      },
    })
  }

  return result
}

// ─── Health Check ────────────────────────────────────────────────────────────

export async function checkMarketingServicesHealth(): Promise<{
  adsService: boolean
  marketingService: boolean
  intentGraph: boolean
}> {
  const [adsHealth, marketingHealth, intentHealth] = await Promise.all([
    // Check ads service
    fetch(`${process.env.REZ_ADS_SERVICE_URL || 'http://localhost:4007'}/health`)
      .then(r => r.ok)
      .catch(() => false),
    // Check marketing service
    fetch(`${process.env.REZ_MARKETING_SERVICE_URL || 'http://localhost:4000'}/health`)
      .then(r => r.ok)
      .catch(() => false),
    // Check intent graph
    fetch(`${process.env.REZ_INTENT_CAPTURE_URL || 'http://localhost:4001'}/health`)
      .then(r => r.ok)
      .catch(() => false),
  ])

  return {
    adsService: adsHealth,
    marketingService: marketingHealth,
    intentGraph: intentHealth,
  }
}

// ─── Environment Variables Needed ───────────────────────────────────────────

/**
 * Required env vars for marketing integration:
 *
 * REZ_ADS_SERVICE_URL - rez-ads-service URL (e.g., https://rez-ads-service.onrender.com)
 * REZ_MARKETING_SERVICE_URL - rez-marketing-service URL
 * REZ_INTENT_CAPTURE_URL - rez-intent-graph URL
 * ADBAZAAR_INTERNAL_KEY - Internal API key for service-to-service auth
 */
