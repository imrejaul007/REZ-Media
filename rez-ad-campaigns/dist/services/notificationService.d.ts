/**
 * Notification Service for REZ Ads Service
 *
 * Publishes notification events to the shared BullMQ queue (notification-events)
 * consumed by the rez-notification-events service.
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
export type NotificationChannel = 'push' | 'email' | 'sms' | 'whatsapp' | 'in_app';
export interface NotificationEvent {
    eventId: string;
    eventType: string;
    userId: string;
    channels: NotificationChannel[];
    payload: {
        title: string;
        body: string;
        data?: Record<string, any>;
        channelId?: string;
        priority?: string;
        emailSubject?: string;
        emailHtml?: string;
        [key: string]: any;
    };
    category?: string;
    source?: string;
    createdAt: string;
}
/**
 * Notify merchant when their ad is approved
 */
export declare function notifyAdApproved(merchantId: string, adId: string, adTitle: string, placement: string): Promise<void>;
/**
 * Notify merchant when their ad is rejected
 */
export declare function notifyAdRejected(merchantId: string, adId: string, adTitle: string, rejectionReason: string): Promise<void>;
/**
 * Notify merchant of spend milestones (25%, 50%, 75%, 90%, 100%)
 */
export declare function notifySpendMilestone(merchantId: string, adId: string, adTitle: string, milestone: number, totalBudget: number, totalSpent: number): Promise<void>;
/**
 * Alert merchant when daily spend exceeds 80% of daily budget
 */
export declare function notifyBudgetAlert(merchantId: string, adId: string, adTitle: string, dailyBudget: number, dailySpent: number, alertType: 'daily_80' | 'daily_90' | 'daily_100' | 'total_80' | 'total_90' | 'total_100'): Promise<void>;
/**
 * Notify merchant of engagement spike (impressions or clicks significantly above normal)
 */
export declare function notifyEngagementSpike(merchantId: string, adId: string, adTitle: string, spikeType: 'impression' | 'click', currentValue: number, averageValue: number, percentIncrease: number): Promise<void>;
/**
 * Re-target users who viewed an ad but didn't click (after 24h delay)
 */
export declare function notifyAdViewedNoClick(userId: string, adId: string, adTitle: string, merchantName: string, ctaText: string, scheduledFor: Date): Promise<void>;
/**
 * Follow-up with users who clicked but didn't convert (after 48h delay)
 */
export declare function notifyClickedNoConvert(userId: string, adId: string, adTitle: string, merchantName: string, ctaText: string, scheduledFor: Date): Promise<void>;
/**
 * Check and trigger spend milestones. Call this after each impression/click that updates spend.
 * Uses Redis to track which milestones have been notified per ad.
 */
export declare function checkSpendMilestones(merchantId: string, adId: string, adTitle: string, totalBudget: number, totalSpent: number): Promise<void>;
/**
 * Check and trigger budget alerts. Call this periodically or after spend updates.
 * Alerts at 80% and 90% thresholds for both daily and total budgets.
 */
export declare function checkBudgetAlerts(merchantId: string, adId: string, adTitle: string, dailyBudget: number, totalBudget: number, dailySpent: number, totalSpent: number): Promise<void>;
//# sourceMappingURL=notificationService.d.ts.map