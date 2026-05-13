/**
 * REZ Inventory Liquidation Pricing Tests
 * Tests for inventory liquidation price calculations
 */

import { REZPricingBrain } from '../src/services/pricingBrain';

describe('Inventory Liquidation', () => {
  let pricingBrain: REZPricingBrain;

  beforeEach(() => {
    pricingBrain = new REZPricingBrain();
  });

  describe('calculateLiquidationPrice', () => {
    describe('Time-based discounts', () => {
      it('should apply 50% discount for slots less than 1 hour away', async () => {
        const originalPrice = 1000;
        const hoursUntilSlot = 0.5;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          hoursUntilSlot,
          10 // Low percent sold
        );

        // 50% + 25% (low sold) = 75% off, but max is 70%
        const expectedDiscount = 0.7; // Max 70% off
        expect(liquidationPrice).toBe(originalPrice * (1 - expectedDiscount));
      });

      it('should apply 30% discount for slots 1-4 hours away', async () => {
        const originalPrice = 1000;
        const hoursUntilSlot = 2;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          hoursUntilSlot,
          80 // High percent sold
        );

        // 30% + 5% (high sold) = 35% off
        expect(liquidationPrice).toBe(originalPrice * 0.65);
      });

      it('should apply 15% discount for slots 4-24 hours away', async () => {
        const originalPrice = 1000;
        const hoursUntilSlot = 12;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          hoursUntilSlot,
          80 // High percent sold
        );

        // 15% + 5% = 20% off
        expect(liquidationPrice).toBe(originalPrice * 0.8);
      });

      it('should apply no time discount for slots more than 24 hours away', async () => {
        const originalPrice = 1000;
        const hoursUntilSlot = 48;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          hoursUntilSlot,
          80 // High percent sold
        );

        // 0% + 5% = 5% off
        expect(liquidationPrice).toBe(originalPrice * 0.95);
      });
    });

    describe('Inventory-based discounts', () => {
      it('should apply 25% discount for less than 25% sold', async () => {
        const originalPrice = 1000;
        const hoursUntilSlot = 48; // No time discount

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          hoursUntilSlot,
          20 // Less than 25% sold
        );

        // 0% time + 25% inventory = 25% off
        expect(liquidationPrice).toBe(originalPrice * 0.75);
      });

      it('should apply 15% discount for 25-50% sold', async () => {
        const originalPrice = 1000;
        const hoursUntilSlot = 48;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          hoursUntilSlot,
          40 // 25-50% sold
        );

        // 0% time + 15% inventory = 15% off
        expect(liquidationPrice).toBe(originalPrice * 0.85);
      });

      it('should apply 5% discount for 50-75% sold', async () => {
        const originalPrice = 1000;
        const hoursUntilSlot = 48;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          hoursUntilSlot,
          60 // 50-75% sold
        );

        // 0% time + 5% inventory = 5% off
        expect(liquidationPrice).toBe(originalPrice * 0.95);
      });

      it('should apply no inventory discount for more than 75% sold', async () => {
        const originalPrice = 1000;
        const hoursUntilSlot = 48;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          hoursUntilSlot,
          90 // More than 75% sold
        );

        // 0% time + 0% inventory = 0% off
        expect(liquidationPrice).toBe(originalPrice);
      });
    });

    describe('Combined discounts', () => {
      it('should combine time and inventory discounts', async () => {
        const originalPrice = 1000;

        // 30% time + 15% inventory = 45% off
        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          2, // 2 hours
          40 // 40% sold
        );

        expect(liquidationPrice).toBe(originalPrice * 0.55);
      });

      it('should cap total discount at 70%', async () => {
        const originalPrice = 1000;

        // 50% time + 25% inventory = 75% total, but capped at 70%
        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          0.5, // Very last minute
          20 // Very low sold
        );

        // Should be capped at 70% off
        expect(liquidationPrice).toBe(originalPrice * 0.3);
      });

      it('should not exceed 70% even with extreme values', async () => {
        const originalPrice = 1000;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          0.1, // Extremely last minute
          5 // Almost nothing sold
        );

        // Even with maximum discounts, should be at least 30% of original
        expect(liquidationPrice).toBeGreaterThanOrEqual(originalPrice * 0.3);
      });
    });

    describe('Edge cases', () => {
      it('should return original price when no discounts apply', async () => {
        const originalPrice = 1000;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          72, // 3 days out
          95 // Almost fully sold
        );

        expect(liquidationPrice).toBe(originalPrice);
      });

      it('should handle zero original price', async () => {
        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          0,
          2,
          20
        );

        expect(liquidationPrice).toBe(0);
      });

      it('should handle very small prices', async () => {
        const originalPrice = 0.01;

        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          2,
          40
        );

        expect(liquidationPrice).toBeCloseTo(originalPrice * 0.55, 4);
      });

      it('should handle boundary hour values', async () => {
        const originalPrice = 1000;

        // Test exactly at 1 hour boundary
        const at1Hour = await pricingBrain.calculateLiquidationPrice(originalPrice, 1, 80);
        const justUnder1Hour = await pricingBrain.calculateLiquidationPrice(originalPrice, 0.99, 80);

        // At 1 hour should get 30%, just under gets 50%
        expect(at1Hour).toBe(1000 * 0.35); // 30% + 5%
        expect(justUnder1Hour).toBe(1000 * 0.55); // 50% + 5%

        // Test exactly at 4 hour boundary
        const at4Hours = await pricingBrain.calculateLiquidationPrice(originalPrice, 4, 80);
        const justUnder4Hours = await pricingBrain.calculateLiquidationPrice(originalPrice, 3.99, 80);

        expect(at4Hours).toBe(1000 * 0.35); // 30% + 5%
        expect(justUnder4Hours).toBe(1000 * 0.55); // 50% + 5%

        // Test exactly at 24 hour boundary
        const at24Hours = await pricingBrain.calculateLiquidationPrice(originalPrice, 24, 80);
        const justUnder24Hours = await pricingBrain.calculateLiquidationPrice(originalPrice, 23.99, 80);

        expect(at24Hours).toBe(1000 * 0.35); // 30% + 5%
        expect(justUnder24Hours).toBe(1000 * 0.5); // 15% + 5%
      });

      it('should handle boundary percent sold values', async () => {
        const originalPrice = 1000;

        // Test exactly at 25% boundary
        const at25 = await pricingBrain.calculateLiquidationPrice(originalPrice, 48, 25);
        const justUnder25 = await pricingBrain.calculateLiquidationPrice(originalPrice, 48, 24.99);

        expect(at25).toBe(1000 * 0.85); // 15%
        expect(justUnder25).toBe(1000 * 0.75); // 25%

        // Test exactly at 50% boundary
        const at50 = await pricingBrain.calculateLiquidationPrice(originalPrice, 48, 50);
        const justUnder50 = await pricingBrain.calculateLiquidationPrice(originalPrice, 48, 49.99);

        expect(at50).toBe(1000 * 0.95); // 5%
        expect(justUnder50).toBe(1000 * 0.85); // 15%

        // Test exactly at 75% boundary
        const at75 = await pricingBrain.calculateLiquidationPrice(originalPrice, 48, 75);
        const justUnder75 = await pricingBrain.calculateLiquidationPrice(originalPrice, 48, 74.99);

        expect(at75).toBe(1000); // 0%
        expect(justUnder75).toBe(1000 * 0.95); // 5%
      });
    });

    describe('Real-world scenarios', () => {
      it('should model Diwali evening last-minute inventory', async () => {
        const originalPrice = 5000; // DOOH premium slot

        // Last minute (3 hours), low sell-through (30%)
        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          3,
          30
        );

        // 30% time + 15% inventory = 45% off
        expect(liquidationPrice).toBe(5000 * 0.55);
      });

      it('should model weekday afternoon poor performance', async () => {
        const originalPrice = 2000;

        // Not too urgent (12 hours), poor performance (20% sold)
        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          12,
          20
        );

        // 15% time + 25% inventory = 40% off
        expect(liquidationPrice).toBe(2000 * 0.6);
      });

      it('should model near-sold-out premium inventory', async () => {
        const originalPrice = 8000;

        // Very urgent (30 min), but almost sold out (85%)
        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          0.5,
          85
        );

        // 50% time + 0% (above 75%) = 50% off, capped at minimum 30%
        expect(liquidationPrice).toBe(8000 * 0.5);
      });

      it('should model healthy sell-through with urgency', async () => {
        const originalPrice = 3000;

        // Moderate urgency (6 hours), good performance (70% sold)
        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          6,
          70
        );

        // 0% time (over 24 hours) + 5% (50-75%) = 5% off
        expect(liquidationPrice).toBe(3000 * 0.95);
      });

      it('should model seasonal inventory clearance', async () => {
        const originalPrice = 1500;

        // End of festival season (48 hours), poor clearance (15%)
        const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
          originalPrice,
          48,
          15
        );

        // 0% time + 25% inventory = 25% off
        expect(liquidationPrice).toBe(1500 * 0.75);
      });
    });
  });

  describe('Budget Allocation for Liquidation Scenarios', () => {
    it('should recommend different channels for different liquidation urgency', async () => {
      // High urgency liquidation - suggest cheaper channels
      const urgentAllocations = await pricingBrain.allocateBudget(5000, 'awareness', { tier: 'tier2' });

      // Low urgency - can spread across premium channels
      const relaxedAllocations = await pricingBrain.allocateBudget(5000, 'awareness', { tier: 'tier1' });

      // Both should return valid allocations
      expect(urgentAllocations.length).toBeGreaterThan(0);
      expect(relaxedAllocations.length).toBeGreaterThan(0);

      // Tier 1 should have higher CPM on average
      const urgentAvgCpm = urgentAllocations.reduce((sum, a) => sum + a.cpm, 0) / urgentAllocations.length;
      const relaxedAvgCpm = relaxedAllocations.reduce((sum, a) => sum + a.cpm, 0) / relaxedAllocations.length;

      expect(relaxedAvgCpm).toBeGreaterThan(urgentAvgCpm);
    });

    it('should prioritize high-conversion channels for limited budgets', async () => {
      const limitedBudget = 1000;
      const allocations = await pricingBrain.allocateBudget(limitedBudget, 'conversions', { tier: 'tier1' });

      // Should prioritize WhatsApp and search for conversions
      const whatsappAlloc = allocations.find(a => a.channel === 'whatsapp');
      expect(whatsappAlloc).toBeDefined();
      expect(whatsappAlloc!.percentage).toBe(30);
    });
  });

  describe('Liquidation Price Validation', () => {
    it('should ensure liquidation price covers minimum costs', async () => {
      const originalPrice = 100;
      const minimumViablePrice = 30; // 30% of original

      const liquidationPrice = await pricingBrain.calculateLiquidationPrice(
        originalPrice,
        0.1, // Extremely urgent
        5 // Almost nothing sold
      );

      // Liquidation price should never go below minimum viable threshold
      const discountPercent = ((originalPrice - liquidationPrice) / originalPrice) * 100;
      expect(discountPercent).toBeLessThanOrEqual(70); // Max 70% discount
      expect(liquidationPrice).toBeGreaterThanOrEqual(originalPrice * 0.3);
    });
  });
});
