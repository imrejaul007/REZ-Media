/**
 * AdBazaar - Payment Service Tests
 */

import {
  calculateCampaignPayment,
  calculateOwnerPayout,
  calculateInstallments,
  PAYMENT_SPLIT,
} from '../services/paymentService';

describe('Payment Service', () => {
  describe('calculateCampaignPayment', () => {
    it('should calculate payment with platform fee', () => {
      const result = calculateCampaignPayment({
        impressions: 100000,
        cpm: 10,
      });

      expect(result.grossAmount).toBe(1000); // 100000 * 10 / 1000
      expect(result.platformFee).toBe(300); // 30% of 1000
      expect(result.gst).toBe(54); // 18% of 300
      expect(result.total).toBe(1354); // 1000 + 300 + 54
    });

    it('should calculate with custom platform fee', () => {
      const result = calculateCampaignPayment({
        impressions: 50000,
        cpm: 20,
        platformFeePercent: 20,
        gstPercent: 0,
      });

      expect(result.grossAmount).toBe(1000);
      expect(result.platformFee).toBe(200); // 20%
      expect(result.total).toBe(1200);
    });
  });

  describe('calculateOwnerPayout', () => {
    it('should calculate owner payout at 70%', () => {
      const result = calculateOwnerPayout({
        grossRevenue: 10000,
      });

      expect(result.ownerAmount).toBe(7000); // 70%
      expect(result.platformAmount).toBe(3000); // 30%
    });

    it('should use custom owner percent', () => {
      const result = calculateOwnerPayout({
        grossRevenue: 10000,
        ownerPercent: 80,
      });

      expect(result.ownerAmount).toBe(8000);
      expect(result.platformAmount).toBe(2000);
    });
  });

  describe('calculateInstallments', () => {
    it('should divide into monthly installments', () => {
      const result = calculateInstallments({
        totalAmount: 30000,
        installments: 3,
      });

      expect(result.installments).toHaveLength(3);
      expect(result.installments[0].amount).toBe(10000);
    });
  });

  describe('PAYMENT_SPLIT', () => {
    it('should have correct split', () => {
      expect(PAYMENT_SPLIT.OWNER_PERCENT).toBe(70);
      expect(PAYMENT_SPLIT.PLATFORM_PERCENT).toBe(30);
      expect(PAYMENT_SPLIT.MIN_PAYOUT).toBe(1000);
    });
  });
});
