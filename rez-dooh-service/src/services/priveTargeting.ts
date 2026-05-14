/**
 * DOOH Prive Targeting Service
 *
 * Integrates Prive membership tiers into DOOH ad targeting.
 * - Adds Prive tier as a targeting filter for DOOH campaigns
 * - Enables elite-only or signature+ content on screens
 * - Tracks Prive engagement for analytics
 *
 * Connection: DOOH Service → Prive Service
 */

const PRIVÉ_SERVICE_URL = process.env.PRIVE_SERVICE_URL || 'https://rez-prive-service.onrender.com';

// Prive tier targeting levels
export type PriveTierLevel = 'none' | 'entry' | 'signature' | 'elite';

// Prive targeting configuration for DOOH campaigns
export interface DOOHPriveTargeting {
  enabled: boolean;
  minTier?: PriveTierLevel;
  maxTier?: PriveTierLevel;
  exclusivity?: 'any' | 'signature_plus' | 'elite_only';
  contentTier?: 'standard' | 'prive' | 'elite_only';
}

// Campaign with Prive targeting
export interface DOOHCampaignWithPrive {
  id: string;
  priveTargeting: DOOHPriveTargeting;
  contentVariant?: {
    standard: string[];
    prive: string[];
    elite: string[];
  };
}

// Screen with Prive context
export interface ScreenWithPriveContext {
  screenId: string;
  location: {
    city: string;
    area?: string;
    tier?: 'tier1' | 'tier2' | 'tier3';
  };
  userContext?: {
    userId?: string;
    priveTier?: PriveTierLevel;
    pillars?: Record<string, number>;
  };
}

// Prive tier priority
const TIER_PRIORITY: Record<PriveTierLevel, number> = {
  elite: 4,
  signature: 3,
  entry: 2,
  none: 1,
};

// Content tier visibility
const CONTENT_TIER_VISIBILITY: Record<string, PriveTierLevel[]> = {
  standard: ['none', 'entry', 'signature', 'elite'],
  prive: ['entry', 'signature', 'elite'],
  elite_only: ['elite'],
};

class DOOHPriveTargetingService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = PRIVÉ_SERVICE_URL;
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
   * Check if a DOOH campaign is visible to a user based on Prive targeting
   */
  async checkCampaignVisibility(
    campaign: DOOHCampaignWithPrive,
    userContext?: { userId?: string; priveTier?: PriveTierLevel }
  ): Promise<{
    visible: boolean;
    reason?: string;
    contentTier: 'standard' | 'prive' | 'elite_only';
  }> {
    // If Prive targeting is disabled, campaign is visible to all
    if (!campaign.priveTargeting.enabled) {
      return { visible: true, contentTier: 'standard' };
    }

    // If no user context, only show non-exclusive campaigns
    if (!userContext?.userId) {
      if (campaign.priveTargeting.exclusivity === 'elite_only') {
        return { visible: false, reason: 'Elite Prive membership required', contentTier: 'elite_only' };
      }
      if (campaign.priveTargeting.exclusivity === 'signature_plus') {
        return { visible: false, reason: 'Signature or Elite Prive membership required', contentTier: 'prive' };
      }
      return { visible: true, contentTier: 'standard' };
    }

    // Get user's Prive tier
    let userTier = userContext.priveTier;
    if (!userTier && userContext.userId) {
      try {
        const eligibility = await this.request<{ success: boolean; data?: { tier: PriveTierLevel } }>(
          `${this.baseUrl}/api/prive/eligibility`,
          {
            headers: {
              'X-User-Id': userContext.userId,
            },
          }
        );
        userTier = eligibility.data?.tier || 'none';
      } catch {
        userTier = 'none';
      }
    }

    // Check exclusivity
    if (campaign.priveTargeting.exclusivity) {
      switch (campaign.priveTargeting.exclusivity) {
        case 'elite_only':
          if (userTier !== 'elite') {
            return {
              visible: false,
              reason: 'Elite Prive membership required',
              contentTier: 'elite_only',
            };
          }
          break;
        case 'signature_plus':
          if (TIER_PRIORITY[userTier] < TIER_PRIORITY.signature) {
            return {
              visible: false,
              reason: 'Signature or Elite Prive membership required',
              contentTier: 'prive',
            };
          }
          break;
      }
    }

    // Check minimum tier
    if (campaign.priveTargeting.minTier) {
      if (TIER_PRIORITY[userTier] < TIER_PRIORITY[campaign.priveTargeting.minTier]) {
        return {
          visible: false,
          reason: `Minimum ${campaign.priveTargeting.minTier} tier required`,
          contentTier: 'standard',
        };
      }
    }

    // Check maximum tier
    if (campaign.priveTargeting.maxTier) {
      if (TIER_PRIORITY[userTier] > TIER_PRIORITY[campaign.priveTargeting.maxTier]) {
        return {
          visible: false,
          reason: `Maximum ${campaign.priveTargeting.maxTier} tier allowed`,
          contentTier: 'standard',
        };
      }
    }

    // Determine content tier based on user tier
    let contentTier: 'standard' | 'prive' | 'elite_only' = 'standard';
    if (userTier === 'elite') {
      contentTier = 'elite_only';
    } else if (userTier === 'signature' || userTier === 'entry') {
      contentTier = 'prive';
    }

    return { visible: true, contentTier };
  }

  /**
   * Get content variant based on user's Prive tier
   */
  getContentVariant(
    campaign: DOOHCampaignWithPrive,
    userTier: PriveTierLevel
  ): string | null {
    if (!campaign.contentVariant) {
      return null;
    }

    // Priority: elite > prive > standard
    if (userTier === 'elite' && campaign.contentVariant.elite?.length) {
      return campaign.contentVariant.elite[0];
    }
    if ((userTier === 'signature' || userTier === 'elite') && campaign.contentVariant.prive?.length) {
      return campaign.contentVariant.prive[0];
    }
    if (campaign.contentVariant.standard?.length) {
      return campaign.contentVariant.standard[0];
    }

    return null;
  }

  /**
   * Track Prive user engagement with DOOH content
   */
  async trackEngagement(
    userId: string,
    screenId: string,
    campaignId: string,
    action: 'view' | 'scan' | 'click' | 'visit'
  ): Promise<void> {
    try {
      await this.request(`${this.baseUrl}/api/prive/engagement-signal`, {
        method: 'POST',
        body: JSON.stringify({
          action: 'dooh_engagement',
          metadata: {
            screenId,
            campaignId,
            action,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch {
      // Non-critical - ignore errors
    }
  }

  /**
   * Get DOOH analytics by Prive tier
   */
  async getPriveAnalytics(campaignId: string): Promise<{
    byTier: Record<PriveTierLevel, { views: number; scans: number; visitRate: number }>;
    totalViews: number;
    tierDistribution: Record<PriveTierLevel, number>;
  }> {
    // This would query the analytics collection
    // For now, return empty structure
    return {
      byTier: {
        none: { views: 0, scans: 0, visitRate: 0 },
        entry: { views: 0, scans: 0, visitRate: 0 },
        signature: { views: 0, scans: 0, visitRate: 0 },
        elite: { views: 0, scans: 0, visitRate: 0 },
      },
      totalViews: 0,
      tierDistribution: {
        none: 0,
        entry: 0,
        signature: 0,
        elite: 0,
      },
    };
  }

  /**
   * Build Prive targeting filter for campaign creation
   */
  buildTargetingFilter(config: DOOHPriveTargeting): Record<string, any> {
    if (!config.enabled) {
      return {};
    }

    const filter: Record<string, any> = {
      prive_targeting_enabled: true,
    };

    if (config.minTier) {
      filter.min_tier_priority = TIER_PRIORITY[config.minTier];
    }

    if (config.maxTier) {
      filter.max_tier_priority = TIER_PRIORITY[config.maxTier];
    }

    if (config.exclusivity) {
      filter.tier_exclusivity = config.exclusivity;
    }

    if (config.contentTier) {
      filter.visible_to_tiers = CONTENT_TIER_VISIBILITY[config.contentTier];
    }

    return filter;
  }
}

export const doohPriveService = new DOOHPriveTargetingService();
export default doohPriveService;
