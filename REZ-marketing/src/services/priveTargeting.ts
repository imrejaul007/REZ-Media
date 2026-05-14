/**
 * Prive Targeting Service
 *
 * Integrates Prive membership tiers into marketing campaigns.
 * - Adds Prive tier as a targeting filter for campaigns
 * - Awards Prive coins to eligible users who engage with campaigns
 * - Maps Prive tiers to campaign targeting parameters
 *
 * Connection: REZ-Marketing → Prive Service → Wallet Service
 */

import { logger } from '../config/logger';

const PRIVÉ_SERVICE_URL = process.env.PRIVÉ_SERVICE_URL || process.env.API_BASE_URL || 'https://rez-backend.onrender.com';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service-36vo.onrender.com';

// Prive tier reward multipliers for campaigns
export const PRIVE_TIER_CAMPAIGN_BONUS = {
  none: 0,      // No bonus for non-members
  entry: 1.0,  // 100% of base reward
  signature: 1.25, // 125% of base reward
  elite: 1.5,  // 150% of base reward
} as const;

export type PriveTier = 'none' | 'entry' | 'signature' | 'elite';

// Prive targeting configuration for campaigns
export interface PriveTargetingConfig {
  enabled: boolean;
  minTier?: PriveTier;
  maxTier?: PriveTier;
  includeNonMembers: boolean;
  tierExclusivity?: 'any' | 'signature_plus' | 'elite_only';
}

// Campaign with Prive targeting
export interface CampaignWithPriveTargeting {
  campaignId: string;
  priveTargeting: PriveTargetingConfig;
  eligibleTiers: PriveTier[];
}

// Prive eligibility response
interface PriveEligibility {
  isEligible: boolean;
  score: number;
  tier: PriveTier;
  trustScore: number;
}

// Prive tier priority for sorting
const TIER_PRIORITY: Record<PriveTier, number> = {
  elite: 4,
  signature: 3,
  entry: 2,
  none: 1,
};

class PriveTargetingService {
  private baseUrl: string;
  private walletUrl: string;

  constructor() {
    this.baseUrl = PRIVÉ_SERVICE_URL;
    this.walletUrl = WALLET_SERVICE_URL;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Prive API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check if a user is eligible for a campaign based on Prive targeting
   */
  async checkCampaignEligibility(
    userId: string,
    campaign: CampaignWithPriveTargeting
  ): Promise<{ eligible: boolean; reason?: string; tier?: PriveTier }> {
    // If Prive targeting is disabled, everyone is eligible
    if (!campaign.priveTargeting.enabled) {
      return { eligible: true };
    }

    try {
      const eligibility = await this.request<{ success: boolean; data?: PriveEligibility }>(
        `${this.baseUrl}/api/prive/eligibility`,
        {
          headers: {
            'X-User-Id': userId,
          },
        }
      );

      const userTier = eligibility.data?.tier || 'none';

      // Check tier exclusivity
      if (campaign.priveTargeting.tierExclusivity) {
        switch (campaign.priveTargeting.tierExclusivity) {
          case 'elite_only':
            if (userTier !== 'elite') {
              return { eligible: false, reason: 'Elite Prive membership required', tier: userTier };
            }
            break;
          case 'signature_plus':
            if (TIER_PRIORITY[userTier] < TIER_PRIORITY.signature) {
              return { eligible: false, reason: 'Signature or Elite Prive membership required', tier: userTier };
            }
            break;
        }
      }

      // Check minimum tier
      if (campaign.priveTargeting.minTier) {
        if (TIER_PRIORITY[userTier] < TIER_PRIORITY[campaign.priveTargeting.minTier]) {
          return {
            eligible: false,
            reason: `Minimum ${campaign.priveTargeting.minTier} tier required`,
            tier: userTier,
          };
        }
      }

      // Check maximum tier
      if (campaign.priveTargeting.maxTier) {
        if (TIER_PRIORITY[userTier] > TIER_PRIORITY[campaign.priveTargeting.maxTier]) {
          return {
            eligible: false,
            reason: `Maximum ${campaign.priveTargeting.maxTier} tier allowed`,
            tier: userTier,
          };
        }
      }

      // Check if non-members are allowed
      if (!campaign.priveTargeting.includeNonMembers && userTier === 'none') {
        return { eligible: false, reason: 'Prive membership required', tier: userTier };
      }

      return { eligible: true, tier: userTier };
    } catch (error) {
      logger.error('[PriveTargeting] Failed to check eligibility:', error);
      // Fail open - allow access if the service is down
      return { eligible: true };
    }
  }

  /**
   * Calculate reward based on Prive tier
   * Returns the adjusted reward amount
   */
  calculateTieredReward(baseReward: number, tier: PriveTier): number {
    const multiplier = PRIVE_TIER_CAMPAIGN_BONUS[tier];
    return Math.floor(baseReward * multiplier);
  }

  /**
   * Award Prive coins for campaign engagement
   */
  async awardCampaignReward(
    userId: string,
    campaignId: string,
    baseReward: number,
    action: 'view' | 'click' | 'conversion' | 'share',
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; coinsAwarded?: number; tier?: PriveTier }> {
    try {
      // Get user Prive eligibility
      const eligibility = await this.request<{ success: boolean; data?: PriveEligibility }>(
        `${this.baseUrl}/api/prive/eligibility`,
        {
          headers: {
            'X-User-Id': userId,
          },
        }
      );

      const tier = eligibility.data?.tier || 'none';

      // Calculate tiered reward
      const coinsAwarded = this.calculateTieredReward(baseReward, tier);

      if (coinsAwarded <= 0) {
        return { success: true, coinsAwarded: 0, tier };
      }

      // Calculate expiry (365 days for Prive coins)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);

      // Credit Prive coins
      await this.request(`${this.walletUrl}/wallet/credit`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          amount: coinsAwarded,
          coinType: 'prive',
          source: 'campaign_engagement',
          description: `Prive coins for ${action} on campaign ${campaignId}`,
          expiresAt: expiresAt.toISOString(),
          metadata: {
            campaignId,
            action,
            baseReward,
            tier,
            multiplier: PRIVE_TIER_CAMPAIGN_BONUS[tier],
            ...metadata,
          },
        }),
      });

      // Record engagement signal for 6-Pillar scoring
      this.recordCampaignSignal(userId, action, campaignId, tier).catch(() => {
        // Silently ignore - non-critical
      });

      return { success: true, coinsAwarded, tier };
    } catch (error) {
      logger.error('[PriveTargeting] Failed to award reward:', error);
      return { success: false };
    }
  }

  /**
   * Record campaign signal for 6-Pillar scoring
   */
  private async recordCampaignSignal(
    userId: string,
    action: string,
    campaignId: string,
    tier: PriveTier
  ): Promise<void> {
    try {
      await this.request(`${this.baseUrl}/api/prive/engagement-signal`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'campaign',
          metadata: {
            campaignId,
            action,
            tier,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch {
      // Non-critical - ignore errors
    }
  }

  /**
   * Build Prive targeting filter for audience queries
   */
  buildPriveAudienceFilter(config: PriveTargetingConfig): Record<string, any> {
    if (!config.enabled) {
      return {}; // No filter - include all users
    }

    // This would be used with the User model or a PriveAccess collection
    // The actual implementation depends on where Prive membership data is stored
    const filter: Record<string, any> = {};

    if (config.minTier) {
      // Filter users by minimum tier
      // This is a simplified example - actual implementation would query the PriveAccess collection
      filter['priveTierPriority'] = { $gte: TIER_PRIORITY[config.minTier] };
    }

    if (config.maxTier) {
      filter['priveTierPriority'] = {
        ...(filter['priveTierPriority'] || {}),
        $lte: TIER_PRIORITY[config.maxTier],
      };
    }

    if (!config.includeNonMembers) {
      filter['priveTier'] = { $ne: 'none' };
    }

    return filter;
  }

  /**
   * Get campaign statistics by Prive tier
   */
  async getCampaignPriveStats(
    campaignId: string
  ): Promise<Record<PriveTier, { views: number; clicks: number; conversions: number; coinsAwarded: number }> {
    // This would query the campaign engagement logs
    // For now, return empty stats - implementation depends on analytics schema
    return {
      none: { views: 0, clicks: 0, conversions: 0, coinsAwarded: 0 },
      entry: { views: 0, clicks: 0, conversions: 0, coinsAwarded: 0 },
      signature: { views: 0, clicks: 0, conversions: 0, coinsAwarded: 0 },
      elite: { views: 0, clicks: 0, conversions: 0, coinsAwarded: 0 },
    };
  }
}

export const priveTargetingService = new PriveTargetingService();
export default priveTargetingService;
