import CryptoJS from 'crypto-js';
import { AddressData, FraudSignalType, FraudSignal } from '../types';
import { logger } from '../config/logger';

interface AddressValidationResult {
  isValid: boolean;
  addressData: AddressData;
  signals: FraudSignal[];
  riskScore: number;
  hash: string;
}

interface PincodeData {
  city: string;
  state: string;
  country: string;
  deliveryAvailable: boolean;
  deliveryRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  avgDeliveryDays: number;
}

// In production, this would come from a database or API
const PINCODE_DATABASE: Record<string, PincodeData> = {
  '110001': { city: 'Delhi', state: 'Delhi', country: 'India', deliveryAvailable: true, deliveryRisk: 'LOW', avgDeliveryDays: 3 },
  '110002': { city: 'Delhi', state: 'Delhi', country: 'India', deliveryAvailable: true, deliveryRisk: 'LOW', avgDeliveryDays: 3 },
  '400001': { city: 'Mumbai', state: 'Maharashtra', country: 'India', deliveryAvailable: true, deliveryRisk: 'LOW', avgDeliveryDays: 2 },
  '400002': { city: 'Mumbai', state: 'Maharashtra', country: 'India', deliveryAvailable: true, deliveryRisk: 'LOW', avgDeliveryDays: 2 },
  '600001': { city: 'Chennai', state: 'Tamil Nadu', country: 'India', deliveryAvailable: true, deliveryRisk: 'LOW', avgDeliveryDays: 4 },
  '700001': { city: 'Kolkata', state: 'West Bengal', country: 'India', deliveryAvailable: true, deliveryRisk: 'LOW', avgDeliveryDays: 5 },
  '560001': { city: 'Bangalore', state: 'Karnataka', country: 'India', deliveryAvailable: true, deliveryRisk: 'LOW', avgDeliveryDays: 3 },
  // Add more pincodes as needed
};

export class AddressValidationService {
  private readonly SUSPICIOUS_PATTERNS = [
    /\bP\.O\.\s*Box\b/i,
    /\bPost\s*Office\b/i,
    /\bC\/O\b/i,
    /\bGeneral\s*Post\s*Office\b/i,
    /\bGPO\b/i,
  ];

  private readonly INCOMPLETE_PATTERNS = [
    /^[A-Za-z\s]+$/, // Only letters and spaces
    /.{0,10}/, // Too short
    /\d{5,6}\s*$/, // Only pincode
  ];

  /**
   * Generate address hash for comparison
   */
  generateAddressHash(address: Partial<AddressData>): string {
    const normalized = [
      address.street?.toLowerCase().trim(),
      address.city?.toLowerCase().trim(),
      address.state?.toLowerCase().trim(),
      address.pincode,
      address.country?.toLowerCase().trim(),
    ].join('|');

    return CryptoJS.SHA256(normalized).toString();
  }

  /**
   * Check if two addresses are similar
   */
  areAddressesSimilar(hash1: string, hash2: string): boolean {
    // Simple hash comparison
    if (hash1 === hash2) return true;

    // In production, implement fuzzy matching here
    return false;
  }

  /**
   * Validate pincode
   */
  validatePincode(pincode: string): PincodeData | null {
    // Try exact match first
    if (PINCODE_DATABASE[pincode]) {
      return PINCODE_DATABASE[pincode];
    }

    // Try first 3 digits (area code)
    const areaCode = pincode.substring(0, 3);
    const matchingEntry = Object.entries(PINCODE_DATABASE).find(
      ([key]) => key.startsWith(areaCode)
    );

    if (matchingEntry) {
      return matchingEntry[1];
    }

    return null;
  }

  /**
   * Calculate address quality score
   */
  calculateQualityScore(address: Partial<AddressData>): number {
    let score = 100;

    // Check for incomplete address
    if (!address.street || address.street.length < 5) {
      score -= 20;
    }

    // Check for suspicious patterns
    if (address.fullAddress) {
      for (const pattern of this.SUSPICIOUS_PATTERNS) {
        if (pattern.test(address.fullAddress)) {
          score -= 15;
        }
      }
    }

    // Check for incomplete patterns
    for (const pattern of this.INCOMPLETE_PATTERNS) {
      if (address.fullAddress && pattern.test(address.fullAddress)) {
        score -= 10;
      }
    }

    // Missing landmark
    if (!address.landmark) {
      score -= 5;
    }

    // Missing coordinates
    if (!address.latitude || !address.longitude) {
      score -= 10;
    }

    // Invalid pincode format
    if (!address.pincode || !/^\d{6}$/.test(address.pincode)) {
      score -= 25;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Validate and analyze shipping address
   */
  async validateAddress(
    address: Partial<AddressData>,
    userTrustedAddresses: string[] = [],
    orderValue?: number
  ): Promise<AddressValidationResult> {
    const signals: FraudSignal[] = [];
    let riskScore = 0;

    // Generate address hash
    const addressHash = this.generateAddressHash(address);

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(address);
    address.qualityScore = qualityScore;

    // Check for new address
    const isNewAddress = !userTrustedAddresses.some((hash) =>
      this.areAddressesSimilar(hash, addressHash)
    );

    if (isNewAddress) {
      signals.push({
        type: FraudSignalType.NEW_ADDRESS,
        severity: 'MEDIUM',
        description: 'New shipping address detected',
        value: true,
      });
      riskScore += 15;
    }

    // Address quality issues
    if (qualityScore < 70) {
      signals.push({
        type: FraudSignalType.ADDRESS_QUALITY_LOW,
        severity: 'HIGH',
        description: `Address quality score too low: ${qualityScore}/100`,
        value: qualityScore,
      });
      riskScore += 20;
    }

    // Validate pincode
    const pincodeData = this.validatePincode(address.pincode || '');
    if (!pincodeData) {
      address.isDeliverable = false;
      address.deliveryRisk = 'HIGH';
      signals.push({
        type: FraudSignalType.ADDRESS_QUALITY_LOW,
        severity: 'MEDIUM',
        description: 'Invalid or unmapped pincode',
        value: address.pincode,
      });
      riskScore += 15;
    } else {
      address.isDeliverable = pincodeData.deliveryAvailable;
      address.deliveryRisk = pincodeData.deliveryRisk;

      if (pincodeData.deliveryRisk === 'HIGH') {
        riskScore += 10;
      }

      // Fill in city/state from pincode if missing
      if (!address.city) address.city = pincodeData.city;
      if (!address.state) address.state = pincodeData.state;
    }

    // High value order to new address
    if (isNewAddress && orderValue && orderValue > 5000) {
      signals.push({
        type: FraudSignalType.HIGH_VALUE_ORDER,
        severity: 'MEDIUM',
        description: `High value order (₹${orderValue}) to new address`,
        value: orderValue,
      });
      riskScore += 15;
    }

    // Suspicious address patterns
    if (address.fullAddress) {
      for (const pattern of this.SUSPICIOUS_PATTERNS) {
        if (pattern.test(address.fullAddress)) {
          signals.push({
            type: FraudSignalType.ADDRESS_QUALITY_LOW,
            severity: 'MEDIUM',
            description: 'Suspicious address pattern detected',
            value: pattern.source,
          });
          riskScore += 10;
          break;
        }
      }
    }

    // Check for deliverability
    if (!address.isDeliverable) {
      signals.push({
        type: FraudSignalType.ADDRESS_QUALITY_LOW,
        severity: 'CRITICAL',
        description: 'Address not deliverable',
        value: false,
      });
      riskScore += 30;
    }

    const isValid = qualityScore >= 50 && address.isDeliverable !== false;

    logger.info('Address validation complete', {
      addressHash: addressHash.substring(0, 8),
      qualityScore,
      isNewAddress,
      isValid,
      riskScore,
      signalsCount: signals.length,
    });

    return {
      isValid,
      addressData: address as AddressData,
      signals,
      riskScore: Math.min(100, riskScore),
      hash: addressHash,
    };
  }

  /**
   * Compare billing and shipping address
   */
  compareBillingShipping(
    shippingHash: string,
    billingHash?: string
  ): { matches: boolean; riskAdjustment: number } {
    if (!billingHash) {
      return { matches: false, riskAdjustment: 5 };
    }

    const matches = shippingHash === billingHash;

    return {
      matches,
      riskAdjustment: matches ? 0 : 10,
    };
  }
}

export const addressValidationService = new AddressValidationService();
