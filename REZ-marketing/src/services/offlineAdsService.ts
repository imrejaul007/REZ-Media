/**
 * Offline Ads Service
 *
 * Manage offline advertising campaigns
 */

import mongoose, { Schema } from 'mongoose';
import QRCode from 'qrcode';

// Types
export interface IOfflineAd {
  _id: mongoose.Types.ObjectId;
  merchantId: string;
  title: string;
  description: string;
  adType: 'auto_rickshaw' | 'bus' | 'hoarding' | 'billboard' | 'mall_kiosks' | 'flyers' | ' newspaper';
  locations: {
    city: string;
    areas: string[];
    coordinates?: { lat: number; lng: number };
  }[];
  duration: number; // days
  startDate?: Date;
  endDate?: Date;
  price: number;
  status: 'draft' | 'pending_approval' | 'active' | 'completed' | 'cancelled';
  impressions: number;
  scans: number;
  conversions: number;
  qrCode?: string;
  creative?: {
    type: 'image' | 'text';
    content: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IQRTracking {
  _id: mongoose.Types.ObjectId;
  adId: string;
  scannedBy: string;
  scannedAt: Date;
  location?: { lat: number; lng: number };
  deviceInfo?: string;
}

// Schema
const OfflineAdSchema = new Schema<IOfflineAd>({
  merchantId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: String,
  adType: {
    type: String,
    enum: ['auto_rickshaw', 'bus', 'hoarding', 'billboard', 'mall_kiosks', 'flyers', 'newspaper'],
    required: true,
  },
  locations: [{
    city: { type: String, required: true },
    areas: [String],
    coordinates: {
      lat: Number,
      lng: Number,
    },
  }],
  duration: { type: Number, required: true },
  startDate: Date,
  endDate: Date,
  price: { type: Number, required: true },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'active', 'completed', 'cancelled'],
    default: 'draft',
  },
  impressions: { type: Number, default: 0 },
  scans: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  qrCode: String,
  creative: {
    type: { type: String, enum: ['image', 'text'] },
    content: String,
  },
}, { timestamps: true });

OfflineAdSchema.index({ merchantId: 1, status: 1 });
OfflineAdSchema.index({ adType: 1, status: 1 });

const QRTrackingSchema = new Schema<IQRTracking>({
  adId: { type: String, required: true, index: true },
  scannedBy: { type: String, required: true },
  scannedAt: { type: Date, default: Date.now },
  location: {
    lat: Number,
    lng: Number,
  },
  deviceInfo: String,
});

export const OfflineAd = mongoose.model<IOfflineAd>('OfflineAd', OfflineAdSchema);
export const QRTracking = mongoose.model<IQRTracking>('QRTracking', QRTrackingSchema);

// Service
export class OfflineAdsService {

  /**
   * Create offline ad campaign
   */
  async createAd(data: Partial<IOfflineAd>): Promise<IOfflineAd> {
    const ad = new OfflineAd(data);
    await ad.save();

    // Generate QR code after save (needs the _id)
    const qrDataUrl = await this.generateQRCode(ad._id.toString());
    ad.qrCode = qrDataUrl;
    await ad.save();

    return ad;
  }

  /**
   * Get merchant's ads
   */
  async getMerchantAds(merchantId: string, status?: string): Promise<IOfflineAd[]> {
    const query: any = { merchantId };
    if (status) query.status = status;
    return OfflineAd.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get ad by ID
   */
  async getAd(adId: string): Promise<IOfflineAd | null> {
    return OfflineAd.findById(adId);
  }

  /**
   * Update ad
   */
  async updateAd(adId: string, updates: Partial<IOfflineAd>): Promise<IOfflineAd | null> {
    return OfflineAd.findByIdAndUpdate(adId, updates, { new: true });
  }

  /**
   * Activate ad
   */
  async activateAd(adId: string): Promise<IOfflineAd | null> {
    const ad = await OfflineAd.findById(adId);
    if (!ad) return null;

    ad.status = 'active';
    ad.startDate = new Date();
    ad.endDate = new Date(Date.now() + ad.duration * 24 * 60 * 60 * 1000);
    await ad.save();
    return ad;
  }

  /**
   * Complete ad
   */
  async completeAd(adId: string): Promise<IOfflineAd | null> {
    return OfflineAd.findByIdAndUpdate(adId, {
      status: 'completed',
      endDate: new Date(),
    }, { new: true });
  }

  /**
   * Track QR scan
   */
  async trackQRScan(data: {
    adId: string;
    scannedBy: string;
    location?: { lat: number; lng: number };
    deviceInfo?: string;
  }): Promise<IQRTracking> {
    const tracking = new QRTracking(data);
    await tracking.save();

    // Update ad scan count
    await OfflineAd.findByIdAndUpdate(data.adId, {
      $inc: { scans: 1 },
    });

    return tracking;
  }

  /**
   * Get ad analytics
   */
  async getAdAnalytics(adId: string): Promise<any> {
    const ad = await OfflineAd.findById(adId);
    if (!ad) return null;

    const scans = await QRTracking.find({ adId });
    const uniqueScanners = new Set(scans.map(s => s.scannedBy)).size;
    const scanLocations = scans.filter(s => s.location).map(s => s.location);

    return {
      impressions: ad.impressions,
      scans: ad.scans,
      conversions: ad.conversions,
      uniqueScanners,
      scanLocations,
      conversionRate: ad.scans > 0 ? (ad.conversions / ad.scans) * 100 : 0,
      costPerScan: ad.scans > 0 ? ad.price / ad.scans : 0,
      costPerConversion: ad.conversions > 0 ? ad.price / ad.conversions : 0,
    };
  }

  /**
   * Browse available ad inventory
   */
  async browseInventory(params: {
    city?: string;
    adType?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }): Promise<{ ads: IOfflineAd[]; total: number }> {
    const { city, adType, minPrice, maxPrice, page = 1, limit = 20 } = params;

    const query: any = { status: 'pending_approval' };

    if (city) {
      query['locations.city'] = city;
    }
    if (adType) {
      query.adType = adType;
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = minPrice;
      if (maxPrice) query.price.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;

    const [ads, total] = await Promise.all([
      OfflineAd.find(query).sort({ price: 1 }).skip(skip).limit(limit),
      OfflineAd.countDocuments(query),
    ]);

    return { ads, total };
  }

  /**
   * Generate QR code with tracking URL
   */
  private async generateQRCode(adId: string): Promise<string> {
    const baseUrl = process.env.FRONTEND_URL || 'https://app.rez.money';
    const trackingUrl = `${baseUrl}/offline-ad/${adId}`;

    try {
      // Generate QR code as base64 data URL
      const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      // Also store the URL for reference
      await OfflineAd.findByIdAndUpdate(adId, { qrCode: trackingUrl });

      return qrDataUrl;
    } catch (error) {
      console.error('QR generation failed:', error);
      // Fallback to simple URL
      return trackingUrl;
    }
  }
}

export const offlineAdsService = new OfflineAdsService();
