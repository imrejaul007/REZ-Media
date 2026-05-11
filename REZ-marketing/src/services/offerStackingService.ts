import { IVoucher, VoucherType } from '../models/Voucher';
import { VoucherRedemption } from '../models/VoucherRedemption';
import { logger } from '../config/logger';

/**
 * Offer stacking rules and priority configuration
 */
interface StackingRule {
  /** Higher priority = applied first */
  priority: number;
  /** Voucher types this rule applies to */
  types: VoucherType[];
  /** Whether these types can stack with each other */
  canStackTogether: boolean;
  /** Conflict types that prevent this rule from being applied */
  conflictsWith?: VoucherType[];
}

interface CalculateStackingInput {
  voucher: IVoucher;
  cartAmount: number;
  userId: string;
  /** Optional: existing vouchers already applied to cart */
  existingVouchers?: IVoucher[];
}

interface StackingResult {
  canApply: boolean;
  reason?: string;
  finalDiscount: number;
  appliedDiscounts: AppliedDiscount[];
}

interface AppliedDiscount {
  voucherCode: string;
  voucherType: VoucherType;
  discount: number;
  priority: number;
}

/**
 * OfferStackingService — handles offer stacking logic and priority-based application.
 *
 * Features:
 * - Priority-based discount application
 * - Type-specific stacking rules (percentage, fixed, BOGO, free_delivery)
 * - Conflict detection between incompatible offers
 * - Free delivery stacking restriction (only one delivery discount)
 */
export class OfferStackingService {
  /**
   * Stacking rules configuration
   * Priority: fixed(1) > percentage(2) > bogo(3) > free_delivery(4)
   */
  private readonly stackingRules: StackingRule[] = [
    {
      priority: 1,
      types: ['fixed'],
      canStackTogether: false,
      conflictsWith: ['fixed', 'percentage', 'bogo'],
    },
    {
      priority: 2,
      types: ['percentage'],
      canStackTogether: true, // Multiple percentage discounts can stack
      conflictsWith: ['fixed', 'bogo'],
    },
    {
      priority: 3,
      types: ['bogo'],
      canStackTogether: false,
      conflictsWith: ['fixed', 'percentage', 'bogo'], // Only one BOGO per order
    },
    {
      priority: 4,
      types: ['free_delivery'],
      canStackTogether: false, // Only one delivery discount per order
      conflictsWith: ['free_delivery'],
    },
  ];

  /**
   * Get stacking rule for a voucher type
   */
  private getStackingRule(type: VoucherType): StackingRule | undefined {
    return this.stackingRules.find((rule) => rule.types.includes(type));
  }

  /**
   * Check if a voucher type can stack with existing applied vouchers
   */
  private canStackWithExisting(
    voucherType: VoucherType,
    existingVouchers: IVoucher[]
  ): { canStack: boolean; reason?: string } {
    const newRule = this.getStackingRule(voucherType);

    if (!newRule) {
      return { canStack: false, reason: `Unknown voucher type: ${voucherType}` };
    }

    for (const existing of existingVouchers) {
      const existingRule = this.getStackingRule(existing.type);

      if (!existingRule) continue;

      // Check for conflicts
      if (newRule.conflictsWith?.includes(existing.type)) {
        return {
          canStack: false,
          reason: `Cannot stack ${voucherType} with existing ${existing.type} offer`,
        };
      }

      if (existingRule.conflictsWith?.includes(voucherType)) {
        return {
          canStack: false,
          reason: `Existing ${existing.type} offer conflicts with ${voucherType}`,
        };
      }

      // Check if same type can stack (e.g., multiple percentage)
      if (!newRule.canStackTogether && existing.type === voucherType) {
        // Allow same type if it's free_delivery (only one delivery discount)
        if (voucherType !== 'free_delivery') {
          return {
            canStack: false,
            reason: `Cannot apply multiple ${voucherType} offers`,
          };
        }
      }
    }

    // Special case: free_delivery only if no other delivery discount
    if (voucherType === 'free_delivery') {
      const hasDeliveryDiscount = existingVouchers.some((v) => v.type === 'free_delivery');
      if (hasDeliveryDiscount) {
        return {
          canStack: false,
          reason: 'Free delivery already applied',
        };
      }
    }

    return { canStack: true };
  }

  /**
   * Calculate discount for a single voucher
   */
  private calculateVoucherDiscount(voucher: IVoucher, cartAmount: number): number {
    switch (voucher.type) {
      case 'percentage': {
        let discount = (cartAmount * voucher.value) / 100;
        // Apply max discount cap if set
        if (voucher.maxDiscount && discount > voucher.maxDiscount) {
          discount = voucher.maxDiscount;
        }
        return Math.round(discount);
      }

      case 'fixed':
        // Discount cannot exceed cart amount
        return Math.min(voucher.value, cartAmount);

      case 'bogo':
        // Buy-one-get-one: return the value of one item
        return voucher.value || cartAmount;

      case 'free_delivery':
        // Free delivery: handled separately, no cart discount
        return 0;

      default:
        return 0;
    }
  }

  /**
   * Get user eligibility for voucher
   */
  async checkUserEligibility(voucher: IVoucher, userId: string): Promise<{ eligible: boolean; reason?: string }> {
    // Check max uses per user
    if (voucher.maxUses) {
      const usageCount = await VoucherRedemption.countDocuments({
        voucherId: voucher._id,
        userId,
      });

      if (usageCount >= voucher.maxUses) {
        return {
          eligible: false,
          reason: 'Already used this voucher',
        };
      }
    }

    return { eligible: true };
  }

  /**
   * Calculate stacking result for a voucher against existing offers
   */
  async calculateStacking(input: CalculateStackingInput): Promise<StackingResult> {
    const { voucher, cartAmount, userId, existingVouchers = [] } = input;

    // 1. Check user eligibility
    const eligibility = await this.checkUserEligibility(voucher, userId);
    if (!eligibility.eligible) {
      return {
        canApply: false,
        reason: eligibility.reason,
        finalDiscount: 0,
        appliedDiscounts: [],
      };
    }

    // 2. Check if voucher is active and valid
    const now = new Date();
    if (voucher.status !== 'active') {
      return {
        canApply: false,
        reason: 'Voucher is not active',
        finalDiscount: 0,
        appliedDiscounts: [],
      };
    }

    if (voucher.validFrom > now) {
      return {
        canApply: false,
        reason: 'Voucher is not yet valid',
        finalDiscount: 0,
        appliedDiscounts: [],
      };
    }

    if (voucher.validUntil < now) {
      return {
        canApply: false,
        reason: 'Voucher has expired',
        finalDiscount: 0,
        appliedDiscounts: [],
      };
    }

    // 3. Check minimum order value
    if (cartAmount < voucher.minOrderValue) {
      return {
        canApply: false,
        reason: `Minimum order value of ₹${voucher.minOrderValue} not met`,
        finalDiscount: 0,
        appliedDiscounts: [],
      };
    }

    // 4. Check stacking conflicts
    const stackingCheck = this.canStackWithExisting(voucher.type, existingVouchers);
    if (!stackingCheck.canStack) {
      return {
        canApply: false,
        reason: stackingCheck.reason,
        finalDiscount: 0,
        appliedDiscounts: [],
      };
    }

    // 5. Calculate discount based on type
    let discount: number;
    let appliedDiscounts: AppliedDiscount[] = [];

    const voucherRule = this.getStackingRule(voucher.type);
    const priority = voucherRule?.priority || 99;

    if (voucher.type === 'free_delivery') {
      // Free delivery doesn't add to cart discount, handled separately
      discount = 0;
    } else {
      discount = this.calculateVoucherDiscount(voucher, cartAmount);
    }

    // Add to applied discounts
    if (discount > 0 || voucher.type === 'free_delivery') {
      appliedDiscounts.push({
        voucherCode: voucher.code,
        voucherType: voucher.type,
        discount,
        priority,
      });
    }

    // 6. Aggregate existing discounts with new voucher
    // Sort by priority (lower = higher priority)
    const allDiscounts = [
      ...existingVouchers.map((v) => ({
        voucherCode: v.code,
        voucherType: v.type,
        discount: this.calculateVoucherDiscount(v, cartAmount),
        priority: this.getStackingRule(v.type)?.priority || 99,
      })),
      ...appliedDiscounts,
    ].sort((a, b) => a.priority - b.priority);

    // Calculate total discount respecting type rules
    let totalDiscount = 0;
    let hasFixed = false;
    let hasPercentage = false;
    let hasBogo = false;
    let hasFreeDelivery = false;

    for (const d of allDiscounts) {
      switch (d.voucherType) {
        case 'fixed':
          if (!hasFixed) {
            totalDiscount += d.discount;
            hasFixed = true;
          }
          break;

        case 'percentage':
          // Percentage can stack with fixed, but multiple percentages are capped
          if (!hasPercentage) {
            // Apply percentage to remaining amount after fixed discount
            const afterFixed = cartAmount - (hasFixed ? totalDiscount : 0);
            const percentageDiscount = Math.round((afterFixed * d.discount) / 100);
            totalDiscount += percentageDiscount;
            hasPercentage = true;
          }
          break;

        case 'bogo':
          if (!hasBogo) {
            totalDiscount += d.discount;
            hasBogo = true;
          }
          break;

        case 'free_delivery':
          if (!hasFreeDelivery) {
            // Free delivery is handled separately in order service
            hasFreeDelivery = true;
          }
          break;
      }
    }

    // 7. Apply max discount cap from voucher if set
    if (voucher.maxDiscount && totalDiscount > voucher.maxDiscount) {
      totalDiscount = voucher.maxDiscount;
    }

    logger.debug('[OfferStackingService] Calculated stacking', {
      voucherCode: voucher.code,
      cartAmount,
      totalDiscount,
      appliedDiscounts: allDiscounts.length,
    });

    return {
      canApply: true,
      finalDiscount: totalDiscount,
      appliedDiscounts: allDiscounts,
    };
  }

  /**
   * Validate multiple vouchers for stacking compatibility
   */
  async validateStacking(vouchers: IVoucher[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for conflicts
    for (let i = 0; i < vouchers.length; i++) {
      for (let j = i + 1; j < vouchers.length; j++) {
        const check = this.canStackWithExisting(vouchers[j].type, [vouchers[i]]);
        if (!check.canStack) {
          errors.push(
            `Conflict between ${vouchers[i].code} (${vouchers[i].type}) and ${vouchers[j].code} (${vouchers[j].type}): ${check.reason}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const offerStackingService = new OfferStackingService();
export default offerStackingService;
