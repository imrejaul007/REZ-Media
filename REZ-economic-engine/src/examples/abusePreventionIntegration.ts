/**
 * Abuse Prevention Integration Examples
 *
 * This file demonstrates how to integrate the abuse prevention
 * service and middleware into your Express application
 */

import express, { Request, Response, NextFunction } from 'express';
import {
  AbusePreventionService,
  AbuseStorage,
  VPNProxyHook,
  VPNProxyCheck,
} from '../services/AbusePrevention';
import {
  createAccountCreationPrevention,
  createRewardClaimPrevention,
  createPromoCodePrevention,
  createVPNProxyCheck,
  createAbuseStatsMiddleware,
  extractClientIP,
} from '../middleware/preventionMiddleware';

// ============================================================================
// EXAMPLE 1: Basic Setup with In-Memory Storage
// ============================================================================

/**
 * Simple in-memory storage implementation for testing/development
 * In production, use Redis or MongoDB
 */
class InMemoryAbuseStorage implements AbuseStorage {
  private devices: Map<string, import('../services/AbusePrevention').DeviceFingerprint> = new Map();
  private velocities: Map<string, import('../services/AbusePrevention').AccountVelocity> = new Map();
  private claims: import('../services/AbusePrevention').RewardClaim[] = [];
  private promoUsages: import('../services/AbusePrevention').PromoCodeUsage[] = [];
  private multiAccountGroups: Map<string, import('../services/AbusePrevention').MultiAccountGroup> = new Map();
  private vpnChecks: Map<string, import('../services/AbusePrevention').VPNProxyCheck> = new Map();
  private counters: Map<string, { count: number; expiry: number }> = new Map();

  async getDeviceFingerprint(deviceId: string) {
    return this.devices.get(deviceId) || null;
  }

  async saveDeviceFingerprint(fp) {
    this.devices.set(fp.deviceId, fp);
  }

  async getDevicesByIP(ip: string) {
    return Array.from(this.devices.values()).filter(d => d.ip === ip);
  }

  async getAccountVelocity(userId: string) {
    return this.velocities.get(userId) || null;
  }

  async saveAccountVelocity(velocity) {
    this.velocities.set(velocity.userId, velocity);
  }

  async getAccountVelocityByDevice(deviceId: string) {
    return Array.from(this.velocities.values()).filter(v => v.deviceId === deviceId);
  }

  async getAccountVelocityByIP(ip: string) {
    return Array.from(this.velocities.values()).filter(v => v.ip === ip);
  }

  async getRewardClaims(userId: string, windowHours: number) {
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    return this.claims.filter(c => c.userId === userId && c.claimedAt.getTime() > cutoff);
  }

  async getRewardClaimsByDevice(deviceId: string, windowHours: number) {
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    return this.claims.filter(c => c.deviceId === deviceId && c.claimedAt.getTime() > cutoff);
  }

  async getRewardClaimsByIP(ip: string, windowHours: number) {
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    return this.claims.filter(c => c.ip === ip && c.claimedAt.getTime() > cutoff);
  }

  async saveRewardClaim(claim) {
    const idx = this.claims.findIndex(c => c.rewardId === claim.rewardId && c.userId === claim.userId);
    if (idx >= 0) {
      this.claims[idx] = claim;
    } else {
      this.claims.push(claim);
    }
  }

  async getPromoUsage(code: string) {
    return this.promoUsages.filter(u => u.code === code);
  }

  async getPromoUsageByUser(userId: string, windowMinutes: number) {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return this.promoUsages.filter(u => u.userId === userId && u.usedAt.getTime() > cutoff);
  }

  async getPromoUsageByDevice(deviceId: string, windowMinutes: number) {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return this.promoUsages.filter(u => u.deviceId === deviceId && u.usedAt.getTime() > cutoff);
  }

  async savePromoUsage(usage) {
    const idx = this.promoUsages.findIndex(
      u => u.code === usage.code && u.userId === usage.userId && u.orderId === usage.orderId
    );
    if (idx >= 0) {
      this.promoUsages[idx] = usage;
    } else {
      this.promoUsages.push(usage);
    }
  }

  async getMultiAccountGroup(userId: string) {
    for (const group of this.multiAccountGroups.values()) {
      if (group.accounts.includes(userId)) {
        return group;
      }
    }
    return null;
  }

  async getMultiAccountGroupBySignal(signal) {
    const results: import('../services/AbusePrevention').MultiAccountGroup[] = [];
    for (const group of this.multiAccountGroups.values()) {
      if (group.sharedSignals.some(s => s.type === signal.type && s.value === signal.value)) {
        results.push(group);
      }
    }
    return results;
  }

  async saveMultiAccountGroup(group) {
    this.multiAccountGroups.set(group.groupId, group);
  }

  async getVPNProxyCheck(ip: string) {
    return this.vpnChecks.get(ip) || null;
  }

  async saveVPNProxyCheck(check) {
    this.vpnChecks.set(check.ip, check);
  }

  async incrementCounter(key: string, ttlSeconds: number) {
    const existing = this.counters.get(key);
    const now = Date.now();

    if (existing && existing.expiry > now) {
      existing.count++;
      return existing.count;
    }

    this.counters.set(key, {
      count: 1,
      expiry: now + ttlSeconds * 1000,
    });
    return 1;
  }

  async getCounter(key: string) {
    const existing = this.counters.get(key);
    if (!existing || existing.expiry < Date.now()) {
      return 0;
    }
    return existing.count;
  }
}

// ============================================================================
// EXAMPLE 2: VPN/Proxy Detection Hook
// ============================================================================

/**
 * Example VPN/Proxy detection hook using ip-api.com (free tier)
 * For production, use services like IPQualityScore, MaxMind, or IPHub
 */
const vpnProxyIPAPIHook: VPNProxyHook = {
  name: 'ip-api-check',
  check: async (ip: string): Promise<VPNProxyCheck> => {
    try {
      // Skip private IPs
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return { ip, isVPN: false, isProxy: false, isTor: false, isDataCenter: false, isResidential: true, riskScore: 0 };
      }

      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,proxy,hosting,org,isp`);
      const data = await response.json() as { status: string; proxy?: boolean; hosting?: boolean; org?: string; isp?: string };

      if (data.status !== 'success') {
        return { ip, isVPN: false, isProxy: false, isTor: false, isDataCenter: false, isResidential: true, riskScore: 0 };
      }

      const isProxy = data.proxy === true;
      const isHosting = data.hosting === true;

      // Check for common hosting/VPN provider patterns in org
      const org = (data.org || '').toLowerCase();
      const isp = (data.isp || '').toLowerCase();
      const vpnPatterns = ['vpn', 'virtual private', 'proxy', 'hosting', 'datacenter', 'cloud', 'aws', 'gce', 'azure', 'digitalocean', 'linode', 'vultr'];
      const isKnownVPN = vpnPatterns.some(p => org.includes(p) || isp.includes(p));

      let riskScore = 0;
      if (isProxy) riskScore += 0.4;
      if (isHosting) riskScore += 0.3;
      if (isKnownVPN) riskScore += 0.3;

      return {
        ip,
        isVPN: isKnownVPN,
        isProxy,
        isTor: false,
        isDataCenter: isHosting,
        isResidential: !isProxy && !isHosting && !isKnownVPN,
        riskScore: Math.min(1, riskScore),
        provider: data.org || data.isp,
      };
    } catch {
      return { ip, isVPN: false, isProxy: false, isTor: false, isDataCenter: false, isResidential: true, riskScore: 0 };
    }
  },
};

// ============================================================================
// EXAMPLE 3: Express Application Setup
// ============================================================================

function createAbusePreventionApp() {
  const app = express();
  const storage = new InMemoryAbuseStorage();

  // Initialize the service
  const abuseService = new AbusePreventionService(storage);

  // Register VPN/Proxy detection hook
  abuseService.registerVPNProxyHook(vpnProxyIPAPIHook);

  // Health/stats endpoint (no auth needed)
  app.get('/health/abuse', createAbuseStatsMiddleware(abuseService));

  // Account creation endpoint with prevention
  app.post(
    '/api/v1/accounts',
    createAccountCreationPrevention({
      service: abuseService,
      logViolations: true,
      onBlock: (_req: Request, res: Response, result) => {
        console.error('[ABUSE] Account creation blocked:', result.triggeredRules);
        res.status(403).json({
          error: 'Account creation blocked',
          code: 'ACCOUNT_CREATION_BLOCKED',
          reason: 'suspicious_activity',
        });
      },
    }),
    async (req: Request, res: Response) => {
      // Your account creation logic here
      res.json({ success: true, message: 'Account created successfully' });
    }
  );

  // Reward claim endpoint with prevention
  app.post(
    '/api/v1/rewards/:rewardId/claim',
    createRewardClaimPrevention({
      service: abuseService,
      logViolations: true,
      onChallenge: (_req: Request, res: Response, result) => {
        // Require additional verification (e.g., CAPTCHA)
        res.status(403).json({
          error: 'Additional verification required',
          code: 'VERIFICATION_REQUIRED',
          riskLevel: result.riskLevel,
        });
      },
    }),
    async (req: Request, res: Response) => {
      const { rewardId } = req.params;
      // Your reward claim logic here
      res.json({ success: true, message: `Reward ${rewardId} claimed successfully` });
    }
  );

  // Promo code validation endpoint with prevention
  app.post(
    '/api/v1/promo/validate',
    createPromoCodePrevention({
      service: abuseService,
      logViolations: true,
    }),
    async (req: Request, res: Response) => {
      const { code } = req.body;
      // Your promo validation logic here
      res.json({ success: true, code, message: 'Promo code valid' });
    }
  );

  // VPN/Proxy check only endpoint (for sensitive operations)
  app.post(
    '/api/v1/sensitive-action',
    createVPNProxyCheck({
      service: abuseService,
      onBlock: (_req: Request, res: Response) => {
        res.status(403).json({
          error: 'Connection from untrusted source',
          code: 'UNTRUSTED_CONNECTION',
        });
      },
    }),
    async (req: Request, res: Response) => {
      res.json({ success: true, message: 'Action completed' });
    }
  );

  return app;
}

// ============================================================================
// EXAMPLE 4: Using the Service Directly
// ============================================================================

async function directServiceUsage() {
  const storage = new InMemoryAbuseStorage();
  const service = new AbusePreventionService(storage);

  // Register hooks
  service.registerVPNProxyHook(vpnProxyIPAPIHook);

  // Check account creation
  const accountResult = await service.checkAccountCreation({
    userId: 'user_123',
    deviceId: 'device_abc',
    ip: '203.0.113.1',
    userAgent: 'Mozilla/5.0...',
  });

  console.log('Account creation check:', {
    passed: accountResult.passed,
    action: accountResult.action,
    riskLevel: accountResult.riskLevel,
    rules: accountResult.triggeredRules.length,
  });

  // Check reward claim
  const claimResult = await service.checkRewardClaim({
    userId: 'user_123',
    rewardId: 'reward_456',
    campaignId: 'campaign_789',
    amount: 50.00,
    deviceId: 'device_abc',
    ip: '203.0.113.1',
  });

  console.log('Reward claim check:', {
    passed: claimResult.passed,
    action: claimResult.action,
    riskLevel: claimResult.riskLevel,
    rules: claimResult.triggeredRules,
  });

  // Check promo code usage
  const promoResult = await service.checkPromoCodeUsage({
    code: 'REZABC123',
    userId: 'user_123',
    deviceId: 'device_abc',
    ip: '203.0.113.1',
    discount: 10.00,
  });

  console.log('Promo code check:', {
    passed: promoResult.passed,
    action: promoResult.action,
    riskLevel: promoResult.riskLevel,
    rules: promoResult.triggeredRules,
  });

  // Generate secure promo code
  const newCode = service.getPromoService().generateSecureCode('REZ');
  console.log('Generated code:', newCode);
}

// ============================================================================
// EXAMPLE 5: Custom IP Extraction with XFF Spoofing Prevention
// ============================================================================

function customIPExtraction() {
  const extractSecureIP = (req: Request): string => {
    // This prevents X-Forwarded-For spoofing
    const forwarded = req.headers['x-forwarded-for'] as string | undefined;
    const forwardedProto = req.headers['x-forwarded-proto'] as string | undefined;

    if (forwarded) {
      // Get the FIRST (leftmost) IP in the chain
      // This should be the trusted proxy, not client-supplied
      const outermost = forwarded.split(',')[0].trim();
      const normalized = outermost.replace(/^::ffff:/, '');

      // Block obviously spoofed values
      const blockedPatterns = ['127.0.0.1', '::1', '0.0.0.0', 'localhost'];
      if (blockedPatterns.includes(normalized)) {
        console.warn('[IP SPOOF] Blocked spoofed IP:', outermost);
        return req.ip || 'unknown';
      }

      return normalized;
    }

    return req.ip || 'unknown';
  };

  return extractSecureIP;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  InMemoryAbuseStorage,
  vpnProxyIPAPIHook,
  createAbusePreventionApp,
  directServiceUsage,
  customIPExtraction,
};

export default {
  InMemoryAbuseStorage,
  createAbusePreventionApp,
};
