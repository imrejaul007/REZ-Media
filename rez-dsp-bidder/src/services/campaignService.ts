import { v4 as uuidv4 } from 'uuid';
import { CampaignModel } from '../models/Campaign.js';
import { CreativeModel } from '../models/Creative.js';
import { BudgetTrackerModel } from '../models/BudgetTracker.js';
import { ICampaign } from '../types/index.js';

export class CampaignService {
  async createCampaign(data: {
    name: string;
    exchange?: 'google_adx' | 'amazon_tam';
    budget: number;
    dailyLimit?: number;
    bidStrategy?: 'fixed' | 'dynamic' | 'optimized';
    maxBidPrice?: number;
    targeting?: {
      geo?: string[];
      screenTypes?: string[];
      locations?: string[];
    };
    startDate: Date;
    endDate?: Date;
  }): Promise<ICampaign> {
    const campaign = await CampaignModel.create({
      ...data,
      status: 'active',
    });

    // Initialize budget tracker for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await BudgetTrackerModel.create({
      campaignId: campaign._id?.toString(),
      date: today,
      totalSpent: 0,
      totalImpressions: 0,
      totalBids: 0,
      totalWins: 0,
    });

    return campaign;
  }

  async getCampaign(id: string): Promise<ICampaign | null> {
    return CampaignModel.findById(id);
  }

  async listCampaigns(filters?: {
    status?: 'active' | 'paused' | 'ended';
    exchange?: string;
  }): Promise<ICampaign[]> {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.exchange) query.exchange = filters.exchange;
    return CampaignModel.find(query).sort({ createdAt: -1 });
  }

  async updateCampaign(id: string, updates: Partial<ICampaign>): Promise<ICampaign | null> {
    return CampaignModel.findByIdAndUpdate(id, updates, { new: true });
  }

  async pauseCampaign(id: string): Promise<ICampaign | null> {
    return CampaignModel.findByIdAndUpdate(id, { status: 'paused' }, { new: true });
  }

  async resumeCampaign(id: string): Promise<ICampaign | null> {
    return CampaignModel.findByIdAndUpdate(id, { status: 'active' }, { new: true });
  }

  async endCampaign(id: string): Promise<ICampaign | null> {
    return CampaignModel.findByIdAndUpdate(id, { status: 'ended' }, { new: true });
  }

  async getCampaignStats(id: string, startDate?: Date, endDate?: Date): Promise<{
    totalSpent: number;
    totalImpressions: number;
    totalBids: number;
    totalWins: number;
    avgBidPrice: number;
    avgWinPrice: number;
    winRate: number;
  }> {
    const query: Record<string, unknown> = { campaignId: id };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) (query.date as Record<string, Date>).$gte = startDate;
      if (endDate) (query.date as Record<string, Date>).$lte = endDate;
    }

    const stats = await BudgetTrackerModel.find(query);

    const totals = stats.reduce((acc, s) => ({
      totalSpent: acc.totalSpent + s.totalSpent,
      totalImpressions: acc.totalImpressions + s.totalImpressions,
      totalBids: acc.totalBids + s.totalBids,
      totalWins: acc.totalWins + s.totalWins,
    }), { totalSpent: 0, totalImpressions: 0, totalBids: 0, totalWins: 0 });

    return {
      ...totals,
      avgBidPrice: totals.totalBids > 0 ? totals.totalSpent / totals.totalBids : 0,
      avgWinPrice: totals.totalWins > 0 ? totals.totalSpent / totals.totalWins : 0,
      winRate: totals.totalBids > 0 ? totals.totalWins / totals.totalBids : 0,
    };
  }

  async addCreative(campaignId: string, creative: {
    url: string;
    width: number;
    height: number;
    mimeType: string;
  }): Promise<void> {
    await CreativeModel.create({
      id: uuidv4(),
      campaignId,
      ...creative,
      status: 'active',
    });
  }

  async getCampaignBudget(campaignId: string): Promise<{
    today: { spent: number; limit: number; remaining: number };
    total: { spent: number; budget: number; remaining: number };
  }> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTracker = await BudgetTrackerModel.findOne({
      campaignId,
      date: today,
    });

    const allTrackers = await BudgetTrackerModel.find({ campaignId });
    const totalSpent = allTrackers.reduce((sum, t) => sum + t.totalSpent, 0);

    return {
      today: {
        spent: todayTracker?.totalSpent || 0,
        limit: campaign.dailyLimit || campaign.budget,
        remaining: (campaign.dailyLimit || campaign.budget) - (todayTracker?.totalSpent || 0),
      },
      total: {
        spent: totalSpent,
        budget: campaign.budget,
        remaining: campaign.budget - totalSpent,
      },
    };
  }
}

export const campaignService = new CampaignService();
