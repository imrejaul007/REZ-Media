import { MarketingCampaign } from '../models/MarketingCampaign';
import mongoose from 'mongoose';

/**
 * CampaignAnalytics — aggregate metrics for merchant dashboard.
 *
 * Provides:
 *   - Per-campaign stats (delivery rate, open rate, CTR, conversion rate)
 *   - Aggregate metrics across all campaigns for a merchant
 *   - Best-performing channel and audience segment
 *   - Attribution: orders placed within attributionWindowDays after campaign send
 */

// Read orders from rez-backend's shared DB
const Order = mongoose.model(
  'MktAnalyticsOrder',
  new mongoose.Schema({}, { strict: false, collection: 'orders' }),
);

export interface CampaignMetrics {
  campaignId: string;
  name: string;
  channel: string;
  status: string;
  sentAt?: Date;
  audienceSize: number;
  sent: number;
  delivered: number;
  failed: number;
  deduped: number;
  opened: number;
  clicked: number;
  converted: number;
  deliveryRate: number;  // delivered / sent * 100
  openRate: number;      // opened / delivered * 100
  ctr: number;           // clicked / delivered * 100
  conversionRate: number; // converted / sent * 100
}

export interface MerchantAnalyticsSummary {
  totalCampaigns: number;
  totalReach: number;
  avgDeliveryRate: number;
  avgOpenRate: number;
  topChannel: string;
  topSegment: string;
  campaigns: CampaignMetrics[];
}

export class CampaignAnalytics {
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics | null> {
    const campaign = await MarketingCampaign.findById(campaignId).lean();
    if (!campaign) return null;

    const s = campaign.stats;
    const delivered = s.delivered || s.sent;

    return {
      campaignId: campaign._id.toString(),
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      sentAt: campaign.sentAt,
      audienceSize: campaign.audience?.estimatedCount || 0,
      sent: s.sent,
      delivered,
      failed: s.failed,
      deduped: s.deduped,
      opened: s.opened,
      clicked: s.clicked,
      converted: s.converted,
      deliveryRate: s.sent > 0 ? Math.round((delivered / s.sent) * 100) : 0,
      openRate: delivered > 0 ? Math.round((s.opened / delivered) * 100) : 0,
      ctr: delivered > 0 ? Math.round((s.clicked / delivered) * 100) : 0,
      conversionRate: s.sent > 0 ? Math.round((s.converted / s.sent) * 100) : 0,
    };
  }

  async getMerchantSummary(merchantId: string, days: number = 30): Promise<MerchantAnalyticsSummary> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return {
        totalCampaigns: 0,
        totalReach: 0,
        avgDeliveryRate: 0,
        avgOpenRate: 0,
        topChannel: 'whatsapp',
        topSegment: 'all',
        campaigns: [],
      };
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const campaigns = await MarketingCampaign.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: { $in: ['sent', 'failed'] },
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    if (!campaigns.length) {
      return {
        totalCampaigns: 0,
        totalReach: 0,
        avgDeliveryRate: 0,
        avgOpenRate: 0,
        topChannel: 'whatsapp',
        topSegment: 'all',
        campaigns: [],
      };
    }

    const metrics = campaigns.map((c) => {
      const s = c.stats;
      const delivered = s.delivered || s.sent;
      return {
        campaignId: c._id.toString(),
        name: c.name,
        channel: c.channel,
        status: c.status,
        sentAt: c.sentAt,
        audienceSize: c.audience?.estimatedCount || 0,
        sent: s.sent,
        delivered,
        failed: s.failed,
        deduped: s.deduped,
        opened: s.opened,
        clicked: s.clicked,
        converted: s.converted,
        deliveryRate: s.sent > 0 ? Math.round((delivered / s.sent) * 100) : 0,
        openRate: delivered > 0 ? Math.round((s.opened / delivered) * 100) : 0,
        ctr: delivered > 0 ? Math.round((s.clicked / delivered) * 100) : 0,
        conversionRate: s.sent > 0 ? Math.round((s.converted / s.sent) * 100) : 0,
      };
    });

    // Aggregate
    const totalReach = metrics.reduce((s, m) => s + m.sent, 0);
    const avgDeliveryRate = Math.round(metrics.reduce((s, m) => s + m.deliveryRate, 0) / metrics.length);
    const avgOpenRate = Math.round(metrics.reduce((s, m) => s + m.openRate, 0) / metrics.length);

    // Top channel by sent volume
    const channelTotals: Record<string, number> = {};
    for (const m of metrics) {
      channelTotals[m.channel] = (channelTotals[m.channel] || 0) + m.sent;
    }
    const topChannel = Object.entries(channelTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'whatsapp';

    // Top segment by delivery rate
    const segmentRates: Record<string, number[]> = {};
    for (const c of campaigns) {
      const seg = c.audience?.segment || 'all';
      const m = metrics.find((x) => x.campaignId === c._id.toString());
      if (m) {
        segmentRates[seg] = segmentRates[seg] || [];
        segmentRates[seg].push(m.deliveryRate);
      }
    }
    const segmentAvgs = Object.entries(segmentRates).map(([seg, rates]) => ({
      seg,
      avg: rates.reduce((s, r) => s + r, 0) / rates.length,
    }));
    const topSegment = segmentAvgs.sort((a, b) => b.avg - a.avg)[0]?.seg || 'all';

    return {
      totalCampaigns: campaigns.length,
      totalReach,
      avgDeliveryRate,
      avgOpenRate,
      topChannel,
      topSegment,
      campaigns: metrics,
    };
  }

  /**
   * Track a campaign open event (called via tracking pixel or deep link).
   */
  async trackOpen(campaignId: string): Promise<void> {
    await MarketingCampaign.findByIdAndUpdate(campaignId, {
      $inc: { 'stats.opened': 1 },
    });
  }

  /**
   * Track a campaign click event.
   */
  async trackClick(campaignId: string): Promise<void> {
    await MarketingCampaign.findByIdAndUpdate(campaignId, {
      $inc: { 'stats.clicked': 1 },
    });
  }

  /**
   * Track a conversion (order placed within attribution window).
   * Called by rez-backend's order service after order is confirmed.
   */
  async trackConversion(merchantId: string, userId: string): Promise<void> {
    if (!mongoose.isValidObjectId(merchantId)) return;

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 7); // default 7-day window

    // Find the most recent sent campaign for this merchant that targeted this user
    const campaign = await MarketingCampaign.findOne({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: 'sent',
      sentAt: { $gte: windowStart },
    })
      .sort({ sentAt: -1 })
      .lean();

    if (campaign) {
      await MarketingCampaign.findByIdAndUpdate(campaign._id, {
        $inc: { 'stats.converted': 1 },
      });
    }
  }
}

export const campaignAnalytics = new CampaignAnalytics();
export default campaignAnalytics;
