// Risk tiers based on score thresholds
export enum RiskTier {
  LOW = 'LOW',      // 0-30
  MEDIUM = 'MEDIUM', // 31-60
  HIGH = 'HIGH'     // 61-100
}

// COD decision outcomes
export enum CODDecision {
  APPROVED = 'APPROVED',
  BLOCKED = 'BLOCKED',
  PARTIAL_ADVANCE = 'PARTIAL_ADVANCE',
  REVIEW = 'REVIEW'
}

// Fraud signal types
export enum FraudSignalType {
  NEW_DEVICE = 'NEW_DEVICE',
  NEW_ADDRESS = 'NEW_ADDRESS',
  FIRST_COD_ORDER = 'FIRST_COD_ORDER',
  HIGH_VALUE_ORDER = 'HIGH_VALUE_ORDER',
  UNUSUAL_LOCATION = 'UNUSUAL_LOCATION',
  DEVICE_FINGERPRINT_MISMATCH = 'DEVICE_FINGERPRINT_MISMATCH',
  ADDRESS_QUALITY_LOW = 'ADDRESS_QUALITY_LOW',
  BEHAVIOR_ANOMALY = 'BEHAVIOR_ANOMALY',
  RAPID_ORDERING = 'RAPID_ORDERING',
  IP_PROXY = 'IP_PROXY'
}

// Interface for device fingerprint data
export interface DeviceFingerprint {
  fingerprintId: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  canvasHash: string;
  webglHash: string;
  audioHash: string;
  ipAddress: string;
  country: string;
  city: string;
  isp: string;
  isProxy: boolean;
  firstSeen: Date;
  lastSeen: Date;
  totalOrders: number;
  successfulOrders: number;
  returnedOrders: number;
  codOrders: number;
  codReturnRate: number;
}

// Interface for address data
export interface AddressData {
  fullAddress: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  qualityScore: number; // 0-100
  isDeliverable: boolean;
  deliveryRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Interface for order data
export interface OrderData {
  orderId: string;
  userId: string;
  orderValue: number;
  codAmount: number;
  itemCount: number;
  itemCategories: string[];
  shippingAddress: AddressData;
  billingAddress?: AddressData;
  deviceFingerprint: DeviceFingerprint;
  isNewDevice: boolean;
  isNewAddress: boolean;
  isFirstCOD: boolean;
  orderHistory: {
    totalOrders: number;
    completedOrders: number;
    returnedOrders: number;
    codOrders: number;
    avgOrderValue: number;
    codReturnRate: number;
  };
}

// Risk scoring result
export interface RiskScoreResult {
  orderId: string;
  userId: string;
  riskScore: number;
  riskTier: RiskTier;
  factors: RiskFactor[];
  signals: FraudSignal[];
  deviceScore: number;
  addressScore: number;
  behaviorScore: number;
  orderScore: number;
  recommendations: string[];
  analyzedAt: Date;
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface FraudSignal {
  type: FraudSignalType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  value: string | number | boolean;
}

// COD decision result
export interface CODDecisionResult {
  orderId: string;
  userId: string;
  decision: CODDecision;
  riskScore: number;
  riskTier: RiskTier;
  partialAdvanceAmount?: number;
  partialAdvancePercentage?: number;
  reason: string;
  conditions?: string[];
  expiresAt: Date;
}

// Verification result
export interface VerificationResult {
  orderId: string;
  verified: boolean;
  checks: VerificationCheck[];
  overallConfidence: number;
  recommendations: string[];
  verifiedAt: Date;
}

export interface VerificationCheck {
  checkType: string;
  passed: boolean;
  details: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

// API request/response types
export interface ScoreRequest {
  orderId: string;
  userId: string;
  orderValue: number;
  codAmount: number;
  itemCount: number;
  itemCategories: string[];
  shippingAddress: AddressData;
  billingAddress?: AddressData;
  fingerprintData: Partial<DeviceFingerprint>;
  userIp: string;
  userAgent: string;
  orderHistory?: OrderData['orderHistory'];
}

export interface VerifyRequest {
  orderId: string;
  userId: string;
  verificationChecks: string[];
}

export interface DecisionRequest {
  orderId: string;
  userId: string;
  orderValue: number;
  codAmount: number;
}
