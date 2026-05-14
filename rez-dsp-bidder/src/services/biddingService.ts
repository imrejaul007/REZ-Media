import { v4 as uuidv4 } from 'uuid';
import { IBidRequest, IBidResponse, Exchange, ICampaign } from '../types/index.js';
import { CampaignModel } from '../models/Campaign.js';
import { BidLogModel } from '../models/BidLog.js';
import { BudgetTrackerModel } from '../models/BudgetTracker.js';
import { config } from '../config/index.js';

export class BiddingService {
  async evaluateAndBid(request: IBidRequest): Promise<IBidResponse> {
    const startTime = Date.now();

    try {
      // Find eligible campaigns
      const campaigns = await this.findEligibleCampaigns(request);
      if (campaigns.length === 0) {
        return this.createNoBidResponse(request, 'No matching campaigns');
      }

      // Select best campaign based on bid strategy
      const campaign = this.selectBestCampaign(campaigns, request);

      // Calculate bid price
      const bidPrice = this.calculateBidPrice(campaign, request);

      // Check budget
      const budgetOk = await this.checkBudget(campaign, bidPrice);
      if (!budgetOk) {
        return this.createNoBidResponse(request, 'Budget exceeded');
      }

      // Submit bid (simulated)
      const bid = await this.submitBid(request, bidPrice, campaign);

      // Log the bid
      await this.logBid(request, bid, campaign, Date.now() - startTime);

      return bid;
    } catch (error) {
      console.error('Bidding error:', error);
      return this.createNoBidResponse(request, 'Internal error');
    }
  }

  private async findEligibleCampaigns(request: IBidRequest): Promise<ICampaign[]> {
    const now = new Date();

    const campaigns = await CampaignModel.find({
      status: 'active',
      $or: [
        { exchange: request.exchange },
        { exchange: { $exists: false } },
      ],
      startDate: { $lte: now },
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: now } },
      ],
    });

    return campaigns.filter(campaign => {
      // Check targeting
      if (!campaign.targeting) return true;

      const { targeting } = campaign;
      const { inventory } = request.impression;

      // Geo targeting
      if (targeting.geo?.length && !targeting.geo.includes(inventory.country)) {
        return false;
      }

      // Screen type targeting
      if (targeting.screenTypes?.length && !targeting.screenTypes.includes(inventory.screenType)) {
        return false;
      }

      // Location targeting
      if (targeting.locations?.length) {
        const locationMatch = targeting.locations.some(loc =>
          inventory.location.toLowerCase().includes(loc.toLowerCase()) ||
          inventory.city?.toLowerCase().includes(loc.toLowerCase())
        );
        if (!locationMatch) return false;
      }

      return true;
    });
  }

  private selectBestCampaign(campaigns: ICampaign[], request: IBidRequest): ICampaign {
    // Select campaign with highest budget remaining
    return campaigns.sort((a, b) => b.budget - a.budget)[0];
  }

  private calculateBidPrice(campaign: ICampaign, request: IBidRequest): number {
    const { floor } = request.impression;
    const { bidStrategy, maxBidPrice } = campaign;

    let bidPrice: number;

    switch (bidStrategy) {
      case 'fixed':
        bidPrice = floor * 1.1; // 10% above floor
        break;

      case 'dynamic':
        bidPrice = floor * (1 + Math.random() * 0.5); // 0-50% above floor
        break;

      case 'optimized':
        // In production, use ML model
        bidPrice = floor * 1.2;
        break;

      default:
        bidPrice = floor * 1.1;
    }

    // Apply campaign max bid limit
    if (maxBidPrice && bidPrice > maxBidPrice) {
      bidPrice = maxBidPrice;
    }

    // Apply DSP max bid limit
    if (bidPrice > config.budget.maxBidPrice) {
      bidPrice = config.budget.maxBidPrice;
    }

    // Must be above floor
    if (bidPrice < floor) {
      bidPrice = floor;
    }

    return Math.round(bidPrice * 100) / 100;
  }

  private async checkBudget(campaign: ICampaign, bidPrice: number): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tracker = await BudgetTrackerModel.findOne({
      campaignId: campaign._id?.toString(),
      date: today,
    });

    const dailyLimit = campaign.dailyLimit || campaign.budget;
    const spentToday = tracker?.totalSpent || 0;

    return spentToday + bidPrice <= dailyLimit;
  }

  private async submitBid(
    request: IBidRequest,
    bidPrice: number,
    campaign: ICampaign
  ): Promise<IBidResponse> {
    // In production, this would submit to exchange API
    const won = Math.random() > 0.5; // Simulate 50% win rate

    return {
      requestId: request.requestId,
      exchange: request.exchange,
      bid: {
        price: bidPrice,
        currency: request.impression.currency,
        adId: `dsp_${request.impression.id}`,
        creativeUrl: `https://creatives.rezapp.com/dsp/${campaign._id}.html`,
        duration: 15,
      },
      timestamp: new Date(),
      won,
      reason: won ? 'Won auction' : 'Lost auction',
    };
  }

  private async logBid(
    request: IBidRequest,
    response: IBidResponse,
    campaign: ICampaign,
    latency: number
  ): Promise<void> {
    const campaignId = campaign._id?.toString() || 'unknown';

    // Log bid
    await BidLogModel.create({
      requestId: request.requestId,
      campaignId,
      exchange: request.exchange,
      impressionId: request.impression.id,
      floor: request.impression.floor,
      bidPrice: response.bid?.price || 0,
      winPrice: response.won ? response.bid?.price : undefined,
      won: response.won,
      spent: response.won ? (response.bid?.price || 0) : 0,
      timestamp: request.timestamp,
      latency,
    });

    // Update budget tracker
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await BudgetTrackerModel.findOneAndUpdate(
      { campaignId, date: today },
      {
        $inc: {
          totalBids: 1,
          totalWins: response.won ? 1 : 0,
          totalSpent: response.won ? (response.bid?.price || 0) : 0,
          totalImpressions: response.won ? 1 : 0,
        },
      },
      { upsert: true, new: true }
    );
  }

  private createNoBidResponse(request: IBidRequest, reason: string): IBidResponse {
    return {
      requestId: request.requestId,
      exchange: request.exchange,
      bid: null,
      timestamp: new Date(),
      won: false,
      reason,
    };
  }
}

export const biddingService = new BiddingService();
