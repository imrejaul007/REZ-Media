import { v4 as uuidv4 } from 'uuid';
import { IBidRequest, IBidResponse, SSPProvider } from '../types/index.js';
import { ConnectionModel } from '../models/Connection.js';
import { BidLogModel } from '../models/BidLog.js';
import { AnalyticsModel } from '../models/Analytics.js';
import { GoogleAdXService } from './googleAdxService.js';
import { PubmaticService } from './pubmaticService.js';
import { IndexExchangeService } from './indexExchangeService.js';

export class BidService {
  private googleAdX = new GoogleAdXService();
  private pubmatic = new PubmaticService();
  private indexExchange = new IndexExchangeService();

  async submitBid(request: IBidRequest): Promise<IBidResponse> {
    const startTime = Date.now();
    let response: IBidResponse;

    try {
      switch (request.provider) {
        case 'google_adx':
          response = await this.googleAdX.submitBid(request);
          break;
        case 'pubmatic':
          response = await this.pubmatic.submitBid(request);
          break;
        case 'index_exchange':
          response = await this.indexExchange.submitBid(request);
          break;
        default:
          throw new Error(`Unknown SSP provider: ${request.provider}`);
      }

      // Log the bid
      await this.logBid(request, response, Date.now() - startTime);

      return response;
    } catch (error) {
      console.error('Bid submission error:', error);
      return {
        requestId: request.requestId,
        bid: null,
        timestamp: new Date(),
      };
    }
  }

  async submitMultiBids(requests: IBidRequest[]): Promise<IBidResponse[]> {
    const promises = requests.map(req => this.submitBid(req));
    return Promise.all(promises);
  }

  private async logBid(
    request: IBidRequest,
    response: IBidResponse,
    latency: number
  ): Promise<void> {
    try {
      await BidLogModel.create({
        requestId: request.requestId,
        provider: request.provider,
        impressionId: request.impression.id,
        floor: request.impression.floor,
        bidPrice: response.bid?.price,
        won: false,
        revenue: 0,
        timestamp: request.timestamp,
        latency,
      });

      // Update analytics
      await this.updateAnalytics(request.provider, {
        requests: 1,
        bids: response.bid ? 1 : 0,
        latency,
      });
    } catch (error) {
      console.error('Failed to log bid:', error);
    }
  }

  async logWin(requestId: string, revenue: number): Promise<void> {
    try {
      await BidLogModel.findOneAndUpdate(
        { requestId },
        { won: true, revenue }
      );

      const bidLog = await BidLogModel.findOne({ requestId });
      if (bidLog) {
        await this.updateAnalytics(bidLog.provider as SSPProvider, {
          wins: 1,
          revenue,
        });
      }
    } catch (error) {
      console.error('Failed to log win:', error);
    }
  }

  private async updateAnalytics(
    provider: SSPProvider,
    update: { requests?: number; bids?: number; wins?: number; revenue?: number; latency?: number }
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await AnalyticsModel.findOne({
      provider,
      date: today,
    });

    if (existing) {
      existing.requests += update.requests || 0;
      existing.bids += update.bids || 0;
      existing.wins += update.wins || 0;
      existing.revenue += update.revenue || 0;
      await existing.save();
    } else {
      await AnalyticsModel.create({
        provider,
        date: today,
        requests: update.requests || 0,
        bids: update.bids || 0,
        wins: update.wins || 0,
        revenue: update.revenue || 0,
        impressions: 0,
        fillRate: 0,
        avgBidPrice: 0,
        avgWinPrice: 0,
      });
    }
  }

  async getAnalytics(
    provider?: SSPProvider,
    startDate?: Date,
    endDate?: Date
  ): Promise<unknown[]> {
    const query: Record<string, unknown> = {};

    if (provider) query.provider = provider;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) (query.date as Record<string, Date>).$gte = startDate;
      if (endDate) (query.date as Record<string, Date>).$lte = endDate;
    }

    return AnalyticsModel.find(query).sort({ date: -1 }).limit(30);
  }
}

export const bidService = new BidService();
