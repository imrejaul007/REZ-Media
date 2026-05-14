export interface CampaignMetrics {
    campaignId: string;
    name: string;
    channel: string;
    status: string;
    sentAt?: Date;
    audienceSize: number;
    sent: number;
    delivered: number;
    failed: number;
    deduped: number;
    opened: number;
    clicked: number;
    converted: number;
    deliveryRate: number;
    openRate: number;
    ctr: number;
    conversionRate: number;
}
export interface MerchantAnalyticsSummary {
    totalCampaigns: number;
    totalReach: number;
    avgDeliveryRate: number;
    avgOpenRate: number;
    topChannel: string;
    topSegment: string;
    campaigns: CampaignMetrics[];
}
export declare class CampaignAnalytics {
    getCampaignMetrics(campaignId: string): Promise<CampaignMetrics | null>;
    getMerchantSummary(merchantId: string, days?: number): Promise<MerchantAnalyticsSummary>;
    /**
     * Track a campaign open event (called via tracking pixel or deep link).
     */
    trackOpen(campaignId: string): Promise<void>;
    /**
     * Track a campaign click event.
     */
    trackClick(campaignId: string): Promise<void>;
    /**
     * Track a conversion (order placed within attribution window).
     * Called by rez-backend's order service after order is confirmed.
     */
    trackConversion(merchantId: string, userId: string): Promise<void>;
}
export declare const campaignAnalytics: CampaignAnalytics;
export default campaignAnalytics;
//# sourceMappingURL=CampaignAnalytics.d.ts.map