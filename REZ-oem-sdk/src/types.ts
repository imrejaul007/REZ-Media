/**
 * REZ OEM SDK - Types
 * Type definitions for OEM/Telco partnerships
 */

export interface OEMConfig {
  partnerId: string;
  partnerSecret: string;
  apiUrl: string;
  deviceId?: string;
  carrier?: string;
}

export interface DeviceInfo {
  deviceId: string;
  manufacturer: string;
  model: string;
  os: 'android' | 'ios' | 'windows' | 'other';
  osVersion: string;
  carrier?: string;
  imei?: string;
  macAddress?: string;
}

export interface UserProfile {
  userId: string;
  oemUserId?: string;
  carrier?: string;
  deviceId: string;
  segments: string[];
  interests: string[];
  consentGiven: boolean;
  consentTimestamp?: Date;
}

export interface AdOffer {
  offerId: string;
  advertiserId: string;
  campaignId: string;
  adType: 'banner' | 'interstitial' | 'native' | 'rewarded' | 'splash';
  placement: string;
  cpm: number;
  targeting: {
    carriers?: string[];
    manufacturers?: string[];
    osVersions?: string[];
    segments?: string[];
  };
  assets: {
    title: string;
    body: string;
    imageUrl?: string;
    videoUrl?: string;
    ctaText: string;
    ctaUrl: string;
  };
  trackingUrls: {
    impression: string;
    click: string;
    conversion?: string;
  };
}

export interface ImpressionEvent {
  offerId: string;
  deviceId: string;
  userId?: string;
  timestamp: Date;
  placement: string;
  viewability?: {
    measurable: boolean;
    visible: boolean;
    percentVisible?: number;
    duration?: number;
  };
}

export interface ClickEvent {
  offerId: string;
  deviceId: string;
  userId?: string;
  timestamp: Date;
  placement: string;
  redirectUrl: string;
}

export interface ConversionEvent {
  offerId: string;
  deviceId: string;
  userId: string;
  timestamp: Date;
  eventType: 'install' | 'signup' | 'purchase' | 'engagement';
  revenue?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface CarrierBillingRequest {
  userId: string;
  deviceId: string;
  offerId: string;
  amount: number;
  currency: string;
  productId: string;
  productName: string;
}

export interface CarrierBillingResponse {
  transactionId: string;
  status: 'pending' | 'confirmed' | 'failed';
  carrierMessage?: string;
  charges: {
    amount: number;
    currency: string;
    appearsOnBill: 'immediate' | 'next_cycle';
  };
}

export interface TelcoConsentRequest {
  msisdn: string;
  carrier: string;
  consentType: 'ad_tracking' | 'data_sharing' | 'location';
  granted: boolean;
  timestamp: Date;
}

export interface TelcoConsentResponse {
  consentId: string;
  status: 'recorded' | 'expired' | 'revoked';
  validUntil?: Date;
}

export interface OEMMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cvr: number;
  rpm: number;
}

export interface CampaignTargeting {
  carriers?: string[];
  manufacturers?: string[];
  deviceModels?: string[];
  osVersions?: string[];
  segments?: string[];
  ageGroups?: string[];
  locations?: string[];
}

export interface OEMPlacement {
  placementId: string;
  name: string;
  type: 'splash' | 'banner' | 'interstitial' | 'native' | 'rewarded';
  positions: string[];
  floors: {
    cpm: number;
    currency: string;
  };
  enabled: boolean;
}
