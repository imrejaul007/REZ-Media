/**
 * REZ Audience Marketplace - Marketplace Service
 * Buy and sell audience segments
 */

import { AudienceSegment, SegmentListing, SegmentPurchase, SegmentMatch } from '../types';

export class AudienceMarketplaceService {
  private listings: Map<string, SegmentListing> = new Map();

  /**
   * List segment for sale
   */
  async listSegment(
    segment: AudienceSegment,
    quantity: number
  ): Promise<SegmentListing> {
    const listing: SegmentListing = {
      id: `listing-${Date.now()}`,
      segment,
      listingType: 'sell',
      availableQuantity: quantity,
      soldQuantity: 0,
      revenue: 0,
      avgMatchRate: 0,
      ratings: 0,
    };

    this.listings.set(listing.id, listing);
    return listing;
  }

  /**
   * Search segments
   */
  async searchSegments(filters: {
    source?: AudienceSegment['source'];
    type?: AudienceSegment['type'];
    minSize?: number;
    maxPrice?: number;
    demographics?: Partial<AudienceSegment['demographics']>;
  }): Promise<SegmentListing[]> {
    // In production: query from database
    return Array.from(this.listings.values()).filter((listing) => {
      if (filters.source && listing.segment.source !== filters.source) return false;
      if (filters.type && listing.segment.type !== filters.type) return false;
      if (filters.minSize && listing.segment.size < filters.minSize) return false;
      if (filters.maxPrice && listing.segment.pricing.cpm && listing.segment.pricing.cpm > filters.maxPrice) return false;
      return true;
    });
  }

  /**
   * Match segment with advertiser audience
   */
  async matchSegment(
    segmentId: string,
    advertiserAudience: string[]
  ): Promise<SegmentMatch> {
    const listing = this.listings.get(segmentId);
    if (!listing) throw new Error('Segment not found');

    // In production: use probabilistic matching
    const matched = Math.floor(advertiserAudience.length * (Math.random() * 0.3 + 0.1));
    const matchRate = matched / advertiserAudience.length;

    const topMatches = advertiserAudience
      .slice(0, 100)
      .map((userId) => ({
        userId,
        score: Math.random(),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return {
      segmentId,
      advertiserAudience,
      matched,
      matchRate,
      topMatches,
    };
  }

  /**
   * Purchase segment
   */
  async purchaseSegment(
    segmentId: string,
    advertiserId: string,
    quantity: number
  ): Promise<SegmentPurchase> {
    const listing = this.listings.get(segmentId);
    if (!listing) throw new Error('Segment not found');

    if (listing.availableQuantity < quantity) {
      throw new Error('Insufficient segment quantity');
    }

    // Calculate price
    const price = listing.segment.pricing.cpm
      ? (quantity / 1000) * listing.segment.pricing.cpm
      : listing.segment.pricing.flatFee || 0;

    const purchase: SegmentPurchase = {
      id: `purchase-${Date.now()}`,
      segmentId,
      advertiserId,
      quantity,
      price: listing.segment.pricing.cpm || 0,
      totalAmount: price,
      status: 'pending',
      deliveryStart: new Date(),
      deliveryEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    // Update listing
    listing.availableQuantity -= quantity;
    listing.soldQuantity += quantity;
    listing.revenue += price;

    this.listings.set(segmentId, listing);

    return purchase;
  }

  /**
   * Get segment insights
   */
  async getInsights(segmentId: string): Promise<{
    overlap: number;
    reachability: number;
    uniqueness: number;
    qualityScore: number;
  }> {
    // In production: calculate from data
    return {
      overlap: 15.5, // % overlap with other segments
      reachability: 85, // % of target reachable
      uniqueness: 72, // % unique to this segment
      qualityScore: 8.5, // 1-10
    };
  }

  /**
   * Create lookalike segment
   */
  async createLookalike(
    sourceSegmentId: string,
    similarity: number // 1-10
  ): Promise<AudienceSegment> {
    const source = this.listings.get(sourceSegmentId)?.segment;
    if (!source) throw new Error('Source segment not found');

    const lookalike: AudienceSegment = {
      id: `seg-lookalike-${Date.now()}`,
      name: `${source.name} Lookalike`,
      description: `Lookalike audience based on ${source.name}`,
      ownerId: source.ownerId,
      ownerType: source.ownerType,
      source: 'first_party',
      type: 'lookalike',
      size: Math.floor(source.size * (similarity / 10)),
      behaviors: source.behaviors,
      interests: source.interests,
      pricing: {
        model: 'cpm',
        cpm: (source.pricing.cpm || 1) * 1.2, // 20% premium
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return lookalike;
  }
}

export const audienceMarketplaceService = new AudienceMarketplaceService();
