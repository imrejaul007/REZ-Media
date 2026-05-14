declare class AttributionService {
    private fetchWithTimeout;
    /**
     * Link an order to a campaign by finding the most recent click from the user
     * within the last 24 hours
     */
    attributeOrderToCampaign(orderId: string, userId: string, storeId: string): Promise<{
        success: boolean;
        campaignId?: string;
        message: string;
    }>;
    /**
     * Get ROI metrics for a campaign
     */
    getCampaignROI(campaignId: string): Promise<{
        impressions: number;
        clicks: number;
        conversions: number;
        totalSpent: number;
        revenueGenerated: number;
        roi: number;
        ctr: number;
        conversionRate: number;
    } | null>;
    /**
     * Get attribution report for all campaigns by merchant within date range
     */
    getAttributionReport(merchantId: string, startDate: Date, endDate: Date): Promise<Array<{
        campaignId: string;
        campaignTitle: string;
        impressions: number;
        clicks: number;
        conversions: number;
        totalSpent: number;
        revenueGenerated: number;
        roi: number;
        ctr: number;
        conversionRate: number;
    }>>;
}
export declare const attributionService: AttributionService;
export {};
//# sourceMappingURL=attributionService.d.ts.map