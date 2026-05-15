/**
 * REZ Partner Portal - Models
 */

import mongoose, { Schema } from 'mongoose';
import {
  Partner,
  PartnerUser,
  Campaign,
  Payout,
  Invoice,
  Report,
} from '../types';

// Partner Schema
const partnerSchema = new Schema<Partner>(
  {
    partnerId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['oem', 'telco', 'agency', 'influencer', 'reseller'], required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    company: String,
    website: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'terminated'],
      default: 'pending',
    },
    tier: {
      type: String,
      enum: ['basic', 'silver', 'gold', 'platinum'],
      default: 'basic',
    },
    commission: {
      default: { type: Number, default: 10 },
      custom: Number,
    },
    settings: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        dashboard: { type: Boolean, default: true },
      },
      autoPayout: { type: Boolean, default: false },
      minPayoutThreshold: { type: Number, default: 100 },
      reportingFrequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'weekly',
      },
    },
    apiCredentials: {
      clientId: String,
      clientSecret: String,
      scopes: [String],
    },
    billing: {
      paymentMethod: String,
      bankDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        routingCode: String,
      },
      paypalEmail: String,
      cryptoWallet: String,
    },
    stats: {
      totalRevenue: { type: Number, default: 0 },
      pendingPayout: { type: Number, default: 0 },
      totalReferrals: { type: Number, default: 0 },
      activeCampaigns: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'partners' }
);

// Partner User Schema
const partnerUserSchema = new Schema<PartnerUser>(
  {
    partnerId: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'viewer'], default: 'viewer' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastLogin: Date,
  },
  { timestamps: true, collection: 'partner_users' }
);

// Campaign Schema
const campaignSchema = new Schema<Campaign>(
  {
    campaignId: { type: String, required: true, unique: true },
    partnerId: { type: String, required: true },
    name: { type: String, required: true },
    advertiserId: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed'],
      default: 'draft',
    },
    budget: {
      total: { type: Number, required: true },
      spent: { type: Number, default: 0 },
      daily: Number,
    },
    targeting: {
      age: {
        min: Number,
        max: Number,
      },
      gender: [String],
      locations: [String],
      interests: [String],
    },
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 },
      cvr: { type: Number, default: 0 },
      cpm: { type: Number, default: 0 },
      cpa: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'partner_campaigns' }
);

// Payout Schema
const payoutSchema = new Schema<Payout>(
  {
    payoutId: { type: String, required: true, unique: true },
    partnerId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    method: {
      type: String,
      enum: ['bank_transfer', 'paypal', 'crypto'],
      required: true,
    },
    transactionId: String,
    requestedAt: { type: Date, default: Date.now },
    processedAt: Date,
    completedAt: Date,
  },
  { timestamps: true, collection: 'payouts' }
);

// Invoice Schema
const invoiceSchema = new Schema<Invoice>(
  {
    invoiceId: { type: String, required: true, unique: true },
    partnerId: { type: String, required: true },
    period: {
      start: Date,
      end: Date,
    },
    items: [
      {
        description: String,
        quantity: Number,
        unitPrice: Number,
        amount: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue'],
      default: 'draft',
    },
    dueDate: Date,
    paidAt: Date,
  },
  { timestamps: true, collection: 'invoices' }
);

// Report Schema
const reportSchema = new Schema<Report>(
  {
    reportId: { type: String, required: true, unique: true },
    partnerId: { type: String, required: true },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      required: true,
    },
    dateRange: {
      start: Date,
      end: Date,
    },
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      topCampaigns: [
        {
          campaignId: String,
          name: String,
          revenue: Number,
        },
      ],
      topPlacements: [
        {
          placement: String,
          impressions: Number,
        },
      ],
    },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'partner_reports' }
);

// Export models
export const PartnerModel = mongoose.model<Partner>('Partner', partnerSchema);
export const PartnerUserModel = mongoose.model<PartnerUser>('PartnerUser', partnerUserSchema);
export const CampaignModel = mongoose.model<Campaign>('Campaign', campaignSchema);
export const PayoutModel = mongoose.model<Payout>('Payout', payoutSchema);
export const InvoiceModel = mongoose.model<Invoice>('Invoice', invoiceSchema);
export const ReportModel = mongoose.model<Report>('Report', reportSchema);
