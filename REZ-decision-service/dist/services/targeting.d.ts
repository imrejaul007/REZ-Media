interface SegmentCriteria {
    type: string;
    priority: number;
}
export declare class TargetingEngine {
    /**
     * Evaluate user segments
     */
    evaluate(userId: string): Promise<SegmentCriteria[]>;
    private isHighValue;
    private isChurned;
    private isWindowShopper;
    private isDealSeeker;
    private isFoodie;
    private isBudgetMinder;
    private isNewUser;
    private isReorderProbabilityHigh;
    private isRecentlyPurchased;
    /**
     * Deterministic A/B variant assignment
     */
    assignVariant(userId: string, campaignId: string): 'A' | 'B';
    private simpleHash;
    /**
     * Frequency cap check
     */
    checkFrequencyCap(userId: string, campaignId: string, channel: string): Promise<boolean>;
    /**
     * Record impression
     */
    recordImpression(userId: string, campaignId: string, channel: string): Promise<void>;
}
export declare const targetingEngine: TargetingEngine;
export {};
