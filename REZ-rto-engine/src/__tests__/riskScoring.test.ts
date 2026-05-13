import { RiskScoringService } from '../services/riskScoring';
import { RiskTier, CODDecision } from '../types';

describe('RiskScoringService', () => {
  let service: RiskScoringService;

  beforeEach(() => {
    service = new RiskScoringService();
  });

  describe('getRiskTier', () => {
    it('should return LOW for scores 0-30', () => {
      expect(service.getRiskTier(0)).toBe(RiskTier.LOW);
      expect(service.getRiskTier(15)).toBe(RiskTier.LOW);
      expect(service.getRiskTier(30)).toBe(RiskTier.LOW);
    });

    it('should return MEDIUM for scores 31-60', () => {
      expect(service.getRiskTier(31)).toBe(RiskTier.MEDIUM);
      expect(service.getRiskTier(45)).toBe(RiskTier.MEDIUM);
      expect(service.getRiskTier(60)).toBe(RiskTier.MEDIUM);
    });

    it('should return HIGH for scores 61-100', () => {
      expect(service.getRiskTier(61)).toBe(RiskTier.HIGH);
      expect(service.getRiskTier(80)).toBe(RiskTier.HIGH);
      expect(service.getRiskTier(100)).toBe(RiskTier.HIGH);
    });
  });

  describe('calculateWeightedScore', () => {
    it('should calculate weighted score correctly', () => {
      // deviceScore=100 (0 risk), addressScore=100 (0 risk), behaviorScore=100 (0 risk), orderScore=100 (0 risk)
      const score = service.calculateWeightedScore(100, 100, 100, 100);
      expect(score).toBe(0);
    });

    it('should account for lower scores as higher risk', () => {
      // deviceScore=50 (50 risk), others perfect
      const score = service.calculateWeightedScore(50, 100, 100, 100);
      // Weight 0.25 * 50 = 12.5
      expect(score).toBe(12);
    });

    it('should combine multiple risk factors', () => {
      // All scores at 50 (50 risk each)
      const score = service.calculateWeightedScore(50, 50, 50, 50);
      // (0.25 * 50) + (0.25 * 50) + (0.30 * 50) + (0.20 * 50) = 12.5 + 12.5 + 15 + 10 = 50
      expect(score).toBe(50);
    });
  });

  describe('setWeights', () => {
    it('should update individual weights', () => {
      service.setWeights({ device: 0.4, address: 0.2 });
      const score = service.calculateWeightedScore(0, 100, 100, 100);
      // 0.4 * 100 = 40
      expect(score).toBe(40);
    });
  });
});
