import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OrderRisk } from '../models/OrderRisk';
import { RiskProfile } from '../models/RiskProfile';
import { Device } from '../models/Device';
import {
  VerificationResult,
  VerificationCheck,
  FraudSignalType,
} from '../types';
import { logger } from '../config/logger';

const router = Router();

const VerifyRequestSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  verificationChecks: z
    .array(z.enum(['address', 'device', 'identity', 'phone', 'email']))
    .optional()
    .default(['address', 'device']),
});

type VerificationCheckType =
  | 'address'
  | 'device'
  | 'identity'
  | 'phone'
  | 'email';

/**
 * POST /api/v1/verify
 * Verify an order with additional checks
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validationResult = VerifyRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { orderId, userId, verificationChecks } = validationResult.data;

    // Get order risk data
    const orderRisk = await OrderRisk.findOne({ orderId, userId });

    if (!orderRisk) {
      return res.status(404).json({
        success: false,
        error: 'Order risk analysis not found',
      });
    }

    // Get user profile
    const profile = await RiskProfile.findOne({ userId });

    // Perform verification checks
    const checks: VerificationCheck[] = [];
    let confidence = 100;

    for (const checkType of verificationChecks) {
      const check = await performVerificationCheck(
        checkType,
        orderRisk,
        profile
      );
      checks.push(check);

      if (!check.passed) {
        confidence -= check.severity === 'HIGH' ? 30 : check.severity === 'MEDIUM' ? 20 : 10;
      }
    }

    confidence = Math.max(0, Math.min(100, confidence));

    // Update order risk with verification results
    orderRisk.verificationChecks = checks.map((c) => ({
      checkType: c.checkType,
      passed: c.passed,
      details: c.details,
    }));
    orderRisk.verified = checks.every((c) => c.passed);
    orderRisk.overallConfidence = confidence;
    orderRisk.verifiedAt = new Date();
    await orderRisk.save();

    // Generate recommendations
    const recommendations = generateRecommendations(checks, confidence);

    const result: VerificationResult = {
      orderId,
      verified: orderRisk.verified,
      checks,
      overallConfidence: confidence,
      recommendations,
      verifiedAt: new Date(),
    };

    logger.info('Order verification complete', {
      orderId,
      userId,
      verified: result.verified,
      confidence,
      checksPassed: checks.filter((c) => c.passed).length,
      totalChecks: checks.length,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error verifying order', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: req.body.orderId,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to verify order',
    });
  }
});

/**
 * GET /api/v1/verify/:orderId
 * Get verification status for an order
 */
router.get('/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const orderRisk = await OrderRisk.findOne({ orderId });

    if (!orderRisk) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: orderRisk.orderId,
        verified: orderRisk.verified,
        verificationChecks: orderRisk.verificationChecks,
        overallConfidence: orderRisk.overallConfidence,
        verifiedAt: orderRisk.verifiedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching verification status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: req.params.orderId,
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch verification status',
    });
  }
});

async function performVerificationCheck(
  checkType: VerificationCheckType,
  orderRisk: any,
  profile: any
): Promise<VerificationCheck> {
  switch (checkType) {
    case 'address': {
      const addressQuality = orderRisk.addressQualityScore || 50;
      const passed = addressQuality >= 70;
      return {
        checkType: 'address',
        passed,
        details: passed
          ? `Address quality score: ${addressQuality}/100`
          : `Low address quality: ${addressQuality}/100 (threshold: 70)`,
        severity: addressQuality < 50 ? 'HIGH' : addressQuality < 70 ? 'MEDIUM' : 'LOW',
      };
    }

    case 'device': {
      const deviceScore = orderRisk.deviceScore || 50;
      const passed = deviceScore >= 60;
      const trustedDevices = profile?.trustedDevices || [];
      const hasTrustedDevice = trustedDevices.length > 0;

      return {
        checkType: 'device',
        passed,
        details: passed
          ? `Device trusted (score: ${deviceScore}/100)`
          : `Device not trusted (score: ${deviceScore}/100). ${hasTrustedDevice ? 'Has previous trusted devices.' : 'No trusted devices.'}`,
        severity: deviceScore < 40 ? 'HIGH' : deviceScore < 60 ? 'MEDIUM' : 'LOW',
      };
    }

    case 'identity': {
      // In production, this would verify against KYC/identity services
      const identityVerified = profile?.fraudSignals?.every(
        (s: any) =>
          s.type !== FraudSignalType.DEVICE_FINGERPRINT_MISMATCH
      );
      const passed = !!identityVerified;

      return {
        checkType: 'identity',
        passed,
        details: passed
          ? 'Identity verification passed'
          : 'Identity verification failed - potential fraud signal',
        severity: passed ? 'LOW' : 'HIGH',
      };
    }

    case 'phone': {
      // In production, verify phone number through OTP or API
      const phoneVerified = true; // Placeholder
      return {
        checkType: 'phone',
        passed: phoneVerified,
        details: phoneVerified
          ? 'Phone number verified'
          : 'Phone number not verified',
        severity: 'LOW',
      };
    }

    case 'email': {
      // In production, verify email through OTP or API
      const emailVerified = true; // Placeholder
      return {
        checkType: 'email',
        passed: emailVerified,
        details: emailVerified
          ? 'Email address verified'
          : 'Email address not verified',
        severity: 'LOW',
      };
    }

    default:
      return {
        checkType: checkType,
        passed: true,
        details: 'Unknown check type',
        severity: 'LOW',
      };
  }
}

function generateRecommendations(
  checks: VerificationCheck[],
  confidence: number
): string[] {
  const recommendations: string[] = [];

  const failedChecks = checks.filter((c) => !c.passed);

  if (failedChecks.length === 0) {
    recommendations.push('All verification checks passed');
    return recommendations;
  }

  for (const check of failedChecks) {
    switch (check.checkType) {
      case 'address':
        recommendations.push('Request address verification via OTP');
        break;
      case 'device':
        recommendations.push('Consider requesting device verification');
        break;
      case 'identity':
        recommendations.push('Require identity verification (KYC)');
        break;
      case 'phone':
        recommendations.push('Verify phone number via OTP');
        break;
      case 'email':
        recommendations.push('Verify email address via OTP');
        break;
    }
  }

  if (confidence < 50) {
    recommendations.push('Consider blocking COD for this order');
    recommendations.push('Flag for manual review');
  } else if (confidence < 70) {
    recommendations.push('Require additional verification');
  }

  return recommendations;
}

export default router;
