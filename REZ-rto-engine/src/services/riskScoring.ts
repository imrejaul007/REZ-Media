import {
  RiskScoreResult,
  RiskTier,
  RiskFactor,
  FraudSignal,
  ScoreRequest,
  AddressData,
  FraudSignalType,
} from '../types';
import { IRiskProfile, RiskProfile } from '../models/RiskProfile';
import { IOrderRisk, OrderRisk } from '../models/OrderRisk';
import { IDevice, Device } from '../models/Device';
import { deviceFingerprintService } from './deviceFingerprint';
import { addressValidationService } from './addressValidation';
import { behaviorAnalysisService } from './behaviorAnalysis';
import { logger } from '../config/logger';

interface RiskWeights {
  device: number;
  address: number;
  behavior: number;
  order: number;
}

const DEFAULT_WEIGHTS: RiskWeights = {
  device: 0.25,
  address: 0.25,
  behavior: 0.30,
  order: 0.20,
};

export class RiskScoringService {
  private weights: RiskWeights = DEFAULT_WEIGHTS;

  /**
   * Update risk weights
   */
  setWeights(weights: Partial<RiskWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * Get risk tier from score
   */
  getRiskTier(score: number): RiskTier {
    if (score <= 30) return RiskTier.LOW;
    if (score <= 60) return RiskTier.MEDIUM;
    return RiskTier.HIGH;
  }

  /**
   * Calculate overall risk score
   */
  calculateWeightedScore(
    deviceScore: number,
    addressScore: number,
    behaviorScore: number,
    orderScore: number
  ): number {
    const riskScore =
      (100 - deviceScore) * this.weights.device +
      (100 - addressScore) * this.weights.address +
      (100 - behaviorScore) * this.weights.behavior +
      (100 - orderScore) * this.weights.order;

    return Math.round(riskScore);
  }

  /**
   * Analyze an order and return comprehensive risk assessment
   */
  async analyzeOrder(request: ScoreRequest): Promise<RiskScoreResult> {
    const startTime = Date.now();
    const signals: FraudSignal[] = [];
    const factors: RiskFactor[] = [];

    logger.info('Starting risk analysis', {
      orderId: request.orderId,
      userId: request.userId,
      orderValue: request.orderValue,
    });

    // 1. Get or create user risk profile
    let profile = await RiskProfile.findOne({ userId: request.userId });
    if (!profile) {
      profile = await RiskProfile.create({
        userId: request.userId,
        overallRiskScore: 0,
        riskTier: RiskTier.LOW,
      });
    }

    // 2. Device fingerprint analysis
    const deviceAnalysis = await this.analyzeDevice(request, profile);
    signals.push(...deviceAnalysis.signals);
    factors.push({
      name: 'device_trust',
      weight: this.weights.device,
      score: deviceAnalysis.deviceScore,
      description: `Device trust score: ${deviceAnalysis.deviceScore}/100`,
    });

    // 3. Address validation
    const addressAnalysis = await this.analyzeAddress(
      request.shippingAddress,
      profile.trustedAddresses,
      request.orderValue
    );
    signals.push(...addressAnalysis.signals);
    factors.push({
      name: 'address_quality',
      weight: this.weights.address,
      score: addressAnalysis.addressScore,
      description: `Address quality score: ${addressAnalysis.addressScore}/100`,
    });

    // 4. Behavioral analysis
    const behaviorAnalysis = await this.analyzeBehavior(
      profile,
      request.orderHistory
    );
    signals.push(...behaviorAnalysis.signals);
    factors.push({
      name: 'behavior_pattern',
      weight: this.weights.behavior,
      score: behaviorAnalysis.behaviorScore,
      description: behaviorAnalysis.factors
        .map((f) => f.description)
        .join('; '),
    });

    // 5. Order-level risk
    const orderAnalysis = this.analyzeOrderLevel(request);
    signals.push(...orderAnalysis.signals);
    factors.push({
      name: 'order_characteristics',
      weight: this.weights.order,
      score: orderAnalysis.orderScore,
      description: orderAnalysis.description,
    });

    // 6. Calculate composite scores
    const deviceRiskScore = 100 - deviceAnalysis.deviceScore;
    const addressRiskScore = addressAnalysis.riskScore;
    const behaviorRiskScore = behaviorAnalysis.riskScore;
    const orderRiskScore = orderAnalysis.riskScore;

    const riskScore = this.calculateWeightedScore(
      deviceAnalysis.deviceScore,
      addressAnalysis.addressScore,
      behaviorAnalysis.behaviorScore,
      orderAnalysis.orderScore
    );

    const riskTier = this.getRiskTier(riskScore);

    // 7. Generate recommendations
    const recommendations = this.generateRecommendations(
      riskScore,
      riskTier,
      signals
    );

    // 8. Save/update risk profile
    await this.updateProfile(profile, {
      deviceScore: deviceAnalysis.deviceScore,
      addressScore: addressAnalysis.addressScore,
      behaviorScore: behaviorAnalysis.behaviorScore,
      orderScore: orderAnalysis.orderScore,
      riskScore,
      signals,
    });

    // 9. Create/update order risk record
    await this.createOrderRiskRecord(request, {
      riskScore,
      riskTier,
      deviceScore: deviceAnalysis.deviceScore,
      addressScore: addressAnalysis.addressScore,
      behaviorScore: behaviorAnalysis.behaviorScore,
      orderScore: orderAnalysis.orderScore,
      signals,
      addressHash: addressAnalysis.hash,
      addressQualityScore: request.shippingAddress.qualityScore,
    });

    const duration = Date.now() - startTime;
    logger.info('Risk analysis complete', {
      orderId: request.orderId,
      userId: request.userId,
      riskScore,
      riskTier,
      duration,
      signalsCount: signals.length,
    });

    return {
      orderId: request.orderId,
      userId: request.userId,
      riskScore,
      riskTier,
      factors,
      signals,
      deviceScore: deviceAnalysis.deviceScore,
      addressScore: addressAnalysis.addressScore,
      behaviorScore: behaviorAnalysis.behaviorScore,
      orderScore: orderAnalysis.orderScore,
      recommendations,
      analyzedAt: new Date(),
    };
  }

  private async analyzeDevice(
    request: ScoreRequest,
    profile: IRiskProfile
  ): Promise<{ deviceScore: number; signals: FraudSignal[]; device?: IDevice }> {
    const signals: FraudSignal[] = [];

    // Get existing device
    const existingDevice = await Device.findOne({ userId: request.userId });

    const components = {
      userAgent: request.userAgent,
      screenResolution: request.fingerprintData.screenResolution || '',
      timezone: request.fingerprintData.timezone || '',
      language: request.fingerprintData.language || '',
      platform: request.fingerprintData.platform || '',
      canvasHash: request.fingerprintData.canvasHash || '',
      webglHash: request.fingerprintData.webglHash || '',
      audioHash: request.fingerprintData.audioHash || '',
      ipAddress: request.userIp,
    };

    const analysis = await deviceFingerprintService.analyzeDevice(
      request.userId,
      components,
      existingDevice
    );

    signals.push(...analysis.signals);

    // Update or create device record
    if (analysis.device) {
      await analysis.device.updateOne({
        lastSeen: new Date(),
        fingerprintHash: analysis.fingerprintHash,
        ipAddress: request.userIp,
      });
    } else {
      const newDevice = await Device.create({
        fingerprintId: analysis.fingerprintId,
        userId: request.userId,
        fingerprintHash: analysis.fingerprintHash,
        userAgent: request.userAgent,
        ipAddress: request.userIp,
        country: analysis.ipInfo.country,
        city: analysis.ipInfo.city,
        isp: analysis.ipInfo.isp,
        isProxy: analysis.ipInfo.isProxy,
        isTor: analysis.ipInfo.isTor,
        trustScore: analysis.trustScore,
        isTrusted: analysis.isTrusted,
      });
    }

    const deviceScore = 100 - deviceFingerprintService.calculateDeviceRiskScore(
      analysis.isNewDevice,
      analysis.trustScore,
      analysis.signals
    );

    return {
      deviceScore: Math.max(0, Math.min(100, deviceScore)),
      signals,
      device: analysis.device || undefined,
    };
  }

  private async analyzeAddress(
    address: Partial<AddressData>,
    trustedAddresses: string[],
    orderValue?: number
  ): Promise<{
    addressScore: number;
    riskScore: number;
    signals: FraudSignal[];
    hash: string;
  }> {
    const validation = await addressValidationService.validateAddress(
      address,
      trustedAddresses,
      orderValue
    );

    return {
      addressScore: validation.addressData.qualityScore || 50,
      riskScore: validation.riskScore,
      signals: validation.signals,
      hash: validation.hash,
    };
  }

  private async analyzeBehavior(
    profile: IRiskProfile,
    orderHistory?: ScoreRequest['orderHistory']
  ): Promise<{
    behaviorScore: number;
    riskScore: number;
    signals: FraudSignal[];
    factors: Array<{ name: string; impact: number; description: string }>;
  }> {
    const analysis = await behaviorAnalysisService.analyzeBehavior(
      profile,
      orderHistory
    );

    return {
      behaviorScore: analysis.behaviorScore,
      riskScore: analysis.riskScore,
      signals: analysis.signals,
      factors: analysis.factors,
    };
  }

  private analyzeOrderLevel(
    request: ScoreRequest
  ): {
    orderScore: number;
    riskScore: number;
    signals: FraudSignal[];
    description: string;
  } {
    const signals: FraudSignal[] = [];
    let riskScore = 0;
    const descriptions: string[] = [];

    // High value order
    if (request.orderValue > 15000) {
      riskScore += 15;
      descriptions.push(`Very high value: ₹${request.orderValue.toLocaleString()}`);
    } else if (request.orderValue > 5000) {
      riskScore += 10;
      descriptions.push(`High value: ₹${request.orderValue.toLocaleString()}`);
    }

    // Large number of items
    if (request.itemCount > 10) {
      riskScore += 5;
      descriptions.push(`Large order: ${request.itemCount} items`);
    }

    // High-risk categories (could be expanded)
    const highRiskCategories = ['electronics', 'jewelry', 'watches'];
    const hasHighRiskCategory = request.itemCategories.some((cat) =>
      highRiskCategories.includes(cat.toLowerCase())
    );
    if (hasHighRiskCategory) {
      riskScore += 10;
      descriptions.push('High-risk item category');
    }

    // COD ratio (if order value differs significantly)
    const codRatio = request.codAmount / request.orderValue;
    if (codRatio > 0.95) {
      riskScore += 5;
      descriptions.push('Full COD order');
    }

    const orderScore = Math.max(0, 100 - riskScore);

    return {
      orderScore,
      riskScore,
      signals,
      description: descriptions.join('; ') || 'Normal order characteristics',
    };
  }

  private async updateProfile(
    profile: IRiskProfile,
    data: {
      deviceScore: number;
      addressScore: number;
      behaviorScore: number;
      orderScore: number;
      riskScore: number;
      signals: FraudSignal[];
    }
  ): Promise<void> {
    // Update scores
    profile.deviceScore = data.deviceScore;
    profile.addressScore = data.addressScore;
    profile.behaviorScore = data.behaviorScore;
    profile.orderScore = data.orderScore;
    profile.overallRiskScore = data.riskScore;
    profile.riskTier = this.getRiskTier(data.riskScore);
    profile.lastAnalyzed = new Date();

    // Add new fraud signals
    for (const signal of data.signals) {
      const existingSignal = profile.fraudSignals.find(
        (s) => s.type === signal.type
      );
      if (existingSignal) {
        existingSignal.count += 1;
        existingSignal.lastOccurrence = new Date();
        existingSignal.resolved = false;
      } else {
        profile.fraudSignals.push({
          type: signal.type,
          count: 1,
          lastOccurrence: new Date(),
          resolved: false,
        });
      }
    }

    await profile.save();
  }

  private async createOrderRiskRecord(
    request: ScoreRequest,
    data: {
      riskScore: number;
      riskTier: RiskTier;
      deviceScore: number;
      addressScore: number;
      behaviorScore: number;
      orderScore: number;
      signals: FraudSignal[];
      addressHash: string;
      addressQualityScore?: number;
    }
  ): Promise<void> {
    await OrderRisk.findOneAndUpdate(
      { orderId: request.orderId },
      {
        orderId: request.orderId,
        userId: request.userId,
        riskScore: data.riskScore,
        riskTier: data.riskTier,
        deviceScore: data.deviceScore,
        addressScore: data.addressScore,
        behaviorScore: data.behaviorScore,
        orderScore: data.orderScore,
        orderValue: request.orderValue,
        codAmount: request.codAmount,
        itemCount: request.itemCount,
        itemCategories: request.itemCategories,
        fraudSignals: data.signals.map((s) => ({
          type: s.type,
          severity: s.severity,
          description: s.description,
          value: s.value as any,
        })),
        shippingAddressHash: data.addressHash,
        addressQualityScore: data.addressQualityScore,
        analyzedAt: new Date(),
        decisionExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
      { upsert: true, new: true }
    );
  }

  private generateRecommendations(
    riskScore: number,
    riskTier: RiskTier,
    signals: FraudSignal[]
  ): string[] {
    const recommendations: string[] = [];

    // Based on risk tier
    switch (riskTier) {
      case RiskTier.HIGH:
        recommendations.push('BLOCK COD - High risk detected');
        recommendations.push('Require full advance payment');
        recommendations.push('Manual review required');
        break;
      case RiskTier.MEDIUM:
        recommendations.push('Allow COD with partial advance');
        recommendations.push('Set partial advance percentage based on risk score');
        recommendations.push('Enhanced monitoring enabled');
        break;
      case RiskTier.LOW:
        recommendations.push('APPROVE standard COD');
        recommendations.push('Proceed with normal processing');
        break;
    }

    // Based on specific signals
    const criticalSignals = signals.filter((s) => s.severity === 'CRITICAL');
    if (criticalSignals.length > 0) {
      recommendations.unshift('CRITICAL: Immediate action required');
    }

    const proxySignals = signals.filter(
      (s) => s.type === FraudSignalType.IP_PROXY
    );
    if (proxySignals.length > 0) {
      recommendations.push('Flag for additional verification');
    }

    return recommendations;
  }
}

export const riskScoringService = new RiskScoringService();
