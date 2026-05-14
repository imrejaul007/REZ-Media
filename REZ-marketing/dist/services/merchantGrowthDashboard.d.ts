/**
 * MerchantGrowthDashboard — unified growth metrics for merchant dashboard.
 *
 * Provides:
 *   - Campaign overview with engagement metrics
 *   - Ad performance (impressions, clicks, CTR, conversions)
 *   - Notification statistics (sent, delivered, opened, clicked)
 *   - Voucher metrics (issued, redeemed, revenue impact)
 *   - Combined growth score (0-100)
 *
 * Growth Score Algorithm:
 *   - Campaign engagement: 30%
 *   - Ad performance: 30%
 *   - Notification open rate: 20%
 *   - Voucher redemption: 20%
 */
export interface CampaignOverview {
    totalCampaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
    totalReach: number;
    avgEngagementRate: number;
    campaigns: CampaignSummary[];
}
export interface CampaignSummary {
    campaignId: string;
    name: string;
    channel: string;
    status: string;
    sentAt?: Date;
    audienceSize: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    engagementRate: number;
}
export interface AdPerformance {
    totalAds: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    ctr: number;
    conversionRate: number;
    avgCpc: number;
    totalSpend: number;
    ads: AdMetrics[];
}
export interface AdMetrics {
    adId: string;
    name: string;
    channel: string;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
    spend: number;
}
export interface NotificationStats {
    totalNotifications: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    byChannel: ChannelNotificationStats[];
}
export interface ChannelNotificationStats {
    channel: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    deliveryRate: number;
    openRate: number;
}
export interface VoucherMetrics {
    totalVouchers: number;
    activeVouchers: number;
    issued: number;
    redeemed: number;
    redemptionRate: number;
    totalDiscountGiven: number;
    avgOrderValue: number;
    vouchers: VoucherSummary[];
}
export interface VoucherSummary {
    voucherId: string;
    code: string;
    type: string;
    status: string;
    value: number;
    issued: number;
    redeemed: number;
    redemptionRate: number;
    totalDiscountGiven: number;
}
export interface GrowthScore {
    overall: number;
    campaignEngagement: number;
    adPerformance: number;
    notificationOpenRate: number;
    voucherRedemption: number;
    breakdown: GrowthScoreBreakdown;
}
export interface GrowthScoreBreakdown {
    campaignEngagementScore: number;
    campaignEngagementWeight: number;
    adPerformanceScore: number;
    adPerformanceWeight: number;
    notificationOpenRateScore: number;
    notificationOpenRateWeight: number;
    voucherRedemptionScore: number;
    voucherRedemptionWeight: number;
}
export interface GrowthDashboard {
    merchantId: string;
    period: {
        start: Date;
        end: Date;
    };
    overview: {
        campaigns: CampaignOverview;
        ads: AdPerformance;
        notifications: NotificationStats;
        vouchers: VoucherMetrics;
    };
    growthScore: GrowthScore;
    generatedAt: Date;
}
export declare class MerchantGrowthDashboardService {
    /**
     * Get complete growth dashboard data for a merchant
     */
    getDashboard(merchantId: string, days?: number): Promise<GrowthDashboard>;
    /**
     * Get campaign overview with engagement metrics
     */
    getCampaignOverview(merchantId: string, start: Date, end: Date): Promise<CampaignOverview>;
    /**
     * Get ad performance metrics
     */
    getAdPerformance(merchantId: string, start: Date, end: Date): Promise<AdPerformance>;
    /**
     * Get notification statistics (sent, delivered, opened, clicked)
     */
    getNotificationStats(merchantId: string, start: Date, end: Date): Promise<NotificationStats>;
    /**
     * Get voucher metrics (issued, redeemed, revenue impact)
     */
    getVoucherMetrics(merchantId: string, start: Date, end: Date): Promise<VoucherMetrics>;
    /**
     * Calculate combined growth health score (0-100)
     *
     * Weights:
     *   - Campaign engagement: 30%
     *   - Ad performance: 30%
     *   - Notification open rate: 20%
     *   - Voucher redemption: 20%
     */
    getGrowthScore(merchantId: string, start: Date, end: Date): Promise<GrowthScore>;
    /**
     * Calculate campaign engagement score (0-100)
     * Based on: engagement rate, campaign frequency, reach
     */
    private calculateCampaignEngagementScore;
    /**
     * Calculate ad performance score (0-100)
     * Based on: CTR, conversion rate, total impressions
     */
    private calculateAdPerformanceScore;
    /**
     * Calculate notification open rate score (0-100)
     * Based on: delivery rate, open rate
     */
    private calculateNotificationOpenRateScore;
    /**
     * Calculate voucher redemption score (0-100)
     * Based on: redemption rate, active vouchers
     */
    private calculateVoucherRedemptionScore;
    private emptyCampaignOverview;
    private emptyAdPerformance;
    private emptyNotificationStats;
    private emptyVoucherMetrics;
}
export declare const merchantGrowthDashboard: MerchantGrowthDashboardService;
export default merchantGrowthDashboard;
//# sourceMappingURL=merchantGrowthDashboard.d.ts.map