/**
 * AdBazaar - Audience Service Tests
 */

import { calculateAudiencePayment, calculateOwnerEarnings } from '../services/audienceService';

describe('Audience Service', () => {
  describe('calculateAudiencePayment', () => {
    it('should calculate payment with all multipliers', () => {
      const result = calculateAudiencePayment({
        impressions: 100000,
        baseCPM: 10,
        cityTier: 2.5,
        timeMultiplier: 2.0,
        demandMultiplier: 1.5,
      });

      expect(result.totalCost).toBe(75000); // 100000 * 10 * 2.5 * 2.0 * 1.5 / 1000
    });

    it('should handle metro city', () => {
      const result = calculateAudiencePayment({
        impressions: 50000,
        baseCPM: 20,
        cityTier: 2.5,
      });

      expect(result.totalCost).toBe(2500);
    });
  });

  describe('calculateOwnerEarnings', () => {
    it('should calculate 70% owner earnings', () => {
      const result = calculateOwnerEarnings({
        grossRevenue: 10000,
      });

      expect(result.ownerAmount).toBe(7000);
      expect(result.platformAmount).toBe(3000);
    });

    it('should calculate with GST deduction', () => {
      const result = calculateOwnerEarnings({
        grossRevenue: 10000,
        deductGST: true,
      });

      expect(result.gstAmount).toBe(540); // 18% of 3000
      expect(result.netPayable).toBe(6460); // 7000 - 540
    });
  });
});
