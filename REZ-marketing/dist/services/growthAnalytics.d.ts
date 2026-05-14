import { IGrowthEvent, GrowthEventType, SourceService, IEventMetadata } from '../models/GrowthEvent';
/**
 * GrowthAnalytics — Unified analytics service for the Growth Stack.
 *
 * Provides cross-service event tracking and aggregation:
 *   - trackEvent(): Record any growth event from marketing, ads, or notification services
 *   - getCampaignMetrics(): Combined metrics from all services for a campaign
 *   - getConversionFunnel(): Track users from impression to conversion
 *   - getROAS(): Calculate Return on Ad Spend
 */
export interface TrackEventInput {
    eventType: GrowthEventType;
    sourceService: SourceService;
    userId?: string;
    merchantId: string;
    metadata?: IEventMetadata;
    value?: number;
    timestamp?: Date;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
}
export interface CampaignMetricsInput {
    campaignId: string;
    merchantId: string;
}
export interface FunnelInput {
    merchantId: string;
    startDate: Date;
    endDate: Date;
    groupBy?: 'day' | 'week' | 'month';
}
export interface ROASInput {
    merchantId: string;
    startDate: Date;
    endDate: Date;
    adSpend: number;
}
export interface EventCount {
    count: number;
    value: number;
}
export interface CampaignMetrics {
    campaignId: string;
    campaignName: string;
    created: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    conversionRate: number;
    totalValue: number;
    avgOrderValue: number;
    vouchersIssued: number;
    vouchersRedeemed: number;
    voucherConversionRate: number;
    notificationsSent: number;
    notificationOpenRate: number;
    revenueAttributed: number;
}
export interface ConversionFunnelStep {
    step: string;
    eventType: GrowthEventType;
    count: number;
    value: number;
    dropOffRate: number;
}
export interface ConversionFunnel {
    merchantId: string;
    startDate: Date;
    endDate: Date;
    totalUsers: number;
    steps: ConversionFunnelStep[];
    overallConversionRate: number;
}
export interface ROASResult {
    merchantId: string;
    startDate: Date;
    endDate: Date;
    adSpend: number;
    revenue: number;
    roas: number;
    cpa: number;
    conversions: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversionRate: number;
}
export interface MerchantGrowthDashboard {
    merchantId: string;
    period: {
        start: Date;
        end: Date;
    };
    summary: {
        totalEvents: number;
        totalRevenue: number;
        totalConversions: number;
        overallConversionRate: number;
    };
    bySource: Record<SourceService, {
        events: number;
        revenue: number;
        conversions: number;
    }>;
    byChannel: Record<string, {
        events: number;
        revenue: number;
        conversions: number;
    }>;
    topCampaigns: Array<{
        campaignId: string;
        campaignName: string;
        conversions: number;
        revenue: number;
        roas: number;
    }>;
    trends: {
        daily: Array<{
            date: string;
            events: number;
            revenue: number;
            conversions: number;
        }>;
    };
}
export declare class GrowthAnalytics {
    /**
     * trackEvent — Record any growth event.
     * Uses eventId for idempotency to prevent duplicate recording.
     */
    trackEvent(input: TrackEventInput): Promise<IGrowthEvent>;
    /**
     * getCampaignMetrics — Get combined metrics from all services for a campaign.
     */
    getCampaignMetrics(input: CampaignMetricsInput): Promise<CampaignMetrics | null>;
    /**
     * getConversionFunnel — Track users from first impression to conversion.
     */
    getConversionFunnel(input: FunnelInput): Promise<ConversionFunnel>;
    /**
     * getROAS — Calculate Return on Ad Spend.
     */
    getROAS(input: ROASInput): Promise<ROASResult>;
    /**
     * getMerchantDashboard — Full growth dashboard for a merchant.
     */
    getMerchantDashboard(merchantId: string, startDate: Date, endDate: Date): Promise<MerchantGrowthDashboard>;
    /**
     * Helper: Aggregate events by type.
     */
    private aggregateByEventType;
}
export declare const growthAnalytics: GrowthAnalytics;
export default growthAnalytics;
//# sourceMappingURL=growthAnalytics.d.ts.map