import axios from 'axios';
import { IConnection, IBidRequest, IBidResponse } from '../types/index.js';

export class IndexExchangeService {
  private connection: IConnection | null = null;

  async connect(connection: IConnection): Promise<void> {
    this.connection = connection;
    console.log('Connected to Index Exchange');
  }

  async disconnect(): Promise<void> {
    this.connection = null;
  }

  async submitBid(request: IBidRequest): Promise<IBidResponse> {
    if (!this.connection) {
      throw new Error('Not connected to Index Exchange');
    }

    const startTime = Date.now();

    try {
      // Index Exchange OpenRTB 2.5 format
      const bidRequest = {
        id: request.requestId,
        imp: [{
          id: request.impression.id,
          banner: {
            w: 320,
            h: 50,
            pos: 1,
          },
          bidfloor: request.impression.floor,
          bidfloorcur: request.impression.currency,
        }],
        device: {
          ip: '127.0.0.1',
          ua: 'ReZ-SSP/1.0',
          devicetype: 1,
        },
        tmax: 120,
      };

      const response = await this.simulateBidResponse(request);
      const latency = Date.now() - startTime;

      console.log(`Index Exchange bid completed in ${latency}ms`, {
        requestId: request.requestId,
        bid: response.bid?.price || null,
      });

      return response;
    } catch (error) {
      console.error('Index Exchange bid error:', error);
      return {
        requestId: request.requestId,
        bid: null,
        timestamp: new Date(),
      };
    }
  }

  private async simulateBidResponse(request: IBidRequest): Promise<IBidResponse> {
    const bidProbability = Math.random();
    const acceptanceThreshold = 0.6;

    if (bidProbability < acceptanceThreshold) {
      const bidPrice = request.impression.floor * (1 + Math.random() * 0.2);
      return {
        requestId: request.requestId,
        bid: {
          price: Math.round(bidPrice * 100) / 100,
          currency: 'INR',
          adId: `ix_${request.impression.id}`,
          creativeUrl: `https://creatives.rezapp.com/ix/${request.impression.id}.html`,
          duration: 15,
        },
        timestamp: new Date(),
      };
    }

    return {
      requestId: request.requestId,
      bid: null,
      timestamp: new Date(),
    };
  }

  async syncInventory(screenIds: string[]): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to Index Exchange');
    }

    console.log(`Syncing ${screenIds.length} inventory items to Index Exchange`);
  }
}
