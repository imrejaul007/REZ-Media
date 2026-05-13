import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { timingSafeEqual } from 'crypto'
import logger from '@/lib/logger'
import { checkAllCampaignBudgetAlerts, BudgetAlert } from '@/lib/budgetAlerts'
import { insertNotification } from '@/lib/notifications'
import { sendPushNotification } from '@/lib/pushNotifications'

// GET /api/cron/budget-alerts
// Called by Vercel Cron (every 6 hours). Checks all active campaigns
// for budget threshold breaches and sends notifications.
//
// Vercel cron config (vercel.json):
//   { "crons": [{ "path": "/api/cron/budget-alerts", "schedule": "0 */6 * * *" }] }
//
// Protected by CRON_SECRET env var.

export async function GET(req: NextRequest) {
  // Validate cron secret via Authorization header
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const actual = Buffer.from(authHeader)
  if (!timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    // Check all campaigns for budget alerts
    const alerts = await checkAllCampaignBudgetAlerts()

    let notificationsSent = 0
    let pushSent = 0

    for (const alert of alerts) {
      // Create in-app notification
      const notificationTitle = getAlertTitle(alert)
      const notificationBody = getAlertBody(alert)

      await insertNotification({
        user_id: alert.buyerId,
        type: 'budget_alert',
        title: notificationTitle,
        body: notificationBody,
        link: `/buyer/campaigns/${alert.campaignId}`,
      })
      notificationsSent++

      // Also try to send push notification (if user has push subscription)
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', alert.buyerId)
        .single()

      if (user) {
        const pushResult = await sendPushNotification(alert.buyerId, {
          title: notificationTitle,
          body: notificationBody,
          data: {
            type: 'budget_alert',
            campaignId: alert.campaignId,
            threshold: alert.threshold,
          },
        })

        if (pushResult.success) {
          pushSent++
        }
      }
    }

    logger.info(
      `[cron/budget-alerts] campaigns_checked=${alerts.length} ` +
      `notifications_sent=${notificationsSent} push_sent=${pushSent}`
    )

    return NextResponse.json({
      success: true,
      alertsTriggered: alerts.length,
      notificationsSent,
      pushSent,
    })
  } catch (e) {
    logger.error('[cron/budget-alerts] error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getAlertTitle(alert: BudgetAlert): string {
  switch (alert.threshold) {
    case 75:
      return 'Budget Alert: 75% Reached'
    case 90:
      return 'Budget Alert: 90% Reached'
    case 100:
      return 'Budget Alert: Budget Exhausted!'
    default:
      return `Budget Alert: ${alert.threshold}% Reached`
  }
}

function getAlertBody(alert: BudgetAlert): string {
  const spentFormatted = alert.spent.toLocaleString('en-IN')
  const budgetFormatted = alert.budget.toLocaleString('en-IN')

  switch (alert.threshold) {
    case 75:
      return `Your campaign "${alert.campaignName}" has reached 75% of its budget (Rs. ${spentFormatted} of Rs. ${budgetFormatted}). Consider adding more budget.`
    case 90:
      return `Your campaign "${alert.campaignName}" has reached 90% of its budget (Rs. ${spentFormatted} of Rs. ${budgetFormatted}). Add budget to continue running.`
    case 100:
      return `Your campaign "${alert.campaignName}" has exhausted its budget (Rs. ${spentFormatted}). Add more budget to continue running.`
    default:
      return `Your campaign "${alert.campaignName}" has reached ${alert.threshold}% of its budget.`
  }
}
