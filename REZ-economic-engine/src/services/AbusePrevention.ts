/**
 * Abuse Prevention Service
 *
 * Comprehensive anti-abuse system for cashback/rewards platform
 *
 * Features:
 * - Device fingerprinting
 * - Account creation velocity limits
 * - Reward claim abuse prevention
 * - Promo code abuse detection
 * - Multi-account detection
 * - VPN/proxy detection hooks
 */

import { createHash } from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AbuseCheckResult {
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  triggeredRules: AbuseRule[];
  action: 'allow' | 'flag' | 'challenge' | 'block';
  metadata: Record<string, unknown>;
  processingTimeMs: number;
  timestamp: string;
}

export interface AbuseRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
}

export interface DeviceFingerprint {
  deviceId: string;
  fingerprint: string;
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  ip: string;
  ipHash: string;
  firstSeen: Date;
  lastSeen: Date;
  riskScore: number;
  tags: string[];
}

export interface AccountVelocity {
  userId: string;
  deviceId: string;
  ip: string;
  accountCreations: number;
  firstCreation: Date;
  lastCreation: Date;
  flagged: boolean;
}

export interface RewardClaim {
  userId: string;
  rewardId: string;
  campaignId: string;
  amount: number;
  claimedAt: Date;
  deviceId: string;
  ip: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
}

export interface PromoCodeUsage {
  code: string;
  userId: string;
  usedAt: Date;
  ip: string;
  deviceId: string;
  orderId?: string;
  discount: number;
  status: 'valid' | 'abused' | 'expired';
}

export interface MultiAccountGroup {
  groupId: string;
  accounts: string[];
  sharedSignals: SharedSignal[];
  riskScore: number;
  createdAt: Date;
}

export interface SharedSignal {
  type: 'ip' | 'device' | 'payment_method' | 'email_pattern' | 'phone_pattern';
  value: string;
  strength: number;
  firstSeen: Date;
}

export interface VPNProxyCheck {
  ip: string;
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDataCenter: boolean;
  isResidential: boolean;
  provider?: string;
  riskScore: number;
  country?: string;
  asn?: string;
  lastSeen?: Date;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface AbusePreventionConfig {
  deviceFingerprinting: {
    enabled: boolean;
    hashAlgorithm: 'sha256' | 'sha512';
    minEntropyBits: number;
    trackScreenRes: boolean;
    trackTimezone: boolean;
    trackLanguage: boolean;
  };
  accountVelocity: {
    enabled: boolean;
    maxAccountsPerDevice: number;
    maxAccountsPerIP: number;
    maxAccountsPerEmailDomain: number;
    windowMinutes: number;
    banAfterViolations: number;
  };
  rewardClaims: {
    enabled: boolean;
    maxClaimsPerUser: number;
    maxClaimsPerDevice: number;
    maxClaimsPerIP: number;
    claimWindowHours: number;
    minTimeBetweenClaims: number;
    suspiciousAmountThreshold: number;
  };
  promoCodes: {
    enabled: boolean;
    maxUsesPerCode: number;
    maxUsesPerUser: number;
    maxUsesPerDevice: number;
    maxUsesPerIP: number;
    timeWindowMinutes: number;
    detectCodeGuessing: boolean;
    codeEntropyBits: number;
  };
  multiAccount: {
    enabled: boolean;
    similarityThreshold: number;
    sharedIPWeight: number;
    sharedDeviceWeight: number;
    sharedPaymentWeight: number;
    maxGroupSize: number;
  };
  vpnProxy: {
    enabled: boolean;
    checkVPN: boolean;
    checkProxy: boolean;
    checkTor: boolean;
    checkDataCenter: boolean;
    ipIntelApiKey?: string;
    cacheTTLMinutes: number;
    blockVPN: boolean;
    blockProxy: boolean;
    blockTor: boolean;
  };
  socialSharing: {
    enabled: boolean;
    platforms: string[];
    minViews: number;
    minClicks: number;
    cooldownMinutes: number;
    maxRewardsPerDay: number;
  };
  velocity: {
    maxTransactionsPerHour: number;
    maxSharesPerDay: number;
  };
  scoring: {
    deviceWeight: number;
    velocityWeight: number;
    vpnWeight: number;
    multiAccountWeight: number;
    promoWeight: number;
    claimWeight: number;
  };
}

export const DEFAULT_ABUSE_CONFIG: AbusePreventionConfig = {
  deviceFingerprinting: {
    enabled: true,
    hashAlgorithm: 'sha256',
    minEntropyBits: 32,
    trackScreenRes: true,
    trackTimezone: true,
    trackLanguage: true,
  },
  accountVelocity: {
    enabled: true,
    maxAccountsPerDevice: 3,
    maxAccountsPerIP: 5,
    maxAccountsPerEmailDomain: 10,
    windowMinutes: 60,
    banAfterViolations: 3,
  },
  rewardClaims: {
    enabled: true,
    maxClaimsPerUser: 100,
    maxClaimsPerDevice: 50,
    maxClaimsPerIP: 30,
    claimWindowHours: 24,
    minTimeBetweenClaims: 1000,
    suspiciousAmountThreshold: 1000,
  },
  promoCodes: {
    enabled: true,
    maxUsesPerCode: 1000,
    maxUsesPerUser: 5,
    maxUsesPerDevice: 3,
    maxUsesPerIP: 5,
    timeWindowMinutes: 60,
    detectCodeGuessing: true,
    codeEntropyBits: 32,
  },
  multiAccount: {
    enabled: true,
    similarityThreshold: 0.6,
    sharedIPWeight: 0.3,
    sharedDeviceWeight: 0.4,
    sharedPaymentWeight: 0.3,
    maxGroupSize: 10,
  },
  vpnProxy: {
    enabled: true,
    checkVPN: true,
    checkProxy: true,
    checkTor: true,
    checkDataCenter: true,
    cacheTTLMinutes: 60,
    blockVPN: false,
    blockProxy: false,
    blockTor: true,
  },
  socialSharing: {
    enabled: true,
    platforms: ['facebook', 'twitter', 'whatsapp', 'instagram', 'telegram'],
    minViews: 10,
    minClicks: 1,
    cooldownMinutes: 5,
    maxRewardsPerDay: 20,
  },
  velocity: {
    maxTransactionsPerHour: 10,
    maxSharesPerDay: 50,
  },
  scoring: {
    deviceWeight: 0.15,
    velocityWeight: 0.20,
    vpnWeight: 0.25,
    multiAccountWeight: 0.25,
    promoWeight: 0.10,
    claimWeight: 0.05,
  },
};

// Legacy config format for backward compatibility
export interface AbusePrevention {
  deviceLimits: {
    maxAccountsPerDevice: number;
    maxAccountsPerIP: number;
  };
  socialSharing: {
    platforms: string[];
    minViews: number;
    minClicks: number;
    cooldownMinutes: number;
    maxRewardsPerDay: number;
  };
  velocity: {
    maxTransactionsPerHour: number;
    maxSharesPerDay: number;
  };
}

export const DEFAULT_ABUSE_PREVENTION: AbusePrevention = {
  deviceLimits: {
    maxAccountsPerDevice: 3,
    maxAccountsPerIP: 5,
  },
  socialSharing: DEFAULT_ABUSE_CONFIG.socialSharing,
  velocity: DEFAULT_ABUSE_CONFIG.velocity,
};

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

export interface AbuseStorage {
  getDeviceFingerprint(deviceId: string): Promise<DeviceFingerprint | null>;
  saveDeviceFingerprint(fp: DeviceFingerprint): Promise<void>;
  getDevicesByIP(ip: string): Promise<DeviceFingerprint[]>;
  getAccountVelocity(userId: string): Promise<AccountVelocity | null>;
  saveAccountVelocity(velocity: AccountVelocity): Promise<void>;
  getAccountVelocityByDevice(deviceId: string): Promise<AccountVelocity[]>;
  getAccountVelocityByIP(ip: string): Promise<AccountVelocity[]>;
  getRewardClaims(userId: string, windowHours: number): Promise<RewardClaim[]>;
  getRewardClaimsByDevice(deviceId: string, windowHours: number): Promise<RewardClaim[]>;
  getRewardClaimsByIP(ip: string, windowHours: number): Promise<RewardClaim[]>;
  saveRewardClaim(claim: RewardClaim): Promise<void>;
  getPromoUsage(code: string): Promise<PromoCodeUsage[]>;
  getPromoUsageByUser(userId: string, windowMinutes: number): Promise<PromoCodeUsage[]>;
  getPromoUsageByDevice(deviceId: string, windowMinutes: number): Promise<PromoCodeUsage[]>;
  savePromoUsage(usage: PromoCodeUsage): Promise<void>;
  getMultiAccountGroup(userId: string): Promise<MultiAccountGroup | null>;
  getMultiAccountGroupBySignal(signal: SharedSignal): Promise<MultiAccountGroup[]>;
  saveMultiAccountGroup(group: MultiAccountGroup): Promise<void>;
  getVPNProxyCheck(ip: string): Promise<VPNProxyCheck | null>;
  saveVPNProxyCheck(check: VPNProxyCheck): Promise<void>;
  incrementCounter(key: string, ttlSeconds: number): Promise<number>;
  getCounter(key: string): Promise<number>;
}

// ============================================================================
// DEVICE FINGERPRINTING SERVICE
// ============================================================================

export class DeviceFingerprintService {
  private config: AbusePreventionConfig['deviceFingerprinting'];
  private storage: AbuseStorage | null;

  constructor(storage?: AbuseStorage | null, config?: Partial<AbusePreventionConfig['deviceFingerprinting']>) {
    this.config = { ...DEFAULT_ABUSE_CONFIG.deviceFingerprinting, ...config };
    this.storage = storage || null;
  }

  generateFingerprint(data: {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
    ip: string;
  }): string {
    const components: string[] = [data.userAgent];
    if (this.config.trackScreenRes && data.screenResolution) components.push(data.screenResolution);
    if (this.config.trackTimezone && data.timezone) components.push(data.timezone);
    if (this.config.trackLanguage && data.language) components.push(data.language);
    if (data.platform) components.push(data.platform);

    const raw = components.join('|');
    const hash = this.config.hashAlgorithm === 'sha256'
      ? createHash('sha256')
      : createHash('sha512');
    return hash.update(raw).digest('hex');
  }

  hashIP(ip: string, salt: string = ''): string {
    return createHash('sha256')
      .update(`${ip}:${salt}`)
      .digest('hex')
      .substring(0, 16);
  }

  calculateEntropy(fingerprint: string): number {
    return fingerprint.length * 4;
  }

  validateEntropy(fingerprint: string): boolean {
    return this.calculateEntropy(fingerprint) >= this.config.minEntropyBits;
  }

  async registerDevice(data: {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
    ip: string;
  }): Promise<DeviceFingerprint> {
    const fingerprint = this.generateFingerprint(data);
    const ipHash = this.hashIP(data.ip);
    const deviceId = createHash('sha256')
      .update(`${fingerprint}:${data.ip}`)
      .digest('hex')
      .substring(0, 24);

    const now = new Date();
    const existing = this.storage ? await this.storage.getDeviceFingerprint(deviceId) : null;

    const record: DeviceFingerprint = {
      deviceId,
      fingerprint,
      userAgent: data.userAgent,
      screenResolution: data.screenResolution,
      timezone: data.timezone,
      language: data.language,
      platform: data.platform,
      ip: data.ip,
      ipHash,
      firstSeen: existing?.firstSeen || now,
      lastSeen: now,
      riskScore: existing?.riskScore || 0,
      tags: existing?.tags || [],
    };

    if (this.storage) {
      await this.storage.saveDeviceFingerprint(record);
    }
    return record;
  }

  async isNewDevice(deviceId: string): Promise<boolean> {
    if (!this.storage) return true;
    const existing = await this.storage.getDeviceFingerprint(deviceId);
    return !existing;
  }

  async getRelatedDevices(ip: string): Promise<DeviceFingerprint[]> {
    if (!this.storage) return [];
    return this.storage.getDevicesByIP(ip);
  }

  async addDeviceRisk(deviceId: string, delta: number, reason: string): Promise<void> {
    if (!this.storage) return;
    const existing = await this.storage.getDeviceFingerprint(deviceId);
    if (existing) {
      existing.riskScore = Math.min(1, Math.max(0, existing.riskScore + delta));
      existing.tags.push(reason);
      await this.storage.saveDeviceFingerprint(existing);
    }
  }
}

// ============================================================================
// ACCOUNT VELOCITY SERVICE
// ============================================================================

export class AccountVelocityService {
  private config: AbusePreventionConfig['accountVelocity'];
  private storage: AbuseStorage | null;

  constructor(storage?: AbuseStorage | null, config?: Partial<AbusePreventionConfig['accountVelocity']>) {
    this.config = { ...DEFAULT_ABUSE_CONFIG.accountVelocity, ...config };
    this.storage = storage || null;
  }

  async recordCreation(userId: string, deviceId: string, ip: string): Promise<void> {
    const existing = this.storage ? await this.storage.getAccountVelocity(userId) : null;
    const now = new Date();

    const velocity: AccountVelocity = {
      userId,
      deviceId,
      ip,
      accountCreations: (existing?.accountCreations || 0) + 1,
      firstCreation: existing?.firstCreation || now,
      lastCreation: now,
      flagged: existing?.flagged || false,
    };

    if (this.storage) {
      await this.storage.saveAccountVelocity(velocity);
      await this.storage.incrementCounter(`velocity:device:${deviceId}`, this.config.windowMinutes * 60);
      await this.storage.incrementCounter(`velocity:ip:${ip}`, this.config.windowMinutes * 60);
    }
  }

  async checkCreation(userId: string, deviceId: string, ip: string): Promise<AbuseCheckResult> {
    const startTime = Date.now();
    const rules: AbuseRule[] = [];
    let riskLevel: AbuseCheckResult['riskLevel'] = 'low';
    let passed = true;

    if (!this.storage) {
      return this.createResult(passed, riskLevel, rules, {}, startTime);
    }

    const deviceVelocity = await this.storage.getAccountVelocityByDevice(deviceId);
    const recentDeviceCreations = deviceVelocity.filter(
      v => Date.now() - v.lastCreation.getTime() < this.config.windowMinutes * 60 * 1000
    );

    if (recentDeviceCreations.length >= this.config.maxAccountsPerDevice) {
      rules.push({
        id: 'MAX_ACCOUNTS_PER_DEVICE',
        name: 'Max Accounts Per Device',
        description: 'Too many accounts created from this device',
        severity: 'critical',
        details: `${recentDeviceCreations.length}/${this.config.maxAccountsPerDevice} in ${this.config.windowMinutes} minutes`,
      });
      riskLevel = 'critical';
      passed = false;
    }

    const ipVelocity = await this.storage.getAccountVelocityByIP(ip);
    const recentIPCcreations = ipVelocity.filter(
      v => Date.now() - v.lastCreation.getTime() < this.config.windowMinutes * 60 * 1000
    );

    if (recentIPCcreations.length >= this.config.maxAccountsPerIP) {
      rules.push({
        id: 'MAX_ACCOUNTS_PER_IP',
        name: 'Max Accounts Per IP',
        description: 'Too many accounts created from this IP',
        severity: 'critical',
        details: `${recentIPCcreations.length}/${this.config.maxAccountsPerIP} in ${this.config.windowMinutes} minutes`,
      });
      riskLevel = 'critical';
      passed = false;
    }

    const userVelocity = await this.storage.getAccountVelocity(userId);
    if (userVelocity?.flagged) {
      rules.push({
        id: 'USER_FLAGGED',
        name: 'User Flagged',
        description: 'User has been flagged for previous abuse',
        severity: 'high',
      });
      riskLevel = 'high';
    }

    return this.createResult(passed, riskLevel, rules, {
      deviceCreations: recentDeviceCreations.length,
      ipCreations: recentIPCcreations.length,
    }, startTime);
  }

  async flagUser(userId: string): Promise<void> {
    if (!this.storage) return;
    const existing = await this.storage.getAccountVelocity(userId);
    if (existing) {
      existing.flagged = true;
      await this.storage.saveAccountVelocity(existing);
    }
  }

  async getStats(userId: string): Promise<{ totalCreations: number; recentCreations: number; isFlagged: boolean }> {
    if (!this.storage) return { totalCreations: 0, recentCreations: 0, isFlagged: false };
    const velocity = await this.storage.getAccountVelocity(userId);
    if (!velocity) return { totalCreations: 0, recentCreations: 0, isFlagged: false };
    return {
      totalCreations: velocity.accountCreations,
      recentCreations: velocity.accountCreations - 1,
      isFlagged: velocity.flagged,
    };
  }

  private createResult(
    passed: boolean,
    riskLevel: AbuseCheckResult['riskLevel'],
    rules: AbuseRule[],
    metadata: Record<string, unknown>,
    startTime: number
  ): AbuseCheckResult {
    return {
      passed,
      riskLevel,
      triggeredRules: rules,
      action: this.getAction(riskLevel),
      metadata,
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  private getAction(riskLevel: AbuseCheckResult['riskLevel']): AbuseCheckResult['action'] {
    switch (riskLevel) {
      case 'critical': return 'block';
      case 'high': return 'block';
      case 'medium': return 'challenge';
      default: return 'allow';
    }
  }
}

// ============================================================================
// REWARD CLAIM SERVICE
// ============================================================================

export class RewardClaimService {
  private config: AbusePreventionConfig['rewardClaims'];
  private storage: AbuseStorage | null;

  constructor(storage?: AbuseStorage | null, config?: Partial<AbusePreventionConfig['rewardClaims']>) {
    this.config = { ...DEFAULT_ABUSE_CONFIG.rewardClaims, ...config };
    this.storage = storage || null;
  }

  async recordClaim(claim: Omit<RewardClaim, 'status'>): Promise<RewardClaim> {
    const fullClaim: RewardClaim = { ...claim, status: 'pending' };
    if (this.storage) {
      await this.storage.saveRewardClaim(fullClaim);
      await this.storage.incrementCounter(`claims:user:${claim.userId}`, this.config.claimWindowHours * 3600);
      await this.storage.incrementCounter(`claims:device:${claim.deviceId}`, this.config.claimWindowHours * 3600);
      await this.storage.incrementCounter(`claims:ip:${claim.ip}`, this.config.claimWindowHours * 3600);
    }
    return fullClaim;
  }

  async checkClaim(claim: Omit<RewardClaim, 'status'>): Promise<AbuseCheckResult> {
    const startTime = Date.now();
    const rules: AbuseRule[] = [];
    let riskLevel: AbuseCheckResult['riskLevel'] = 'low';
    let passed = true;

    if (!this.storage) {
      return this.createResult(passed, riskLevel, rules, {}, startTime);
    }

    const userClaims = await this.storage.getRewardClaims(claim.userId, this.config.claimWindowHours);
    if (userClaims.length >= this.config.maxClaimsPerUser) {
      rules.push({
        id: 'MAX_CLAIMS_PER_USER',
        name: 'Max Claims Per User',
        description: 'User has claimed too many rewards',
        severity: 'high',
        details: `${userClaims.length}/${this.config.maxClaimsPerUser} in ${this.config.claimWindowHours}h`,
      });
      riskLevel = 'high';
      passed = false;
    }

    const deviceClaims = await this.storage.getRewardClaimsByDevice(claim.deviceId, this.config.claimWindowHours);
    if (deviceClaims.length >= this.config.maxClaimsPerDevice) {
      rules.push({
        id: 'MAX_CLAIMS_PER_DEVICE',
        name: 'Max Claims Per Device',
        description: 'Device has claimed too many rewards',
        severity: 'critical',
        details: `${deviceClaims.length}/${this.config.maxClaimsPerDevice} in ${this.config.claimWindowHours}h`,
      });
      riskLevel = 'critical';
      passed = false;
    }

    const ipClaims = await this.storage.getRewardClaimsByIP(claim.ip, this.config.claimWindowHours);
    if (ipClaims.length >= this.config.maxClaimsPerIP) {
      rules.push({
        id: 'MAX_CLAIMS_PER_IP',
        name: 'Max Claims Per IP',
        description: 'IP address has claimed too many rewards',
        severity: 'critical',
        details: `${ipClaims.length}/${this.config.maxClaimsPerIP} in ${this.config.claimWindowHours}h`,
      });
      riskLevel = 'critical';
      passed = false;
    }

    const lastClaim = userClaims[userClaims.length - 1];
    if (lastClaim) {
      const timeSinceLastClaim = Date.now() - lastClaim.claimedAt.getTime();
      if (timeSinceLastClaim < this.config.minTimeBetweenClaims) {
        rules.push({
          id: 'MIN_TIME_BETWEEN_CLAIMS',
          name: 'Min Time Between Claims',
          description: 'Claims submitted too quickly',
          severity: 'medium',
          details: `${timeSinceLastClaim}ms since last claim`,
        });
        if (riskLevel !== 'critical') riskLevel = 'medium';
      }
    }

    if (claim.amount > this.config.suspiciousAmountThreshold) {
      rules.push({
        id: 'SUSPICIOUS_AMOUNT',
        name: 'Suspicious Reward Amount',
        description: 'Reward amount exceeds threshold',
        severity: 'medium',
        details: `Amount: ${claim.amount}, threshold: ${this.config.suspiciousAmountThreshold}`,
      });
      if (riskLevel !== 'critical') riskLevel = 'medium';
    }

    return this.createResult(passed, riskLevel, rules, {
      userClaimCount: userClaims.length,
      deviceClaimCount: deviceClaims.length,
      ipClaimCount: ipClaims.length,
    }, startTime);
  }

  async updateClaimStatus(claimId: string, userId: string, status: RewardClaim['status']): Promise<void> {
    if (!this.storage) return;
    const claims = await this.storage.getRewardClaims(userId, this.config.claimWindowHours);
    const claim = claims.find(c => c.rewardId === claimId);
    if (claim) {
      claim.status = status;
      await this.storage.saveRewardClaim(claim);
    }
  }

  private createResult(
    passed: boolean,
    riskLevel: AbuseCheckResult['riskLevel'],
    rules: AbuseRule[],
    metadata: Record<string, unknown>,
    startTime: number
  ): AbuseCheckResult {
    return {
      passed,
      riskLevel,
      triggeredRules: rules,
      action: this.getAction(riskLevel),
      metadata,
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  private getAction(riskLevel: AbuseCheckResult['riskLevel']): AbuseCheckResult['action'] {
    switch (riskLevel) {
      case 'critical': return 'block';
      case 'high': return 'block';
      case 'medium': return 'challenge';
      default: return 'allow';
    }
  }
}

// ============================================================================
// PROMO CODE SERVICE
// ============================================================================

export class PromoCodeService {
  private config: AbusePreventionConfig['promoCodes'];
  private storage: AbuseStorage | null;

  constructor(storage?: AbuseStorage | null, config?: Partial<AbusePreventionConfig['promoCodes']>) {
    this.config = { ...DEFAULT_ABUSE_CONFIG.promoCodes, ...config };
    this.storage = storage || null;
  }

  async recordUsage(usage: Omit<PromoCodeUsage, 'status'>): Promise<PromoCodeUsage> {
    const fullUsage: PromoCodeUsage = { ...usage, status: 'valid' };
    if (this.storage) {
      await this.storage.savePromoUsage(fullUsage);
      await this.storage.incrementCounter(`promo:code:${usage.code}`, this.config.timeWindowMinutes * 60);
      await this.storage.incrementCounter(`promo:user:${usage.userId}`, this.config.timeWindowMinutes * 60);
      await this.storage.incrementCounter(`promo:device:${usage.deviceId}`, this.config.timeWindowMinutes * 60);
      await this.storage.incrementCounter(`promo:ip:${usage.ip}`, this.config.timeWindowMinutes * 60);
    }
    return fullUsage;
  }

  async checkUsage(usage: Omit<PromoCodeUsage, 'status'>): Promise<AbuseCheckResult> {
    const startTime = Date.now();
    const rules: AbuseRule[] = [];
    let riskLevel: AbuseCheckResult['riskLevel'] = 'low';
    let passed = true;

    if (!this.storage) {
      return this.createResult(passed, riskLevel, rules, {}, startTime);
    }

    const codeUsages = await this.storage.getPromoUsage(usage.code);
    const recentCodeUsages = codeUsages.filter(
      u => Date.now() - u.usedAt.getTime() < this.config.timeWindowMinutes * 60 * 1000
    );

    if (recentCodeUsages.length >= this.config.maxUsesPerCode) {
      rules.push({
        id: 'MAX_USES_PER_CODE',
        name: 'Max Uses Per Code',
        description: 'Promo code has been used too many times',
        severity: 'high',
        details: `${recentCodeUsages.length}/${this.config.maxUsesPerCode} in ${this.config.timeWindowMinutes}min`,
      });
      riskLevel = 'high';
      passed = false;
    }

    const userUsages = await this.storage.getPromoUsageByUser(usage.userId, this.config.timeWindowMinutes);
    const userCodeCount = userUsages.filter(u => u.code === usage.code).length;

    if (userCodeCount >= this.config.maxUsesPerUser) {
      rules.push({
        id: 'MAX_USES_PER_USER',
        name: 'Max Uses Per User',
        description: 'User has used this code too many times',
        severity: 'high',
        details: `${userCodeCount}/${this.config.maxUsesPerUser} in ${this.config.timeWindowMinutes}min`,
      });
      riskLevel = 'high';
      passed = false;
    }

    const deviceUsages = await this.storage.getPromoUsageByDevice(usage.deviceId, this.config.timeWindowMinutes);
    const deviceCodeCount = deviceUsages.filter(u => u.code === usage.code).length;

    if (deviceCodeCount >= this.config.maxUsesPerDevice) {
      rules.push({
        id: 'MAX_USES_PER_DEVICE',
        name: 'Max Uses Per Device',
        description: 'Device has used this code too many times',
        severity: 'critical',
        details: `${deviceCodeCount}/${this.config.maxUsesPerDevice} in ${this.config.timeWindowMinutes}min`,
      });
      riskLevel = 'critical';
      passed = false;
    }

    if (this.config.detectCodeGuessing && recentCodeUsages.length > 5) {
      const uniqueCodes = new Set(userUsages.map(u => u.code)).size;
      if (uniqueCodes > 10 && uniqueCodes / userUsages.length > 0.8) {
        rules.push({
          id: 'POSSIBLE_CODE_GUESSING',
          name: 'Possible Code Guessing',
          description: 'Multiple different codes attempted in short time',
          severity: 'medium',
          details: `${uniqueCodes} unique codes in ${userUsages.length} attempts`,
        });
        if (riskLevel !== 'critical' && riskLevel !== 'high') riskLevel = 'medium';
      }
    }

    return this.createResult(passed, riskLevel, rules, {
      codeUsageCount: recentCodeUsages.length,
      userCodeCount,
      deviceCodeCount,
    }, startTime);
  }

  generateSecureCode(prefix: string = 'REZ'): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const entropy = Math.ceil(this.config.codeEntropyBits / Math.log2(chars.length));
    let code = prefix;
    for (let i = 0; i < entropy; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  calculateCodeEntropy(code: string): number {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return code.length * Math.log2(chars.length);
  }

  async markAbused(code: string, userId: string): Promise<void> {
    if (!this.storage) return;
    const usages = await this.storage.getPromoUsage(code);
    const usage = usages.find(u => u.userId === userId);
    if (usage) {
      usage.status = 'abused';
      await this.storage.savePromoUsage(usage);
    }
  }

  private createResult(
    passed: boolean,
    riskLevel: AbuseCheckResult['riskLevel'],
    rules: AbuseRule[],
    metadata: Record<string, unknown>,
    startTime: number
  ): AbuseCheckResult {
    return {
      passed,
      riskLevel,
      triggeredRules: rules,
      action: this.getAction(riskLevel),
      metadata,
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  private getAction(riskLevel: AbuseCheckResult['riskLevel']): AbuseCheckResult['action'] {
    switch (riskLevel) {
      case 'critical': return 'block';
      case 'high': return 'block';
      case 'medium': return 'challenge';
      default: return 'allow';
    }
  }
}

// ============================================================================
// MULTI-ACCOUNT DETECTION SERVICE
// ============================================================================

export class MultiAccountDetectionService {
  private config: AbusePreventionConfig['multiAccount'];
  private storage: AbuseStorage | null;

  constructor(storage?: AbuseStorage | null, config?: Partial<AbusePreventionConfig['multiAccount']>) {
    this.config = { ...DEFAULT_ABUSE_CONFIG.multiAccount, ...config };
    this.storage = storage || null;
  }

  async checkNewAccount(newAccount: {
    userId: string;
    ip: string;
    deviceId: string;
    emailHash?: string;
    phoneHash?: string;
    paymentMethodHash?: string;
  }): Promise<AbuseCheckResult> {
    const startTime = Date.now();
    const rules: AbuseRule[] = [];
    let riskLevel: AbuseCheckResult['riskLevel'] = 'low';
    let passed = true;
    let similarityScore = 0;
    const signals: SharedSignal[] = [];

    if (this.storage) {
      const existingByIP = await this.storage.getAccountVelocityByIP(newAccount.ip);
      if (existingByIP.length > 0) {
        signals.push({
          type: 'ip',
          value: newAccount.ip,
          strength: this.config.sharedIPWeight,
          firstSeen: existingByIP[0].lastCreation,
        });
        similarityScore += this.config.sharedIPWeight;
      }

      const existingByDevice = await this.storage.getAccountVelocityByDevice(newAccount.deviceId);
      if (existingByDevice.length > 0) {
        signals.push({
          type: 'device',
          value: newAccount.deviceId,
          strength: this.config.sharedDeviceWeight,
          firstSeen: existingByDevice[0].lastCreation,
        });
        similarityScore += this.config.sharedDeviceWeight;
      }
    }

    const normalizedSimilarity = Math.min(1, similarityScore);

    if (normalizedSimilarity >= this.config.similarityThreshold) {
      rules.push({
        id: 'MULTI_ACCOUNT_SUSPECTED',
        name: 'Multi-Account Suspected',
        description: 'New account shares identifiers with existing accounts',
        severity: normalizedSimilarity > 0.8 ? 'critical' : 'high',
        details: `Similarity score: ${Math.round(normalizedSimilarity * 100)}%, signals: ${signals.length}`,
      });
      riskLevel = normalizedSimilarity > 0.8 ? 'critical' : 'high';
      passed = false;

      if (this.storage) {
        await this.createOrUpdateGroup(newAccount.userId, signals);
      }
    }

    return {
      passed,
      riskLevel,
      triggeredRules: rules,
      action: this.getAction(riskLevel),
      metadata: {
        similarityScore: normalizedSimilarity,
        sharedSignals: signals.map(s => s.type),
      },
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  async createOrUpdateGroup(userId: string, signals: SharedSignal[]): Promise<MultiAccountGroup | null> {
    if (!this.storage) return null;

    const existingGroup = await this.storage.getMultiAccountGroup(userId);
    const now = new Date();

    if (existingGroup) {
      const newAccounts = new Set([...existingGroup.accounts, userId]);
      const allSignals = [...existingGroup.sharedSignals];

      for (const signal of signals) {
        if (!allSignals.find(s => s.type === signal.type && s.value === signal.value)) {
          allSignals.push(signal);
        }
      }

      existingGroup.accounts = Array.from(newAccounts);
      existingGroup.sharedSignals = allSignals;
      existingGroup.riskScore = this.calculateGroupRiskScore(allSignals);

      await this.storage.saveMultiAccountGroup(existingGroup);
      return existingGroup;
    }

    const group: MultiAccountGroup = {
      groupId: createHash('sha256').update(`${userId}:${Date.now()}`).digest('hex').substring(0, 16),
      accounts: [userId],
      sharedSignals: signals,
      riskScore: this.calculateGroupRiskScore(signals),
      createdAt: now,
    };

    await this.storage.saveMultiAccountGroup(group);
    return group;
  }

  async getGroupAccounts(userId: string): Promise<string[]> {
    if (!this.storage) return [];
    const group = await this.storage.getMultiAccountGroup(userId);
    return group?.accounts || [];
  }

  private calculateGroupRiskScore(signals: SharedSignal[]): number {
    let score = 0;
    const strongSignals = signals.filter(s => s.strength >= 0.3);
    score += strongSignals.length * 0.2;
    const uniqueDevices = new Set(signals.filter(s => s.type === 'device').map(s => s.value)).size;
    const uniqueIPs = new Set(signals.filter(s => s.type === 'ip').map(s => s.value)).size;
    if (uniqueDevices > 3) score += 0.2;
    if (uniqueIPs > 5) score += 0.2;
    return Math.min(1, score);
  }

  private getAction(riskLevel: AbuseCheckResult['riskLevel']): AbuseCheckResult['action'] {
    switch (riskLevel) {
      case 'critical': return 'block';
      case 'high': return 'block';
      case 'medium': return 'challenge';
      default: return 'allow';
    }
  }
}

// ============================================================================
// VPN/PROXY DETECTION SERVICE
// ============================================================================

export interface VPNProxyHook {
  name: string;
  check: (ip: string) => Promise<VPNProxyCheck>;
}

export class VPNProxyDetectionService {
  private config: AbusePreventionConfig['vpnProxy'];
  private storage: AbuseStorage | null;
  private hooks: VPNProxyHook[] = [];

  constructor(storage?: AbuseStorage | null, config?: Partial<AbusePreventionConfig['vpnProxy']>) {
    this.config = { ...DEFAULT_ABUSE_CONFIG.vpnProxy, ...config };
    this.storage = storage || null;
  }

  registerHook(hook: VPNProxyHook): void {
    this.hooks.push(hook);
  }

  async checkIP(ip: string): Promise<VPNProxyCheck> {
    if (this.storage) {
      const cached = await this.storage.getVPNProxyCheck(ip);
      if (cached) {
        const cacheAge = Date.now() - (cached.lastSeen?.getTime() || 0);
        const maxAge = this.config.cacheTTLMinutes * 60 * 1000;
        if (cacheAge < maxAge) return cached;
      }
    }

    const results: VPNProxyCheck[] = [];
    for (const hook of this.hooks) {
      try {
        const result = await hook.check(ip);
        results.push(result);
      } catch (error) {
        console.error(`VPN/Proxy hook ${hook.name} failed:`, error);
      }
    }

    const merged: VPNProxyCheck = {
      ip,
      isVPN: false,
      isProxy: false,
      isTor: false,
      isDataCenter: false,
      isResidential: true,
      riskScore: 0,
    };

    for (const result of results) {
      merged.isVPN = merged.isVPN || result.isVPN;
      merged.isProxy = merged.isProxy || result.isProxy;
      merged.isTor = merged.isTor || result.isTor;
      merged.isDataCenter = merged.isDataCenter || result.isDataCenter;
      merged.isResidential = merged.isResidential && result.isResidential;
      merged.riskScore = Math.max(merged.riskScore, result.riskScore);
      merged.country = result.country || merged.country;
      merged.asn = result.asn || merged.asn;
      merged.provider = result.provider || merged.provider;
    }

    merged.lastSeen = new Date();
    if (this.storage) {
      await this.storage.saveVPNProxyCheck(merged);
    }

    return merged;
  }

  async checkAndBlock(ip: string): Promise<AbuseCheckResult> {
    const startTime = Date.now();
    const check = await this.checkIP(ip);
    const rules: AbuseRule[] = [];
    let riskLevel: AbuseCheckResult['riskLevel'] = 'low';
    let passed = true;

    if (this.config.checkVPN && this.config.blockVPN && check.isVPN) {
      rules.push({
        id: 'VPN_DETECTED',
        name: 'VPN Detected',
        description: 'Connection from VPN provider',
        severity: 'high',
        details: check.provider ? `Provider: ${check.provider}` : undefined,
      });
      riskLevel = 'high';
      passed = false;
    }

    if (this.config.checkProxy && this.config.blockProxy && check.isProxy) {
      rules.push({
        id: 'PROXY_DETECTED',
        name: 'Proxy Detected',
        description: 'Connection from proxy server',
        severity: 'high',
        details: check.provider ? `Provider: ${check.provider}` : undefined,
      });
      riskLevel = 'high';
      passed = false;
    }

    if (this.config.checkTor && this.config.blockTor && check.isTor) {
      rules.push({
        id: 'TOR_DETECTED',
        name: 'Tor Detected',
        description: 'Connection from Tor exit node',
        severity: 'critical',
      });
      riskLevel = 'critical';
      passed = false;
    }

    if (this.config.checkDataCenter && check.isDataCenter) {
      rules.push({
        id: 'DATACENTER_IP',
        name: 'Data Center IP',
        description: 'IP address belongs to data center',
        severity: 'medium',
      });
      if (riskLevel !== 'critical' && riskLevel !== 'high') riskLevel = 'medium';
    }

    return {
      passed,
      riskLevel,
      triggeredRules: rules,
      action: this.getAction(riskLevel),
      metadata: {
        isVPN: check.isVPN,
        isProxy: check.isProxy,
        isTor: check.isTor,
        isDataCenter: check.isDataCenter,
        provider: check.provider,
      },
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  private getAction(riskLevel: AbuseCheckResult['riskLevel']): AbuseCheckResult['action'] {
    switch (riskLevel) {
      case 'critical': return 'block';
      case 'high': return 'block';
      case 'medium': return 'challenge';
      default: return 'allow';
    }
  }
}

// ============================================================================
// COMBINED ABUSE PREVENTION SERVICE
// ============================================================================

export class AbusePreventionService {
  private deviceService: DeviceFingerprintService;
  private velocityService: AccountVelocityService;
  private claimService: RewardClaimService;
  private promoService: PromoCodeService;
  private multiAccountService: MultiAccountDetectionService;
  private vpnProxyService: VPNProxyDetectionService;
  private config: AbusePreventionConfig;
  private storage: AbuseStorage | null;

  constructor(storage?: AbuseStorage | null, config?: Partial<AbusePreventionConfig>) {
    this.storage = storage || null;
    this.config = { ...DEFAULT_ABUSE_CONFIG, ...config };

    this.deviceService = new DeviceFingerprintService(this.storage, this.config.deviceFingerprinting);
    this.velocityService = new AccountVelocityService(this.storage, this.config.accountVelocity);
    this.claimService = new RewardClaimService(this.storage, this.config.rewardClaims);
    this.promoService = new PromoCodeService(this.storage, this.config.promoCodes);
    this.multiAccountService = new MultiAccountDetectionService(this.storage, this.config.multiAccount);
    this.vpnProxyService = new VPNProxyDetectionService(this.storage, this.config.vpnProxy);
  }

  getDeviceService(): DeviceFingerprintService { return this.deviceService; }
  getVelocityService(): AccountVelocityService { return this.velocityService; }
  getClaimService(): RewardClaimService { return this.claimService; }
  getPromoService(): PromoCodeService { return this.promoService; }
  getMultiAccountService(): MultiAccountDetectionService { return this.multiAccountService; }
  getVPNProxyService(): VPNProxyDetectionService { return this.vpnProxyService; }
  registerVPNProxyHook(hook: VPNProxyHook): void { this.vpnProxyService.registerHook(hook); }

  async checkAccountCreation(params: {
    userId: string;
    deviceId: string;
    ip: string;
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
  }): Promise<AbuseCheckResult> {
    const startTime = Date.now();
    const allRules: AbuseRule[] = [];
    let maxRisk: AbuseCheckResult['riskLevel'] = 'low';

    await this.deviceService.registerDevice({
      userAgent: params.userAgent,
      screenResolution: params.screenResolution,
      timezone: params.timezone,
      language: params.language,
      platform: params.platform,
      ip: params.ip,
    });

    if (this.config.vpnProxy.enabled) {
      const vpnResult = await this.vpnProxyService.checkAndBlock(params.ip);
      allRules.push(...vpnResult.triggeredRules);
      maxRisk = this.upgradeRisk(maxRisk, vpnResult.riskLevel);
    }

    if (this.config.accountVelocity.enabled) {
      const velocityResult = await this.velocityService.checkCreation(params.userId, params.deviceId, params.ip);
      allRules.push(...velocityResult.triggeredRules);
      maxRisk = this.upgradeRisk(maxRisk, velocityResult.riskLevel);
    }

    if (this.config.multiAccount.enabled) {
      const multiResult = await this.multiAccountService.checkNewAccount({
        userId: params.userId,
        deviceId: params.deviceId,
        ip: params.ip,
      });
      allRules.push(...multiResult.triggeredRules);
      maxRisk = this.upgradeRisk(maxRisk, multiResult.riskLevel);
    }

    await this.velocityService.recordCreation(params.userId, params.deviceId, params.ip);

    return {
      passed: maxRisk === 'low',
      riskLevel: maxRisk,
      triggeredRules: allRules,
      action: this.getAction(maxRisk),
      metadata: {},
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  async checkRewardClaim(params: {
    userId: string;
    rewardId: string;
    campaignId: string;
    amount: number;
    deviceId: string;
    ip: string;
  }): Promise<AbuseCheckResult> {
    const startTime = Date.now();
    const allRules: AbuseRule[] = [];
    let maxRisk: AbuseCheckResult['riskLevel'] = 'low';

    if (this.config.vpnProxy.enabled) {
      const vpnResult = await this.vpnProxyService.checkAndBlock(params.ip);
      allRules.push(...vpnResult.triggeredRules);
      maxRisk = this.upgradeRisk(maxRisk, vpnResult.riskLevel);
    }

    if (this.config.rewardClaims.enabled) {
      const claimResult = await this.claimService.checkClaim({
        userId: params.userId,
        rewardId: params.rewardId,
        campaignId: params.campaignId,
        amount: params.amount,
        deviceId: params.deviceId,
        ip: params.ip,
        claimedAt: new Date(),
      });
      allRules.push(...claimResult.triggeredRules);
      maxRisk = this.upgradeRisk(maxRisk, claimResult.riskLevel);
    }

    if (this.config.multiAccount.enabled) {
      const multiResult = await this.multiAccountService.checkNewAccount({
        userId: params.userId,
        deviceId: params.deviceId,
        ip: params.ip,
      });
      allRules.push(...multiResult.triggeredRules);
      maxRisk = this.upgradeRisk(maxRisk, multiResult.riskLevel);
    }

    return {
      passed: maxRisk === 'low',
      riskLevel: maxRisk,
      triggeredRules: allRules,
      action: this.getAction(maxRisk),
      metadata: {},
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  async checkPromoCodeUsage(params: {
    code: string;
    userId: string;
    deviceId: string;
    ip: string;
    orderId?: string;
    discount: number;
  }): Promise<AbuseCheckResult> {
    const startTime = Date.now();
    const allRules: AbuseRule[] = [];
    let maxRisk: AbuseCheckResult['riskLevel'] = 'low';

    if (this.config.vpnProxy.enabled) {
      const vpnResult = await this.vpnProxyService.checkAndBlock(params.ip);
      allRules.push(...vpnResult.triggeredRules);
      maxRisk = this.upgradeRisk(maxRisk, vpnResult.riskLevel);
    }

    if (this.config.promoCodes.enabled) {
      const promoResult = await this.promoService.checkUsage({
        code: params.code,
        userId: params.userId,
        usedAt: new Date(),
        ip: params.ip,
        deviceId: params.deviceId,
        orderId: params.orderId,
        discount: params.discount,
      });
      allRules.push(...promoResult.triggeredRules);
      maxRisk = this.upgradeRisk(maxRisk, promoResult.riskLevel);
    }

    return {
      passed: maxRisk === 'low',
      riskLevel: maxRisk,
      triggeredRules: allRules,
      action: this.getAction(maxRisk),
      metadata: {},
      processingTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  private upgradeRisk(current: AbuseCheckResult['riskLevel'], newRisk: AbuseCheckResult['riskLevel']): AbuseCheckResult['riskLevel'] {
    const levels: AbuseCheckResult['riskLevel'][] = ['low', 'medium', 'high', 'critical'];
    return levels[Math.max(levels.indexOf(current), levels.indexOf(newRisk))];
  }

  private getAction(riskLevel: AbuseCheckResult['riskLevel']): AbuseCheckResult['action'] {
    switch (riskLevel) {
      case 'critical': return 'block';
      case 'high': return 'block';
      case 'medium': return 'challenge';
      default: return 'allow';
    }
  }
}

// ============================================================================
// LEGACY FUNCTIONS (backward compatibility)
// ============================================================================

export interface DeviceFingerprintLegacy {
  deviceId?: string;
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
}

export interface SocialShareCheck {
  platform: string;
  postUrl: string;
  viewCount: number;
  clickCount: number;
  shareTime: Date;
}

export interface ActivityCount {
  last24h: number;
  last1h: number;
}

export interface ShareCooldown {
  userId: string;
  lastShareTime: Date;
  platform: string;
}

export interface DailyRewards {
  count: number;
  lastRewardTime?: Date;
}

export interface FullAbuseCheck {
  fingerprint?: DeviceFingerprintLegacy;
  existingAccounts?: number;
  share?: SocialShareCheck;
  velocity?: ActivityCount;
  lastShare?: ShareCooldown | null;
  todayRewards?: number;
}

export function checkDeviceLimits(
  fingerprint: DeviceFingerprintLegacy,
  existingAccounts: number,
  config: AbusePrevention['deviceLimits'] = DEFAULT_ABUSE_PREVENTION.deviceLimits
): { isAbuse: boolean; riskLevel: string; triggeredRules: string[]; action: string } {
  const triggeredRules: string[] = [];
  let riskLevel: string = 'low';

  if (existingAccounts >= config.maxAccountsPerDevice) {
    triggeredRules.push('MAX_ACCOUNTS_PER_DEVICE');
    riskLevel = 'high';
  }

  return {
    isAbuse: triggeredRules.length > 0,
    riskLevel,
    triggeredRules,
    action: riskLevel === 'high' ? 'block' : 'flag',
  };
}

export function validateSocialShare(
  share: SocialShareCheck,
  config: AbusePrevention['socialSharing'] = DEFAULT_ABUSE_PREVENTION.socialSharing
): { isAbuse: boolean; riskLevel: string; triggeredRules: string[]; action: string } {
  const triggeredRules: string[] = [];

  if (!config.platforms.includes(share.platform)) {
    triggeredRules.push('INVALID_PLATFORM');
  }

  if (share.viewCount < config.minViews) {
    triggeredRules.push(`MIN_VIEWS_NOT_MET:${share.viewCount}<${config.minViews}`);
  }

  if (share.clickCount < config.minClicks) {
    triggeredRules.push(`MIN_CLICKS_NOT_MET:${share.clickCount}<${config.minClicks}`);
  }

  let riskLevel: string = 'low';
  if (triggeredRules.length > 0) riskLevel = 'medium';

  const clickRate = share.clickCount / Math.max(1, share.viewCount);
  if (clickRate < 0.01) {
    triggeredRules.push('SUSPICIOUS_ENGAGEMENT_RATIO');
    riskLevel = 'high';
  }

  const timeSincePost = Date.now() - share.shareTime.getTime();
  if (timeSincePost < 5000) {
    triggeredRules.push('INSTANT_SHARE_BOT_LIKELY');
    riskLevel = 'high';
  }

  return {
    isAbuse: riskLevel === 'high',
    riskLevel,
    triggeredRules,
    action: riskLevel === 'high' ? 'block' : riskLevel === 'medium' ? 'challenge' : 'allow',
  };
}

export function checkVelocity(
  activity: ActivityCount,
  config: AbusePrevention['velocity'] = DEFAULT_ABUSE_PREVENTION.velocity
): { isAbuse: boolean; riskLevel: string; triggeredRules: string[]; action: string } {
  const triggeredRules: string[] = [];
  let riskLevel: string = 'low';

  if (activity.last1h >= config.maxTransactionsPerHour) {
    triggeredRules.push('VELOCITY_HOURLY_EXCEEDED');
    riskLevel = 'high';
  } else if (activity.last1h >= config.maxTransactionsPerHour * 0.8) {
    triggeredRules.push('VELOCITY_HOURLY_WARNING');
    riskLevel = 'medium';
  }

  if (activity.last24h >= config.maxSharesPerDay) {
    triggeredRules.push('VELOCITY_DAILY_EXCEEDED');
    riskLevel = 'high';
  }

  return {
    isAbuse: riskLevel === 'high',
    riskLevel,
    triggeredRules,
    action: riskLevel === 'high' ? 'block' : 'allow',
  };
}

export function checkCooldown(
  lastShare: ShareCooldown | null,
  config: AbusePrevention['socialSharing'] = DEFAULT_ABUSE_PREVENTION.socialSharing
): { inCooldown: boolean; remainingSeconds: number } {
  if (!lastShare) return { inCooldown: false, remainingSeconds: 0 };

  const cooldownMs = config.cooldownMinutes * 60 * 1000;
  const elapsed = Date.now() - lastShare.lastShareTime.getTime();
  const remaining = cooldownMs - elapsed;

  return {
    inCooldown: remaining > 0,
    remainingSeconds: Math.ceil(Math.max(0, remaining) / 1000),
  };
}

export function checkDailyRewardLimit(
  todayRewards: number,
  config: AbusePrevention['socialSharing'] = DEFAULT_ABUSE_PREVENTION.socialSharing
): { withinLimit: boolean; remaining: number } {
  const remaining = config.maxRewardsPerDay - todayRewards;
  return {
    withinLimit: remaining > 0,
    remaining: Math.max(0, remaining),
  };
}

function upgradeRisk(current: string, newRisk: string): string {
  const levels = ['low', 'medium', 'high', 'critical'];
  return levels[Math.max(levels.indexOf(current), levels.indexOf(newRisk))] as string;
}

function getActionFromRisk(risk: string): string {
  switch (risk) {
    case 'critical': return 'block';
    case 'high': return 'block';
    case 'medium': return 'challenge';
    default: return 'allow';
  }
}

export function runAbuseChecks(check: FullAbuseCheck): { isAbuse: boolean; riskLevel: string; triggeredRules: string[]; action: string } {
  const allTriggered: string[] = [];
  let maxRisk: string = 'low';

  if (check.fingerprint && check.existingAccounts !== undefined) {
    const deviceResult = checkDeviceLimits(check.fingerprint, check.existingAccounts);
    allTriggered.push(...deviceResult.triggeredRules);
    maxRisk = upgradeRisk(maxRisk, deviceResult.riskLevel);
  }

  if (check.share) {
    const shareResult = validateSocialShare(check.share);
    allTriggered.push(...shareResult.triggeredRules);
    maxRisk = upgradeRisk(maxRisk, shareResult.riskLevel);
  }

  if (check.velocity) {
    const velocityResult = checkVelocity(check.velocity);
    allTriggered.push(...velocityResult.triggeredRules);
    maxRisk = upgradeRisk(maxRisk, velocityResult.riskLevel);
  }

  if (check.lastShare !== undefined) {
    const cooldownResult = checkCooldown(check.lastShare);
    if (cooldownResult.inCooldown) {
      allTriggered.push('IN_COOLDOWN');
      maxRisk = upgradeRisk(maxRisk, 'medium');
    }
  }

  if (check.todayRewards !== undefined) {
    const limitResult = checkDailyRewardLimit(check.todayRewards);
    if (!limitResult.withinLimit) {
      allTriggered.push('DAILY_REWARD_LIMIT_EXCEEDED');
      maxRisk = upgradeRisk(maxRisk, 'medium');
    }
  }

  return {
    isAbuse: maxRisk === 'high' || maxRisk === 'critical',
    riskLevel: maxRisk,
    triggeredRules: allTriggered,
    action: getActionFromRisk(maxRisk),
  };
}

// ============================================================================
// DEFAULT EXPORTS
// ============================================================================

export { DEFAULT_ABUSE_CONFIG };

export default {
  DeviceFingerprintService,
  AccountVelocityService,
  RewardClaimService,
  PromoCodeService,
  MultiAccountDetectionService,
  VPNProxyDetectionService,
  AbusePreventionService,
  checkDeviceLimits,
  validateSocialShare,
  checkVelocity,
  checkCooldown,
  checkDailyRewardLimit,
  runAbuseChecks,
};
