/**
 * REZ DSP Portal - DSP Portal Service
 * Self-serve advertising platform with DOOH Intelligence integration
 */

import axios from 'axios';
import { DSPAdvertiser, DSPCampaign, DSPargeting, DSpotCreative, DSPMetrics } from '../types';

// DOOH Intelligence Integration
const DOOH_INTEL_URL = process.env.DOOH_INTEL_URL || 'http://localhost:4080';

// Types for DOOH Intelligence
interface DOOHPricingQuote {
  finalCPM: number;
  baseCPM: number;
  adjustments: {
    captivity: number;
    cityTier: number;
    timeSlot: number;
    seasonal: number;
    demand: number;
    audienceMatch: number;
  };
}

interface ScreenTypeInfo {
  type: string;
  captivityLevel: string;
  description: string;
  baseCPM: number;
}

export class DSPPortalService {
  /**
   * Register new advertiser
   */
  async registerAdvertiser(data: {
    name: string;
    email: string;
    company: string;
    website?: string;
  }): Promise<DSPAdvertiser> {
    const advertiser: DSPAdvertiser = {
      id: `adv-${Date.now()}`,
      name: data.name,
      email: data.email,
      company: data.company,
      website: data.website,
      status: 'pending',
      balance: 0,
      spent: 0,
      createdAt: new Date(),
    };

    return advertiser;
  }

  /**
   * Create campaign
   */
  async createCampaign(
    advertiserId: string,
    data: {
      name: string;
      objective: DSPCampaign['objective'];
      budget: { daily?: number; total: number };
      bidding: DSPCampaign['bidding'];
      targeting: DSPargeting;
    }
  ): Promise<DSPCampaign> {
    const campaign: DSPCampaign = {
      id: `camp-${Date.now()}`,
      advertiserId,
      name: data.name,
      objective: data.objective,
      status: 'draft',
      budget: {
        ...data.budget,
        spent: 0,
      },
      bidding: data.bidding,
      targeting: data.targeting,
      creatives: [],
      metrics: {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0,
        conversionRate: 0,
        spend: 0,
        cpm: 0,
        cpc: 0,
        cpa: 0,
        roas: 0,
      },
      createdAt: new Date(),
    };

    return campaign;
  }

  /**
   * Add creative to campaign
   */
  async addCreative(
    campaignId: string,
    creative: Omit<DSpotCreative, 'id' | 'status'>
  ): Promise<DSpotCreative> {
    const newCreative: DSpotCreative = {
      ...creative,
      id: `creative-${Date.now()}`,
      status: 'pending',
    };

    return newCreative;
  }

  /**
   * Launch campaign
   */
  async launchCampaign(campaignId: string): Promise<void> {
    console.log(`Launching campaign: ${campaignId}`);
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    console.log(`Pausing campaign: ${campaignId}`);
  }

  /**
   * Get campaign metrics
   */
  async getCampaignMetrics(campaignId: string): Promise<DSPMetrics> {
    // In production: aggregate from ad serving data
    return {
      impressions: 125000,
      clicks: 2500,
      ctr: 2.0,
      conversions: 125,
      conversionRate: 5.0,
      spend: 500,
      cpm: 4.0,
      cpc: 0.2,
      cpa: 4.0,
      roas: 3.5,
    };
  }

  /**
   * Generate report
   */
  async generateReport(
    campaignId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    campaignId: string;
    dateRange: { start: Date; end: Date };
    metrics: DSPMetrics;
  }> {
    const metrics = await this.getCampaignMetrics(campaignId);

    return {
      campaignId,
      dateRange: { start: startDate, end: endDate },
      metrics,
    };
  }

  /**
   * Estimate reach
   */
  async estimateReach(targeting: DSPargeting, budget: number): Promise<{
    impressions: number;
    reach: number;
    frequency: number;
  }> {
    // In production: use historical data for estimation
    const cpm = 4.0; // $4 per 1000 impressions
    const impressions = (budget / cpm) * 1000;
    const reach = impressions * 0.6; // Assume 60% unique
    const frequency = impressions / reach;

    return {
      impressions: Math.round(impressions),
      reach: Math.round(reach),
      frequency: Math.round(frequency * 10) / 10,
    };
  }

  /**
   * Add funds to account
   */
  async addFunds(advertiserId: string, amount: number): Promise<{
    newBalance: number;
    transactionId: string;
  }> {
    // In production: integrate with payment
    return {
      newBalance: amount,
      transactionId: `txn-${Date.now()}`,
    };
  }

  /**
   * Get billing summary
   */
  async getBillingSummary(advertiserId: string): Promise<{
    balance: number;
    pending: number;
    spent: number;
    invoices: { id: string; amount: number; date: Date }[];
  }> {
    return {
      balance: 1000,
      pending: 150,
      spent: 5000,
      invoices: [
        { id: 'inv-1', amount: 1500, date: new Date() },
        { id: 'inv-2', amount: 2000, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      ],
    };
  }
}

  // ============================================================================
  // DOOH INTELLIGENCE METHODS
  // ============================================================================

  /**
   * Get dynamic pricing from DOOH Intelligence
   */
  async getDOOHPricing(params: {
    screenType: string;
    city: string;
    tier: 'metro' | 'tier1' | 'tier2' | 'tier3';
    scheduledTime?: { start: Date; end: Date };
  }): Promise<DOOHPricingQuote | null> {
    try {
      const response = await axios.post(
        `${DOOH_INTEL_URL}/api/pricing/calculate`,
        {
          screenType: params.screenType,
          location: {
            city: params.city,
            tier: params.tier,
          },
          scheduledTime: params.scheduledTime || {
            start: new Date(),
            end: new Date(),
          },
          campaignObjective: 'awareness',
        },
        { timeout: 5000 }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get DOOH pricing:', error);
      return null;
    }
  }

  /**
   * Get available screen types with pricing
   */
  async getScreenTypes(): Promise<ScreenTypeInfo[] | null> {
    try {
      const response = await axios.get(
        `${DOOH_INTEL_URL}/api/screens/types`,
        { timeout: 5000 }
      );
      return response.data.data.screens;
    } catch (error) {
      console.error('Failed to get screen types:', error);
      return null;
    }
  }

  /**
   * Get demo pricing (all screen types)
   */
  async getDemoPricing(): Promise<Array<{
    screenType: string;
    base: number;
    metroPeak: number;
    metroNormal: number;
    tier2Peak: number;
  }> | null> {
    try {
      const response = await axios.get(
        `${DOOH_INTEL_URL}/api/demo/pricing`,
        { timeout: 5000 }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get demo pricing:', error);
      return null;
    }
  }

  /**
   * Calculate campaign estimate with intelligence
   */
  async calculateCampaignEstimate(params: {
    screenTypes: string[];
    cities: string[];
    budget: number;
    objective: string;
  }): Promise<{
    estimatedImpressions: number;
    estimatedCPM: number;
    priceBreakdown: Array<{
      screenType: string;
      baseCPM: number;
      estimatedCPM: number;
    }>;
  } | null> {
    try {
      // Get pricing for first screen type as estimate
      const screenTypes = await this.getScreenTypes();
      if (!screenTypes?.length) return null;

      const priceBreakdown = params.screenTypes.map((screenType) => {
        const info = screenTypes.find((s) => s.type === screenType);
        return {
          screenType,
          baseCPM: info?.baseCPM || 100,
          estimatedCPM: (info?.baseCPM || 100) * 2.5, // Metro peak estimate
        };
      });

      const avgCPM =
        priceBreakdown.reduce((sum, p) => sum + p.estimatedCPM, 0) /
        priceBreakdown.length;

      return {
        estimatedImpressions: Math.round((params.budget / avgCPM) * 1000),
        estimatedCPM: avgCPM,
        priceBreakdown,
      };
    } catch (error) {
      console.error('Failed to calculate estimate:', error);
      return null;
    }
  }
}

export const dspPortalService = new DSPPortalService();
