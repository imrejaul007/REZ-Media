/**
 * Influencer Marketing Service
 *
 * Core business logic for influencer campaigns
 */

import mongoose, { Schema } from 'mongoose';

// Types
export interface IInfluencer {
  _id: mongoose.Types.ObjectId;
  userId: string;
  name: string;
  username: string;
  profilePic?: string;
  bio?: string;
  niche: string[];
  followerCount: number;
  location: {
    city: string;
    state?: string;
    country: string;
  };
  socialLinks: {
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  rating: number;
  totalCampaigns: number;
  completedCampaigns: number;
  totalEarnings: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInfluencerCampaign {
  _id: mongoose.Types.ObjectId;
  merchantId: string;
  title: string;
  description: string;
  brandName: string;
  category: string;
  budget: number;
  paymentType: 'fixed' | 'barter' | 'hybrid';
  barterDetails?: {
    product: string;
    value: number;
  };
  deliverables: {
    type: 'story' | 'post' | 'reel' | 'video';
    count: number;
    minReach?: number;
  }[];
  requirements: string;
  deadline: Date;
  status: 'draft' | 'open' | 'in_review' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  selectedInfluencers: string[];
  applications: IApplication[];
  analytics: {
    totalViews: number;
    totalEngagement: number;
    totalConversions: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IApplication {
  influencerId: string;
  proposedContent: string;
  proposedPrice: number;
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: Date;
  respondedAt?: Date;
}

// Mongoose Schemas
const InfluencerSchema = new Schema<IInfluencer>({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  profilePic: String,
  bio: String,
  niche: [{ type: String }],
  followerCount: { type: Number, default: 0 },
  location: {
    city: { type: String, required: true },
    state: String,
    country: { type: String, default: 'India' },
  },
  socialLinks: {
    instagram: String,
    youtube: String,
    twitter: String,
  },
  rating: { type: Number, default: 0 },
  totalCampaigns: { type: Number, default: 0 },
  completedCampaigns: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

InfluencerSchema.index({ niche: 1 });
InfluencerSchema.index({ 'location.city': 1 });
InfluencerSchema.index({ followerCount: -1 });
InfluencerSchema.index({ rating: -1 });

const InfluencerCampaignSchema = new Schema<IInfluencerCampaign>({
  merchantId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: String,
  brandName: { type: String, required: true },
  category: { type: String, required: true },
  budget: { type: Number, required: true },
  paymentType: { type: String, enum: ['fixed', 'barter', 'hybrid'], default: 'fixed' },
  barterDetails: {
    product: String,
    value: Number,
  },
  deliverables: [{
    type: { type: String, enum: ['story', 'post', 'reel', 'video'] },
    count: Number,
    minReach: Number,
  }],
  requirements: String,
  deadline: { type: Date, required: true },
  status: {
    type: String,
    enum: ['draft', 'open', 'in_review', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'draft',
  },
  selectedInfluencers: [{ type: String }],
  applications: [{
    influencerId: String,
    proposedContent: String,
    proposedPrice: Number,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    appliedAt: Date,
    respondedAt: Date,
  }],
  analytics: {
    totalViews: { type: Number, default: 0 },
    totalEngagement: { type: Number, default: 0 },
    totalConversions: { type: Number, default: 0 },
  },
}, { timestamps: true });

InfluencerCampaignSchema.index({ merchantId: 1, status: 1 });
InfluencerCampaignSchema.index({ category: 1, status: 1 });

export const Influencer = mongoose.model<IInfluencer>('Influencer', InfluencerSchema);
export const InfluencerCampaign = mongoose.model<IInfluencerCampaign>('InfluencerCampaign', InfluencerCampaignSchema);

// Service Class
export class InfluencerService {

  /**
   * Register influencer profile
   */
  async registerInfluencer(data: Partial<IInfluencer>): Promise<IInfluencer> {
    const influencer = new Influencer(data);
    await influencer.save();
    return influencer;
  }

  /**
   * Get influencer by userId
   */
  async getInfluencer(userId: string): Promise<IInfluencer | null> {
    return Influencer.findOne({ userId });
  }

  /**
   * Search influencers
   */
  async searchInfluencers(params: {
    niche?: string[];
    city?: string;
    minFollowers?: number;
    maxBudget?: number;
    sortBy?: 'followers' | 'rating' | 'earnings';
    page?: number;
    limit?: number;
  }): Promise<{ influencers: IInfluencer[]; total: number }> {
    const { niche, city, minFollowers, sortBy = 'rating', page = 1, limit = 20 } = params;

    const query: any = { isActive: true };

    if (niche && niche.length > 0) {
      query.niche = { $in: niche };
    }
    if (city) {
      query['location.city'] = city;
    }
    if (minFollowers) {
      query.followerCount = { $gte: minFollowers };
    }

    const sort: any = {};
    if (sortBy === 'followers') sort.followerCount = -1;
    else if (sortBy === 'rating') sort.rating = -1;
    else if (sortBy === 'earnings') sort.totalEarnings = -1;

    const skip = (page - 1) * limit;

    const [influencers, total] = await Promise.all([
      Influencer.find(query).sort(sort).skip(skip).limit(limit),
      Influencer.countDocuments(query),
    ]);

    return { influencers, total };
  }

  /**
   * Create influencer campaign
   */
  async createCampaign(data: Partial<IInfluencerCampaign>): Promise<IInfluencerCampaign> {
    const campaign = new InfluencerCampaign(data);
    await campaign.save();
    return campaign;
  }

  /**
   * Get campaigns for merchant
   */
  async getMerchantCampaigns(merchantId: string, status?: string): Promise<IInfluencerCampaign[]> {
    const query: any = { merchantId };
    if (status) query.status = status;
    return InfluencerCampaign.find(query).sort({ createdAt: -1 });
  }

  /**
   * Apply to campaign
   */
  async applyToCampaign(campaignId: string, influencerId: string, application: {
    proposedContent: string;
    proposedPrice: number;
  }): Promise<IInfluencerCampaign | null> {
    const campaign = await InfluencerCampaign.findById(campaignId);
    if (!campaign || campaign.status !== 'open') return null;

    // Check if already applied
    const existingApp = campaign.applications.find(
      a => a.influencerId === influencerId
    );
    if (existingApp) return null;

    campaign.applications.push({
      influencerId,
      proposedContent: application.proposedContent,
      proposedPrice: application.proposedPrice,
      status: 'pending',
      appliedAt: new Date(),
    });

    await campaign.save();
    return campaign;
  }

  /**
   * Accept application
   */
  async acceptApplication(campaignId: string, influencerId: string): Promise<IInfluencerCampaign | null> {
    const campaign = await InfluencerCampaign.findById(campaignId);
    if (!campaign) return null;

    const application = campaign.applications.find(a => a.influencerId === influencerId);
    if (!application) return null;

    application.status = 'accepted';
    application.respondedAt = new Date();

    if (!campaign.selectedInfluencers.includes(influencerId)) {
      campaign.selectedInfluencers.push(influencerId);
    }

    campaign.status = 'assigned';
    await campaign.save();

    return campaign;
  }

  /**
   * Reject application
   */
  async rejectApplication(campaignId: string, influencerId: string): Promise<IInfluencerCampaign | null> {
    const campaign = await InfluencerCampaign.findById(campaignId);
    if (!campaign) return null;

    const application = campaign.applications.find(a => a.influencerId === influencerId);
    if (!application) return null;

    application.status = 'rejected';
    application.respondedAt = new Date();
    await campaign.save();

    return campaign;
  }

  /**
   * Update campaign analytics
   */
  async updateCampaignAnalytics(campaignId: string, analytics: {
    views?: number;
    engagement?: number;
    conversions?: number;
  }): Promise<IInfluencerCampaign | null> {
    const campaign = await InfluencerCampaign.findById(campaignId);
    if (!campaign) return null;

    if (analytics.views) campaign.analytics.totalViews += analytics.views;
    if (analytics.engagement) campaign.analytics.totalEngagement += analytics.engagement;
    if (analytics.conversions) campaign.analytics.totalConversions += analytics.conversions;

    await campaign.save();
    return campaign;
  }

  /**
   * Get influencer analytics
   */
  async getInfluencerAnalytics(influencerId: string): Promise<any> {
    const influencer = await Influencer.findById(influencerId);
    if (!influencer) return null;

    const campaigns = await InfluencerCampaign.find({
      selectedInfluencers: influencer.userId,
    });

    const completedCampaigns = campaigns.filter(c => c.status === 'completed');
    const totalViews = completedCampaigns.reduce((sum, c) => sum + c.analytics.totalViews, 0);
    const totalEngagement = completedCampaigns.reduce((sum, c) => sum + c.analytics.totalEngagement, 0);
    const avgEngagementRate = totalViews > 0
      ? (totalEngagement / totalViews) * 100
      : 0;

    return {
      totalCampaigns: campaigns.length,
      completedCampaigns: completedCampaigns.length,
      totalEarnings: influencer.totalEarnings,
      totalViews,
      totalEngagement,
      avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      rating: influencer.rating,
    };
  }
}

export const influencerService = new InfluencerService();
