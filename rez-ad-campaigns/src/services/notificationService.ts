/**
 * Notification Service for REZ Ad Campaigns
 *
 * Routes all notification events through the centralized RABTUL Notification Service
 * via HTTP API instead of direct BullMQ queue operations.
 *
 * Event types:
 * - ad_approved: Merchant notified when their ad is approved
 * - ad_rejected: Merchant notified when their ad is rejected (includes reason)
 * - ad_spend_milestone: Merchant notified at spend milestones (25%, 50%, 75%, 90%)
 * - ad_budget_alert: Merchant alerted when daily/total budget thresholds exceeded
 * - ad_engagement_spike: Merchant notified of unusual engagement patterns
 * - ad_viewed_no_click: Re-engagement for users who viewed but didn't click
 * - ad_clicked_no_convert: Follow-up for users who clicked but didn't convert
 */

const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL ?? 'https://rez-notifications-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? '';
const HTTP_TIMEOUT_MS = 10_000;

const commonHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
  'X-Internal-Service': 'rez-ad-campaigns',
} as const;

export type NotificationChannel = 'push' | 'email' | 'sms' | 'whatsapp' | 'in_app';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
  priority?: string;
  emailSubject?: string;
  emailHtml?: string;
  [key: string]: any;
}

export interface NotificationEvent {
  eventId: string;
  eventType: string;
  userId: string;
  channels: NotificationChannel[];
  payload: NotificationPayload;
  category?: string;
  source?: string;
  scheduledFor?: string;
  createdAt: string;
}

// ── HTTP Client ────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notifications/send`, {
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

// ── Ad Status Notifications ────────────────────────────────────────────────────

/**
 * Notify merchant when their ad is approved
 */
export async function notifyAdApproved(
  merchantId: string,
  adId: string,
  adTitle: string,
  placement: string
): Promise<void> {
  try {
    const event: NotificationEvent = {
      eventId: `ad-approved-${adId}-${Date.now()}`,
      eventType: 'ad_approved',
      userId: merchantId,
      channels: ['push', 'email', 'in_app'],
      payload: {
        title: 'Your ad is live!',
        body: `Great news! Your ad "${adTitle}" has been approved and is now running on ${formatPlacement(placement)}.`,
        channelId: 'ads',
        priority: 'high',
        emailSubject: 'Your REZ Ad is Now Live!',
        data: {
          adId,
          adTitle,
          placement,
          status: 'active',
        },
      },
      category: 'ads',
      source: 'rez-ad-campaigns',
      createdAt: new Date().toISOString(),
    };

    await post('/api/v1/notifications/send', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      channels: event.channels,
      payload: event.payload,
      category: event.category,
      source: event.source,
      createdAt: event.createdAt,
    });

    console.info('[NotificationService] Ad approved notification sent', {
      merchantId,
      adId,
      eventType: 'ad_approved',
    });
  } catch (error) {
    console.error('[NotificationService] Failed to send ad approved notification', {
      merchantId,
      adId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Notify merchant when their ad is rejected
 */
export async function notifyAdRejected(
  merchantId: string,
  adId: string,
  adTitle: string,
  rejectionReason: string
): Promise<void> {
  try {
    const event: NotificationEvent = {
      eventId: `ad-rejected-${adId}-${Date.now()}`,
      eventType: 'ad_rejected',
      userId: merchantId,
      channels: ['push', 'email', 'in_app'],
      payload: {
        title: 'Your ad needs changes',
        body: `Your ad "${adTitle}" was not approved. Reason: ${rejectionReason}. Please make the necessary changes and resubmit.`,
        channelId: 'ads',
        priority: 'high',
        emailSubject: 'Action Required: Your REZ Ad Was Not Approved',
        data: {
          adId,
          adTitle,
          rejectionReason,
          status: 'rejected',
        },
      },
      category: 'ads',
      source: 'rez-ad-campaigns',
      createdAt: new Date().toISOString(),
    };

    await post('/api/v1/notifications/send', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      channels: event.channels,
      payload: event.payload,
      category: event.category,
      source: event.source,
      createdAt: event.createdAt,
    });

    console.info('[NotificationService] Ad rejected notification sent', {
      merchantId,
      adId,
      eventType: 'ad_rejected',
    });
  } catch (error) {
    console.error('[NotificationService] Failed to send ad rejected notification', {
      merchantId,
      adId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Spend & Budget Notifications ─────────────────────────────────────────────

/**
 * Notify merchant of spend milestones (25%, 50%, 75%, 90%, 100%)
 */
export async function notifySpendMilestone(
  merchantId: string,
  adId: string,
  adTitle: string,
  milestone: number,
  totalBudget: number,
  totalSpent: number
): Promise<void> {
  try {
    const event: NotificationEvent = {
      eventId: `spend-milestone-${adId}-${milestone}-${Date.now()}`,
      eventType: 'ad_spend_milestone',
      userId: merchantId,
      channels: ['push', 'in_app'],
      payload: {
        title: milestone === 100 ? 'Budget exhausted' : `Budget ${milestone}% spent`,
        body: milestone === 100
          ? `Your ad "${adTitle}" has reached its budget limit. Consider increasing your budget to continue running.`
          : `Your ad "${adTitle}" has used ${milestone}% of its budget (Rs ${totalSpent.toFixed(2)} of Rs ${totalBudget.toFixed(2)}).`,
        channelId: 'ads',
        priority: milestone >= 90 ? 'high' : 'default',
        data: {
          adId,
          adTitle,
          milestone,
          totalBudget,
          totalSpent,
          remaining: Math.max(0, totalBudget - totalSpent),
        },
      },
      category: 'ads',
      source: 'rez-ad-campaigns',
      createdAt: new Date().toISOString(),
    };

    await post('/api/v1/notifications/send', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      channels: event.channels,
      payload: event.payload,
      category: event.category,
      source: event.source,
      createdAt: event.createdAt,
    });

    console.info('[NotificationService] Spend milestone notification sent', {
      merchantId,
      adId,
      milestone,
      totalSpent,
      totalBudget,
    });
  } catch (error) {
    console.error('[NotificationService] Failed to send spend milestone notification', {
      merchantId,
      adId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Alert merchant when daily spend exceeds 80% of daily budget
 */
export async function notifyBudgetAlert(
  merchantId: string,
  adId: string,
  adTitle: string,
  dailyBudget: number,
  dailySpent: number,
  alertType: 'daily_80' | 'daily_90' | 'daily_100' | 'total_80' | 'total_90' | 'total_100'
): Promise<void> {
  try {
    const isUrgent = alertType.includes('90') || alertType.includes('100');

    let message: string;
    if (alertType.startsWith('daily')) {
      const pct = alertType.replace('daily_', '');
      message = pct === '100'
        ? `Your daily budget for "${adTitle}" is exhausted. The ad will pause until tomorrow.`
        : `You've used ${pct}% of your daily budget for "${adTitle}" (Rs ${dailySpent.toFixed(2)} of Rs ${dailyBudget.toFixed(2)}).`;
    } else {
      const pct = alertType.replace('total_', '');
      message = pct === '100'
        ? `Your total budget for "${adTitle}" is exhausted. The ad has been paused.`
        : `You've used ${pct}% of your total budget for "${adTitle}" (Rs ${dailySpent.toFixed(2)} of Rs ${dailyBudget.toFixed(2)}).`;
    }

    const event: NotificationEvent = {
      eventId: `budget-alert-${adId}-${alertType}-${Date.now()}`,
      eventType: 'ad_budget_alert',
      userId: merchantId,
      channels: ['push', 'email', 'in_app'],
      payload: {
        title: isUrgent ? 'Urgent: Budget Alert' : 'Budget Alert',
        body: message,
        channelId: 'ads',
        priority: isUrgent ? 'high' : 'default',
        emailSubject: isUrgent ? 'Urgent: REZ Ad Budget Alert' : 'REZ Ad Budget Alert',
        data: {
          adId,
          adTitle,
          dailyBudget,
          dailySpent,
          alertType,
        },
      },
      category: 'ads',
      source: 'rez-ad-campaigns',
      createdAt: new Date().toISOString(),
    };

    await post('/api/v1/notifications/send', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      channels: event.channels,
      payload: event.payload,
      category: event.category,
      source: event.source,
      createdAt: event.createdAt,
    });

    console.info('[NotificationService] Budget alert notification sent', {
      merchantId,
      adId,
      alertType,
      dailyBudget,
      dailySpent,
    });
  } catch (error) {
    console.error('[NotificationService] Failed to send budget alert notification', {
      merchantId,
      adId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Notify merchant of engagement spike (impressions or clicks significantly above normal)
 */
export async function notifyEngagementSpike(
  merchantId: string,
  adId: string,
  adTitle: string,
  spikeType: 'impression' | 'click',
  currentValue: number,
  averageValue: number,
  percentIncrease: number
): Promise<void> {
  try {
    const event: NotificationEvent = {
      eventId: `engagement-spike-${adId}-${spikeType}-${Date.now()}`,
      eventType: 'ad_engagement_spike',
      userId: merchantId,
      channels: ['push', 'in_app'],
      payload: {
        title: 'Your ad is getting attention!',
        body: `Your ad "${adTitle}" is seeing a ${percentIncrease.toFixed(0)}% increase in ${spikeType}s today. Current: ${currentValue}, Average: ${averageValue.toFixed(0)}.`,
        channelId: 'ads',
        priority: 'default',
        data: {
          adId,
          adTitle,
          spikeType,
          currentValue,
          averageValue,
          percentIncrease,
        },
      },
      category: 'ads',
      source: 'rez-ad-campaigns',
      createdAt: new Date().toISOString(),
    };

    await post('/api/v1/notifications/send', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      channels: event.channels,
      payload: event.payload,
      category: event.category,
      source: event.source,
      createdAt: event.createdAt,
    });

    console.info('[NotificationService] Engagement spike notification sent', {
      merchantId,
      adId,
      spikeType,
      percentIncrease,
    });
  } catch (error) {
    console.error('[NotificationService] Failed to send engagement spike notification', {
      merchantId,
      adId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Re-engagement Notifications ────────────────────────────────────────────────

/**
 * Re-target users who viewed an ad but didn't click (after 24h delay)
 */
export async function notifyAdViewedNoClick(
  userId: string,
  adId: string,
  adTitle: string,
  merchantName: string,
  ctaText: string,
  scheduledFor: Date
): Promise<void> {
  try {
    const event: NotificationEvent = {
      eventId: `viewed-no-click-${adId}-${userId}-${Date.now()}`,
      eventType: 'ad_viewed_no_click',
      userId,
      channels: ['push', 'in_app'],
      payload: {
        title: 'See it again?',
        body: `You viewed ${merchantName}'s ad "${adTitle}" yesterday. ${ctaText} to learn more!`,
        channelId: 'ads',
        priority: 'default',
        data: {
          adId,
          adTitle,
          merchantName,
          ctaText,
          interactionType: 'retarget_view',
        },
      },
      category: 'ads',
      source: 'rez-ad-campaigns',
      scheduledFor: scheduledFor.toISOString(),
      createdAt: new Date().toISOString(),
    };

    await post('/api/v1/notifications/send', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      channels: event.channels,
      payload: event.payload,
      category: event.category,
      source: event.source,
      scheduledFor: event.scheduledFor,
      createdAt: event.createdAt,
    });

    console.info('[NotificationService] Re-target view notification scheduled', {
      userId,
      adId,
      scheduledFor: scheduledFor.toISOString(),
    });
  } catch (error) {
    console.error('[NotificationService] Failed to schedule re-target view notification', {
      userId,
      adId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Follow-up with users who clicked but didn't convert (after 48h delay)
 */
export async function notifyClickedNoConvert(
  userId: string,
  adId: string,
  adTitle: string,
  merchantName: string,
  ctaText: string,
  scheduledFor: Date
): Promise<void> {
  try {
    const event: NotificationEvent = {
      eventId: `clicked-no-convert-${adId}-${userId}-${Date.now()}`,
      eventType: 'ad_clicked_no_convert',
      userId,
      channels: ['push', 'in_app'],
      payload: {
        title: 'Still interested?',
        body: `You clicked on ${merchantName}'s ad "${adTitle}" recently. ${ctaText} - special offer waiting for you!`,
        channelId: 'ads',
        priority: 'default',
        data: {
          adId,
          adTitle,
          merchantName,
          ctaText,
          interactionType: 'follow_up_click',
        },
      },
      category: 'ads',
      source: 'rez-ad-campaigns',
      scheduledFor: scheduledFor.toISOString(),
      createdAt: new Date().toISOString(),
    };

    await post('/api/v1/notifications/send', {
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      channels: event.channels,
      payload: event.payload,
      category: event.category,
      source: event.source,
      scheduledFor: event.scheduledFor,
      createdAt: event.createdAt,
    });

    console.info('[NotificationService] Follow-up click notification scheduled', {
      userId,
      adId,
      scheduledFor: scheduledFor.toISOString(),
    });
  } catch (error) {
    console.error('[NotificationService] Failed to schedule follow-up click notification', {
      userId,
      adId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPlacement(placement: string): string {
  const placementNames: Record<string, string> = {
    home_banner: 'the Home Banner',
    explore_feed: 'Explore Feed',
    store_listing: 'Store Listings',
    search_result: 'Search Results',
  };
  return placementNames[placement] || placement;
}

// ── Redis-based Milestone Tracking ───────────────────────────────────────────

const MILESTONES = [25, 50, 75, 90, 100];
const milestoneKeyPrefix = 'ad:milestone:';

// Redis client for milestone tracking (simple in-memory fallback)
const redisCache = new Map<string, string>();

async function redisGet(key: string): Promise<string | null> {
  return redisCache.get(key) ?? null;
}

async function redisSet(key: string, value: string): Promise<void> {
  redisCache.set(key, value);
}

/**
 * Check and trigger spend milestones. Call this after each impression/click that updates spend.
 * Uses Redis to track which milestones have been notified per ad.
 */
export async function checkSpendMilestones(
  merchantId: string,
  adId: string,
  adTitle: string,
  totalBudget: number,
  totalSpent: number
): Promise<void> {
  for (const milestone of MILESTONES) {
    const threshold = (totalBudget * milestone) / 100;
    const key = `${milestoneKeyPrefix}${adId}:${milestone}`;

    // Check if we've already notified for this milestone
    const notified = await redisGet(key);
    if (notified) continue;

    // Check if we've crossed this milestone threshold
    if (totalSpent >= threshold) {
      await redisSet(key, '1');
      await notifySpendMilestone(merchantId, adId, adTitle, milestone, totalBudget, totalSpent);
    }
  }
}

/**
 * Check and trigger budget alerts. Call this periodically or after spend updates.
 * Alerts at 80% and 90% thresholds for both daily and total budgets.
 */
export async function checkBudgetAlerts(
  merchantId: string,
  adId: string,
  adTitle: string,
  dailyBudget: number,
  totalBudget: number,
  dailySpent: number,
  totalSpent: number
): Promise<void> {
  // Daily budget alerts
  if (dailyBudget > 0) {
    const dailyPct = (dailySpent / dailyBudget) * 100;
    if (dailyPct >= 100) {
      await redisSet('daily100:' + adId, '1');
      await notifyBudgetAlert(merchantId, adId, adTitle, dailyBudget, dailySpent, 'daily_100');
    } else if (dailyPct >= 90) {
      await redisSet('daily90:' + adId, '1');
      await notifyBudgetAlert(merchantId, adId, adTitle, dailyBudget, dailySpent, 'daily_90');
    } else if (dailyPct >= 80) {
      await redisSet('daily80:' + adId, '1');
      await notifyBudgetAlert(merchantId, adId, adTitle, dailyBudget, dailySpent, 'daily_80');
    }
  }

  // Total budget alerts
  if (totalBudget > 0) {
    const totalPct = (totalSpent / totalBudget) * 100;
    if (totalPct >= 100) {
      await redisSet('total100:' + adId, '1');
      await notifyBudgetAlert(merchantId, adId, adTitle, totalBudget, totalSpent, 'total_100');
    } else if (totalPct >= 90) {
      await redisSet('total90:' + adId, '1');
      await notifyBudgetAlert(merchantId, adId, adTitle, totalBudget, totalSpent, 'total_90');
    } else if (totalPct >= 80) {
      await redisSet('total80:' + adId, '1');
      await notifyBudgetAlert(merchantId, adId, adTitle, totalBudget, totalSpent, 'total_80');
    }
  }
}
