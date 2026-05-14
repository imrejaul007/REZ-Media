export interface Offer {
    id: string;
    type: 'cashback' | 'percentage' | 'bogo' | 'free_delivery';
    value: number;
    code?: string;
    description?: string;
}
export interface OfferResult {
    offer: Offer;
    discount: number;
    stackable: boolean;
}
export interface StackingRule {
    id: string;
    offerType: string;
    stackableWith: string[];
    nonStackableWith: string[];
    priority: number;
    maxDiscount?: number;
}
export interface StackingContext {
    orderSubtotal: number;
    userId?: string;
    restaurantId?: string;
    timestamp?: Date;
}
export declare class OfferStackingService {
    private rules;
    /**
     * Calculate which offers can be stacked together based on stacking rules
     */
    calculateStackableOffers(offers: Offer[], context?: StackingContext): Promise<OfferResult[]>;
    /**
     * Check if an offer can stack with already applied offers
     */
    private checkStackability;
    /**
     * Get stacking rule for an offer type
     */
    private getRule;
    /**
     * Get priority for an offer type
     */
    private getPriority;
    /**
     * Calculate discount amount for an offer
     */
    private calculateDiscount;
    /**
     * Add a custom stacking rule
     */
    addRule(rule: StackingRule): void;
    /**
     * Remove a stacking rule by ID
     */
    removeRule(ruleId: string): boolean;
    /**
     * Get all current stacking rules
     */
    getRules(): StackingRule[];
    /**
     * Check if two specific offers can stack together
     */
    canStack(offer1: Offer, offer2: Offer): boolean;
}
export declare const offerStackingService: OfferStackingService;
export default OfferStackingService;
//# sourceMappingURL=offerStackingService.d.ts.map