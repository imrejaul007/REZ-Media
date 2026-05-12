import { Channel } from '../models/Touchpoint';
import { AttributionModel, IAttributionReport } from '../models/AttributionReport';
type LeanAttributionReport = Omit<IAttributionReport, 'save' | 'delete' | 'validate'>;
export interface ReportFilters {
    merchantId?: string;
    campaignId?: string;
    startDate?: Date;
    endDate?: Date;
    attributionModel?: AttributionModel;
    lookbackDays?: number;
}
export interface AttributionReportResponse {
    reportId: string;
    summary: {
        totalTouchpoints: number;
        totalConversions: number;
        totalValue: number;
        conversionRate: number;
    };
    channelAttribution: Array<{
        channel: string;
        touchpoints: number;
        conversions: number;
        value: number;
        percentage: number;
    }>;
    campaignAttribution: Array<{
        campaignId: string;
        touchpoints: number;
        conversions: number;
        value: number;
        percentage: number;
        channels: Array<{
            channel: string;
            touchpoints: number;
            value: number;
        }>;
    }>;
    model: string;
    dateRange: {
        start: Date;
        end: Date;
    };
}
export interface FunnelStage {
    stage: string;
    count: number;
    dropoffRate: number;
    dropoffCount: number;
}
export interface FunnelReportResponse {
    funnelStages: FunnelStage[];
    totalUsers: number;
    conversionRate: number;
    dateRange: {
        start: Date;
        end: Date;
    };
}
export interface CampaignAttributionResponse {
    campaignId: string;
    metrics: {
        totalTouchpoints: number;
        uniqueUsers: number;
        conversions: number;
        conversionRate: number;
        totalValue: number;
        averageOrderValue: number;
    };
    channelBreakdown: Array<{
        channel: Channel;
        touchpoints: number;
        conversions: number;
        value: number;
        contribution: number;
    }>;
    touchpointTypeBreakdown: Array<{
        type: string;
        count: number;
    }>;
    topConvertingChannels: Array<{
        channel: string;
        conversions: number;
        value: number;
    }>;
}
export declare class ReportGenerator {
    /**
     * Generate attribution report
     */
    generateAttributionReport(filters: ReportFilters): Promise<AttributionReportResponse>;
    /**
     * Format attribution report for API response
     */
    private formatAttributionReport;
    /**
     * Generate funnel report
     */
    generateFunnelReport(filters: Omit<ReportFilters, 'attributionModel' | 'lookbackDays'>): Promise<FunnelReportResponse>;
    /**
     * Generate campaign attribution report
     */
    generateCampaignAttribution(campaignId: string, filters?: {
        startDate?: Date;
        endDate?: Date;
        attributionModel?: AttributionModel;
    }): Promise<CampaignAttributionResponse>;
    /**
     * Get attributed touchpoint based on model
     */
    private getAttributedTouchpoint;
    /**
     * Get historical reports
     */
    getHistoricalReports(filters?: {
        reportType?: IAttributionReport['reportType'];
        entityId?: string;
        limit?: number;
    }): Promise<LeanAttributionReport[]>;
    /**
     * Get report by ID
     */
    getReport(reportId: string): Promise<LeanAttributionReport | null>;
    /**
     * Generate real-time dashboard metrics
     */
    getDashboardMetrics(merchantId: string): Promise<{
        today: {
            touchpoints: number;
            conversions: number;
            value: number;
        };
        last7Days: {
            touchpoints: number;
            conversions: number;
            value: number;
        };
        last30Days: {
            touchpoints: number;
            conversions: number;
            value: number;
        };
        trends: {
            touchpointTrend: number;
            conversionTrend: number;
            valueTrend: number;
        };
    }>;
}
export declare const reportGenerator: ReportGenerator;
export {};
//# sourceMappingURL=ReportGenerator.d.ts.map