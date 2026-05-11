import mongoose from 'mongoose';
import { MarketingCampaign } from '../models/MarketingCampaign';
import { Voucher } from '../models/Voucher';
import { VoucherRedemption } from '../models/VoucherRedemption';
import { logger } from '../config/logger';

/**
 * MerchantGrowthDashboard — unified growth metrics for merchant dashboard.
 *
 * Provides:
 *   - Campaign overview with engagement metrics
 *   - Ad performance (impressions, clicks, CTR, conversions)
 *   - Notification statistics (sent, delivered, opened, clicked)
 *   - Voucher metrics (issued, redeemed, revenue impact)
 *   - Combined growth score (0-100)
 *
 * Growth Score Algorithm:
 *   - Campaign engagement: 30%
 *   - Ad performance: 30%
 *   - Notification open rate: 20%
 *   - Voucher redemption: 20%
 */

// ── Type Definitions ────────────────────────────────────────────────────────────

export interface CampaignOverview {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalReach: number;
  avgEngagementRate: number;
  campaigns: CampaignSummary[];
}

export interface CampaignSummary {
  campaignId: string;
  name: string;
  channel: string;
  status: string;
  sentAt?: Date;
  audienceSize: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  engagementRate: number;
}

export interface AdPerformance {
  totalAds: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;
  conversionRate: number;
  avgCpc: number;
  totalSpend: number;
  ads: AdMetrics[];
}

export interface AdMetrics {
  adId: string;
  name: string;
  channel: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
  spend: number;
}

export interface NotificationStats {
  totalNotifications: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  byChannel: ChannelNotificationStats[];
}

export interface ChannelNotificationStats {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
}

export interface VoucherMetrics {
  totalVouchers: number;
  activeVouchers: number;
  issued: number;
  redeemed: number;
  redemptionRate: number;
  totalDiscountGiven: number;
  avgOrderValue: number;
  vouchers: VoucherSummary[];
}

export interface VoucherSummary {
  voucherId: string;
  code: string;
  type: string;
  status: string;
  value: number;
  issued: number;
  redeemed: number;
  redemptionRate: number;
  totalDiscountGiven: number;
}

export interface GrowthScore {
  overall: number;
  campaignEngagement: number;
  adPerformance: number;
  notificationOpenRate: number;
  voucherRedemption: number;
  breakdown: GrowthScoreBreakdown;
}

export interface GrowthScoreBreakdown {
  campaignEngagementScore: number;
  campaignEngagementWeight: number;
  adPerformanceScore: number;
  adPerformanceWeight: number;
  notificationOpenRateScore: number;
  notificationOpenRateWeight: number;
  voucherRedemptionScore: number;
  voucherRedemptionWeight: number;
}

export interface GrowthDashboard {
  merchantId: string;
  period: { start: Date; end: Date };
  overview: {
    campaigns: CampaignOverview;
    ads: AdPerformance;
    notifications: NotificationStats;
    vouchers: VoucherMetrics;
  };
  growthScore: GrowthScore;
  generatedAt: Date;
}

// ── Helper Collections ──────────────────────────────────────────────────────────

const getNotificationLogs = () => mongoose.connection.collection('notificationlogs');
const getBroadcastLogs = () => mongoose.connection.collection('broadcastlogs');
const getAdBazaarAds = () => mongoose.connection.collection('adbazaar_ads');

// ── Growth Dashboard Service ────────────────────────────────────────────────────

export class MerchantGrowthDashboardService {

  /**
   * Get complete growth dashboard data for a merchant
   */
  async getDashboard(merchantId: string, days: number = 30): Promise<GrowthDashboard> {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    const [campaigns, ads, notifications, vouchers, growthScore] = await Promise.all([
      this.getCampaignOverview(merchantId, start, end),
      this.getAdPerformance(merchantId, start, end),
      this.getNotificationStats(merchantId, start, end),
      this.getVoucherMetrics(merchantId, start, end),
      this.getGrowthScore(merchantId, start, end),
    ]);

    return {
      merchantId,
      period: { start, end },
      overview: { campaigns, ads, notifications, vouchers },
      growthScore,
      generatedAt: new Date(),
    };
  }

  /**
   * Get campaign overview with engagement metrics
   */
  async getCampaignOverview(merchantId: string, start: Date, end: Date): Promise<CampaignOverview> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return this.emptyCampaignOverview();
    }

    const campaigns = await MarketingCampaign.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    if (!campaigns.length) {
      return this.emptyCampaignOverview();
    }

    const campaignSummaries: CampaignSummary[] = campaigns.map((c) => {
      const s = c.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 };
      const delivered = s.delivered || s.sent || 0;
      const engagementRate = delivered > 0
        ? Math.round(((s.opened || 0) + (s.clicked || 0)) / delivered * 100)
        : 0;

      return {
        campaignId: (c._id as mongoose.Types.ObjectId).toString(),
        name: c.name,
        channel: c.channel,
        status: c.status,
        sentAt: c.sentAt,
        audienceSize: c.audience?.estimatedCount || 0,
        sent: s.sent || 0,
        delivered,
        opened: s.opened || 0,
        clicked: s.clicked || 0,
        converted: s.converted || 0,
        engagementRate,
      };
    });

    const totalReach = campaignSummaries.reduce((sum, c) => sum + c.sent, 0);
    const avgEngagementRate = Math.round(
      campaignSummaries.reduce((sum, c) => sum + c.engagementRate, 0) / campaignSummaries.length
    );

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => ['draft', 'scheduled', 'sending'].includes(c.status)).length,
      completedCampaigns: campaigns.filter((c) => c.status === 'sent').length,
      totalReach,
      avgEngagementRate,
      campaigns: campaignSummaries,
    };
  }

  /**
   * Get ad performance metrics
   */
  async getAdPerformance(merchantId: string, start: Date, end: Date): Promise<AdPerformance> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return this.emptyAdPerformance();
    }

    const adsCollection = getAdBazaarAds();

    const ads = await adsCollection
      .find({
        merchantId: new mongoose.Types.ObjectId(merchantId),
        createdAt: { $gte: start, $lte: end },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    if (!ads.length) {
      return this.emptyAdPerformance();
    }

    const adMetrics: AdMetrics[] = ads.map((ad) => {
      const impressions = ad.impressions || ad.views || 0;
      const clicks = ad.clicks || 0;
      const conversions = ad.conversions || ad.converted || 0;
      const spend = ad.spend || ad.cost || 0;

      return {
        adId: (ad._id as mongoose.Types.ObjectId).toString(),
        name: ad.name || ad.title || 'Unnamed Ad',
        channel: ad.channel || 'push',
        impressions,
        clicks,
        conversions,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        conversionRate: impressions > 0 ? Math.round((conversions / impressions) * 10000) / 100 : 0,
        spend,
      };
    });

    const totalImpressions = adMetrics.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = adMetrics.reduce((sum, ad) => sum + ad.clicks, 0);
    const totalConversions = adMetrics.reduce((sum, ad) => sum + ad.conversions, 0);
    const totalSpend = adMetrics.reduce((sum, ad) => sum + ad.spend, 0);

    return {
      totalAds: ads.length,
      totalImpressions,
      totalClicks,
      totalConversions,
      ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
      conversionRate: totalImpressions > 0
        ? Math.round((totalConversions / totalImpressions) * 10000) / 100
        : 0,
      avgCpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
      totalSpend,
      ads: adMetrics,
    };
  }

  /**
   * Get notification statistics (sent, delivered, opened, clicked)
   */
  async getNotificationStats(merchantId: string, start: Date, end: Date): Promise<NotificationStats> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return this.emptyNotificationStats();
    }

    const notificationLogs = getNotificationLogs();
    const broadcastLogs = getBroadcastLogs();

    // Query both notification logs and broadcast logs for comprehensive stats
    const [notifLogs, broadLogs] = await Promise.all([
      notificationLogs
        .find({
          merchantId: new mongoose.Types.ObjectId(merchantId),
          createdAt: { $gte: start, $lte: end },
        })
        .toArray(),
      broadcastLogs
        .find({
          merchantId: new mongoose.Types.ObjectId(merchantId),
          sentAt: { $gte: start, $lte: end },
        })
        .toArray(),
    ]);

    // Aggregate stats
    let totalSent = 0;
    let totalDelivered = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    const channelStats: Record<string, { sent: number; delivered: number; opened: number; clicked: number }> = {};

    // Process notification logs
    for (const log of notifLogs) {
      const sent = log.sent || log.count || 0;
      const delivered = log.delivered || log.deliveredCount || sent;
      const opened = log.opened || log.openCount || 0;
      const clicked = log.clicked || log.clickCount || 0;
      const channel = log.channel || 'push';

      totalSent += sent;
      totalDelivered += delivered;
      totalOpened += opened;
      totalClicked += clicked;

      if (!channelStats[channel]) {
        channelStats[channel] = { sent: 0, delivered: 0, opened: 0, clicked: 0 };
      }
      channelStats[channel].sent += sent;
      channelStats[channel].delivered += delivered;
      channelStats[channel].opened += opened;
      channelStats[channel].clicked += clicked;
    }

    // Process broadcast logs
    for (const log of broadLogs) {
      const sent = log.userCount || 0;
      const channel = log.channel || 'push';

      totalSent += sent;

      if (!channelStats[channel]) {
        channelStats[channel] = { sent: 0, delivered: 0, opened: 0, clicked: 0 };
      }
      channelStats[channel].sent += sent;
    }

    const totalNotifications = notifLogs.length + broadLogs.length;

    // Calculate rates
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 10000) / 100 : 0;
    const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 10000) / 100 : 0;
    const clickRate = totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 10000) / 100 : 0;

    const byChannel: ChannelNotificationStats[] = Object.entries(channelStats).map(([channel, stats]) => ({
      channel,
      sent: stats.sent,
      delivered: stats.delivered,
      opened: stats.opened,
      clicked: stats.clicked,
      deliveryRate: stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 10000) / 100 : 0,
      openRate: stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 10000) / 100 : 0,
    }));

    return {
      totalNotifications,
      sent: totalSent,
      delivered: totalDelivered,
      opened: totalOpened,
      clicked: totalClicked,
      deliveryRate,
      openRate,
      clickRate,
      byChannel,
    };
  }

  /**
   * Get voucher metrics (issued, redeemed, revenue impact)
   */
  async getVoucherMetrics(merchantId: string, start: Date, end: Date): Promise<VoucherMetrics> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return this.emptyVoucherMetrics();
    }

    // Get vouchers created in the period
    const vouchers = await Voucher.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      createdAt: { $gte: start, $lte: end },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (!vouchers.length) {
      return this.emptyVoucherMetrics();
    }

    // Get redemptions for these vouchers
    const voucherIds = vouchers.map((v) => v._id);
    const redemptions = await VoucherRedemption.find({
      voucherId: { $in: voucherIds },
      redeemedAt: { $gte: start, $lte: end },
    }).lean();

    // Calculate per-voucher stats
    const voucherSummaries: VoucherSummary[] = vouchers.map((v) => {
      const voucherRedemptions = redemptions.filter(
        (r) => r.voucherId?.toString() === v._id.toString()
      );
      const redeemed = voucherRedemptions.length;
      const totalDiscountGiven = voucherRedemptions.reduce(
        (sum, r) => sum + (r.discountApplied || 0),
        0
      );
      const issued = v.maxUses || redeemed;
      const redemptionRate = issued > 0 ? Math.round((redeemed / issued) * 10000) / 100 : 0;

      return {
        voucherId: (v._id as mongoose.Types.ObjectId).toString(),
        code: v.code,
        type: v.type,
        status: v.status,
        value: v.value,
        issued,
        redeemed,
        redemptionRate,
        totalDiscountGiven,
      };
    });

    const totalIssued = voucherSummaries.reduce((sum, v) => sum + v.issued, 0);
    const totalRedeemed = voucherSummaries.reduce((sum, v) => sum + v.redeemed, 0);
    const totalDiscountGiven = voucherSummaries.reduce((sum, v) => sum + v.totalDiscountGiven, 0);
    const redemptionRate = totalIssued > 0 ? Math.round((totalRedeemed / totalIssued) * 10000) / 100 : 0;
    const avgOrderValue = totalRedeemed > 0
      ? Math.round(voucherSummaries.reduce(
          (sum, v) => {
            const vRedemptions = redemptions.filter(
              (r) => r.voucherId?.toString() === v.voucherId
            );
            const orderValues = vRedemptions.map((r) => r.orderValue || 0);
            return sum + orderValues.reduce((s, o) => s + o, 0);
          }, 0
        ) / totalRedeemed)
      : 0;

    return {
      totalVouchers: vouchers.length,
      activeVouchers: vouchers.filter((v) => v.status === 'active').length,
      issued: totalIssued,
      redeemed: totalRedeemed,
      redemptionRate,
      totalDiscountGiven,
      avgOrderValue,
      vouchers: voucherSummaries,
    };
  }

  /**
   * Calculate combined growth health score (0-100)
   *
   * Weights:
   *   - Campaign engagement: 30%
   *   - Ad performance: 30%
   *   - Notification open rate: 20%
   *   - Voucher redemption: 20%
   */
  async getGrowthScore(merchantId: string, start: Date, end: Date): Promise<GrowthScore> {
    const [
      campaignOverview,
      adPerformance,
      notificationStats,
      voucherMetrics,
    ] = await Promise.all([
      this.getCampaignOverview(merchantId, start, end),
      this.getAdPerformance(merchantId, start, end),
      this.getNotificationStats(merchantId, start, end),
      this.getVoucherMetrics(merchantId, start, end),
    ]);

    // Calculate individual component scores (0-100)
    const campaignEngagementScore = this.calculateCampaignEngagementScore(campaignOverview);
    const adPerformanceScore = this.calculateAdPerformanceScore(adPerformance);
    const notificationOpenRateScore = this.calculateNotificationOpenRateScore(notificationStats);
    const voucherRedemptionScore = this.calculateVoucherRedemptionScore(voucherMetrics);

    // Weights
    const WEIGHTS = {
      campaignEngagement: 0.30,
      adPerformance: 0.30,
      notificationOpenRate: 0.20,
      voucherRedemption: 0.20,
    };

    // Calculate weighted overall score
    const overall = Math.round(
      campaignEngagementScore * WEIGHTS.campaignEngagement +
      adPerformanceScore * WEIGHTS.adPerformance +
      notificationOpenRateScore * WEIGHTS.notificationOpenRate +
      voucherRedemptionScore * WEIGHTS.voucherRedemption
    );

    return {
      overall,
      campaignEngagement: Math.round(campaignEngagementScore),
      adPerformance: Math.round(adPerformanceScore),
      notificationOpenRate: Math.round(notificationOpenRateScore),
      voucherRedemption: Math.round(voucherRedemptionScore),
      breakdown: {
        campaignEngagementScore: Math.round(campaignEngagementScore),
        campaignEngagementWeight: WEIGHTS.campaignEngagement * 100,
        adPerformanceScore: Math.round(adPerformanceScore),
        adPerformanceWeight: WEIGHTS.adPerformance * 100,
        notificationOpenRateScore: Math.round(notificationOpenRateScore),
        notificationOpenRateWeight: WEIGHTS.notificationOpenRate * 100,
        voucherRedemptionScore: Math.round(voucherRedemptionScore),
        voucherRedemptionWeight: WEIGHTS.voucherRedemption * 100,
      },
    };
  }

  /**
   * Calculate campaign engagement score (0-100)
   * Based on: engagement rate, campaign frequency, reach
   */
  private calculateCampaignEngagementScore(overview: CampaignOverview): number {
    if (overview.totalCampaigns === 0) return 0;

    // Engagement rate component (40% of this score)
    const engagementComponent = Math.min(overview.avgEngagementRate, 50) * 2; // Scale to 0-100

    // Campaign frequency component (30% of this score)
    // Assume 4 campaigns/month is good frequency (normalize to 0-100)
    const frequencyScore = Math.min(overview.totalCampaigns / 4 * 25, 30);

    // Reach component (30% of this score)
    // Normalize: 1000 reach = 15 points, 10000+ = 30 points
    const reachScore = Math.min(Math.log10(overview.totalReach + 1) * 10, 30);

    return Math.min(engagementComponent + frequencyScore + reachScore, 100);
  }

  /**
   * Calculate ad performance score (0-100)
   * Based on: CTR, conversion rate, total impressions
   */
  private calculateAdPerformanceScore(performance: AdPerformance): number {
    if (performance.totalAds === 0) return 0;

    // CTR component (40% of this score) - benchmark: 2% is good
    const ctrScore = Math.min(performance.ctr / 2 * 40, 40);

    // Conversion rate component (35% of this score) - benchmark: 0.5% is good
    const conversionScore = Math.min(performance.conversionRate / 0.5 * 35, 35);

    // Volume component (25% of this score)
    // Normalize: 1000 impressions = 10 points, 100000+ = 25 points
    const volumeScore = Math.min(Math.log10(performance.totalImpressions + 1) * 5, 25);

    return Math.min(ctrScore + conversionScore + volumeScore, 100);
  }

  /**
   * Calculate notification open rate score (0-100)
   * Based on: delivery rate, open rate
   */
  private calculateNotificationOpenRateScore(stats: NotificationStats): number {
    if (stats.totalNotifications === 0) return 0;

    // Delivery rate component (40% of this score) - benchmark: 90% is good
    const deliveryComponent = Math.min(stats.deliveryRate / 90 * 40, 40);

    // Open rate component (60% of this score) - benchmark: 30% is good
    const openRateComponent = Math.min(stats.openRate / 30 * 60, 60);

    return Math.min(deliveryComponent + openRateComponent, 100);
  }

  /**
   * Calculate voucher redemption score (0-100)
   * Based on: redemption rate, active vouchers
   */
  private calculateVoucherRedemptionScore(metrics: VoucherMetrics): number {
    if (metrics.totalVouchers === 0) return 0;

    // Redemption rate component (70% of this score) - benchmark: 30% is good
    const redemptionComponent = Math.min(metrics.redemptionRate / 30 * 70, 70);

    // Active voucher diversity component (30% of this score)
    // More active vouchers = better merchant engagement
    const diversityScore = Math.min(metrics.activeVouchers / 5 * 30, 30);

    return Math.min(redemptionComponent + diversityScore, 100);
  }

  // ── Empty State Helpers ────────────────────────────────────────────────────────

  private emptyCampaignOverview(): CampaignOverview {
    return {
      totalCampaigns: 0,
      activeCampaigns: 0,
      completedCampaigns: 0,
      totalReach: 0,
      avgEngagementRate: 0,
      campaigns: [],
    };
  }

  private emptyAdPerformance(): AdPerformance {
    return {
      totalAds: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      ctr: 0,
      conversionRate: 0,
      avgCpc: 0,
      totalSpend: 0,
      ads: [],
    };
  }

  private emptyNotificationStats(): NotificationStats {
    return {
      totalNotifications: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      byChannel: [],
    };
  }

  private emptyVoucherMetrics(): VoucherMetrics {
    return {
      totalVouchers: 0,
      activeVouchers: 0,
      issued: 0,
      redeemed: 0,
      redemptionRate: 0,
      totalDiscountGiven: 0,
      avgOrderValue: 0,
      vouchers: [],
    };
  }
}

// Singleton instance
export const merchantGrowthDashboard = new MerchantGrowthDashboardService();
export default merchantGrowthDashboard;
