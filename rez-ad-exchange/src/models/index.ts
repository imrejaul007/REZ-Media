/**
 * REZ Ad Exchange - Models
 */

import mongoose, { Schema } from 'mongoose';
import {
  Publisher,
  Advertiser,
  Campaign,
  Deal,
  Auction,
  BidRequest,
} from '../types';

// Publisher Schema
const publisherSchema = new Schema<Publisher>(
  {
    publisherId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    domain: { type: String, required: true, unique: true },
    type: { type: String, enum: ['website', 'app', 'dooh'], required: true },
    categories: [String],
    traffic: {
      monthlyPageviews: { type: Number, default: 0 },
      monthlyVisitors: { type: Number, default: 0 },
      avgSessionDuration: { type: Number, default: 0 },
    },
    inventory: [
      {
        inventoryId: String,
        placementId: String,
        name: String,
        type: String,
        sizes: [String],
        positions: [String],
        traffic: {
          dailyImpressions: { type: Number, default: 0 },
          fillRate: { type: Number, default: 0 },
          avgCPM: { type: Number, default: 0 },
        },
        enabled: { type: Boolean, default: true },
      },
    ],
    sspAccounts: [
      {
        sspId: String,
        name: String,
        endpoint: String,
        apiKey: String,
        enabled: { type: Boolean, default: true },
        floors: { type: Number, default: 0 },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'verified', 'suspended'],
      default: 'pending',
    },
  },
  { timestamps: true, collection: 'publishers' }
);

// Advertiser Schema
const advertiserSchema = new Schema<Advertiser>(
  {
    advertiserId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    company: { type: String, required: true },
    website: { type: String, required: true },
    industry: { type: String, required: true },
    budgets: [
      {
        budgetId: String,
        name: String,
        amount: Number,
        spent: { type: Number, default: 0 },
        startDate: Date,
        endDate: Date,
        pacing: { type: String, enum: ['accelerated', 'standard'], default: 'standard' },
        status: { type: String, enum: ['active', 'paused', 'exhausted'], default: 'active' },
      },
    ],
    dspAccounts: [
      {
        dspId: String,
        name: String,
        endpoint: String,
        apiKey: String,
        enabled: { type: Boolean, default: true },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending',
    },
  },
  { timestamps: true, collection: 'advertisers' }
);

// Campaign Schema
const campaignSchema = new Schema<Campaign>(
  {
    campaignId: { type: String, required: true, unique: true },
    advertiserId: { type: String, required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed'],
      default: 'draft',
    },
    objective: {
      type: String,
      enum: ['awareness', 'traffic', 'conversion', 'revenue'],
      required: true,
    },
    budget: {
      total: { type: Number, required: true },
      spent: { type: Number, default: 0 },
      daily: Number,
    },
    bidding: {
      strategy: {
        type: String,
        enum: ['cpm', 'cpc', 'cpa', 'fixed'],
        required: true,
      },
      maxBid: { type: Number, required: true },
      targetCpa: Number,
      targetRoas: Number,
    },
    targeting: {
      age: {
        min: Number,
        max: Number,
      },
      gender: [String],
      locations: [String],
      devices: [String],
      inventoryTypes: [String],
      publishers: [String],
      categories: [String],
      viewability: {
        min: Number,
        max: Number,
      },
    },
    creatives: [
      {
        creativeId: String,
        name: String,
        type: String,
        format: String,
        assets: {
          url: String,
          width: Number,
          height: Number,
          mimeType: String,
        },
        clickUrl: String,
        trackingUrls: {
          impression: String,
          click: String,
        },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      },
    ],
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      spend: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 },
      cvr: { type: Number, default: 0 },
      cpm: { type: Number, default: 0 },
      cpc: { type: Number, default: 0 },
      cpa: { type: Number, default: 0 },
      viewability: {
        measurable: { type: Number, default: 0 },
        visible: { type: Number, default: 0 },
        avgViewability: { type: Number, default: 0 },
      },
    },
  },
  { timestamps: true, collection: 'campaigns' }
);

// Deal Schema
const dealSchema = new Schema<Deal>(
  {
    dealId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['preferred', 'programmatic', 'private'],
      required: true,
    },
    publisherId: { type: String, required: true },
    advertiserId: String,
    inventoryIds: [String],
    floorPrice: { type: Number, required: true },
    budget: Number,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['active', 'paused', 'expired'],
      default: 'active',
    },
  },
  { timestamps: true, collection: 'deals' }
);

// Auction Schema
const auctionSchema = new Schema<Auction>(
  {
    auctionId: { type: String, required: true, unique: true },
    requestId: { type: String, required: true },
    inventoryId: { type: String, required: true },
    bids: [
      {
        dspId: String,
        campaignId: String,
        cpm: Number,
      },
    ],
    winner: {
      dspId: String,
      campaignId: String,
      cpm: Number,
    },
    secondPrice: Number,
    timestamp: Date,
  },
  { timestamps: true, collection: 'auctions' }
);

// Export models
export const PublisherModel = mongoose.model<Publisher>('Publisher', publisherSchema);
export const AdvertiserModel = mongoose.model<Advertiser>('Advertiser', advertiserSchema);
export const CampaignModel = mongoose.model<Campaign>('Campaign', campaignSchema);
export const DealModel = mongoose.model<Deal>('Deal', dealSchema);
export const AuctionModel = mongoose.model<Auction>('Auction', auctionSchema);
