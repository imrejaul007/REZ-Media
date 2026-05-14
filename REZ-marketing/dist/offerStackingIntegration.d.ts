import { Offer, OfferResult, StackingContext, offerStackingService, OfferStackingService } from './offerStackingService';
export interface OrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    modifiers?: {
        name: string;
        price: number;
    }[];
}
export interface Order {
    id: string;
    items: OrderItem[];
    subtotal: number;
    deliveryFee?: number;
    tax?: number;
    tip?: number;
}
export interface OrderTotalCalculation {
    subtotal: number;
    discountTotal: number;
    deliveryFee: number;
    tax: number;
    tip: number;
    total: number;
    appliedOffers: OfferResult[];
    freeDeliveryApplied: boolean;
}
export interface OrderTotalContext extends StackingContext {
    items: OrderItem[];
    deliveryFee?: number;
    taxRate?: number;
    restaurantId?: string;
    userId?: string;
}
/**
 * Calculate order total with offer stacking applied
 */
export declare function calculateOrderTotalWithOffers(order: Order, offers: Offer[], context?: Partial<OrderTotalContext>): Promise<OrderTotalCalculation>;
/**
 * Calculate maximum possible discount for given offers
 */
export declare function getMaximumDiscount(subtotal: number, offers: Offer[]): Promise<{
    maxDiscount: number;
    appliedOffers: OfferResult[];
}>;
/**
 * Validate if offers can be combined
 */
export declare function validateOfferCombination(offers: Offer[]): {
    valid: boolean;
    conflicts: {
        offer1: Offer;
        offer2: Offer;
        reason: string;
    }[];
};
export { offerStackingService };
declare const _default: {
    calculateOrderTotalWithOffers: typeof calculateOrderTotalWithOffers;
    getMaximumDiscount: typeof getMaximumDiscount;
    validateOfferCombination: typeof validateOfferCombination;
    offerStackingService: OfferStackingService;
};
export default _default;
//# sourceMappingURL=offerStackingIntegration.d.ts.map