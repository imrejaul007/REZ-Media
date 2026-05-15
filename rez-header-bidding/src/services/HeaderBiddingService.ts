/**
 * REZ Header Bidding - Header Bidding Service
 * Prebid.js integration and SSP waterfall
 */

import { BidderConfig, PrebidConfig, BidResponse, WaterfallResult } from '../types';

export class HeaderBiddingService {
  private bidders: Map<string, BidderConfig> = new Map();

  constructor() {
    // Register default bidders
    this.registerBidder({
      bidder: 'google',
      name: 'Google AdX',
      endpoint: 'https://securepubads.g.doubleclick.net/gampad/ads',
      timeout: 1000,
      enabled: true,
      weights: 1.0,
    });
    this.registerBidder({
      bidder: 'pubmatic',
      name: 'PubMatic',
      endpoint: 'https://ads.pubmatic.com/AdServer/js/pbtzli.js',
      timeout: 800,
      enabled: true,
      weights: 0.8,
    });
    this.registerBidder({
      bidder: 'index',
      name: 'Index Exchange',
      endpoint: 'https://ads INDEX_ENDPOINT',
      timeout: 800,
      enabled: true,
      weights: 0.7,
    });
  }

  registerBidder(config: BidderConfig): void {
    this.bidders.set(config.bidder, config);
  }

  /**
   * Run header bidding auction
   */
  async runAuction(config: PrebidConfig): Promise<WaterfallResult> {
    const waterfall: WaterfallResult['waterfall'] = [];
    const startTime = Date.now();

    // Sort bidders by weight (highest first)
    const sortedBidders = Array.from(this.bidders.values())
      .filter((b) => b.enabled)
      .sort((a, b) => b.weights - a.weights);

    // Request bids from each bidder
    const bidPromises = sortedBidders.map((bidder) =>
      this.requestBid(bidder, config).then((response): { bidder: string; cpm: number; status: 'bid' | 'no_bid' } => ({
        bidder: bidder.bidder,
        cpm: response?.cpm || 0,
        status: response ? 'bid' as const : 'no_bid' as const,
      }))
    );

    const results = await Promise.all(bidPromises);
    waterfall.push(...results);

    // Find winning bid (highest CPM)
    const winningBid = results
      .filter((r) => r.status === 'bid')
      .sort((a, b) => b.cpm - a.cpm)[0];

    const auctionTime = Date.now() - startTime;

    return {
      winner: winningBid
        ? { bidder: winningBid.bidder, cpm: winningBid.cpm } as BidResponse
        : ({} as BidResponse),
      waterfall,
      auctionTime,
    };
  }

  /**
   * Request bid from a single bidder
   */
  private async requestBid(
    bidder: BidderConfig,
    config: PrebidConfig
  ): Promise<BidResponse | null> {
    try {
      // In production: make actual bid request
      console.log(`Requesting bid from ${bidder.name}`);

      // Simulate bid response
      const hasBid = Math.random() > 0.3; // 70% chance of bid
      if (!hasBid) return null;

      return {
        bidder: bidder.bidder,
        requestId: `req-${Date.now()}`,
        cpm: Math.random() * 5 + 0.5, // $0.50 - $5.50
        currency: 'USD',
        netRevenue: true,
        ttl: 300,
        ad: '<div>Ad Content</div>',
      };
    } catch (error) {
      console.error(`Bid request failed for ${bidder.name}:`, error);
      return null;
    }
  }

  /**
   * Generate Prebid.js configuration
   */
  generatePrebidConfig(): object {
    const bidders = Array.from(this.bidders.values()).map((b) => ({
      name: b.name,
      gvlid: 0, // Would be actual GVL ID
      bidders: [b.bidder],
    }));

    return {
      adUnits: [],
      bidderSettings: {
        standard: {
          adserverTargeting: [
            { key: 'hb_bidder', val: (bidResponse: BidResponse) => bidResponse.bidderCode },
            { key: 'hb_adid', val: (bidResponse: BidResponse) => bidResponse.adId },
            { key: 'hb_pb', val: (bidResponse: BidResponse) => bidResponse.pbHg },
          ],
        },
      },
      bidders,
    };
  }

  /**
   * Generate ad server targeting
   */
  generateTargeting(bids: BidResponse[]): Record<string, string> {
    const targeting: Record<string, string> = {};

    const winningBid = bids.sort((a, b) => b.cpm - a.cpm)[0];
    if (!winningBid) return targeting;

    targeting.hb_bidder = winningBid.bidder;
    targeting.hb_adid = winningBid.requestId;
    targeting.hb_pb = this.getPriceBucket(winningBid.cpm);
    targeting.hb_size = '300x250';

    return targeting;
  }

  private getPriceBucket(cpm: number): string {
    const buckets = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    for (const bucket of buckets) {
      if (cpm <= bucket) return bucket.toFixed(2);
    }
    return '5.00';
  }
}

export const headerBiddingService = new HeaderBiddingService();
