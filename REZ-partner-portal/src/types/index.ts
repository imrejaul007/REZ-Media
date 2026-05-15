/**
 * REZ Partner Portal - Types
 */

export type PartnerType = 'oem' | 'telco' | 'agency' | 'influencer' | 'reseller';

export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'terminated';

export interface Partner {
  _id: string;
  partnerId: string;
  name: string;
  type: PartnerType;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  address?: Address;
  status: PartnerStatus;
  tier: 'basic' | 'silver' | 'gold' | 'platinum';
  commission: {
    default: number;
    custom?: number;
  };
  settings: PartnerSettings;
  apiCredentials?: {
    clientId: string;
    clientSecret: string;
    scopes: string[];
  };
  billing?: BillingInfo;
  stats?: PartnerStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface PartnerSettings {
  notifications: {
    email: boolean;
    sms: boolean;
    dashboard: boolean;
  };
  autoPayout: boolean;
  minPayoutThreshold: number;
  reportingFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface BillingInfo {
  paymentMethod: 'bank_transfer' | 'paypal' | 'crypto';
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    routingCode: string;
  };
  paypalEmail?: string;
  cryptoWallet?: string;
}

export interface PartnerStats {
  totalRevenue: number;
  pendingPayout: number;
  totalReferrals: number;
  activeCampaigns: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface PartnerUser {
  _id: string;
  partnerId: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'manager' | 'viewer';
  status: 'active' | 'inactive';
  lastLogin?: Date;
  createdAt: Date;
}

export interface Campaign {
  _id: string;
  campaignId: string;
  partnerId: string;
  name: string;
  advertiserId: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  budget: {
    total: number;
    spent: number;
    daily?: number;
  };
  targeting: {
    age?: { min: number; max: number };
    gender?: string[];
    locations?: string[];
    interests?: string[];
  };
  metrics: CampaignMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cvr: number;
  cpm: number;
  cpa: number;
}

export interface Payout {
  _id: string;
  payoutId: string;
  partnerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method: 'bank_transfer' | 'paypal' | 'crypto';
  transactionId?: string;
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
}

export interface Invoice {
  _id: string;
  invoiceId: string;
  partnerId: string;
  period: {
    start: Date;
    end: Date;
  };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: Date;
  paidAt?: Date;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Report {
  _id: string;
  reportId: string;
  partnerId: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: ReportMetrics;
  generatedAt: Date;
}

export interface ReportMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  topCampaigns: { campaignId: string; name: string; revenue: number }[];
  topPlacements: { placement: string; impressions: number }[];
}
