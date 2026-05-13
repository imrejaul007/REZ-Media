/**
 * Shared notification helper — AB-D1 FIX
 *
 * Wraps supabase.from('notifications').insert() in a try/catch.
 * On failure, inserts the notification payload into `notification_retry_queue`
 * for a background job to retry later. This prevents silent drops when the
 * notifications table is temporarily unavailable.
 *
 * Also sends push notifications when available.
 */
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'
import { sendPushNotification } from '@/lib/pushNotifications'

export interface NotificationPayload {
  user_id: string
  type: string
  title: string
  body: string
  link?: string | null
}

export async function insertNotification(payload: NotificationPayload): Promise<void> {
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('notifications').insert(payload)
    if (error) throw error

    // Also send push notification if configured
    await sendPushNotification(payload.user_id, {
      title: payload.title,
      body: payload.body,
      data: {
        type: payload.type,
        link: payload.link,
      },
    })
  } catch (err) {
    logger.error('[notifications] insert failed, queueing for retry', err)
    try {
      const supabase = createServerClient()
      const nextRetry = new Date(Date.now() + 60_000).toISOString()
      await supabase.from('notification_retry_queue').insert({
        user_id: payload.user_id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        link: payload.link ?? null,
        attempts: 0,
        last_attempt: new Date().toISOString(),
        next_retry: nextRetry,
        status: 'pending',
        error_message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      })
    } catch (queueErr) {
      logger.error('[notifications] retry queue insert also failed', queueErr)
    }
  }
}
