import { Types } from 'mongoose';
import { KarmaCampaign, Participant, IKarmaCampaign, IParticipant, KarmaCampaignType, KarmaCampaignStatus, ParticipationStatus } from '../models/KarmaCampaign';
import { logger } from '../config/logger';
import { growthAnalytics } from './growthAnalytics';

// ── DTOs ────────────────────────────────────────────────────────────────────────

export interface CreateCampaignDTO {
  merchantId: string;
  name: string;
  description: string;
  campaignType: KarmaCampaignType;
  imageUrl?: string;
  coverImageUrl?: string;
  objectives?: string[];
  requirements?: string[];
  impactMetrics?: Record<string, string>;
  location: {
    coordinates: [number, number];
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  schedule: {
    startDate: Date | string;
    endDate: Date | string;
    startTime?: string;
    endTime?: string;
    isAllDay?: boolean;
  };
  participantLimit?: number;
  rewardConfig: {
    coinsPerParticipant: number;
    bonusCoinsForCompletion?: number;
    maxTotalRewards?: number;
  };
  badgeConfig?: {
    badgeName: string;
    badgeDescription?: string;
    badgeIcon?: string;
    earnAfterCount?: number;
  };
  sharingConfig?: {
    autoShareOnCompletion?: boolean;
    shareTextTemplates?: Record<string, string>;
    includeCampaignImage?: boolean;
    includeTrackingLink?: boolean;
  };
  verificationSettings?: {
    requirePhotoProof?: boolean;
    requireCheckIn?: boolean;
    verificationDeadlineHours?: number;
    manualVerificationRequired?: boolean;
  };
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateCampaignDTO {
  name?: string;
  description?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  objectives?: string[];
  requirements?: string[];
  impactMetrics?: Record<string, string>;
  location?: {
    coordinates: [number, number];
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  schedule?: {
    startDate?: Date | string;
    endDate?: Date | string;
    startTime?: string;
    endTime?: string;
    isAllDay?: boolean;
  };
  participantLimit?: number;
  status?: KarmaCampaignStatus;
  rewardConfig?: {
    coinsPerParticipant?: number;
    bonusCoinsForCompletion?: number;
    maxTotalRewards?: number;
  };
  badgeConfig?: {
    badgeName?: string;
    badgeDescription?: string;
    badgeIcon?: string;
    earnAfterCount?: number;
  };
  sharingConfig?: {
    autoShareOnCompletion?: boolean;
    shareTextTemplates?: Record<string, string>;
    includeCampaignImage?: boolean;
    includeTrackingLink?: boolean;
  };
  verificationSettings?: {
    requirePhotoProof?: boolean;
    requireCheckIn?: boolean;
    verificationDeadlineHours?: number;
    manualVerificationRequired?: boolean;
  };
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CampaignFilters {
  merchantId?: string;
  campaignType?: KarmaCampaignType;
  status?: KarmaCampaignStatus;
  city?: string;
  near?: { coordinates: [number, number]; radiusKm: number };
  upcoming?: boolean;
  page?: number;
  limit?: number;
}

export interface JoinCampaignDTO {
  userId: string;
  campaignId: string;
}

export interface VerifyParticipationDTO {
  participantId: string;
  verifiedBy: string;
  verificationNotes?: string;
  coinsEarned?: number;
}

export interface RecordCheckInDTO {
  participantId: string;
  checkInLocation?: {
    coordinates: [number, number];
    address?: string;
  };
  proofPhotoUrl?: string;
}

export interface SubmitFeedbackDTO {
  participantId: string;
  feedback: string;
  rating: number;
}

export interface RecordShareDTO {
  participantId: string;
  platform: string;
  shareText: string;
}

export interface CampaignAnalytics {
  campaignId: string;
  overview: {
    totalRegistrations: number;
    totalAttendances: number;
    totalVerifications: number;
    conversionRate: number; // verified / registered
    rewardDistributionRate: number; // rewarded / verified
  };
  engagement: {
    averageFeedbackRating: number;
    sharesCount: number;
    sharesRate: number; // shares / verified
  };
  rewards: {
    totalCoinsAwarded: number;
    averageCoinsPerParticipant: number;
  };
  participantBreakdown: {
    byStatus: Record<ParticipationStatus, number>;
    dailyRegistrations: Array<{ date: string; count: number }>;
  };
}

export interface MerchantGoodwillReport {
  merchantId: string;
  campaignsOrganized: number;
  totalParticipantsImpacted: number;
  totalCoinsDistributed: number;
  goodwillScore: number;
  topCampaignTypes: Array<{ type: KarmaCampaignType; count: number }>;
  recentCampaigns: Array<{
    campaignId: string;
    name: string;
    type: KarmaCampaignType;
    participants: number;
    coinsDistributed: number;
    date: Date;
  }>;
}

// ── Share Text Templates ────────────────────────────────────────────────────────

const SHARE_TEMPLATES: Record<KarmaCampaignType, string> = {
  blood_donation: 'I just donated blood and earned Branded Coins! Every drop counts. Join the cause at {merchantName} and make a difference. {campaignLink}',
  food_distribution: 'I participated in a food distribution drive and earned Branded Coins! Together we can end hunger. Join {merchantName} and help feed those in need. {campaignLink}',
  tree_plantation: 'I planted trees today and earned Branded Coins! Let\'s grow a greener future together. Join {merchantName} in making the planet greener. {campaignLink}',
  ngo_collaboration: 'I supported an NGO cause today and earned Branded Coins! Small actions create big changes. Thank you {merchantName} for making giving easy. {campaignLink}',
  volunteer: 'I volunteered today and earned Branded Coins! Giving back feels amazing. Join me in making a difference with {merchantName}. {campaignLink}',
  environment: 'I took action for the environment today and earned Branded Coins! Every small step matters. Join {merchantName} in protecting our planet. {campaignLink}',
};

// ── KarmaCampaignService ─────────────────────────────────────────────────────────

export class KarmaCampaignService {

  /**
   * Create a new karma campaign
   */
  async createCampaign(data: CreateCampaignDTO): Promise<IKarmaCampaign> {
    // Validate dates
    const startDate = new Date(data.schedule.startDate);
    const endDate = new Date(data.schedule.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format for schedule');
    }

    if (endDate <= startDate) {
      throw new Error('End date must be after start date');
    }

    // Validate coordinates
    if (!data.location.coordinates || data.location.coordinates.length !== 2) {
      throw new Error('Valid coordinates [longitude, latitude] are required');
    }

    const [lng, lat] = data.location.coordinates;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid coordinates. Longitude must be -180 to 180, latitude must be -90 to 90');
    }

    // Check reward config
    if (data.rewardConfig.coinsPerParticipant < 0) {
      throw new Error('Coins per participant cannot be negative');
    }

    const campaign = new KarmaCampaign({
      merchantId: new Types.ObjectId(data.merchantId),
      name: data.name,
      description: data.description,
      campaignType: data.campaignType,
      imageUrl: data.imageUrl,
      coverImageUrl: data.coverImageUrl,
      objectives: data.objectives || [],
      requirements: data.requirements || [],
      impactMetrics: data.impactMetrics,
      location: {
        type: 'Point',
        coordinates: data.location.coordinates,
        address: data.location.address,
        city: data.location.city,
        state: data.location.state,
        pincode: data.location.pincode,
        landmark: data.location.landmark,
      },
      schedule: {
        startDate,
        endDate,
        startTime: data.schedule.startTime,
        endTime: data.schedule.endTime,
        isAllDay: data.schedule.isAllDay,
      },
      participantLimit: data.participantLimit,
      rewardConfig: {
        coinsPerParticipant: data.rewardConfig.coinsPerParticipant,
        bonusCoinsForCompletion: data.rewardConfig.bonusCoinsForCompletion || 0,
        maxTotalRewards: data.rewardConfig.maxTotalRewards,
        currentRewardPoolUsed: 0,
      },
      badgeConfig: data.badgeConfig ? {
        badgeName: data.badgeConfig.badgeName,
        badgeDescription: data.badgeConfig.badgeDescription,
        badgeIcon: data.badgeConfig.badgeIcon,
        earnAfterCount: data.badgeConfig.earnAfterCount || 1,
      } : undefined,
      sharingConfig: data.sharingConfig ? {
        autoShareOnCompletion: data.sharingConfig.autoShareOnCompletion ?? true,
        shareTextTemplates: data.sharingConfig.shareTextTemplates,
        includeCampaignImage: data.sharingConfig.includeCampaignImage ?? true,
        includeTrackingLink: data.sharingConfig.includeTrackingLink ?? true,
      } : undefined,
      verificationSettings: data.verificationSettings ? {
        requirePhotoProof: data.verificationSettings.requirePhotoProof ?? false,
        requireCheckIn: data.verificationSettings.requireCheckIn ?? false,
        verificationDeadlineHours: data.verificationSettings.verificationDeadlineHours ?? 72,
        manualVerificationRequired: data.verificationSettings.manualVerificationRequired ?? false,
      } : {
        requirePhotoProof: false,
        requireCheckIn: false,
        verificationDeadlineHours: 72,
        manualVerificationRequired: false,
      },
      tags: data.tags,
      metadata: data.metadata,
      createdBy: data.createdBy ? new Types.ObjectId(data.createdBy) : undefined,
      stats: {
        totalRegistrations: 0,
        totalAttendances: 0,
        totalVerifications: 0,
        totalRewardsDistributed: 0,
        totalCoinsAwarded: 0,
        sharesCount: 0,
        viewsCount: 0,
      },
      merchantGoodwill: {
        totalCampaignsOrganized: 0,
        totalParticipantsImpacted: 0,
        totalCoinsDistributed: 0,
        goodwillScore: 0,
      },
      status: 'draft',
    });

    await campaign.save();
    logger.info('[KarmaCampaignService] Created campaign', { campaignId: campaign._id, name: campaign.name, type: campaign.campaignType });

    // Track growth analytics event
    this.trackCampaignEvent('campaign_created', campaign).catch((err) =>
      logger.warn('[KarmaCampaignService] Growth analytics tracking failed', { error: err.message })
    );

    return campaign;
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(id: string): Promise<IKarmaCampaign | null> {
    return KarmaCampaign.findById(id);
  }

  /**
   * Get campaign by ID with merchant details
   */
  async getCampaignWithMerchant(id: string): Promise<IKarmaCampaign | null> {
    return KarmaCampaign.findById(id).populate('merchantId', 'name businessName logoUrl');
  }

  /**
   * List campaigns with filters
   */
  async listCampaigns(filters: CampaignFilters = {}): Promise<{ campaigns: IKarmaCampaign[]; total: number }> {
    const query: Record<string, unknown> = {};

    if (filters.merchantId) {
      query.merchantId = new Types.ObjectId(filters.merchantId);
    }
    if (filters.campaignType) {
      query.campaignType = filters.campaignType;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.city) {
      query['location.city'] = filters.city;
    }
    if (filters.near) {
      query['location.coordinates'] = {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: filters.near.coordinates,
          },
          $maxDistance: filters.near.radiusKm * 1000, // Convert km to meters
        },
      };
    }
    if (filters.upcoming) {
      query['schedule.startDate'] = { $gte: new Date() };
      query.status = 'active';
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      KarmaCampaign.find(query).sort({ 'schedule.startDate': -1 }).skip(skip).limit(limit),
      KarmaCampaign.countDocuments(query),
    ]);

    return { campaigns, total };
  }

  /**
   * Update a campaign
   */
  async updateCampaign(id: string, data: UpdateCampaignDTO): Promise<IKarmaCampaign | null> {
    const campaign = await KarmaCampaign.findById(id);
    if (!campaign) {
      return null;
    }

    // Cannot update certain fields if campaign is active
    if (campaign.status === 'active' && (data.schedule || data.location || data.participantLimit)) {
      throw new Error('Cannot modify schedule, location, or participant limit for an active campaign');
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.objectives !== undefined) updateData.objectives = data.objectives;
    if (data.requirements !== undefined) updateData.requirements = data.requirements;
    if (data.impactMetrics !== undefined) updateData.impactMetrics = data.impactMetrics;
    if (data.participantLimit !== undefined) updateData.participantLimit = data.participantLimit;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    if (data.location !== undefined) {
      updateData.location = {
        type: 'Point',
        coordinates: data.location.coordinates,
        address: data.location.address,
        city: data.location.city,
        state: data.location.state,
        pincode: data.location.pincode,
        landmark: data.location.landmark,
      };
    }

    if (data.schedule !== undefined) {
      const schedule: Record<string, unknown> = { ...campaign.schedule as unknown as Record<string, unknown> };
      if (data.schedule.startDate !== undefined) schedule.startDate = new Date(data.schedule.startDate);
      if (data.schedule.endDate !== undefined) schedule.endDate = new Date(data.schedule.endDate);
      if (data.schedule.startTime !== undefined) schedule.startTime = data.schedule.startTime;
      if (data.schedule.endTime !== undefined) schedule.endTime = data.schedule.endTime;
      if (data.schedule.isAllDay !== undefined) schedule.isAllDay = data.schedule.isAllDay;
      updateData.schedule = schedule;
    }

    if (data.rewardConfig !== undefined) {
      const rewardConfig: Record<string, unknown> = { ...campaign.rewardConfig as unknown as Record<string, unknown> };
      if (data.rewardConfig.coinsPerParticipant !== undefined) rewardConfig.coinsPerParticipant = data.rewardConfig.coinsPerParticipant;
      if (data.rewardConfig.bonusCoinsForCompletion !== undefined) rewardConfig.bonusCoinsForCompletion = data.rewardConfig.bonusCoinsForCompletion;
      if (data.rewardConfig.maxTotalRewards !== undefined) rewardConfig.maxTotalRewards = data.rewardConfig.maxTotalRewards;
      updateData.rewardConfig = rewardConfig;
    }

    if (data.badgeConfig !== undefined) {
      const badgeConfig: Record<string, unknown> = { ...(campaign.badgeConfig as unknown as Record<string, unknown>) };
      if (data.badgeConfig.badgeName !== undefined) badgeConfig.badgeName = data.badgeConfig.badgeName;
      if (data.badgeConfig.badgeDescription !== undefined) badgeConfig.badgeDescription = data.badgeConfig.badgeDescription;
      if (data.badgeConfig.badgeIcon !== undefined) badgeConfig.badgeIcon = data.badgeConfig.badgeIcon;
      if (data.badgeConfig.earnAfterCount !== undefined) badgeConfig.earnAfterCount = data.badgeConfig.earnAfterCount;
      updateData.badgeConfig = badgeConfig;
    }

    if (data.sharingConfig !== undefined) {
      const sharingConfig: Record<string, unknown> = { ...(campaign.sharingConfig as unknown as Record<string, unknown>) };
      if (data.sharingConfig.autoShareOnCompletion !== undefined) sharingConfig.autoShareOnCompletion = data.sharingConfig.autoShareOnCompletion;
      if (data.sharingConfig.shareTextTemplates !== undefined) sharingConfig.shareTextTemplates = data.sharingConfig.shareTextTemplates;
      if (data.sharingConfig.includeCampaignImage !== undefined) sharingConfig.includeCampaignImage = data.sharingConfig.includeCampaignImage;
      if (data.sharingConfig.includeTrackingLink !== undefined) sharingConfig.includeTrackingLink = data.sharingConfig.includeTrackingLink;
      updateData.sharingConfig = sharingConfig;
    }

    if (data.verificationSettings !== undefined) {
      const verificationSettings: Record<string, unknown> = { ...campaign.verificationSettings as unknown as Record<string, unknown> };
      if (data.verificationSettings.requirePhotoProof !== undefined) verificationSettings.requirePhotoProof = data.verificationSettings.requirePhotoProof;
      if (data.verificationSettings.requireCheckIn !== undefined) verificationSettings.requireCheckIn = data.verificationSettings.requireCheckIn;
      if (data.verificationSettings.verificationDeadlineHours !== undefined) verificationSettings.verificationDeadlineHours = data.verificationSettings.verificationDeadlineHours;
      if (data.verificationSettings.manualVerificationRequired !== undefined) verificationSettings.manualVerificationRequired = data.verificationSettings.manualVerificationRequired;
      updateData.verificationSettings = verificationSettings;
    }

    const updatedCampaign = await KarmaCampaign.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (updatedCampaign) {
      logger.info('[KarmaCampaignService] Updated campaign', { campaignId: id });
    }

    return updatedCampaign;
  }

  /**
   * Publish a campaign (change status from draft to active)
   */
  async publishCampaign(id: string): Promise<IKarmaCampaign | null> {
    const campaign = await KarmaCampaign.findById(id);
    if (!campaign) {
      return null;
    }

    if (campaign.status !== 'draft') {
      throw new Error(`Cannot publish campaign with status: ${campaign.status}`);
    }

    if (new Date(campaign.schedule.startDate) < new Date()) {
      throw new Error('Cannot publish a campaign with a past start date');
    }

    campaign.status = 'active';
    await campaign.save();

    logger.info('[KarmaCampaignService] Published campaign', { campaignId: id });
    return campaign;
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(id: string, reason?: string): Promise<IKarmaCampaign | null> {
    const campaign = await KarmaCampaign.findById(id);
    if (!campaign) {
      return null;
    }

    if (campaign.status === 'completed') {
      throw new Error('Cannot cancel a completed campaign');
    }

    campaign.status = 'cancelled';
    campaign.metadata = { ...campaign.metadata, cancellationReason: reason };

    // Refund participants who haven't been verified
    const unverifiedParticipants = await Participant.find({
      campaignId: campaign._id,
      status: { $in: ['registered', 'attended'] },
    });

    // Mark participants as cancelled
    await Participant.updateMany(
      { campaignId: campaign._id, status: { $in: ['registered', 'attended'] } },
      { $set: { status: 'registered', metadata: { ...campaign.metadata, cancelledAt: new Date() } } },
    );

    await campaign.save();

    logger.info('[KarmaCampaignService] Cancelled campaign', { campaignId: id, reason, affectedParticipants: unverifiedParticipants.length });
    return campaign;
  }

  /**
   * Complete a campaign
   */
  async completeCampaign(id: string): Promise<IKarmaCampaign | null> {
    const campaign = await KarmaCampaign.findById(id);
    if (!campaign) {
      return null;
    }

    if (campaign.status !== 'active') {
      throw new Error(`Cannot complete campaign with status: ${campaign.status}`);
    }

    campaign.status = 'completed';

    // Update merchant goodwill
    const verifiedCount = await Participant.countDocuments({
      campaignId: campaign._id,
      status: { $in: ['verified', 'rewarded'] },
    });

    campaign.merchantGoodwill = {
      totalCampaignsOrganized: campaign.merchantGoodwill.totalCampaignsOrganized + 1,
      totalParticipantsImpacted: campaign.merchantGoodwill.totalParticipantsImpacted + verifiedCount,
      totalCoinsDistributed: campaign.merchantGoodwill.totalCoinsDistributed + campaign.stats.totalCoinsAwarded,
      goodwillScore: this.calculateGoodwillScore(
        campaign.merchantGoodwill.totalCampaignsOrganized + 1,
        campaign.merchantGoodwill.totalParticipantsImpacted + verifiedCount,
        campaign.merchantGoodwill.totalCoinsDistributed + campaign.stats.totalCoinsAwarded,
      ),
    };

    await campaign.save();

    logger.info('[KarmaCampaignService] Completed campaign', { campaignId: id, verifiedParticipants: verifiedCount });
    return campaign;
  }

  /**
   * Delete a campaign (soft delete by cancelling)
   */
  async deleteCampaign(id: string): Promise<boolean> {
    const campaign = await this.cancelCampaign(id, 'Campaign deleted');
    return !!campaign;
  }

  /**
   * Join a campaign
   */
  async joinCampaign(data: JoinCampaignDTO): Promise<{ success: boolean; participant?: IParticipant; message: string }> {
    const campaign = await KarmaCampaign.findById(data.campaignId);
    if (!campaign) {
      return { success: false, message: 'Campaign not found' };
    }

    if (campaign.status !== 'active') {
      return { success: false, message: `Cannot join campaign with status: ${campaign.status}` };
    }

    const now = new Date();
    if (now < campaign.schedule.startDate) {
      return { success: false, message: 'Campaign has not started yet' };
    }
    if (now > campaign.schedule.endDate) {
      return { success: false, message: 'Campaign has ended' };
    }

    // Check participant limit
    if (campaign.participantLimit) {
      const currentParticipants = await Participant.countDocuments({
        campaignId: campaign._id,
        status: { $in: ['registered', 'attended', 'verified', 'rewarded'] },
      });
      if (currentParticipants >= campaign.participantLimit) {
        return { success: false, message: 'Campaign is full' };
      }
    }

    // Check if already registered
    const existingParticipant = await Participant.findOne({
      campaignId: new Types.ObjectId(data.campaignId),
      userId: new Types.ObjectId(data.userId),
    });

    if (existingParticipant) {
      return { success: false, message: 'Already registered for this campaign', participant: existingParticipant };
    }

    const participant = new Participant({
      campaignId: campaign._id,
      userId: new Types.ObjectId(data.userId),
      status: 'registered',
      registeredAt: new Date(),
    });

    await participant.save();

    // Update campaign stats
    await KarmaCampaign.updateOne(
      { _id: campaign._id },
      { $inc: { 'stats.totalRegistrations': 1 } },
    );

    logger.info('[KarmaCampaignService] User joined campaign', { campaignId: data.campaignId, userId: data.userId });

    // Track analytics
    this.trackParticipationEvent('joined', campaign, participant).catch((err) =>
      logger.warn('[KarmaCampaignService] Tracking failed', { error: err.message })
    );

    return { success: true, participant, message: 'Successfully registered for campaign' };
  }

  /**
   * Get participant details
   */
  async getParticipant(participantId: string): Promise<IParticipant | null> {
    return Participant.findById(participantId);
  }

  /**
   * Get user's participation in a campaign
   */
  async getUserParticipation(userId: string, campaignId: string): Promise<IParticipant | null> {
    return Participant.findOne({
      userId: new Types.ObjectId(userId),
      campaignId: new Types.ObjectId(campaignId),
    });
  }

  /**
   * List participants for a campaign
   */
  async listParticipants(
    campaignId: string,
    options: { status?: ParticipationStatus; page?: number; limit?: number } = {},
  ): Promise<{ participants: IParticipant[]; total: number }> {
    const query: Record<string, unknown> = { campaignId: new Types.ObjectId(campaignId) };
    if (options.status) {
      query.status = options.status;
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [participants, total] = await Promise.all([
      Participant.find(query).populate('userId', 'name email phone').sort({ registeredAt: -1 }).skip(skip).limit(limit),
      Participant.countDocuments(query),
    ]);

    return { participants, total };
  }

  /**
   * List user's campaign participations
   */
  async getUserParticipations(userId: string): Promise<{ past: IParticipant[]; upcoming: IParticipant[] }> {
    const now = new Date();
    const userObjectId = new Types.ObjectId(userId);

    const participations = await Participant.find({ userId: userObjectId })
      .populate('campaignId')
      .sort({ registeredAt: -1 });

    const past: IParticipant[] = [];
    const upcoming: IParticipant[] = [];

    for (const p of participations) {
      const campaign = p.campaignId as unknown as IKarmaCampaign;
      if (campaign && campaign.schedule) {
        if (new Date(campaign.schedule.endDate) < now) {
          past.push(p);
        } else {
          upcoming.push(p);
        }
      } else {
        past.push(p);
      }
    }

    return { past, upcoming };
  }

  /**
   * Record participant check-in
   */
  async recordCheckIn(data: RecordCheckInDTO): Promise<IParticipant | null> {
    const participant = await Participant.findById(data.participantId);
    if (!participant) {
      return null;
    }

    if (participant.status !== 'registered') {
      throw new Error(`Cannot check in participant with status: ${participant.status}`);
    }

    participant.status = 'attended';
    participant.checkInTime = new Date();
    if (data.proofPhotoUrl) {
      participant.proofPhotoUrl = data.proofPhotoUrl;
    }
    if (data.checkInLocation) {
      participant.checkInLocation = {
        type: 'Point',
        coordinates: data.checkInLocation.coordinates,
        address: data.checkInLocation.address,
      };
    }

    await participant.save();

    // Update campaign stats
    await KarmaCampaign.updateOne(
      { _id: participant.campaignId },
      { $inc: { 'stats.totalAttendances': 1 } },
    );

    logger.info('[KarmaCampaignService] Participant checked in', { participantId: data.participantId });

    return participant;
  }

  /**
   * Verify participant participation
   */
  async verifyParticipation(data: VerifyParticipationDTO): Promise<IParticipant | null> {
    const session = await (await import('mongoose')).default.startSession();
    session.startTransaction();

    try {
      const participant = await Participant.findById(data.participantId).session(session);
      if (!participant) {
        await session.abortTransaction();
        return null;
      }

      const campaign = await KarmaCampaign.findById(participant.campaignId).session(session);
      if (!campaign) {
        await session.abortTransaction();
        throw new Error('Campaign not found');
      }

      // Update participant
      participant.status = 'verified';
      participant.verifiedAt = new Date();
      participant.verifiedBy = new Types.ObjectId(data.verifiedBy);
      if (data.verificationNotes) {
        participant.verificationNotes = data.verificationNotes;
      }

      // Calculate coins
      let coinsEarned = data.coinsEarned || campaign.rewardConfig.coinsPerParticipant;
      const rewardPoolUsed = campaign.rewardConfig.currentRewardPoolUsed || 0;
      const maxRewards = campaign.rewardConfig.maxTotalRewards;

      // Check reward pool limits
      if (maxRewards && rewardPoolUsed >= maxRewards) {
        coinsEarned = 0;
      } else if (maxRewards) {
        const remainingPool = maxRewards - rewardPoolUsed;
        coinsEarned = Math.min(coinsEarned, remainingPool);
      }

      participant.coinsEarned = coinsEarned;

      await participant.save({ session });

      // Update campaign stats
      await KarmaCampaign.updateOne(
        { _id: campaign._id },
        {
          $inc: {
            'stats.totalVerifications': 1,
            'stats.totalRewardsDistributed': coinsEarned > 0 ? 1 : 0,
            'stats.totalCoinsAwarded': coinsEarned,
            'rewardConfig.currentRewardPoolUsed': coinsEarned > 0 ? 1 : 0,
          },
        },
        { session },
      );

      await session.commitTransaction();

      logger.info('[KarmaCampaignService] Verified participation', {
        participantId: data.participantId,
        coinsEarned,
        verifiedBy: data.verifiedBy,
      });

      // Track analytics
      this.trackParticipationEvent('verified', campaign, participant).catch((err) =>
        logger.warn('[KarmaCampaignService] Tracking failed', { error: err.message })
      );

      return participant;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Award rewards (mark as rewarded)
   */
  async awardRewards(participantId: string): Promise<IParticipant | null> {
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return null;
    }

    if (participant.status !== 'verified') {
      throw new Error(`Cannot award rewards to participant with status: ${participant.status}`);
    }

    participant.status = 'rewarded';
    await participant.save();

    // Track badge earning if applicable
    const campaign = await KarmaCampaign.findById(participant.campaignId);
    if (campaign?.badgeConfig) {
      const earnAfterCount = campaign.badgeConfig.earnAfterCount ?? 1;
      const userBadgeCount = await Participant.countDocuments({
        userId: participant.userId,
        status: 'rewarded',
        badgeEarned: true,
      });

      if (userBadgeCount + 1 >= earnAfterCount) {
        participant.badgeEarned = true;
        participant.badgeEarnedAt = new Date();
        await participant.save();
      }
    }

    logger.info('[KarmaCampaignService] Rewards awarded', { participantId });

    return participant;
  }

  /**
   * Record social share
   */
  async recordShare(data: RecordShareDTO): Promise<IParticipant | null> {
    const participant = await Participant.findById(data.participantId);
    if (!participant) {
      return null;
    }

    participant.sharedOnSocial = true;
    participant.sharePlatform = data.platform;
    participant.shareText = data.shareText;
    participant.sharedAt = new Date();

    await participant.save();

    // Update campaign stats
    await KarmaCampaign.updateOne(
      { _id: participant.campaignId },
      { $inc: { 'stats.sharesCount': 1 } },
    );

    logger.info('[KarmaCampaignService] Recorded share', {
      participantId: data.participantId,
      platform: data.platform,
    });

    return participant;
  }

  /**
   * Generate share text for a campaign
   */
  generateShareText(campaign: IKarmaCampaign, merchantName: string, trackingLink?: string): string {
    const template = campaign.sharingConfig?.shareTextTemplates?.default || SHARE_TEMPLATES[campaign.campaignType];
    const campaignLink = trackingLink || `${process.env.APP_URL || 'https://rez.money'}/karma-campaigns/${campaign._id}`;

    return template
      .replace('{merchantName}', merchantName)
      .replace('{campaignLink}', campaignLink);
  }

  /**
   * Submit feedback
   */
  async submitFeedback(data: SubmitFeedbackDTO): Promise<IParticipant | null> {
    const participant = await Participant.findById(data.participantId);
    if (!participant) {
      return null;
    }

    if (!['verified', 'rewarded'].includes(participant.status)) {
      throw new Error('Feedback can only be submitted after verification');
    }

    participant.feedback = data.feedback;
    participant.feedbackRating = Math.max(1, Math.min(5, data.rating));

    await participant.save();

    logger.info('[KarmaCampaignService] Feedback submitted', { participantId: data.participantId, rating: data.rating });

    return participant;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics | null> {
    const campaign = await KarmaCampaign.findById(campaignId);
    if (!campaign) {
      return null;
    }

    const participants = await Participant.find({ campaignId });
    const totalRegistrations = participants.length;
    const totalAttendances = participants.filter((p) => ['attended', 'verified', 'rewarded'].includes(p.status)).length;
    const totalVerifications = participants.filter((p) => ['verified', 'rewarded'].includes(p.status)).length;
    const totalRewards = participants.filter((p) => p.status === 'rewarded').length;
    const totalCoinsAwarded = participants.reduce((sum, p) => sum + (p.coinsEarned || 0), 0);
    const feedbackRatings = participants.filter((p) => p.feedbackRating).map((p) => p.feedbackRating!);
    const sharesCount = participants.filter((p) => p.sharedOnSocial).length;

    // Calculate daily registrations
    const dailyMap = new Map<string, number>();
    for (const p of participants) {
      const date = p.registeredAt.toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    }
    const dailyRegistrations = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      campaignId,
      overview: {
        totalRegistrations,
        totalAttendances,
        totalVerifications,
        conversionRate: totalRegistrations > 0 ? (totalVerifications / totalRegistrations) * 100 : 0,
        rewardDistributionRate: totalVerifications > 0 ? (totalRewards / totalVerifications) * 100 : 0,
      },
      engagement: {
        averageFeedbackRating: feedbackRatings.length > 0 ? feedbackRatings.reduce((a, b) => a + b, 0) / feedbackRatings.length : 0,
        sharesCount,
        sharesRate: totalVerifications > 0 ? (sharesCount / totalVerifications) * 100 : 0,
      },
      rewards: {
        totalCoinsAwarded,
        averageCoinsPerParticipant: totalVerifications > 0 ? totalCoinsAwarded / totalVerifications : 0,
      },
      participantBreakdown: {
        byStatus: {
          registered: participants.filter((p) => p.status === 'registered').length,
          attended: participants.filter((p) => p.status === 'attended').length,
          verified: participants.filter((p) => p.status === 'verified').length,
          rewarded: participants.filter((p) => p.status === 'rewarded').length,
        },
        dailyRegistrations,
      },
    };
  }

  /**
   * Get merchant goodwill report
   */
  async getMerchantGoodwillReport(merchantId: string): Promise<MerchantGoodwillReport | null> {
    const campaigns = await KarmaCampaign.find({ merchantId: new Types.ObjectId(merchantId) });
    if (campaigns.length === 0) {
      return null;
    }

    // Aggregate goodwill from all campaigns
    let totalCampaigns = 0;
    let totalParticipants = 0;
    let totalCoins = 0;
    const typeCountMap = new Map<KarmaCampaignType, number>();
    const recentCampaignsData: Array<{
      campaignId: string;
      name: string;
      type: KarmaCampaignType;
      participants: number;
      coinsDistributed: number;
      date: Date;
    }> = [];

    for (const campaign of campaigns) {
      totalCampaigns += 1;
      totalParticipants += campaign.stats.totalVerifications;
      totalCoins += campaign.stats.totalCoinsAwarded;

      const typeCount = typeCountMap.get(campaign.campaignType) || 0;
      typeCountMap.set(campaign.campaignType, typeCount + 1);

      recentCampaignsData.push({
        campaignId: String(campaign._id),
        name: campaign.name,
        type: campaign.campaignType,
        participants: campaign.stats.totalVerifications,
        coinsDistributed: campaign.stats.totalCoinsAwarded,
        date: campaign.createdAt,
      });
    }

    const goodwillScore = this.calculateGoodwillScore(totalCampaigns, totalParticipants, totalCoins);
    const topCampaignTypes = Array.from(typeCountMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    recentCampaignsData.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      merchantId,
      campaignsOrganized: totalCampaigns,
      totalParticipantsImpacted: totalParticipants,
      totalCoinsDistributed: totalCoins,
      goodwillScore,
      topCampaignTypes,
      recentCampaigns: recentCampaignsData.slice(0, 10),
    };
  }

  /**
   * Get nearby campaigns
   */
  async getNearbyCampaigns(
    coordinates: [number, number],
    radiusKm: number,
    options: { campaignType?: KarmaCampaignType; status?: KarmaCampaignStatus } = {},
  ): Promise<IKarmaCampaign[]> {
    const query: Record<string, unknown> = {
      status: options.status || 'active',
      'schedule.endDate': { $gte: new Date() },
      'location.coordinates': {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates,
          },
          $maxDistance: radiusKm * 1000,
        },
      },
    };

    if (options.campaignType) {
      query.campaignType = options.campaignType;
    }

    return KarmaCampaign.find(query).limit(50);
  }

  /**
   * Increment campaign views
   */
  async incrementViews(campaignId: string): Promise<void> {
    await KarmaCampaign.updateOne(
      { _id: campaignId },
      { $inc: { 'stats.viewsCount': 1 } },
    );
  }

  /**
   * Auto-complete expired campaigns
   */
  async autoCompleteExpiredCampaigns(): Promise<number> {
    const result = await KarmaCampaign.updateMany(
      {
        status: 'active',
        'schedule.endDate': { $lt: new Date() },
      },
      { $set: { status: 'completed' } },
    );

    if (result.modifiedCount > 0) {
      logger.info('[KarmaCampaignService] Auto-completed expired campaigns', { count: result.modifiedCount });
    }

    return result.modifiedCount;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────────

  private calculateGoodwillScore(campaigns: number, participants: number, coins: number): number {
    // Simple scoring algorithm: campaigns (40%) + participants (40%) + coins (20%)
    const campaignScore = Math.min(campaigns * 10, 100) * 0.4;
    const participantScore = Math.min(participants * 0.5, 100) * 0.4;
    const coinScore = Math.min(coins / 100, 100) * 0.2;

    return Math.round(campaignScore + participantScore + coinScore);
  }

  private async trackCampaignEvent(eventType: string, campaign: IKarmaCampaign): Promise<void> {
    await growthAnalytics.trackEvent({
      eventType: `karma_${eventType}` as any,
      sourceService: 'marketing',
      merchantId: String(campaign.merchantId),
      metadata: {
        campaignId: String(campaign._id),
        campaignType: campaign.campaignType,
        campaignName: campaign.name,
      },
    });
  }

  private async trackParticipationEvent(
    eventType: string,
    campaign: IKarmaCampaign,
    participant: IParticipant,
  ): Promise<void> {
    await growthAnalytics.trackEvent({
      eventType: `karma_participation_${eventType}` as any,
      sourceService: 'marketing',
      userId: String(participant.userId),
      merchantId: String(campaign.merchantId),
      metadata: {
        campaignId: String(campaign._id),
        campaignType: campaign.campaignType,
        coinsEarned: participant.coinsEarned,
      },
    });
  }
}

// ── Singleton Instance ──────────────────────────────────────────────────────────

export const karmaCampaignService = new KarmaCampaignService();
