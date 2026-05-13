/**
 * Push notification utility using OneSignal
 *
 * Required env vars:
 *   ONESIGNAL_APP_ID
 *   ONESIGNAL_API_KEY
 *
 * Note: In production, you would also need to store and manage
 * OneSignal external_user_ids for each user.
 */

import logger from './logger'

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY

export interface PushNotification {
  title: string
  body: string
  data?: Record<string, unknown>
  icon?: string
  url?: string
}

export interface PushResult {
  success: boolean
  id?: string
  recipients?: number
  error?: string
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  notification: PushNotification
): Promise<PushResult> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    logger.warn('[Push] OneSignal not configured, skipping push to user', { userId })
    return { success: false, error: 'Push provider not configured' }
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [userId],
        headings: { en: notification.title },
        contents: { en: notification.body },
        data: notification.data,
        small_icon: notification.icon || 'ic_notification_icon',
        url: notification.url,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      logger.error('[Push] OneSignal API error', { result })
      return {
        success: false,
        error: result.errors?.toString() || 'Unknown error from OneSignal',
      }
    }

    return {
      success: true,
      id: result.id,
      recipients: result.recipients,
    }
  } catch (err) {
    logger.error('[Push] Failed to send push', { error: String(err) })
    return { success: false, error: String(err) }
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendBulkPushNotification(
  userIds: string[],
  notification: PushNotification
): Promise<PushResult> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    logger.warn('[Push] OneSignal not configured, skipping push', { userCount: userIds.length })
    return { success: false, error: 'Push provider not configured' }
  }

  if (userIds.length === 0) {
    return { success: false, error: 'No users specified' }
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: userIds,
        headings: { en: notification.title },
        contents: { en: notification.body },
        data: notification.data,
        small_icon: notification.icon || 'ic_notification_icon',
        url: notification.url,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      logger.error('[Push] OneSignal bulk API error', { result })
      return {
        success: false,
        error: result.errors?.toString() || 'Unknown error from OneSignal',
      }
    }

    return {
      success: true,
      id: result.id,
      recipients: result.recipients,
    }
  } catch (err) {
    logger.error('[Push] Failed to send bulk push', { error: String(err) })
    return { success: false, error: String(err) }
  }
}

/**
 * Send notification types for common events
 */
export async function notifyBookingConfirmed(
  userId: string,
  listingTitle: string,
  bookingId: string
): Promise<PushResult> {
  return sendPushNotification(userId, {
    title: 'Booking Confirmed!',
    body: `Your booking for "${listingTitle}" has been confirmed.`,
    data: {
      type: 'booking_confirmed',
      bookingId,
    },
  })
}

export async function notifyPaymentReceived(
  userId: string,
  amount: number,
  bookingId: string
): Promise<PushResult> {
  return sendPushNotification(userId, {
    title: 'Payment Received',
    body: `Rs. ${amount.toLocaleString('en-IN')} has been credited to your account.`,
    data: {
      type: 'payment_received',
      bookingId,
    },
  })
}

export async function notifyNewInquiry(
  vendorId: string,
  buyerName: string,
  listingTitle: string
): Promise<PushResult> {
  return sendPushNotification(vendorId, {
    title: 'New Inquiry Received',
    body: `${buyerName} is interested in "${listingTitle}"`,
    data: {
      type: 'new_inquiry',
    },
  })
}

export async function notifyQuoteReceived(
  buyerId: string,
  vendorName: string,
  listingTitle: string
): Promise<PushResult> {
  return sendPushNotification(buyerId, {
    title: 'Quote Received',
    body: `${vendorName} sent you a quote for "${listingTitle}"`,
    data: {
      type: 'quote_received',
    },
  })
}
