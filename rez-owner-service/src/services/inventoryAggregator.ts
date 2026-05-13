/**
 * REZ Owner Service - Inventory Aggregator
 *
 * Unified API that aggregates inventory from all sources:
 * - AdBazaar (physical listings)
 * - DOOH Screens
 * - QR Campaigns (AdsQr)
 * - In-App Ads
 */

import axios, { AxiosInstance } from 'axios';

export interface OwnerInventory {
  ownerId: string;
  sources: {
    adBazaar: AdBazaarInventory[];
    dooh: DoohInventory[];
    qrCampaigns: QRCampaignInventory[];
    inAppAds: InAppAdInventory[];
  };
  totalRevenue: number;
  totalImpressions: number;
  totalScans: number;
  lastUpdated: Date;
}

export interface AdBazaarInventory {
  id: string;
  type: 'listing' | 'booking' | 'inquiry';
  title: string;
  category: string;
  status: 'active' | 'paused' | 'draft' | 'archived';
  price: number;
  impressions: number;
  bookings: number;
  earnings: number;
  createdAt: Date;
}

export interface DoohInventory {
  id: string;
  screenId: string;
  location: string;
  type: 'digital_billboard' | 'led_screen' | 'kiosk' | 'interactive_display';
  status: 'online' | 'offline' | 'paused';
  impressions: number;
  cpm: number;
  earnings: number;
  lastActive: Date;
}

export interface QRCampaignInventory {
  id: string;
  campaignId: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  scans: number;
  uniqueScans: number;
  conversions: number;
  coinReward: number;
  earnings: number;
  createdAt: Date;
}

export interface InAppAdInventory {
  id: string;
  adUnitId: string;
  placement: string;
  type: 'banner' | 'feed' | 'splash' | 'rewarded';
  status: 'active' | 'paused' | 'inactive';
  impressions: number;
  cpm: number;
  clicks: number;
  earnings: number;
}

export interface UnifiedEarnings {
  total: number;
  breakdown: {
    adBazaar: number;
    dooh: number;
    qrCampaigns: number;
    inAppAds: number;
  };
  pending: number;
  paid: number;
  currency: string;
}

export class InventoryAggregator {
  private adBazaarClient: AxiosInstance;
  private doohClient: AxiosInstance;
  private adsqrClient: AxiosInstance;
  private inAppClient: AxiosInstance;

  constructor() {
    const adBazaarUrl = process.env.ADBAZAAR_API_URL || 'http://localhost:3001';
    const doohUrl = process.env.DOOH_API_URL || 'http://localhost:3005';
    const adsqrUrl = process.env.ADSQR_API_URL || 'http://localhost:3006';
    const inAppUrl = process.env.INAPP_AD_API_URL || 'http://localhost:3007';

    this.adBazaarClient = axios.create({
      baseURL: adBazaarUrl,
      timeout: 10000,
      headers: { 'X-Internal-Token': process.env.ADBAZAAR_API_KEY || '' }
    });

    this.doohClient = axios.create({
      baseURL: doohUrl,
      timeout: 10000,
      headers: { 'X-Internal-Token': process.env.DOOH_API_KEY || '' }
    });

    this.adsqrClient = axios.create({
      baseURL: adsqrUrl,
      timeout: 10000,
      headers: { 'X-Internal-Token': process.env.ADSQR_API_KEY || '' }
    });

    this.inAppClient = axios.create({
      baseURL: inAppUrl,
      timeout: 10000,
      headers: { 'X-Internal-Token': process.env.INAPP_AD_API_KEY || '' }
    });
  }

  async getOwnerInventory(ownerId: string): Promise<OwnerInventory> {
    const [adBazaar, dooh, qrCampaigns, inAppAds] = await Promise.all([
      this.getAdBazaarInventory(ownerId),
      this.getDoohInventory(ownerId),
      this.getQRCampaignInventory(ownerId),
      this.getInAppAdInventory(ownerId)
    ]);

    const totalRevenue =
      adBazaar.reduce((sum, i) => sum + i.earnings, 0) +
      dooh.reduce((sum, i) => sum + i.earnings, 0) +
      qrCampaigns.reduce((sum, i) => sum + i.earnings, 0) +
      inAppAds.reduce((sum, i) => sum + i.earnings, 0);

    const totalImpressions =
      adBazaar.reduce((sum, i) => sum + i.impressions, 0) +
      dooh.reduce((sum, i) => sum + i.impressions, 0) +
      inAppAds.reduce((sum, i) => sum + i.impressions, 0);

    const totalScans = qrCampaigns.reduce((sum, i) => sum + i.scans, 0);

    return {
      ownerId,
      sources: { adBazaar, dooh, qrCampaigns, inAppAds },
      totalRevenue,
      totalImpressions,
      totalScans,
      lastUpdated: new Date()
    };
  }

  async getAdBazaarInventory(ownerId: string): Promise<AdBazaarInventory[]> {
    try {
      const response = await this.adBazaarClient.get(`/api/vendor/inventory/${ownerId}`);
      return response.data.inventory || [];
    } catch (error) {
      console.error('AdBazaar fetch error:', error);
      return [];
    }
  }

  async getDoohInventory(ownerId: string): Promise<DoohInventory[]> {
    try {
      const response = await this.doohClient.get(`/api/screens/owner/${ownerId}`);
      return response.data.screens || [];
    } catch (error) {
      console.error('DOOH fetch error:', error);
      return [];
    }
  }

  async getQRCampaignInventory(ownerId: string): Promise<QRCampaignInventory[]> {
    try {
      const response = await this.adsqrClient.get(`/api/campaigns/owner/${ownerId}`);
      return response.data.campaigns || [];
    } catch (error) {
      console.error('AdsQr fetch error:', error);
      return [];
    }
  }

  async getInAppAdInventory(ownerId: string): Promise<InAppAdInventory[]> {
    try {
      const response = await this.inAppClient.get(`/api/ad-units/owner/${ownerId}`);
      return response.data.adUnits || [];
    } catch (error) {
      console.error('InApp Ad fetch error:', error);
      return [];
    }
  }

  async getUnifiedEarnings(ownerId: string): Promise<UnifiedEarnings> {
    const inventory = await this.getOwnerInventory(ownerId);

    const adBazaarTotal = inventory.sources.adBazaar.reduce((sum, i) => sum + i.earnings, 0);
    const doohTotal = inventory.sources.dooh.reduce((sum, i) => sum + i.earnings, 0);
    const qrTotal = inventory.sources.qrCampaigns.reduce((sum, i) => sum + i.earnings, 0);
    const inAppTotal = inventory.sources.inAppAds.reduce((sum, i) => sum + i.earnings, 0);

    return {
      total: adBazaarTotal + doohTotal + qrTotal + inAppTotal,
      breakdown: {
        adBazaar: adBazaarTotal,
        dooh: doohTotal,
        qrCampaigns: qrTotal,
        inAppAds: inAppTotal
      },
      pending: (adBazaarTotal + doohTotal + qrTotal + inAppTotal) * 0.3, // Example: 30% pending
      paid: (adBazaarTotal + doohTotal + qrTotal + inAppTotal) * 0.7,     // Example: 70% paid
      currency: 'INR'
    };
  }

  async getUnifiedAnalytics(ownerId: string, dateRange: '7d' | '30d' | '90d') {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate analytics from all sources
    const [adBazaarAnalytics, doohAnalytics, qrAnalytics, inAppAnalytics] = await Promise.all([
      this.getAdBazaarAnalytics(ownerId, startDate),
      this.getDoohAnalytics(ownerId, startDate),
      this.getQRAnalytics(ownerId, startDate),
      this.getInAppAnalytics(ownerId, startDate)
    ]);

    return {
      dateRange,
      startDate,
      endDate: new Date(),
      impressions: {
        adBazaar: adBazaarAnalytics.impressions,
        dooh: doohAnalytics.impressions,
        inApp: inAppAnalytics.impressions,
        total: adBazaarAnalytics.impressions + doohAnalytics.impressions + inAppAnalytics.impressions
      },
      scans: {
        qr: qrAnalytics.scans,
        unique: qrAnalytics.uniqueScans,
        conversions: qrAnalytics.conversions
      },
      clicks: {
        adBazaar: adBazaarAnalytics.clicks,
        dooh: doohAnalytics.clicks,
        inApp: inAppAnalytics.clicks,
        total: adBazaarAnalytics.clicks + doohAnalytics.clicks + inAppAnalytics.clicks
      },
      revenue: {
        adBazaar: adBazaarAnalytics.revenue,
        dooh: doohAnalytics.revenue,
        qrCampaigns: qrAnalytics.revenue,
        inApp: inAppAnalytics.revenue,
        total: adBazaarAnalytics.revenue + doohAnalytics.revenue + qrAnalytics.revenue + inAppAnalytics.revenue
      },
      timeline: this.mergeTimelines([
        adBazaarAnalytics.timeline,
        doohAnalytics.timeline,
        qrAnalytics.timeline,
        inAppAnalytics.timeline
      ])
    };
  }

  private async getAdBazaarAnalytics(ownerId: string, startDate: Date) {
    try {
      const response = await this.adBazaarClient.get(`/api/vendor/analytics/${ownerId}`, {
        params: { start: startDate.toISOString() }
      });
      return response.data;
    } catch {
      return { impressions: 0, clicks: 0, revenue: 0, timeline: [] };
    }
  }

  private async getDoohAnalytics(ownerId: string, startDate: Date) {
    try {
      const response = await this.doohClient.get(`/api/screens/analytics/${ownerId}`, {
        params: { start: startDate.toISOString() }
      });
      return response.data;
    } catch {
      return { impressions: 0, clicks: 0, revenue: 0, timeline: [] };
    }
  }

  private async getQRAnalytics(ownerId: string, startDate: Date) {
    try {
      const response = await this.adsqrClient.get(`/api/campaigns/analytics/${ownerId}`, {
        params: { start: startDate.toISOString() }
      });
      return response.data;
    } catch {
      return { scans: 0, uniqueScans: 0, conversions: 0, revenue: 0, timeline: [] };
    }
  }

  private async getInAppAnalytics(ownerId: string, startDate: Date) {
    try {
      const response = await this.inAppClient.get(`/api/ad-units/analytics/${ownerId}`, {
        params: { start: startDate.toISOString() }
      });
      return response.data;
    } catch {
      return { impressions: 0, clicks: 0, revenue: 0, timeline: [] };
    }
  }

  private mergeTimelines(timelines: any[][]): any[] {
    const merged = new Map<string, any>();

    for (const timeline of timelines) {
      for (const point of timeline) {
        const existing = merged.get(point.date);
        if (existing) {
          Object.keys(point).forEach(key => {
            if (key !== 'date' && typeof point[key] === 'number') {
              existing[key] = (existing[key] || 0) + point[key];
            }
          });
        } else {
          merged.set(point.date, { ...point });
        }
      }
    }

    return Array.from(merged.values()).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }
}

export const inventoryAggregator = new InventoryAggregator();
