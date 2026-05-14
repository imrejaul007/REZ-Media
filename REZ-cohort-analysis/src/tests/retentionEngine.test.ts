import {
  calculateRetentionRate,
  calculateRetentionWithConfidence,
  calculateARPU,
  calculateWeightedRetention,
  getPeriodStart,
  getPeriodsBetween,
  formatPeriodLabel,
  fitExponentialDecay,
  predictRetention,
  calculateRetentionStats,
} from '../services/retentionEngine';

describe('RetentionEngine', () => {
  describe('calculateRetentionRate', () => {
    it('should calculate 100% retention when all users remain', () => {
      const rate = calculateRetentionRate(100, 100);
      expect(rate).toBe(100);
    });

    it('should calculate 0% retention when no users remain', () => {
      const rate = calculateRetentionRate(0, 100);
      expect(rate).toBe(0);
    });

    it('should calculate correct percentage', () => {
      const rate = calculateRetentionRate(65, 100);
      expect(rate).toBe(65);
    });

    it('should handle decimal results', () => {
      const rate = calculateRetentionRate(33, 100);
      expect(rate).toBe(33);
    });

    it('should handle edge case of zero initial users', () => {
      const rate = calculateRetentionRate(0, 0);
      expect(rate).toBe(0);
    });

    it('should cap at 100% maximum', () => {
      const rate = calculateRetentionRate(150, 100);
      expect(rate).toBe(100);
    });
  });

  describe('calculateRetentionWithConfidence', () => {
    it('should return confidence intervals for 95% by default', () => {
      const result = calculateRetentionWithConfidence(50, 100);
      expect(result.rate).toBe(50);
      expect(result.lower).toBeGreaterThan(0);
      expect(result.upper).toBeLessThan(100);
      expect(result.lower).toBeLessThan(result.rate);
      expect(result.upper).toBeGreaterThan(result.rate);
    });

    it('should return wider intervals for smaller samples', () => {
      const smallSample = calculateRetentionWithConfidence(5, 10);
      const largeSample = calculateRetentionWithConfidence(500, 1000);

      // Small sample should have wider confidence interval
      const smallInterval = smallSample.upper - smallSample.lower;
      const largeInterval = largeSample.upper - largeSample.lower;

      expect(smallInterval).toBeGreaterThan(largeInterval);
    });

    it('should handle zero initial users', () => {
      const result = calculateRetentionWithConfidence(0, 0);
      expect(result.rate).toBe(0);
      expect(result.lower).toBe(0);
      expect(result.upper).toBe(0);
    });
  });

  describe('calculateARPU', () => {
    it('should calculate correct ARPU', () => {
      const arpu = calculateARPU(1000, 100);
      expect(arpu).toBe(10);
    });

    it('should return 0 when no active users', () => {
      const arpu = calculateARPU(1000, 0);
      expect(arpu).toBe(0);
    });

    it('should handle decimal ARPU', () => {
      const arpu = calculateARPU(100, 3);
      expect(arpu).toBe(33.33);
    });
  });

  describe('calculateWeightedRetention', () => {
    it('should calculate weighted average correctly', () => {
      const rates = [80, 60, 40];
      const weights = [100, 100, 100];
      const weighted = calculateWeightedRetention(rates, weights);
      expect(weighted).toBe(60);
    });

    it('should weight by user count', () => {
      const rates = [100, 50];
      const weights = [10, 90]; // 10% high retention, 90% low retention
      const weighted = calculateWeightedRetention(rates, weights);
      // Expected: (100*10 + 50*90) / 100 = 5500 / 100 = 55
      expect(weighted).toBe(55);
    });

    it('should return 0 for empty arrays', () => {
      const weighted = calculateWeightedRetention([], []);
      expect(weighted).toBe(0);
    });
  });

  describe('getPeriodStart', () => {
    it('should return start of day for daily period', () => {
      const date = new Date('2026-01-15T14:30:00Z');
      const result = getPeriodStart(date, 'daily');
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('should return start of week (Monday) for weekly period', () => {
      // Wednesday, Jan 15, 2026
      const date = new Date('2026-01-15T14:30:00Z');
      const result = getPeriodStart(date, 'weekly');
      // Should be Monday, Jan 13, 2026
      expect(result.getDate()).toBe(13);
      expect(result.getDay()).toBe(1); // Monday
    });

    it('should return start of month for monthly period', () => {
      const date = new Date('2026-01-15T14:30:00Z');
      const result = getPeriodStart(date, 'monthly');
      expect(result.getDate()).toBe(1);
    });
  });

  describe('getPeriodsBetween', () => {
    it('should calculate days between dates', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      const periods = getPeriodsBetween(start, end, 'daily');
      expect(periods).toBe(30);
    });

    it('should calculate weeks between dates', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-28');
      const periods = getPeriodsBetween(start, end, 'weekly');
      expect(periods).toBe(3);
    });

    it('should calculate months between dates', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-06-01');
      const periods = getPeriodsBetween(start, end, 'monthly');
      expect(periods).toBe(5);
    });
  });

  describe('formatPeriodLabel', () => {
    it('should format daily periods as YYYY-MM-DD', () => {
      const date = new Date('2026-01-15');
      const label = formatPeriodLabel(date, 'daily');
      expect(label).toBe('2026-01-15');
    });

    it('should format weekly periods as YYYY-WNN', () => {
      const date = new Date('2026-01-15');
      const label = formatPeriodLabel(date, 'weekly');
      expect(label).toMatch(/^2026-W\d{2}$/);
    });

    it('should format monthly periods as YYYY-Mon', () => {
      const date = new Date('2026-01-15');
      const label = formatPeriodLabel(date, 'monthly');
      expect(label).toBe('2026-Jan');
    });
  });

  describe('fitExponentialDecay', () => {
    it('should fit exponential model to retention data', () => {
      const data = [
        { periodIndex: 0, retentionRate: 100, lowerConfidence: 100, upperConfidence: 100, sampleSize: 1000 },
        { periodIndex: 1, retentionRate: 65, lowerConfidence: 62, upperConfidence: 68, sampleSize: 1000 },
        { periodIndex: 2, retentionRate: 42, lowerConfidence: 39, upperConfidence: 45, sampleSize: 1000 },
        { periodIndex: 3, retentionRate: 27, lowerConfidence: 24, upperConfidence: 30, sampleSize: 1000 },
      ];

      const result = fitExponentialDecay(data);
      expect(result.r0).toBeCloseTo(100, 0);
      expect(result.lambda).toBeGreaterThan(0);
      expect(result.rSquared).toBeGreaterThan(0.9);
    });

    it('should return defaults for insufficient data', () => {
      const data = [
        { periodIndex: 0, retentionRate: 100, lowerConfidence: 100, upperConfidence: 100, sampleSize: 1000 },
      ];

      const result = fitExponentialDecay(data);
      expect(result.r0).toBe(100);
      expect(result.lambda).toBe(0.1);
      expect(result.rSquared).toBe(0);
    });
  });

  describe('predictRetention', () => {
    it('should predict retention using exponential model', () => {
      const predicted = predictRetention(100, 0.3, 3);
      // R(3) = 100 * e^(-0.3 * 3) = 100 * e^(-0.9) ≈ 40.66
      expect(predicted).toBeCloseTo(40.66, 0);
    });

    it('should cap prediction at 100%', () => {
      const predicted = predictRetention(100, -0.5, -1);
      expect(predicted).toBeLessThanOrEqual(100);
    });

    it('should not return negative values', () => {
      const predicted = predictRetention(100, 0.5, 10);
      expect(predicted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateRetentionStats', () => {
    it('should calculate statistics for retention curve', () => {
      const data = [
        { periodIndex: 0, retentionRate: 100, lowerConfidence: 100, upperConfidence: 100, sampleSize: 1000 },
        { periodIndex: 1, retentionRate: 70, lowerConfidence: 67, upperConfidence: 73, sampleSize: 1000 },
        { periodIndex: 2, retentionRate: 55, lowerConfidence: 52, upperConfidence: 58, sampleSize: 1000 },
        { periodIndex: 3, retentionRate: 45, lowerConfidence: 42, upperConfidence: 48, sampleSize: 1000 },
        { periodIndex: 4, retentionRate: 40, lowerConfidence: 37, upperConfidence: 43, sampleSize: 1000 },
      ];

      const stats = calculateRetentionStats(data);

      expect(stats.averageRetention).toBe(62);
      expect(stats.maxDrop).toBe(30); // 100 -> 70
      expect(stats.medianRetention).toBe(55);
      expect(stats.stabilizationPeriod).toBe(4);
    });

    it('should handle empty data', () => {
      const stats = calculateRetentionStats([]);

      expect(stats.averageRetention).toBe(0);
      expect(stats.medianRetention).toBe(0);
      expect(stats.maxDrop).toBe(0);
      expect(stats.stabilizationPeriod).toBe(0);
    });
  });
});
