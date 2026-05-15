/**
 * REZ Partner Portal - Services
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  Partner,
  PartnerUser,
  PartnerType,
  PartnerStatus,
  Campaign,
  Payout,
} from '../types';
import {
  PartnerModel,
  PartnerUserModel,
  CampaignModel,
  PayoutModel,
  ReportModel,
} from '../models';

const JWT_SECRET = process.env.JWT_SECRET || 'partner-portal-secret-change-me';

export class PartnerService {
  /**
   * Create a new partner
   */
  async createPartner(data: {
    name: string;
    type: PartnerType;
    email: string;
    phone?: string;
    company?: string;
    website?: string;
  }): Promise<Partner> {
    const partnerId = `partner-${uuidv4().slice(0, 8)}`;

    const partner = new PartnerModel({
      partnerId,
      ...data,
      status: 'pending',
      commission: { default: 10 },
      settings: {
        notifications: { email: true, sms: false, dashboard: true },
        autoPayout: false,
        minPayoutThreshold: 100,
        reportingFrequency: 'weekly',
      },
    });

    await partner.save();
    return partner;
  }

  /**
   * Get partner by ID
   */
  async getPartner(partnerId: string): Promise<Partner | null> {
    return PartnerModel.findOne({ partnerId });
  }

  /**
   * Get partner by email
   */
  async getPartnerByEmail(email: string): Promise<Partner | null> {
    return PartnerModel.findOne({ email });
  }

  /**
   * Update partner status
   */
  async updatePartnerStatus(partnerId: string, status: PartnerStatus): Promise<Partner | null> {
    return PartnerModel.findOneAndUpdate(
      { partnerId },
      { status },
      { new: true }
    );
  }

  /**
   * List all partners with pagination
   */
  async listPartners(options: {
    type?: PartnerType;
    status?: PartnerStatus;
    page?: number;
    limit?: number;
  }): Promise<{ partners: Partner[]; total: number }> {
    const { type, status, page = 1, limit = 20 } = options;
    const query: Record<string, unknown> = {};

    if (type) query.type = type;
    if (status) query.status = status;

    const [partners, total] = await Promise.all([
      PartnerModel.find(query).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }),
      PartnerModel.countDocuments(query),
    ]);

    return { partners, total };
  }

  /**
   * Update partner API credentials
   */
  async updateApiCredentials(partnerId: string): Promise<{ clientId: string; clientSecret: string }> {
    const clientId = `rez_${uuidv4().replace(/-/g, '')}`;
    const clientSecret = uuidv4();

    await PartnerModel.findOneAndUpdate(
      { partnerId },
      {
        apiCredentials: {
          clientId,
          clientSecret,
          scopes: ['campaigns:read', 'campaigns:write', 'analytics:read', 'payouts:read'],
        },
      }
    );

    return { clientId, clientSecret };
  }

  /**
   * Generate partner JWT token
   */
  async generateToken(partnerId: string): Promise<string> {
    const partner = await PartnerModel.findOne({ partnerId });
    if (!partner) throw new Error('Partner not found');

    return jwt.sign(
      { partnerId, type: partner.type },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
}

export class PartnerUserService {
  /**
   * Create partner user
   */
  async createUser(data: {
    partnerId: string;
    email: string;
    password: string;
    name: string;
    role?: 'admin' | 'manager' | 'viewer';
  }): Promise<PartnerUser> {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = new PartnerUserModel({
      ...data,
      password: hashedPassword,
      role: data.role || 'viewer',
    });

    await user.save();
    return user;
  }

  /**
   * Authenticate partner user
   */
  async authenticate(email: string, password: string): Promise<{ user: PartnerUser; token: string } | null> {
    const user = await PartnerUserModel.findOne({ email, status: 'active' });
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    const token = jwt.sign(
      { userId: user._id, partnerId: user.partnerId, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await PartnerUserModel.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    return { user, token };
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<PartnerUser | null> {
    return PartnerUserModel.findById(userId).select('-password');
  }
}

export class CampaignService {
  /**
   * Create campaign for partner
   */
  async createCampaign(data: {
    partnerId: string;
    name: string;
    advertiserId: string;
    budget: number;
  }): Promise<Campaign> {
    const campaignId = `camp-${uuidv4().slice(0, 8)}`;

    const campaign = new CampaignModel({
      campaignId,
      ...data,
      status: 'draft',
      budget: { total: data.budget, spent: 0 },
      metrics: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        ctr: 0,
        cvr: 0,
        cpm: 0,
        cpa: 0,
      },
    });

    await campaign.save();

    // Update partner stats
    await PartnerModel.findOneAndUpdate(
      { partnerId: data.partnerId },
      { $inc: { 'stats.activeCampaigns': 1 } }
    );

    return campaign;
  }

  /**
   * Get campaigns for partner
   */
  async getPartnerCampaigns(partnerId: string): Promise<Campaign[]> {
    return CampaignModel.find({ partnerId }).sort({ createdAt: -1 });
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(campaignId: string, status: Campaign['status']): Promise<Campaign | null> {
    return CampaignModel.findOneAndUpdate(
      { campaignId },
      { status },
      { new: true }
    );
  }

  /**
   * Update campaign metrics
   */
  async updateMetrics(campaignId: string, metrics: Partial<Campaign['metrics']>): Promise<void> {
    await CampaignModel.findOneAndUpdate(
      { campaignId },
      { $inc: metrics as Record<string, number> }
    );
  }
}

export class PayoutService {
  /**
   * Request payout
   */
  async requestPayout(partnerId: string, amount: number, method: Payout['method']): Promise<Payout> {
    const partner = await PartnerModel.findOne({ partnerId });
    if (!partner) throw new Error('Partner not found');

    if (partner.stats.pendingPayout < amount) {
      throw new Error('Insufficient balance');
    }

    if (partner.settings.minPayoutThreshold > amount) {
      throw new Error(`Minimum payout threshold is ${partner.settings.minPayoutThreshold}`);
    }

    const payoutId = `payout-${uuidv4().slice(0, 8)}`;

    const payout = new PayoutModel({
      payoutId,
      partnerId,
      amount,
      currency: 'USD',
      method,
      status: 'pending',
    });

    await payout.save();

    // Update partner pending payout
    await PartnerModel.findOneAndUpdate(
      { partnerId },
      { $inc: { 'stats.pendingPayout': -amount } }
    );

    return payout;
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(partnerId: string): Promise<Payout[]> {
    return PayoutModel.find({ partnerId }).sort({ requestedAt: -1 });
  }

  /**
   * Process payout (admin only)
   */
  async processPayout(payoutId: string): Promise<Payout | null> {
    return PayoutModel.findOneAndUpdate(
      { payoutId, status: 'pending' },
      {
        status: 'processing',
        processedAt: new Date(),
      },
      { new: true }
    );
  }
}

// Export singleton instances
export const partnerService = new PartnerService();
export const partnerUserService = new PartnerUserService();
export const campaignService = new CampaignService();
export const payoutService = new PayoutService();
