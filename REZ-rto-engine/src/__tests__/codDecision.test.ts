import { CODDecisionService } from '../services/codDecision';
import { CODDecision, RiskTier } from '../types';

describe('CODDecisionService', () => {
  let service: CODDecisionService;

  beforeEach(() => {
    service = new CODDecisionService();
  });

  describe('Decision thresholds', () => {
    it('should have correct default block threshold', () => {
      expect(service['thresholds'].blockThreshold).toBe(60);
    });

    it('should have correct default partial advance threshold', () => {
      expect(service['thresholds'].partialAdvanceMinThreshold).toBe(30);
    });

    it('should allow updating thresholds', () => {
      service.setThresholds({ blockThreshold: 70 });
      expect(service['thresholds'].blockThreshold).toBe(70);
    });
  });

  describe('Partial advance calculation', () => {
    it('should calculate 10% for low-medium risk (score <= 35)', () => {
      const percentage = service['thresholds'].partialAdvancePercentage(30);
      expect(percentage).toBe(10);
    });

    it('should calculate 20% for medium risk (score 36-45)', () => {
      const percentage = service['thresholds'].partialAdvancePercentage(40);
      expect(percentage).toBe(20);
    });

    it('should calculate 30% for higher medium risk (score 46-55)', () => {
      const percentage = service['thresholds'].partialAdvancePercentage(50);
      expect(percentage).toBe(30);
    });

    it('should calculate 40% for high-medium risk (score > 55)', () => {
      const percentage = service['thresholds'].partialAdvancePercentage(58);
      expect(percentage).toBe(40);
    });
  });
});
