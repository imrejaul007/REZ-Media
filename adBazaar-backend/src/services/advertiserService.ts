/**
 * AdBazaar - Advertiser Service
 * Manages advertisers and campaigns
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import {
  Advertiser,
  Campaign,
  CampaignStatus,
  CampaignObjective,
  CampaignTargeting,
  Creative,
  ScreenBooking,
  MarketplaceSearch,
  MarketplaceListing,
  PricingQuote,
  SCREEN_CAPTIVITY_MAP,
} from '../types';
import {
  getScreen,
  getOwner,
  getAllScreens,
} from './screenOwnerService';

// In-memory storage
const advertisers: Map<string, Advertiser> = new Map();
const campaigns: Map<string, Campaign> = new Map();

// Service URLs for DOOH intelligence
const DOOH_INTEL_URL = process.env.DOOH_INTEL_URL || 'http://localhost:4080';
const PRICING_ENGINE_URL = process.env.PRICING_ENGINE_URL || 'http://localhost:4016';

// ============================================================================
// ADVERTISER MANAGEMENT
// ============================================================================

export function registerAdvertiser(data: {
  userId: string;
  companyName: string;
  gstin?: string;
  website?: string;
  industry: string;
}): Advertiser {
  const advertiserId = `adv-${uuidv4().slice(0, 8)}`;

  const advertiser: Advertiser = {
    advertiserId,
    userId: data.userId,
    companyName: data.companyName,
    gstin: data.gstin,
    website: data.website,
    industry: data.industry,
    stats: {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalSpend: 0,
      totalImpressions: 0,
      avgROAS: 0,
    },
    createdAt: new Date(),
  };

  advertisers.set(advertiserId, advertiser);
  return advertiser;
}

export function getAdvertiser(advertiserId: string): Advertiser | null {
  return advertisers.get(advertiserId) || null;
}

// ============================================================================
// CAMPAIGN MANAGEMENT
// ============================================================================

export function createCampaign(
  advertiserId: string,
  data: {
    name: string;
    budget: { total: number; daily?: number };
    objective: CampaignObjective;
    targeting: CampaignTargeting;
    schedule: { startDate: Date; endDate?: Date };
    screenBookings?: ScreenBooking[];
  }
): Campaign | null {
  const advertiser = advertisers.get(advertiserId);
  if (!advertiser) return null;

  const campaignId = `camp-${uuidv4().slice(0, 8)}`;

  const campaign: Campaign = {
    campaignId,
    advertiserId,
    name: data.name,
    status: 'draft',
    budget: {
      total: data.budget.total,
      daily: data.budget.daily,
      spent: 0,
    },
    objective: data.objective,
    bidStrategy: 'cpm',
    targeting: data.targeting,
    creatives: [],
    schedule: data.schedule,
    screenBookings: data.screenBookings || [],
    stats: {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
      ctr: 0,
      cvr: 0,
      cpm: 0,
      cpc: 0,
      cpa: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  campaigns.set(campaignId, campaign);
  advertiser.stats.totalCampaigns += 1;

  return campaign;
}

export function getCampaign(campaignId: string): Campaign | null {
  return campaigns.get(campaignId) || null;
}

export function getAdvertiserCampaigns(advertiserId: string): Campaign[] {
  return Array.from(campaigns.values()).filter(
    c => c.advertiserId === advertiserId
  );
}

export function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus
): Campaign | null {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return null;

  campaign.status = status;
  campaign.updatedAt = new Date();

  // Update advertiser stats
  const advertiser = advertisers.get(campaign.advertiserId);
  if (advertiser) {
    advertiser.stats.activeCampaigns = Array.from(campaigns.values()).filter(
      c => c.advertiserId === advertiser.advertiserId && c.status === 'active'
    ).length;
  }

  return campaign;
}

export function addCreative(
  campaignId: string,
  creative: Omit<Creative, 'creativeId'>
): Campaign | null {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return null;

  const creativeId = `cre-${uuidv4().slice(0, 8)}`;
  campaign.creatives.push({ creativeId, ...creative });
  campaign.updatedAt = new Date();

  return campaign;
}

// ============================================================================
// MARKETPLACE SEARCH
// ============================================================================

export async function searchMarketplace(
  search: MarketplaceSearch
): Promise<{ listings: MarketplaceListing[]; total: number }> {
  const screens = getAllScreens({
    screenTypes: search.filters.screenTypes,
    cities: search.filters.cities,
    status: 'active',
  });

  const listings: MarketplaceListing[] = [];

  for (const screen of screens) {
    const owner = getOwner(screen.ownerId);
    if (!owner) continue;

    // Get dynamic pricing from DOOH intelligence
    let dynamicCPM = screen.floorPrice.cpm;

    try {
      const response = await axios.post(
        `${DOOH_INTEL_URL}/api/pricing/calculate`,
        {
          screenType: screen.screenType,
          location: {
            city: screen.address.city,
            tier: getCityTier(screen.address.city),
          },
          scheduledTime: {
            start: new Date(),
            end: new Date(),
          },
          campaignObjective: 'awareness',
        },
        { timeout: 3000 }
      );
      dynamicCPM = response.data.data.finalCPM;
    } catch {
      // Use floor price as fallback
    }

    const listing: MarketplaceListing = {
      screen,
      owner: {
        name: owner.businessName,
        rating: 4.5, // Would come from reviews
        totalListings: owner.screens.length,
      },
      pricing: {
        currentCPM: dynamicCPM,
        originalCPM: screen.floorPrice.cpm,
        discount: screen.floorPrice.cpm < dynamicCPM
          ? ((dynamicCPM - screen.floorPrice.cpm) / dynamicCPM * 100)
          : undefined,
      },
      availability: {
        available: true,
      },
    };

    listings.push(listing);
  }

  // Sort
  switch (search.sort) {
    case 'price_asc':
      listings.sort((a, b) => a.pricing.currentCPM - b.pricing.currentCPM);
      break;
    case 'price_desc':
      listings.sort((a, b) => b.pricing.currentCPM - a.pricing.currentCPM);
      break;
    case 'rating':
      listings.sort((a, b) => b.owner.rating - a.owner.rating);
      break;
  }

  // Pagination
  const total = listings.length;
  const start = (search.pagination.page - 1) * search.pagination.limit;
  const paginated = listings.slice(start, start + search.pagination.limit);

  return { listings: paginated, total };
}

// ============================================================================
// PRICING QUOTE
// ============================================================================

export async function getPricingQuote(
  campaignId: string,
  screenId: string
): Promise<PricingQuote | null> {
  const campaign = campaigns.get(campaignId);
  const screen = getScreen(screenId);

  if (!campaign || !screen) return null;

  // Get dynamic pricing from DOOH intelligence
  let dynamicCPM = screen.floorPrice.cpm;
  const adjustments = {
    captivity: 1.0,
    cityTier: 1.0,
    timeSlot: 1.0,
    seasonal: 1.0,
    demand: 1.0,
    audienceMatch: 1.0,
  };

  try {
    const response = await axios.post(
      `${DOOH_INTEL_URL}/api/pricing/calculate`,
      {
        screenType: screen.screenType,
        location: {
          city: screen.address.city,
          tier: getCityTier(screen.address.city),
        },
        scheduledTime: campaign.schedule,
        campaignObjective: campaign.objective,
      },
      { timeout: 5000 }
    );

    const data = response.data.data;
    dynamicCPM = data.finalCPM;
    adjustments.captivity = data.multipliers.captivity;
    adjustments.cityTier = data.multipliers.cityTier;
    adjustments.timeSlot = data.multipliers.timeSlot;
    adjustments.seasonal = data.multipliers.seasonal;
    adjustments.demand = data.multipliers.demand;
  } catch {
    // Use floor price as fallback
    adjustments.captivity = getCaptivityMultiplier(screen.captivityLevel);
  }

  // Calculate total
  const baseCPM = screen.floorPrice.cpm;
  const totalBudget = campaign.budget.total;
  const estimatedImpressions = (totalBudget / dynamicCPM) * 1000;

  // Payment split: Owner gets 70%, Platform 30%
  const PLATFORM_FEE_PERCENT = 0.30;
  const GST_PERCENT = 0.18;

  const platformFee = dynamicCPM * PLATFORM_FEE_PERCENT;
  const ownerPayout = dynamicCPM - platformFee;
  const gst = platformFee * GST_PERCENT;
  const total = dynamicCPM + gst;

  return {
    screenId,
    campaignId,
    baseCPM,
    dynamicCPM,
    adjustments,
    finalCPM: dynamicCPM,
    totalBudget,
    estimatedImpressions: Math.round(estimatedImpressions),
    ownerPayout,
    platformFee,
    gst,
    total,
    validUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 min validity
  };
}

// ============================================================================
// CAMPAIGN STATS
// ============================================================================

export function recordImpression(campaignId: string, amount: number = 1): void {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return;

  campaign.stats.impressions += amount;
  campaign.stats.cpm = campaign.stats.spend / campaign.stats.impressions * 1000;
  campaign.stats.ctr = campaign.stats.impressions > 0
    ? campaign.stats.clicks / campaign.stats.impressions * 100
    : 0;
  campaign.updatedAt = new Date();
}

export function recordClick(campaignId: string): void {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return;

  campaign.stats.clicks += 1;
  campaign.stats.ctr = campaign.stats.impressions > 0
    ? campaign.stats.clicks / campaign.stats.impressions * 100
    : 0;
  campaign.stats.cpc = campaign.stats.clicks > 0
    ? campaign.stats.spend / campaign.stats.clicks
    : 0;
  campaign.updatedAt = new Date();
}

export function recordConversion(campaignId: string, value: number): void {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return;

  campaign.stats.conversions += 1;
  campaign.stats.cvr = campaign.stats.clicks > 0
    ? campaign.stats.conversions / campaign.stats.clicks * 100
    : 0;
  campaign.stats.cpa = campaign.stats.conversions > 0
    ? campaign.stats.spend / campaign.stats.conversions
    : 0;
  campaign.updatedAt = new Date();
}

// ============================================================================
// HELPERS
// ============================================================================

function getCityTier(city: string): 'metro' | 'tier1' | 'tier2' | 'tier3' {
  const metroCities = ['mumbai', 'delhi', 'bangalore', 'chennai', 'hyderabad', 'kolkata'];
  const tier1Cities = ['pune', 'ahmedabad', 'surat', 'jaipur', 'lucknow', 'chandigarh'];

  const cityLower = city.toLowerCase();

  if (metroCities.includes(cityLower)) return 'metro';
  if (tier1Cities.includes(cityLower)) return 'tier1';

  return 'tier2';
}

function getCaptivityMultiplier(level: CaptivityLevel): number {
  switch (level) {
    case 'personal': return 2.0;
    case 'captive_private': return 1.5;
    case 'semi_captive': return 1.2;
    case 'public': return 1.0;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const advertiserService = {
  registerAdvertiser,
  getAdvertiser,
  createCampaign,
  getCampaign,
  getAdvertiserCampaigns,
  updateCampaignStatus,
  addCreative,
  searchMarketplace,
  getPricingQuote,
  recordImpression,
  recordClick,
  recordConversion,
};

export default advertiserService;
