/**
 * RFM Campaign Mapper
 * Maps RFM segments to campaign types
 */

export const RFM_CAMPAIGN_MAP = {
  champions: {
    campaigns: ['VIP_exclusive', 'Early_access', 'Premium_rewards'],
    messaging: 'Thank you for being our best customer!',
    discount: 0,
    priority: 1,
  },
  loyal: {
    campaigns: ['Loyalty_boost', 'Double_points', 'Exclusive_offer'],
    messaging: 'We appreciate your loyalty',
    discount: 5,
    priority: 2,
  },
  potential: {
    campaigns: ['Nurture_sequence', 'Welcome_series', 'Onboarding'],
    messaging: 'We have something special for you',
    discount: 10,
    priority: 3,
  },
  at_risk: {
    campaigns: ['Win_back', 'Special_reactivation', 'We_miss_you'],
    messaging: 'We miss you! Here is a special offer',
    discount: 15,
    priority: 4,
  },
  lost: {
    campaigns: ['Reactivation', 'Final_win_back', 'Farewell'],
    messaging: 'Last chance to reconnect',
    discount: 25,
    priority: 5,
  },
};

export function getCampaignForSegment(segment: string) {
  return RFM_CAMPAIGN_MAP[segment as keyof typeof RFM_CAMPAIGN_MAP] || RFM_CAMPAIGN_MAP.potential;
}

export function calculateCampaignPriority(): string[] {
  return Object.entries(RFM_CAMPAIGN_MAP)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([segment]) => segment);
}
