/**
 * REZ AI Dynamic Pricing Engine Tests
 * Tests for dynamic pricing calculations
 */

import { AIDynamicPricingEngine, type PricingRequest } from '../src/services/pricingEngine';

describe('AIDynamicPricingEngine', () => {
  let pricingEngine: AIDynamicPricingEngine;

  beforeEach(() => {
    pricingEngine = new AIDynamicPricingEngine();
  });

  describe('calculatePrice', () => {
    it('should calculate price for banner ad with awareness goal', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'homepage_hero',
        goalType: 'awareness',
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result).toBeDefined();
      expect(result.finalPrice).toBeGreaterThan(0);
      expect(result.basePrice).toBe(150); // Banner CPM
      expect(result.unit).toBe('CPM');
      expect(result.factors).toBeDefined();
      expect(result.breakdown).toBeDefined();
    });

    it('should return CPC for clicks goal', async () => {
      const request: PricingRequest = {
        adType: 'search',
        placement: 'search_results',
        goalType: 'clicks',
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result.unit).toBe('CPC');
      expect(result.basePrice).toBe(12); // Search CPC
    });

    it('should return CPA for conversions goal', async () => {
      const request: PricingRequest = {
        adType: 'whatsapp',
        placement: 'direct_message',
        goalType: 'conversions',
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result.unit).toBe('CPA');
      expect(result.basePrice).toBe(25); // WhatsApp CPA
    });

    it('should return CPV for footfall goal', async () => {
      const request: PricingRequest = {
        adType: 'dooh',
        placement: 'mall_entrance',
        goalType: 'footfall',
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result.unit).toBe('CPV');
      expect(result.basePrice).toBe(8); // DOOH CPV
    });

    it('should return CPS for qr_scans goal', async () => {
      const request: PricingRequest = {
        adType: 'qr',
        placement: 'store_poster',
        goalType: 'qr_scans',
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result.unit).toBe('CPS');
      expect(result.basePrice).toBe(4); // QR CPS
    });

    it('should respect vendor minimum price as floor', async () => {
      const request: PricingRequest = {
        adType: 'email',
        placement: 'newsletter',
        goalType: 'awareness',
        vendorMinimumPrice: 50,
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result.finalPrice).toBeGreaterThanOrEqual(50);
    });

    it('should include all pricing factors', async () => {
      const request: PricingRequest = {
        adType: 'feed',
        placement: 'social_feed',
        goalType: 'awareness',
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result.factors.basePrice).toBeDefined();
      expect(result.factors.currency).toBe('INR');
      expect(result.factors.demandMultiplier).toBeGreaterThan(0);
      expect(result.factors.competitionMultiplier).toBeGreaterThan(0);
      expect(result.factors.peakTimeMultiplier).toBeGreaterThan(0);
      expect(result.factors.dayOfWeekMultiplier).toBeGreaterThan(0);
      expect(result.factors.seasonalMultiplier).toBeGreaterThan(0);
      expect(result.factors.locationMultiplier).toBeGreaterThan(0);
      expect(result.factors.footTrafficMultiplier).toBeGreaterThan(0);
      expect(result.factors.incomeLevelMultiplier).toBeGreaterThan(0);
      expect(result.factors.conversionScore).toBeGreaterThan(0);
      expect(result.factors.audienceQuality).toBeGreaterThan(0);
      expect(result.factors.engagementRate).toBeGreaterThan(0);
    });

    it('should include breakdown with all components', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
      };

      const result = await pricingEngine.calculatePrice(request);

      const expectedComponents = [
        'Base Price',
        'Demand',
        'Competition',
        'Peak Time',
        'Day of Week',
        'Seasonal',
        'Location',
        'Foot Traffic',
        'Audience Quality',
        'Engagement',
      ];

      const components = result.breakdown.map(b => b.component);
      expectedComponents.forEach(comp => {
        expect(components).toContain(comp);
      });
    });

    it('should have recommendedBid 15% above final price', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result.recommendedBid).toBeCloseTo(result.finalPrice * 1.15, 2);
    });

    it('should calculate validUntil as 15 minutes from now', async () => {
      const beforeCall = Date.now();
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
      };

      const result = await pricingEngine.calculatePrice(request);
      const afterCall = Date.now();

      const validUntilMs = result.validUntil.getTime();
      const expectedMin = beforeCall + 15 * 60 * 1000 - 1000;
      const expectedMax = afterCall + 15 * 60 * 1000 + 1000;

      expect(validUntilMs).toBeGreaterThanOrEqual(expectedMin);
      expect(validUntilMs).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('Peak Time Multipliers', () => {
    it('should apply highest multiplier at 8 PM (20:00)', async () => {
      const peakRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-05-15T20:00:00'),
          end: new Date('2026-05-15T22:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(peakRequest);

      expect(result.factors.peakTimeMultiplier).toBe(2.5);
    });

    it('should apply low multiplier at 3 AM', async () => {
      const lateNightRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-05-15T03:00:00'),
          end: new Date('2026-05-15T05:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(lateNightRequest);

      expect(result.factors.peakTimeMultiplier).toBe(0.3);
    });

    it('should apply moderate multiplier at midday', async () => {
      const middayRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-05-15T14:00:00'),
          end: new Date('2026-05-15T16:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(middayRequest);

      expect(result.factors.peakTimeMultiplier).toBe(1.2);
    });
  });

  describe('Day of Week Multipliers', () => {
    it('should apply highest multiplier on Saturday', async () => {
      const saturdayRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-05-16T10:00:00'), // Saturday
          end: new Date('2026-05-16T12:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(saturdayRequest);

      expect(result.factors.dayOfWeekMultiplier).toBe(1.4);
    });

    it('should apply low multiplier on Sunday', async () => {
      const sundayRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-05-17T10:00:00'), // Sunday
          end: new Date('2026-05-17T12:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(sundayRequest);

      expect(result.factors.dayOfWeekMultiplier).toBe(0.7);
    });
  });

  describe('Seasonal Multipliers', () => {
    it('should apply 2x multiplier in festival months (October)', async () => {
      const festivalRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-10-15T10:00:00'),
          end: new Date('2026-10-15T12:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(festivalRequest);

      expect(result.factors.seasonalMultiplier).toBe(2.0);
    });

    it('should apply 1.5x multiplier for Holi (March)', async () => {
      const holiRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-03-10T10:00:00'),
          end: new Date('2026-03-10T12:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(holiRequest);

      expect(result.factors.seasonalMultiplier).toBe(1.5);
    });

    it('should apply 1.3x multiplier for summer (April-May)', async () => {
      const summerRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-05-01T10:00:00'),
          end: new Date('2026-05-01T12:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(summerRequest);

      expect(result.factors.seasonalMultiplier).toBe(1.3);
    });

    it('should apply 0.8x multiplier for monsoon (June-July)', async () => {
      const monsoonRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-07-01T10:00:00'),
          end: new Date('2026-07-01T12:00:00'),
        },
      };

      const result = await pricingEngine.calculatePrice(monsoonRequest);

      expect(result.factors.seasonalMultiplier).toBe(0.8);
    });
  });

  describe('Location Multipliers', () => {
    it('should apply tier 1 multiplier for Mumbai', async () => {
      const mumbaiRequest: PricingRequest = {
        adType: 'dooh',
        placement: 'test',
        goalType: 'awareness',
        location: {
          city: 'Mumbai',
        },
      };

      const result = await pricingEngine.calculatePrice(mumbaiRequest);

      expect(result.factors.locationMultiplier).toBe(2.5);
    });

    it('should apply tier 1 multiplier for Delhi', async () => {
      const delhiRequest: PricingRequest = {
        adType: 'dooh',
        placement: 'test',
        goalType: 'awareness',
        location: {
          city: 'Delhi',
        },
      };

      const result = await pricingEngine.calculatePrice(delhiRequest);

      expect(result.factors.locationMultiplier).toBe(2.5);
    });

    it('should apply tier 2 multiplier for Jaipur', async () => {
      const jaipurRequest: PricingRequest = {
        adType: 'dooh',
        placement: 'test',
        goalType: 'awareness',
        location: {
          city: 'Jaipur',
        },
      };

      const result = await pricingEngine.calculatePrice(jaipurRequest);

      expect(result.factors.locationMultiplier).toBe(1.5);
    });

    it('should apply tier 3 multiplier for unknown cities', async () => {
      const unknownRequest: PricingRequest = {
        adType: 'dooh',
        placement: 'test',
        goalType: 'awareness',
        location: {
          city: 'UnknownCity',
        },
      };

      const result = await pricingEngine.calculatePrice(unknownRequest);

      expect(result.factors.locationMultiplier).toBe(1.0);
    });
  });

  describe('Competition Multipliers', () => {
    it('should apply high competition multiplier', async () => {
      const highCompetitionRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        competitionLevel: 'high',
      };

      const result = await pricingEngine.calculatePrice(highCompetitionRequest);

      expect(result.factors.competitionMultiplier).toBe(1.8);
    });

    it('should apply medium competition multiplier', async () => {
      const mediumCompetitionRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        competitionLevel: 'medium',
      };

      const result = await pricingEngine.calculatePrice(mediumCompetitionRequest);

      expect(result.factors.competitionMultiplier).toBe(1.2);
    });

    it('should apply low competition multiplier', async () => {
      const lowCompetitionRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        competitionLevel: 'low',
      };

      const result = await pricingEngine.calculatePrice(lowCompetitionRequest);

      expect(result.factors.competitionMultiplier).toBe(0.7);
    });

    it('should apply default competition multiplier when not specified', async () => {
      const noCompetitionRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
      };

      const result = await pricingEngine.calculatePrice(noCompetitionRequest);

      expect(result.factors.competitionMultiplier).toBe(1.0);
    });
  });

  describe('Audience Income Multipliers', () => {
    it('should apply high income multiplier', async () => {
      const highIncomeRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        targetAudience: {
          segment: 'professionals',
          income: 'high',
        },
      };

      const result = await pricingEngine.calculatePrice(highIncomeRequest);

      expect(result.factors.incomeLevelMultiplier).toBe(2.0);
    });

    it('should apply medium income multiplier', async () => {
      const mediumIncomeRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        targetAudience: {
          segment: 'general',
          income: 'medium',
        },
      };

      const result = await pricingEngine.calculatePrice(mediumIncomeRequest);

      expect(result.factors.incomeLevelMultiplier).toBe(1.3);
    });

    it('should apply low income multiplier', async () => {
      const lowIncomeRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        targetAudience: {
          segment: 'students',
          income: 'low',
        },
      };

      const result = await pricingEngine.calculatePrice(lowIncomeRequest);

      expect(result.factors.incomeLevelMultiplier).toBe(0.8);
    });
  });

  describe('Combined Multipliers', () => {
    it('should combine multiple multipliers correctly', async () => {
      // Peak time (2.5) + Saturday (1.4) + Festival (2.0) + Tier1 (2.5) + High income (2.0)
      const premiumRequest: PricingRequest = {
        adType: 'dooh',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-10-17T20:00:00'), // Saturday 8 PM, October
          end: new Date('2026-10-17T22:00:00'),
        },
        location: {
          city: 'Mumbai',
        },
        targetAudience: {
          segment: 'premium_users',
          income: 'high',
        },
        competitionLevel: 'high',
      };

      const result = await pricingEngine.calculatePrice(result);

      // Verify multipliers are applied
      expect(result.factors.peakTimeMultiplier).toBe(2.5);
      expect(result.factors.dayOfWeekMultiplier).toBe(1.4);
      expect(result.factors.seasonalMultiplier).toBe(2.0);
      expect(result.factors.locationMultiplier).toBe(2.5);
      expect(result.factors.incomeLevelMultiplier).toBe(2.0);
      expect(result.factors.competitionMultiplier).toBe(1.8);
    });
  });

  describe('Confidence Score', () => {
    it('should be between 0.5 and 0.95', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
      };

      const result = await pricingEngine.calculatePrice(request);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
      expect(result.confidenceScore).toBeLessThanOrEqual(0.95);
    });

    it('should increase with more factors', async () => {
      const minimalRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
      };

      const detailedRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        scheduledTime: {
          start: new Date('2026-05-15T10:00:00'),
          end: new Date('2026-05-15T12:00:00'),
        },
        location: {
          city: 'Mumbai',
        },
        targetAudience: {
          segment: 'professionals',
          income: 'high',
        },
        competitionLevel: 'high',
      };

      const minimalResult = await pricingEngine.calculatePrice(minimalRequest);
      const detailedResult = await pricingEngine.calculatePrice(detailedRequest);

      // Detailed request should have higher confidence
      expect(detailedResult.confidenceScore).toBeGreaterThanOrEqual(minimalResult.confidenceScore);
    });
  });

  describe('Performance Estimation', () => {
    it('should estimate reach for different ad types', async () => {
      const adTypes = ['banner', 'feed', 'search', 'dooh', 'push', 'email'] as const;

      for (const adType of adTypes) {
        const request: PricingRequest = {
          adType,
          placement: 'test',
          goalType: 'awareness',
          budget: 10000,
        };

        const result = await pricingEngine.calculatePrice(request);

        expect(result.estimatedReach).toBeGreaterThan(0);
        expect(result.estimatedClicks).toBeGreaterThanOrEqual(0);
        expect(result.estimatedConversions).toBeGreaterThanOrEqual(0);
      }
    });

    it('should scale reach with budget', async () => {
      const smallBudgetRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        budget: 1000,
      };

      const largeBudgetRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        budget: 50000,
      };

      const smallResult = await pricingEngine.calculatePrice(smallBudgetRequest);
      const largeResult = await pricingEngine.calculatePrice(largeBudgetRequest);

      expect(largeResult.estimatedReach).toBeGreaterThan(smallResult.estimatedReach);
    });

    it('should apply targeting reduction factor', async () => {
      const untargetedRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        budget: 10000,
      };

      const targetedRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        budget: 10000,
        targetAudience: {
          segment: 'young_professionals',
          income: 'high',
        },
      };

      const untargetedResult = await pricingEngine.calculatePrice(untargetedRequest);
      const targetedResult = await pricingEngine.calculatePrice(targetedRequest);

      // Targeted reach should be lower due to smaller audience
      expect(targetedResult.estimatedReach).toBeLessThan(untargetedResult.estimatedReach);
    });
  });

  describe('Breakdown Calculation', () => {
    it('should show base price contribution correctly', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
      };

      const result = await pricingEngine.calculatePrice(request);

      const basePriceItem = result.breakdown.find(b => b.component === 'Base Price');
      expect(basePriceItem).toBeDefined();
      expect(basePriceItem!.multiplier).toBe(1.0);
      expect(basePriceItem!.contribution).toBe(150);
    });

    it('should show multiplier contributions correctly', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        competitionLevel: 'high',
      };

      const result = await pricingEngine.calculatePrice(request);

      const competitionItem = result.breakdown.find(b => b.component === 'Competition');
      expect(competitionItem).toBeDefined();
      expect(competitionItem!.multiplier).toBe(1.8);
      expect(competitionItem!.contribution).toBe(150 * (1.8 - 1)); // 120
    });
  });
});
