// Offer Stacking Rules Engine

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
  stackableWith: string[];  // Types it can stack with
  nonStackableWith: string[]; // Types it cannot stack with
  priority: number; // Higher = applied first
  maxDiscount?: number;
}

export interface StackingContext {
  orderSubtotal: number;
  userId?: string;
  restaurantId?: string;
  timestamp?: Date;
}

export class OfferStackingService {

  private rules: StackingRule[] = [
    // Cashback can stack with everything
    {
      id: 'cashback',
      offerType: 'cashback',
      stackableWith: ['discount', 'bogo', 'free_delivery', 'percentage'],
      nonStackableWith: [],
      priority: 1
    },

    // Percentage discount stacks with free delivery and cashback only
    {
      id: 'percentage',
      offerType: 'percentage',
      stackableWith: ['free_delivery', 'cashback'],
      nonStackableWith: ['percentage', 'bogo'],
      priority: 2
    },

    // BOGO doesn't stack with percentage or another BOGO
    {
      id: 'bogo',
      offerType: 'bogo',
      stackableWith: ['free_delivery', 'cashback'],
      nonStackableWith: ['percentage', 'bogo'],
      priority: 3
    },

    // Free delivery stacks with everything except itself
    {
      id: 'free_delivery',
      offerType: 'free_delivery',
      stackableWith: ['cashback', 'percentage', 'bogo'],
      nonStackableWith: ['free_delivery'],
      priority: 4
    },
  ];

  /**
   * Calculate which offers can be stacked together based on stacking rules
   */
  async calculateStackableOffers(
    offers: Offer[],
    context?: StackingContext
  ): Promise<OfferResult[]> {
    if (offers.length === 0) {
      return [];
    }

    // Sort by priority (highest first)
    const sorted = [...offers].sort((a, b) =>
      this.getPriority(b.type) - this.getPriority(a.type)
    );

    const appliedOffers: Offer[] = [];
    let totalDiscount = 0;

    for (const offer of sorted) {
      const rule = this.getRule(offer.type);

      // Check if stackable with already applied offers
      const canStack = this.checkStackability(offer, appliedOffers, rule);

      if (canStack) {
        const discount = this.calculateDiscount(offer, context);
        const maxDiscount = rule.maxDiscount;

        // Apply max discount cap if configured
        const finalDiscount = maxDiscount
          ? Math.min(discount, maxDiscount)
          : discount;

        appliedOffers.push(offer);
        totalDiscount += finalDiscount;
      }
    }

    return appliedOffers.map(offer => ({
      offer,
      discount: this.calculateDiscount(offer, context),
      stackable: true,
    }));
  }

  /**
   * Check if an offer can stack with already applied offers
   */
  private checkStackability(
    offer: Offer,
    appliedOffers: Offer[],
    rule: StackingRule
  ): boolean {
    // Check all previously applied offers
    for (const applied of appliedOffers) {
      // If current offer has this applied type in nonStackableWith, cannot stack
      if (rule.nonStackableWith.includes(applied.type)) {
        return false;
      }

      // Check reverse: if applied offer has current in its nonStackableWith
      const appliedRule = this.getRule(applied.type);
      if (appliedRule.nonStackableWith.includes(offer.type)) {
        return false;
      }
    }

    // Check if current offer can stack with all applied offers
    return appliedOffers.every(applied =>
      rule.stackableWith.includes(applied.type)
    );
  }

  /**
   * Get stacking rule for an offer type
   */
  private getRule(type: string): StackingRule {
    const found = this.rules.find(r => r.offerType === type);
    if (found) return found;
    return {
      id: `default-${type}`,
      offerType: type,
      stackableWith: [],
      nonStackableWith: [],
      priority: 0
    };
  }

  /**
   * Get priority for an offer type
   */
  private getPriority(type: string): number {
    return this.getRule(type).priority;
  }

  /**
   * Calculate discount amount for an offer
   */
  private calculateDiscount(offer: Offer, context?: StackingContext): number {
    switch (offer.type) {
      case 'percentage':
        // Percentage of order subtotal
        return context?.orderSubtotal
          ? (offer.value / 100) * context.orderSubtotal
          : 0;

      case 'cashback':
        // Cashback is usually a fixed amount or percentage returned
        return offer.value;

      case 'bogo':
        // BOGO - assume value is the discount per item or percentage
        return offer.value;

      case 'free_delivery':
        // Free delivery - value could be the delivery fee amount
        return offer.value;

      default:
        return offer.value;
    }
  }

  /**
   * Add a custom stacking rule
   */
  addRule(rule: StackingRule): void {
    const existing = this.rules.findIndex(r => r.id === rule.id);
    if (existing >= 0) {
      this.rules[existing] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Remove a stacking rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all current stacking rules
   */
  getRules(): StackingRule[] {
    return [...this.rules];
  }

  /**
   * Check if two specific offers can stack together
   */
  canStack(offer1: Offer, offer2: Offer): boolean {
    const rule1 = this.getRule(offer1.type);
    const rule2 = this.getRule(offer2.type);

    return (
      rule1.stackableWith.includes(offer2.type) &&
      !rule1.nonStackableWith.includes(offer2.type) &&
      rule2.stackableWith.includes(offer1.type) &&
      !rule2.nonStackableWith.includes(offer1.type)
    );
  }
}

// Singleton instance for easy access
export const offerStackingService = new OfferStackingService();

export default OfferStackingService;
