/**
 * REZ Ad Exchange - Services
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Publisher,
  Advertiser,
  Campaign,
  Deal,
  BidRequest,
  Bid,
  BidResponse,
} from '../types';
import {
  PublisherModel,
  AdvertiserModel,
  CampaignModel,
  DealModel,
  AuctionModel,
} from '../models';

export class PublisherService {
  /**
   * Register a new publisher
   */
  async registerPublisher(data: {
    name: string;
    domain: string;
    type: 'website' | 'app' | 'dooh';
    categories?: string[];
  }): Promise<Publisher> {
    const publisherId = `pub-${uuidv4().slice(0, 8)}`;

    const publisher = new PublisherModel({
      publisherId,
      ...data,
      traffic: {
        monthlyPageviews: 0,
        monthlyVisitors: 0,
        avgSessionDuration: 0,
      },
      inventory: [],
      sspAccounts: [],
      status: 'pending',
    });

    await publisher.save();
    return publisher;
  }

  /**
   * Add inventory to publisher
   */
  async addInventory(publisherId: string, inventory: Omit<Publisher['inventory'][0], 'inventoryId'>): Promise<void> {
    const inventoryId = `inv-${uuidv4().slice(0, 8)}`;

    await PublisherModel.findOneAndUpdate(
      { publisherId },
      {
        $push: {
          inventory: { inventoryId, ...inventory },
        },
      }
    );
  }

  /**
   * Get publisher by domain
   */
  async getByDomain(domain: string): Promise<Publisher | null> {
    return PublisherModel.findOne({ domain });
  }

  /**
   * List all publishers
   */
  async listPublishers(options: { status?: string; page?: number; limit?: number } = {}): Promise<{ publishers: Publisher[]; total: number }> {
    const { status, page = 1, limit = 20 } = options;
    const query: Record<string, unknown> = {};
    if (status) query.status = status;

    const [publishers, total] = await Promise.all([
      PublisherModel.find(query).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }),
      PublisherModel.countDocuments(query),
    ]);

    return { publishers, total };
  }
}

export class AdvertiserService {
  /**
   * Register a new advertiser
   */
  async registerAdvertiser(data: {
    name: string;
    company: string;
    website: string;
    industry: string;
  }): Promise<Advertiser> {
    const advertiserId = `adv-${uuidv4().slice(0, 8)}`;

    const advertiser = new AdvertiserModel({
      advertiserId,
      ...data,
      budgets: [],
      dspAccounts: [],
      status: 'pending',
    });

    await advertiser.save();
    return advertiser;
  }

  /**
   * Get advertiser by ID
   */
  async getAdvertiser(advertiserId: string): Promise<Advertiser | null> {
    return AdvertiserModel.findOne({ advertiserId });
  }

  /**
   * Add budget to advertiser
   */
  async addBudget(advertiserId: string, budget: { name: string; amount: number; startDate: Date }): Promise<void> {
    const budgetId = `budget-${uuidv4().slice(0, 8)}`;

    await AdvertiserModel.findOneAndUpdate(
      { advertiserId },
      {
        $push: {
          budgets: { budgetId, ...budget, spent: 0, status: 'active' },
        },
      }
    );
  }
}

export class AuctionService {
  private activeBids: Map<string, { campaignId: string; cpm: number; creativeId: string }[]> = new Map();

  /**
   * Process bid request and run auction
   */
  async processBidRequest(request: BidRequest): Promise<BidResponse> {
    const auctionId = `auc-${uuidv4().slice(0, 8)}`;

    // Get eligible campaigns
    const campaigns = await CampaignModel.find({
      status: 'active',
      'targeting.publishers': { $in: [request.publisher.publisherId] },
    }).limit(10);

    // Calculate bids
    const bids: Bid[] = [];
    for (const campaign of campaigns) {
      const cpm = this.calculateBid(campaign, request);
      if (cpm >= request.floorPrice) {
        const creative = campaign.creatives[0];
        if (creative) {
          bids.push({
            campaignId: campaign.campaignId,
            creativeId: creative.creativeId,
            cpm,
            currency: 'USD',
            ad: {
              type: creative.type as 'banner' | 'video' | 'native',
              content: creative.assets.url,
              width: creative.assets.width,
              height: creative.assets.height,
              mimeType: creative.assets.mimeType,
            },
          });
        }
      }
    }

    // Sort by CPM and determine winner
    bids.sort((a, b) => b.cpm - a.cpm);
    const winner = bids[0];
    const secondPrice = bids[1]?.cpm || request.floorPrice;

    // Store auction result
    await AuctionModel.create({
      auctionId,
      requestId: request.requestId,
      inventoryId: request.inventory.inventoryId,
      bids: bids.map((b) => ({ dspId: 'exchange', campaignId: b.campaignId, cpm: b.cpm })),
      winner: winner ? { dspId: 'exchange', campaignId: winner.campaignId, cpm: secondPrice } : undefined,
      secondPrice,
      timestamp: new Date(),
    });

    return {
      requestId: request.requestId,
      bids: winner ? [winner] : [],
      timestamp: new Date(),
    };
  }

  /**
   * Calculate bid for a campaign
   */
  private calculateBid(campaign: Campaign, request: BidRequest): number {
    const maxBid = campaign.bidding.maxBid;

    switch (campaign.bidding.strategy) {
      case 'cpm':
        return Math.min(maxBid, request.floorPrice * 1.2);
      case 'cpc':
        return Math.min(maxBid, request.floorPrice * 1.1);
      case 'fixed':
        return maxBid;
      default:
        return Math.min(maxBid, request.floorPrice * 1.15);
    }
  }

  /**
   * Record impression
   */
  async recordImpression(campaignId: string): Promise<void> {
    await CampaignModel.findOneAndUpdate(
      { campaignId },
      {
        $inc: {
          'metrics.impressions': 1,
          budget: { spent: 0.001 },
        },
      }
    );
  }

  /**
   * Record click
   */
  async recordClick(campaignId: string): Promise<void> {
    await CampaignModel.findOneAndUpdate(
      { campaignId },
      { $inc: { 'metrics.clicks': 1 } }
    );
  }
}

export class DealService {
  /**
   * Create a new deal
   */
  async createDeal(data: {
    name: string;
    type: 'preferred' | 'programmatic' | 'private';
    publisherId: string;
    advertiserId?: string;
    inventoryIds: string[];
    floorPrice: number;
    budget?: number;
    startDate: Date;
    endDate?: Date;
  }): Promise<Deal> {
    const dealId = `deal-${uuidv4().slice(0, 8)}`;

    const deal = new DealModel({
      dealId,
      ...data,
      status: 'active',
    });

    await deal.save();
    return deal;
  }

  /**
   * Get deals for publisher
   */
  async getPublisherDeals(publisherId: string): Promise<Deal[]> {
    return DealModel.find({ publisherId, status: 'active' });
  }

  /**
   * Get deals for advertiser
   */
  async getAdvertiserDeals(advertiserId: string): Promise<Deal[]> {
    return DealModel.find({ advertiserId, status: 'active' });
  }
}

// Export singleton instances
export const publisherService = new PublisherService();
export const advertiserService = new AdvertiserService();
export const auctionService = new AuctionService();
export const dealService = new DealService();
