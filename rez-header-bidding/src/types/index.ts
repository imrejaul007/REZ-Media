/**
 * REZ Header Bidding - Types
 */

export interface BidderConfig {
  bidder: string;
  name: string;
  endpoint: string;
  timeout: number; // ms
  enabled: boolean;
  weights: number; // Bidder weight for waterfall
}

export interface PrebidConfig {
  code: string;
  mediaTypes: {
    banner?: { sizes: number[][] };
    video?: { context: 'instream' | 'outstream'; playerSize: number[][] };
    native?: object;
  };
  bids: BidRequest[];
}

export interface BidRequest {
  bidder: string;
  params: object;
}

export interface BidResponse {
  bidder: string;
  requestId: string;
  cpm: number;
  currency: string;
  netRevenue: boolean;
  ttl: number;
  ad: string;
  adm?: string;
  dealId?: string;
  // Prebid-specific
  bidderCode?: string;
  adId?: string;
  pbHg?: string;
}

export interface WaterfallResult {
  winner: BidResponse;
  waterfall: { bidder: string; cpm: number; status: 'bid' | 'no_bid' | 'timeout' }[];
  auctionTime: number;
}

export interface HeaderBiddingAd {
  slotId: string;
  bids: BidResponse[];
  winningBid?: BidResponse;
  targeting: Record<string, string>;
}
