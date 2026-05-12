/**
 * DOOH Service - Database Repositories
 *
 * Repository pattern for database operations.
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  ScreenModel,
  IScreenDocument,
  CampaignModel,
  ICampaignDocument,
  ImpressionEventModel,
  IImpressionEventDocument,
  PlaylistModel,
  IPlaylistDocument,
  PayoutModel,
  IPayoutDocument,
  HeartbeatModel,
  IHeartbeatDocument,
} from './schemas';

// ============================================================================
// Screen Repository
// ============================================================================

export interface ScreenFilter {
  type?: string;
  networkType?: string;
  city?: string;
  area?: string;
  status?: string;
  ownerType?: string;
  ownerId?: string;
  minCpm?: number;
  maxCpm?: number;
  minFootfall?: number;
}

export interface ScreenRegistrationData {
  name: string;
  type: string;
  networkType?: string;
  locationType: string;
  location: {
    city: string;
    area: string;
    zone?: string;
    lat: number;
    lng: number;
    address?: string;
  };
  ownerId: string;
  ownerEmail?: string;
  ownerPhone?: string;
  hardware?: {
    model?: string;
    os?: string;
    resolution?: string;
    screenSize?: number;
  };
  operatingHours?: {
    open: string;
    close: string;
    timezone: string;
  };
  audienceProfile?: {
    primary: { type: string; percentage: number }[];
    peakHours: { start: string; end: string; dayType: string }[];
    avgDwellTime: number;
    dailyFootfall?: number;
  };
  cpm?: number;
}

export interface ScreenUpdateData {
  name?: string;
  hardware?: {
    model?: string;
    os?: string;
    resolution?: string;
    screenSize?: number;
  };
  operatingHours?: {
    open: string;
    close: string;
    timezone: string;
  };
  cpm?: number;
}

export class ScreenRepository {
  /**
   * Generate a secure API key hash
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Generate a new screen API key
   */
  generateApiKey(screenId: string): string {
    const randomPart = crypto.randomBytes(16).toString('hex');
    const screenPart = screenId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    return `dooh_sk_${screenPart}_${randomPart}`;
  }

  /**
   * Register a new screen
   */
  async register(data: ScreenRegistrationData): Promise<IScreenDocument> {
    const screenId = `screen_${uuidv4()}`;
    const apiKey = this.generateApiKey(screenId);

    const screen = new ScreenModel({
      screenId,
      name: data.name,
      type: data.type,
      networkType: data.networkType || 'mass',
      locationType: data.locationType,
      location: data.location,
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail,
      ownerPhone: data.ownerPhone,
      hardware: data.hardware,
      operatingHours: data.operatingHours,
      audienceProfile: data.audienceProfile,
      cpm: data.cpm || 10,
      apiKeyHash: this.hashApiKey(apiKey),
      playlistVersion: 0,
      earningsBalance: 0,
      earningsPaid: 0,
      totalImpressions: 0,
      totalScans: 0,
    });

    await screen.save();

    return screen;
  }

  /**
   * Get screen by ID
   */
  async findById(screenId: string): Promise<IScreenDocument | null> {
    return ScreenModel.findOne({ screenId });
  }

  /**
   * Find screen by API key
   */
  async findByApiKey(apiKey: string): Promise<IScreenDocument | null> {
    const hash = this.hashApiKey(apiKey);
    return ScreenModel.findOne({ apiKeyHash: hash });
  }

  /**
   * Validate API key
   */
  async validateApiKey(screenId: string, apiKey: string): Promise<boolean> {
    const screen = await this.findByApiKey(apiKey);
    if (!screen) return false;

    // Use timing-safe comparison
    if (screen.screenId !== screenId) return false;

    const hash = this.hashApiKey(apiKey);
    if (screen.apiKeyHash.length !== hash.length) return false;

    let result = 0;
    for (let i = 0; i < screen.apiKeyHash.length; i++) {
      result |= screen.apiKeyHash.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Get all screens
   */
  async findAll(): Promise<IScreenDocument[]> {
    return ScreenModel.find().sort({ createdAt: -1 });
  }

  /**
   * Query screens with filters
   */
  async find(filter: ScreenFilter): Promise<IScreenDocument[]> {
    const query: Record<string, unknown> = {};

    if (filter.type) query.type = filter.type;
    if (filter.networkType) query.networkType = filter.networkType;
    if (filter.city) query['location.city'] = { $regex: new RegExp(filter.city, 'i') };
    if (filter.area) query['location.area'] = { $regex: new RegExp(filter.area, 'i') };
    if (filter.status) query.status = filter.status;
    if (filter.ownerType) query.ownerType = filter.ownerType;
    if (filter.ownerId) query.ownerId = filter.ownerId;
    if (filter.minCpm) query.cpm = { ...query.cpm as object, $gte: filter.minCpm };
    if (filter.maxCpm) query.cpm = { ...query.cpm as object, $lte: filter.maxCpm };
    if (filter.minFootfall) {
      query['audienceProfile.dailyFootfall'] = { $gte: filter.minFootfall };
    }

    return ScreenModel.find(query).sort({ createdAt: -1 });
  }

  /**
   * Update screen
   */
  async update(screenId: string, data: ScreenUpdateData): Promise<IScreenDocument | null> {
    return ScreenModel.findOneAndUpdate(
      { screenId },
      { $set: data },
      { new: true }
    );
  }

  /**
   * Update screen status
   */
  async updateStatus(screenId: string, status: string): Promise<IScreenDocument | null> {
    return ScreenModel.findOneAndUpdate(
      { screenId },
      {
        $set: {
          status,
          lastSeen: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Process heartbeat
   */
  async processHeartbeat(
    screenId: string,
    heartbeat: {
      status: string;
      playlistVersion?: number;
      impressionsLastHour?: number;
      errors?: string[];
    }
  ): Promise<{ needsUpdate: boolean; screen: IScreenDocument | null }> {
    const screen = await ScreenModel.findOne({ screenId });

    if (!screen) {
      return { needsUpdate: false, screen: null };
    }

    const needsUpdate =
      screen.playlistVersion === 0 ||
      (heartbeat.playlistVersion && heartbeat.playlistVersion !== screen.playlistVersion) ||
      !screen.lastSync ||
      (Date.now() - new Date(screen.lastSync).getTime() > 60 * 60 * 1000);

    await ScreenModel.updateOne(
      { screenId },
      {
        $set: {
          status: heartbeat.status,
          lastSeen: new Date(),
          ...(heartbeat.impressionsLastHour && {
            $inc: { totalImpressions: heartbeat.impressionsLastHour },
          }),
        },
      }
    );

    const updated = await ScreenModel.findOne({ screenId });

    return { needsUpdate, screen: updated };
  }

  /**
   * Increment impressions
   */
  async incrementImpressions(screenId: string, count: number): Promise<void> {
    await ScreenModel.updateOne(
      { screenId },
      { $inc: { totalImpressions: count } }
    );
  }

  /**
   * Delete screen
   */
  async delete(screenId: string): Promise<boolean> {
    const result = await ScreenModel.deleteOne({ screenId });
    return result.deletedCount > 0;
  }

  /**
   * Get network statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    offline: number;
    inactive: number;
    maintenance: number;
    totalImpressions: number;
    totalScans: number;
  }> {
    const screens = await ScreenModel.find();
    const byStatus = screens.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: screens.length,
      active: byStatus.active || 0,
      offline: byStatus.offline || 0,
      inactive: byStatus.inactive || 0,
      maintenance: byStatus.maintenance || 0,
      totalImpressions: screens.reduce((sum, s) => sum + (s.totalImpressions || 0), 0),
      totalScans: screens.reduce((sum, s) => sum + (s.totalScans || 0), 0),
    };
  }
}

// ============================================================================
// Campaign Repository
// ============================================================================

export class CampaignRepository {
  /**
   * Create campaign
   */
  async create(data: Partial<ICampaignDocument>): Promise<ICampaignDocument> {
    const campaignId = `camp_${uuidv4()}`;

    const campaign = new CampaignModel({
      campaignId,
      ...data,
    });

    await campaign.save();
    return campaign;
  }

  /**
   * Get campaign by ID
   */
  async findById(campaignId: string): Promise<ICampaignDocument | null> {
    return CampaignModel.findOne({ campaignId });
  }

  /**
   * Get all campaigns
   */
  async findAll(filter?: { status?: string; merchantId?: string }): Promise<ICampaignDocument[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.merchantId) query.merchantId = filter.merchantId;

    return CampaignModel.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get active campaigns
   */
  async findActive(): Promise<ICampaignDocument[]> {
    const now = new Date();
    return CampaignModel.find({
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
  }

  /**
   * Update campaign
   */
  async update(campaignId: string, data: Partial<ICampaignDocument>): Promise<ICampaignDocument | null> {
    return CampaignModel.findOneAndUpdate(
      { campaignId },
      { $set: data },
      { new: true }
    );
  }

  /**
   * Update campaign status
   */
  async updateStatus(campaignId: string, status: string): Promise<ICampaignDocument | null> {
    return CampaignModel.findOneAndUpdate(
      { campaignId },
      { $set: { status, 'metrics.lastUpdated': new Date() } },
      { new: true }
    );
  }

  /**
   * Increment spend
   */
  async incrementSpend(campaignId: string, amount: number): Promise<void> {
    await CampaignModel.updateOne(
      { campaignId },
      {
        $inc: {
          spent: amount,
          'metrics.totalSpent': amount,
        },
      }
    );
  }

  /**
   * Increment metrics
   */
  async incrementMetrics(
    campaignId: string,
    metrics: {
      impressions?: number;
      scans?: number;
      visits?: number;
      purchases?: number;
      revenue?: number;
    }
  ): Promise<void> {
    const update: Record<string, unknown> = {
      'metrics.lastUpdated': new Date(),
    };

    if (metrics.impressions) {
      update['metrics.impressions'] = metrics.impressions;
    }
    if (metrics.scans) {
      update['metrics.scans'] = metrics.scans;
    }
    if (metrics.visits) {
      update['metrics.visits'] = metrics.visits;
    }
    if (metrics.purchases) {
      update['metrics.purchases'] = metrics.purchases;
    }
    if (metrics.revenue) {
      update['metrics.revenue'] = metrics.revenue;
    }

    await CampaignModel.updateOne({ campaignId }, { $inc: update });
  }
}

// ============================================================================
// Analytics Repository
// ============================================================================

export class AnalyticsRepository {
  /**
   * Record impression events
   */
  async recordImpressions(events: Array<{
    screenId: string;
    campaignId?: string;
    adId: string;
    userId?: string;
    timestamp?: Date;
    durationPlayed?: number;
    viewable?: boolean;
  }>): Promise<number> {
    const docs = events.map((event) => ({
      screenId: event.screenId,
      campaignId: event.campaignId,
      adId: event.adId,
      userId: event.userId,
      timestamp: event.timestamp || new Date(),
      durationPlayed: event.durationPlayed || 0,
      viewable: event.viewable !== false,
    }));

    const result = await ImpressionEventModel.insertMany(docs, { ordered: false });
    return result.length;
  }

  /**
   * Get screen impressions for a time period
   */
  async getScreenImpressions(
    screenId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ count: number; uniqueUsers: number; avgDuration: number }> {
    const result = await ImpressionEventModel.aggregate([
      {
        $match: {
          screenId,
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          avgDuration: { $avg: '$durationPlayed' },
        },
      },
      {
        $project: {
          count: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          avgDuration: 1,
        },
      },
    ]);

    return result[0] || { count: 0, uniqueUsers: 0, avgDuration: 0 };
  }

  /**
   * Get campaign performance
   */
  async getCampaignPerformance(
    campaignId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    impressions: number;
    scans: number;
    visits: number;
    revenue: number;
  }> {
    const result = await ImpressionEventModel.aggregate([
      {
        $match: {
          campaignId,
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          impressions: { $sum: 1 },
          scans: {
            $sum: { $cond: [{ $eq: ['$metadata.type', 'scan'] }, 1, 0] },
          },
          visits: {
            $sum: { $cond: [{ $eq: ['$metadata.type', 'visit'] }, 1, 0] },
          },
          revenue: {
            $sum: { $ifNull: ['$metadata.revenue', 0] },
          },
        },
      },
    ]);

    return result[0] || { impressions: 0, scans: 0, visits: 0, revenue: 0 };
  }
}

// ============================================================================
// Playlist Repository
// ============================================================================

export class PlaylistRepository {
  /**
   * Save playlist
   */
  async save(data: {
    screenId: string;
    date: Date;
    slots: Array<{
      position: number;
      campaignId: string;
      creativeId: string;
      startTime: string;
      duration: number;
      scheduledImpressions: number;
    }>;
    totalDuration: number;
    version: number;
  }): Promise<IPlaylistDocument> {
    const playlistId = `pl_${uuidv4()}`;

    // Delete existing playlist for this screen/date
    await PlaylistModel.deleteOne({
      screenId: data.screenId,
      date: data.date,
    });

    const playlist = new PlaylistModel({
      playlistId,
      screenId: data.screenId,
      date: data.date,
      slots: data.slots,
      totalDuration: data.totalDuration,
      version: data.version,
      generatedAt: new Date(),
    });

    await playlist.save();
    return playlist;
  }

  /**
   * Get latest playlist for screen
   */
  async getLatest(screenId: string): Promise<IPlaylistDocument | null> {
    return PlaylistModel.findOne({ screenId }).sort({ date: -1, version: -1 });
  }

  /**
   * Get playlist by screen and date
   */
  async getByScreenAndDate(screenId: string, date: Date): Promise<IPlaylistDocument | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return PlaylistModel.findOne({
      screenId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ version: -1 });
  }
}

// ============================================================================
// Heartbeat Repository
// ============================================================================

export class HeartbeatRepository {
  /**
   * Record heartbeat
   */
  async record(data: {
    screenId: string;
    status: string;
    playlistVersion: number;
    impressionsLastHour?: number;
    errors?: string[];
  }): Promise<IHeartbeatDocument> {
    const heartbeat = new HeartbeatModel({
      screenId: data.screenId,
      timestamp: new Date(),
      status: data.status,
      playlistVersion: data.playlistVersion,
      impressionsLastHour: data.impressionsLastHour || 0,
      errors: data.errors,
    });

    await heartbeat.save();
    return heartbeat;
  }

  /**
   * Get latest heartbeat for screen
   */
  async getLatest(screenId: string): Promise<IHeartbeatDocument | null> {
    return HeartbeatModel.findOne({ screenId }).sort({ timestamp: -1 });
  }
}

// ============================================================================
// Payout Repository
// ============================================================================

export class PayoutRepository {
  /**
   * Create payout record
   */
  async create(data: {
    screenId: string;
    periodStart: Date;
    periodEnd: Date;
    impressions: number;
    grossRevenue: number;
    platformFee: number;
    ownerAmount: number;
  }): Promise<IPayoutDocument> {
    const payoutId = `payout_${uuidv4()}`;

    const payout = new PayoutModel({
      payoutId,
      ...data,
    });

    await payout.save();
    return payout;
  }

  /**
   * Get payouts for screen
   */
  async getByScreen(screenId: string): Promise<IPayoutDocument[]> {
    return PayoutModel.find({ screenId }).sort({ periodEnd: -1 });
  }

  /**
   * Update payout status
   */
  async updateStatus(
    payoutId: string,
    status: string,
    transactionId?: string
  ): Promise<IPayoutDocument | null> {
    return PayoutModel.findOneAndUpdate(
      { payoutId },
      {
        $set: {
          status,
          ...(status === 'paid' && { paidAt: new Date() }),
          ...(transactionId && { transactionId }),
        },
      },
      { new: true }
    );
  }
}

// ============================================================================
// Export singleton instances
// ============================================================================

export const screenRepository = new ScreenRepository();
export const campaignRepository = new CampaignRepository();
export const analyticsRepository = new AnalyticsRepository();
export const playlistRepository = new PlaylistRepository();
export const heartbeatRepository = new HeartbeatRepository();
export const payoutRepository = new PayoutRepository();
