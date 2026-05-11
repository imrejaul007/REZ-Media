// Offer Stacking Integration with Order Total Calculation

import {
  Offer,
  OfferResult,
  StackingContext,
  offerStackingService,
  OfferStackingService
} from './offerStackingService';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: { name: string; price: number }[];
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
export async function calculateOrderTotalWithOffers(
  order: Order,
  offers: Offer[],
  context?: Partial<OrderTotalContext>
): Promise<OrderTotalCalculation> {
  // Calculate subtotal from items
  const subtotal = order.items.reduce((sum, item) => {
    const itemPrice = item.price * item.quantity;
    const modifiersTotal = (item.modifiers || []).reduce(
      (modSum, mod) => modSum + mod.price,
      0
    );
    return sum + itemPrice + modifiersTotal;
  }, 0);

  // Build stacking context
  const stackingContext: StackingContext = {
    orderSubtotal: subtotal,
    userId: context?.userId,
    restaurantId: context?.restaurantId,
    timestamp: context?.timestamp || new Date(),
  };

  // Calculate stackable offers
  const appliedOffers = await offerStackingService.calculateStackableOffers(
    offers,
    stackingContext
  );

  // Calculate discount total (excluding free delivery as it's a fee waiver)
  const discountTotal = appliedOffers
    .filter(result => result.offer.type !== 'free_delivery')
    .reduce((sum, result) => sum + result.discount, 0);

  // Check if free delivery was applied
  const freeDeliveryApplied = appliedOffers.some(
    result => result.offer.type === 'free_delivery'
  );

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
export async function getMaximumDiscount(
  subtotal: number,
  offers: Offer[]
): Promise<{ maxDiscount: number; appliedOffers: OfferResult[] }> {
  const stackingContext: StackingContext = {
    orderSubtotal: subtotal,
  };

  const appliedOffers = await offerStackingService.calculateStackableOffers(
    offers,
    stackingContext
  );

  const maxDiscount = appliedOffers
    .filter(result => result.offer.type !== 'free_delivery')
    .reduce((sum, result) => sum + result.discount, 0);

  return { maxDiscount, appliedOffers };
}

/**
 * Validate if offers can be combined
 */
export function validateOfferCombination(offers: Offer[]): {
  valid: boolean;
  conflicts: { offer1: Offer; offer2: Offer; reason: string }[];
} {
  const conflicts: { offer1: Offer; offer2: Offer; reason: string }[] = [];

  for (let i = 0; i < offers.length; i++) {
    for (let j = i + 1; j < offers.length; j++) {
      if (!offerStackingService.canStack(offers[i], offers[j])) {
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

export { offerStackingService };
export default {
  calculateOrderTotalWithOffers,
  getMaximumDiscount,
  validateOfferCombination,
  offerStackingService,
};
