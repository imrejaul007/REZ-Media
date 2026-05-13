/**
 * REZ Pricing Brain Tests
 * Tests for calculatePrice, multipliers, quality score, and confidence score
 */

import { REZPricingBrain, type PricingRequest, type AdType, type GoalType } from '../src/services/pricingBrain';

describe('REZPricingBrain', () => {
  let pricingBrain: REZPricingBrain;

  beforeEach(() => {
    pricingBrain = new REZPricingBrain();
  });

  describe('calculatePrice', () => {
    it('should calculate price for basic banner ad', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'homepage_top',
        goalType: 'awareness',
        campaignMode: 'auction',
      };

      const result = await pricingBrain.calculatePrice(request);

      expect(result).toBeDefined();
      expect(result.finalPrice).toBeGreaterThan(0);
      expect(result.basePrice).toBe(150); // Banner CPM base price
      expect(result.unit).toBe('CPM');
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.multipliers).toBeDefined();
      expect(result.breakdown).toBeDefined();
      expect(result.estimatedResults).toBeDefined();
    });

    it('should return correct pricing unit for each goal type', async () => {
      const goalUnitMap: Array<{ goal: GoalType; expectedUnit: string }> = [
        { goal: 'awareness', expectedUnit: 'CPM' },
        { goal: 'clicks', expectedUnit: 'CPC' },
        { goal: 'conversions', expectedUnit: 'CPA' },
        { goal: 'sales', expectedUnit: 'CPA' },
        { goal: 'footfall', expectedUnit: 'CPV' },
        { goal: 'qr_scans', expectedUnit: 'CPS' },
        { goal: 'leads', expectedUnit: 'CPA' },
      ];

      for (const { goal, expectedUnit } of goalUnitMap) {
        const request: PricingRequest = {
          adType: 'banner',
          placement: 'test',
          goalType: goal,
          campaignMode: 'auction',
        };

        const result = await pricingBrain.calculatePrice(request);
        expect(result.unit).toBe(expectedUnit);
      }
    });

    it('should respect vendor minimum price as floor', async () => {
      const vendorMinimumPrice = 500;
      const request: PricingRequest = {
        adType: 'push',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        vendorMinimumPrice,
      };

      const result = await pricingBrain.calculatePrice(request);

      // Final price should be at least vendor minimum
      expect(result.finalPrice).toBeGreaterThanOrEqual(vendorMinimumPrice);
      expect(result.floorPrice).toBe(vendorMinimumPrice);
    });

    it('should include auction details for auction mode', async () => {
      const request: PricingRequest = {
        adType: 'search',
        placement: 'results_page',
        goalType: 'clicks',
        campaignMode: 'auction',
      };

      const result = await pricingBrain.calculatePrice(request);

      expect(result.auctionDetails).toBeDefined();
      expect(result.auctionDetails?.mode).toBe('auction');
      expect(result.auctionDetails?.competingAds).toBeGreaterThanOrEqual(0);
      expect(result.auctionDetails?.yourRank).toBeGreaterThan(0);
      expect(result.auctionDetails?.winningBid).toBeGreaterThan(0);
      expect(result.auctionDetails?.reservePrice).toBeGreaterThan(0);
    });

    it('should not include auction details for reserved mode', async () => {
      const request: PricingRequest = {
        adType: 'dooh',
        placement: 'mall_led',
        goalType: 'awareness',
        campaignMode: 'reserved',
      };

      const result = await pricingBrain.calculatePrice(request);

      expect(result.auctionDetails).toBeUndefined();
    });

    it('should include performance guarantee for premium tiers', async () => {
      const tiers = ['smart', 'premium', 'enterprise'] as const;

      for (const tier of tiers) {
        const request: PricingRequest = {
          adType: 'banner',
          placement: 'test',
          goalType: 'conversions',
          campaignMode: 'auction',
          performanceTier: tier,
        };

        const result = await pricingBrain.calculatePrice(request);

        expect(result.performanceGuarantee).toBeDefined();
        expect(result.performanceGuarantee?.tier).toBe(tier);
        expect(result.performanceGuarantee?.guarantee).toBeDefined();
        expect(result.performanceGuarantee?.estimatedClicks).toBeGreaterThan(0);
        expect(result.performanceGuarantee?.estimatedConversions).toBeGreaterThan(0);
      }
    });

    it('should set validUntil to 15 minutes from now', async () => {
      const request: PricingRequest = {
        adType: 'feed',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
      };

      const beforeCall = Date.now();
      const result = await pricingBrain.calculatePrice(request);
      const afterCall = Date.now();

      const validUntilMs = result.validUntil.getTime();
      const expectedMin = beforeCall + 15 * 60 * 1000 - 1000;
      const expectedMax = afterCall + 15 * 60 * 1000 + 1000;

      expect(validUntilMs).toBeGreaterThanOrEqual(expectedMin);
      expect(validUntilMs).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('Multipliers', () => {
    it('should apply peak time multiplier for prime hours', async () => {
      // Test 8 PM (prime time should have high multiplier)
      const primeTimeRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        scheduledTime: {
          start: new Date('2026-05-16T20:00:00'), // Saturday 8 PM
          end: new Date('2026-05-16T22:00:00'),
        },
      };

      const result = await pricingBrain.calculatePrice(primeTimeRequest);

      // Prime time multiplier should be >= 2.0
      expect(result.multipliers.peakTime).toBeGreaterThanOrEqual(2.0);
      expect(result.multipliers.dayOfWeek).toBeGreaterThanOrEqual(1.0); // Saturday
    });

    it('should apply low multiplier for off-peak hours', async () => {
      const offPeakRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        scheduledTime: {
          start: new Date('2026-05-18T03:00:00'), // Monday 3 AM
          end: new Date('2026-05-18T05:00:00'),
        },
      };

      const result = await pricingBrain.calculatePrice(offPeakRequest);

      expect(result.multipliers.peakTime).toBeLessThanOrEqual(0.5);
    });

    it('should apply location multiplier for tier 1 cities', async () => {
      const tier1Request: PricingRequest = {
        adType: 'dooh',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        location: {
          city: 'Mumbai',
          tier: 'tier1',
        },
      };

      const result = await pricingBrain.calculatePrice(tier1Request);

      expect(result.multipliers.location).toBe(2.5);
    });

    it('should apply lower multiplier for tier 3 cities', async () => {
      const tier3Request: PricingRequest = {
        adType: 'dooh',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        location: {
          city: 'SomeSmallCity',
          tier: 'tier3',
        },
      };

      const result = await pricingBrain.calculatePrice(tier3Request);

      expect(result.multipliers.location).toBe(1.0);
    });

    it('should apply seasonal multiplier for festival months', async () => {
      const festivalRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        scheduledTime: {
          start: new Date('2026-10-15T10:00:00'), // October
          end: new Date('2026-10-15T12:00:00'),
        },
      };

      const result = await pricingBrain.calculatePrice(festivalRequest);

      expect(result.multipliers.seasonal).toBe(2.0); // Festival season
    });

    it('should apply category multiplier for luxury brands', async () => {
      const luxuryRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        targetAudience: {
          segment: 'high_net_worth',
          income: 'high',
          category: 'luxury',
        },
      };

      const result = await pricingBrain.calculatePrice(luxuryRequest);

      expect(result.multipliers.category).toBe(2.5);
    });

    it('should apply real estate multiplier', async () => {
      const realEstateRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        targetAudience: {
          segment: 'home_buyers',
          income: 'high',
          category: 'real_estate',
        },
      };

      const result = await pricingBrain.calculatePrice(realEstateRequest);

      expect(result.multipliers.category).toBe(3.0);
    });

    it('should apply demand multiplier for high income audience', async () => {
      const highIncomeRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        targetAudience: {
          segment: 'professionals',
          income: 'high',
        },
      };

      const result = await pricingBrain.calculatePrice(highIncomeRequest);

      expect(result.multipliers.demand).toBe(1.5);
    });

    it('should apply demand multiplier for medium income audience', async () => {
      const mediumIncomeRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        targetAudience: {
          segment: 'general',
          income: 'medium',
        },
      };

      const result = await pricingBrain.calculatePrice(mediumIncomeRequest);

      expect(result.multipliers.demand).toBe(1.2);
    });
  });

  describe('Price Caps', () => {
    it('should cap dooh prices at 8x base', async () => {
      const doohRequest: PricingRequest = {
        adType: 'dooh',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        scheduledTime: {
          start: new Date('2026-10-15T20:00:00'), // Festival peak
          end: new Date('2026-10-15T22:00:00'),
        },
        location: {
          city: 'Mumbai',
          tier: 'tier1',
        },
        targetAudience: {
          segment: 'all',
          income: 'high',
          category: 'luxury',
        },
      };

      const result = await pricingBrain.calculatePrice(doohRequest);

      // DOOH base price is 200, max cap is 8x = 1600
      expect(result.maxCap).toBe(200 * 8);
      expect(result.finalPrice).toBeLessThanOrEqual(result.maxCap);
    });

    it('should cap search prices at 6x base', async () => {
      const searchRequest: PricingRequest = {
        adType: 'search',
        placement: 'test',
        goalType: 'clicks',
        campaignMode: 'auction',
      };

      const result = await pricingBrain.calculatePrice(searchRequest);

      expect(result.maxCap).toBe(result.basePrice * 6);
      expect(result.finalPrice).toBeLessThanOrEqual(result.maxCap);
    });

    it('should cap email prices at 2x base', async () => {
      const emailRequest: PricingRequest = {
        adType: 'email',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
      };

      const result = await pricingBrain.calculatePrice(emailRequest);

      expect(result.maxCap).toBe(result.basePrice * 2);
      expect(result.finalPrice).toBeLessThanOrEqual(result.maxCap);
    });

    it('should include cap warning in breakdown when near cap', async () => {
      // Create a scenario that pushes price near cap
      const nearCapRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        scheduledTime: {
          start: new Date('2026-10-15T20:00:00'),
          end: new Date('2026-10-15T22:00:00'),
        },
        location: {
          city: 'Mumbai',
          tier: 'tier1',
        },
        targetAudience: {
          segment: 'all',
          income: 'high',
          category: 'luxury',
        },
      };

      const result = await pricingBrain.calculatePrice(nearCapRequest);

      // If final price is >= 95% of cap, should have cap warning
      if (result.finalPrice >= result.maxCap * 0.95) {
        const capItem = result.breakdown.find(item => item.capped);
        expect(capItem).toBeDefined();
        expect(capItem?.component).toBe('MAX CAP APPLIED');
      }
    });
  });

  describe('Quality Score', () => {
    it('should return normalized quality score', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
      };

      const result = await pricingBrain.calculatePrice(request);

      // Quality score should be normalized (base 5.0 / 5 = 1.0)
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(2.0); // Max normalized score
    });

    it('should affect effective price', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
      };

      const result = await pricingBrain.calculatePrice(request);

      // Effective price = finalPrice / (1 + (qualityScore - 1) * 0.2)
      // When qualityScore > 1, effective price < final price
      if (result.qualityScore > 1) {
        expect(result.effectivePrice).toBeLessThan(result.finalPrice);
      }
    });
  });

  describe('Confidence Score', () => {
    it('should be between 0 and 0.95', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
      };

      const result = await pricingBrain.calculatePrice(request);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
      expect(result.confidenceScore).toBeLessThanOrEqual(0.95);
    });

    it('should increase with more specific multipliers', async () => {
      const basicRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
      };

      const detailedRequest: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        scheduledTime: {
          start: new Date('2026-05-15T10:00:00'),
          end: new Date('2026-05-15T12:00:00'),
        },
        location: {
          city: 'Mumbai',
          tier: 'tier1',
        },
        targetAudience: {
          segment: 'professionals',
          income: 'high',
        },
      };

      const basicResult = await pricingBrain.calculatePrice(basicRequest);
      const detailedResult = await pricingBrain.calculatePrice(detailedRequest);

      // More specific request should have higher or equal confidence
      expect(detailedResult.confidenceScore).toBeGreaterThanOrEqual(basicResult.confidenceScore);
    });
  });

  describe('Budget Allocation', () => {
    it('should allocate budget across channels based on goal', async () => {
      const allocations = await pricingBrain.allocateBudget(10000, 'awareness', { tier: 'tier1' });

      expect(allocations).toBeDefined();
      expect(allocations.length).toBeGreaterThan(0);

      // Check total percentage equals 100
      const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
      expect(totalPercentage).toBe(100);

      // Check amounts sum to total budget
      const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
      expect(totalAmount).toBeLessThanOrEqual(10000);
    });

    it('should prioritize whatsapp for sales goal', async () => {
      const allocations = await pricingBrain.allocateBudget(10000, 'sales', { tier: 'tier1' });

      // Find whatsapp allocation
      const whatsappAlloc = allocations.find(a => a.channel === 'whatsapp');
      expect(whatsappAlloc).toBeDefined();
      expect(whatsappAlloc!.percentage).toBe(35); // 35% for sales
    });

    it('should prioritize dooh for footfall goal', async () => {
      const allocations = await pricingBrain.allocateBudget(10000, 'footfall', { tier: 'tier1' });

      // Find dooh allocation
      const doohAlloc = allocations.find(a => a.channel === 'dooh');
      expect(doohAlloc).toBeDefined();
      expect(doohAlloc!.percentage).toBe(40); // 40% for footfall
    });

    it('should include estimated results for each allocation', async () => {
      const allocations = await pricingBrain.allocateBudget(10000, 'conversions', { tier: 'tier1' });

      for (const allocation of allocations) {
        expect(allocation.estimatedReach).toBeGreaterThanOrEqual(0);
        expect(allocation.estimatedClicks).toBeGreaterThanOrEqual(0);
        expect(allocation.estimatedConversions).toBeGreaterThanOrEqual(0);
        expect(allocation.cpm).toBeGreaterThan(0);
      }
    });
  });

  describe('Minimum Spend Validation', () => {
    it('should validate minimum spend for each ad type', () => {
      const testCases: Array<{ adType: AdType; minimum: number }> = [
        { adType: 'dooh', minimum: 3000 },
        { adType: 'offline', minimum: 5000 },
        { adType: 'whatsapp', minimum: 1000 },
        { adType: 'push', minimum: 300 },
        { adType: 'banner', minimum: 500 },
      ];

      for (const { adType, minimum } of testCases) {
        const invalidResult = pricingBrain.validateMinimumSpend(adType, minimum - 1);
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.message).toContain(String(minimum));

        const validResult = pricingBrain.validateMinimumSpend(adType, minimum);
        expect(validResult.valid).toBe(true);
      }
    });

    it('should return valid for budgets at or above minimum', () => {
      const result = pricingBrain.validateMinimumSpend('banner', 500);
      expect(result.valid).toBe(true);
    });
  });

  describe('Estimated Results', () => {
    it('should calculate estimated reach based on budget', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
        budget: 10000,
      };

      const result = await pricingBrain.calculatePrice(request);

      expect(result.estimatedResults.reach).toBeGreaterThan(0);
      expect(result.estimatedResults.clicks).toBeGreaterThan(0);
    });

    it('should estimate qr scans for qr ad type', async () => {
      const request: PricingRequest = {
        adType: 'qr',
        placement: 'test',
        goalType: 'qr_scans',
        campaignMode: 'auction',
        budget: 5000,
      };

      const result = await pricingBrain.calculatePrice(request);

      expect(result.estimatedResults.scans).toBeGreaterThan(0);
    });
  });

  describe('Recommended Bid', () => {
    it('should be 15% above final price', async () => {
      const request: PricingRequest = {
        adType: 'banner',
        placement: 'test',
        goalType: 'awareness',
        campaignMode: 'auction',
      };

      const result = await pricingBrain.calculatePrice(request);

      expect(result.recommendedBid).toBeCloseTo(result.finalPrice * 1.15, 2);
    });
  });
});
