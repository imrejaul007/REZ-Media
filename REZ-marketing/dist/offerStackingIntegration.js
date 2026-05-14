"use strict";
// Offer Stacking Integration with Order Total Calculation
Object.defineProperty(exports, "__esModule", { value: true });
exports.offerStackingService = void 0;
exports.calculateOrderTotalWithOffers = calculateOrderTotalWithOffers;
exports.getMaximumDiscount = getMaximumDiscount;
exports.validateOfferCombination = validateOfferCombination;
const offerStackingService_1 = require("./offerStackingService");
Object.defineProperty(exports, "offerStackingService", { enumerable: true, get: function () { return offerStackingService_1.offerStackingService; } });
/**
 * Calculate order total with offer stacking applied
 */
async function calculateOrderTotalWithOffers(order, offers, context) {
    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => {
        const itemPrice = item.price * item.quantity;
        const modifiersTotal = (item.modifiers || []).reduce((modSum, mod) => modSum + mod.price, 0);
        return sum + itemPrice + modifiersTotal;
    }, 0);
    // Build stacking context
    const stackingContext = {
        orderSubtotal: subtotal,
        userId: context?.userId,
        restaurantId: context?.restaurantId,
        timestamp: context?.timestamp || new Date(),
    };
    // Calculate stackable offers
    const appliedOffers = await offerStackingService_1.offerStackingService.calculateStackableOffers(offers, stackingContext);
    // Calculate discount total (excluding free delivery as it's a fee waiver)
    const discountTotal = appliedOffers
        .filter(result => result.offer.type !== 'free_delivery')
        .reduce((sum, result) => sum + result.discount, 0);
    // Check if free delivery was applied
    const freeDeliveryApplied = appliedOffers.some(result => result.offer.type === 'free_delivery');
    // Calculate final totals
    const deliveryFee = freeDeliveryApplied ? 0 : (order.deliveryFee || 0);
    const taxableAmount = Math.max(0, subtotal - discountTotal);
    const taxRate = context?.taxRate || 0;
    const tax = taxableAmount * taxRate;
    const tip = order.tip || 0;
    const total = taxableAmount + deliveryFee + tax + tip;
    return {
        subtotal,
        discountTotal,
        deliveryFee,
        tax,
        tip,
        total: Math.max(0, total),
        appliedOffers,
        freeDeliveryApplied,
    };
}
/**
 * Calculate maximum possible discount for given offers
 */
async function getMaximumDiscount(subtotal, offers) {
    const stackingContext = {
        orderSubtotal: subtotal,
    };
    const appliedOffers = await offerStackingService_1.offerStackingService.calculateStackableOffers(offers, stackingContext);
    const maxDiscount = appliedOffers
        .filter(result => result.offer.type !== 'free_delivery')
        .reduce((sum, result) => sum + result.discount, 0);
    return { maxDiscount, appliedOffers };
}
/**
 * Validate if offers can be combined
 */
function validateOfferCombination(offers) {
    const conflicts = [];
    for (let i = 0; i < offers.length; i++) {
        for (let j = i + 1; j < offers.length; j++) {
            if (!offerStackingService_1.offerStackingService.canStack(offers[i], offers[j])) {
                conflicts.push({
                    offer1: offers[i],
                    offer2: offers[j],
                    reason: `Cannot stack ${offers[i].type} with ${offers[j].type}`,
                });
            }
        }
    }
    return {
        valid: conflicts.length === 0,
        conflicts,
    };
}
exports.default = {
    calculateOrderTotalWithOffers,
    getMaximumDiscount,
    validateOfferCombination,
    offerStackingService: offerStackingService_1.offerStackingService,
};
//# sourceMappingURL=offerStackingIntegration.js.map