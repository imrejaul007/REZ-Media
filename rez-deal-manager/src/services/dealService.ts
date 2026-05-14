import { v4 as uuidv4 } from 'uuid';
import { DealModel, IDeal, DealType, DealStatus } from '../types/index.js';

export class DealService {
  async createDeal(data: {
    name: string;
    type: DealType;
    advertiserId: string;
    publisherId: string;
    ssp: string;
    floorPrice: number;
    startDate: Date;
    endDate?: Date;
    targeting?: { geo?: string[]; screenTypes?: string[]; screenIds?: string[] };
    budget?: number;
    pacing?: { daily?: number; weekly?: number };
  }): Promise<IDeal> {
    return DealModel.create({
      dealId: `deal_${uuidv4().slice(0, 8)}`,
      ...data,
      status: 'draft',
    });
  }

  async getDeal(dealId: string): Promise<IDeal | null> {
    return DealModel.findOne({ dealId });
  }

  async listDeals(filters?: {
    status?: DealStatus;
    advertiserId?: string;
    publisherId?: string;
    ssp?: string;
  }): Promise<IDeal[]> {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.advertiserId) query.advertiserId = filters.advertiserId;
    if (filters?.publisherId) query.publisherId = filters.publisherId;
    if (filters?.ssp) query.ssp = filters.ssp;
    return DealModel.find(query).sort({ createdAt: -1 });
  }

  async updateDeal(dealId: string, updates: Partial<IDeal>): Promise<IDeal | null> {
    return DealModel.findOneAndUpdate({ dealId }, updates, { new: true });
  }

  async activateDeal(dealId: string): Promise<IDeal | null> {
    return DealModel.findOneAndUpdate({ dealId }, { status: 'active' }, { new: true });
  }

  async pauseDeal(dealId: string): Promise<IDeal | null> {
    return DealModel.findOneAndUpdate({ dealId }, { status: 'paused' }, { new: true });
  }

  async endDeal(dealId: string): Promise<IDeal | null> {
    return DealModel.findOneAndUpdate({ dealId }, { status: 'ended' }, { new: true });
  }

  async checkDealEligibility(dealId: string, impression: {
    screenId: string;
    screenType: string;
    location: string;
    country: string;
    floorPrice: number;
  }): Promise<{ eligible: boolean; deal?: IDeal; reason?: string }> {
    const deal = await DealModel.findOne({ dealId, status: 'active' });
    if (!deal) return { eligible: false, reason: 'Deal not found or inactive' };

    // Check date
    const now = new Date();
    if (deal.startDate > now) return { eligible: false, reason: 'Deal not started' };
    if (deal.endDate && deal.endDate < now) return { eligible: false, reason: 'Deal ended' };

    // Check floor price
    if (impression.floorPrice < deal.floorPrice) {
      return { eligible: false, reason: 'Below floor price' };
    }

    // Check targeting
    if (deal.targeting) {
      if (deal.targeting.screenIds?.length && !deal.targeting.screenIds.includes(impression.screenId)) {
        return { eligible: false, reason: 'Screen not targeted' };
      }
      if (deal.targeting.screenTypes?.length && !deal.targeting.screenTypes.includes(impression.screenType)) {
        return { eligible: false, reason: 'Screen type not targeted' };
      }
    }

    return { eligible: true, deal };
  }
}

export const dealService = new DealService();
