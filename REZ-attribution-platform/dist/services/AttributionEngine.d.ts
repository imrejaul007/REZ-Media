import { IConversion } from '../models/Conversion';
import { AttributionModel, IAttributionReport } from '../models/AttributionReport';
type TouchpointData = {
    id: string;
    userId: string;
    sessionId: string;
    type: string;
    channel: string;
    campaignId?: string;
    adId?: string;
    merchantId?: string;
    storeId?: string;
    location?: {
        latitude?: number;
        longitude?: number;
        address?: string;
    };
    timestamp: Date;
    [key: string]: unknown;
};
export interface AttributionConfig {
    model: AttributionModel;
    lookbackDays: number;
    attributionWindow: number;
}
export interface AttributionResult {
    touchpointId: string;
    touchpoint: TouchpointData;
    contribution: number;
    contributionPercentage: number;
    attributedChannel: string;
    attributedCampaignId?: string;
}
export interface ConversionAttribution {
    conversionId: string;
    userId: string;
    totalValue: number;
    attributionModel: AttributionModel;
    contributions: AttributionResult[];
    totalContribution: number;
}
export declare class AttributionEngine {
    private readonly defaultConfig;
    /**
     * Calculate attribution for a single conversion
     */
    calculateConversionAttribution(touchpoints: TouchpointData[], conversion: IConversion, config?: Partial<AttributionConfig>): ConversionAttribution;
    /**
     * Filter touchpoints within the attribution window
     */
    private filterTouchpointsByWindow;
    /**
     * Sort touchpoints by timestamp (oldest first for attribution)
     */
    private sortByTimestamp;
    /**
     * Apply the specified attribution model
     */
    private applyAttributionModel;
    /**
     * First-touch: 100% credit to first touchpoint
     */
    private applyFirstTouch;
    /**
     * Last-touch: 100% credit to last touchpoint
     */
    private applyLastTouch;
    /**
     * Linear: Equal credit to all touchpoints
     */
    private applyLinear;
    /**
     * Time-decay: More credit to recent touchpoints (half-life of 7 days)
     */
    private applyTimeDecay;
    /**
     * Position-based (U-shaped): 40% first, 40% last, 20% distributed among middle
     */
    private applyPositionBased;
    /**
     * Generate comprehensive attribution report
     */
    generateAttributionReport(touchpoints: TouchpointData[], conversions: IConversion[], config: Partial<AttributionConfig> & {
        reportType: IAttributionReport['reportType'];
        entityId?: string;
        entityType?: IAttributionReport['entityType'];
    }): Promise<IAttributionReport>;
    /**
     * Generate funnel data for visualization
     */
    private generateFunnelData;
    /**
     * Compare attribution across different models
     */
    compareAttributionModels(touchpoints: TouchpointData[], conversion: IConversion): Promise<Record<AttributionModel, ConversionAttribution>>;
}
export declare const attributionEngine: AttributionEngine;
export {};
//# sourceMappingURL=AttributionEngine.d.ts.map