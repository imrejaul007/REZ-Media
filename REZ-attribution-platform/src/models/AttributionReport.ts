import mongoose, { Document, Schema } from 'mongoose';
import { Channel } from './Touchpoint';

export enum AttributionModel {
  FIRST_TOUCH = 'first_touch',
  LAST_TOUCH = 'last_touch',
  LINEAR = 'linear',
  TIME_DECAY = 'time_decay',
  POSITION_BASED = 'position_based'
}

export interface IChannelAttribution {
  channel: Channel | string;
  touchpoints: number;
  conversions: number;
  attributedValue: number;
  attributionPercentage: number;
}

export interface ICampaignAttribution {
  campaignId: string;
  campaignName?: string;
  touchpoints: number;
  conversions: number;
  attributedValue: number;
  attributionPercentage: number;
  channelBreakdown: IChannelAttribution[];
}

export interface ITouchpointContribution {
  touchpointId: string;
  touchpointType: string;
  channel: string;
  campaignId?: string;
  timestamp: Date;
  contribution: number;
  contributionPercentage: number;
}

export interface IAttributionReport extends Document {
  id: string;
  reportType: 'single_conversion' | 'campaign' | 'merchant' | 'channel' | 'custom';
  attributionModel: AttributionModel;
  entityId?: string; // campaignId, merchantId, or custom identifier
  entityType?: 'campaign' | 'merchant' | 'user' | 'custom';

  // Date range
  startDate: Date;
  endDate: Date;
  lookbackDays: number;

  // Summary metrics
  totalTouchpoints: number;
  totalConversions: number;
  totalValue: number;
  conversionRate: number;

  // Channel attribution breakdown
  channelAttribution: IChannelAttribution[];

  // Campaign attribution breakdown
  campaignAttribution: ICampaignAttribution[];

  // Detailed touchpoint contributions
  touchpointContributions: ITouchpointContribution[];

  // For position-based model
  firstTouchContribution?: number;
  lastTouchContribution?: number;
  middleTouchContribution?: number;

  // Funnel data
  funnelData?: Array<{
    stage: string;
    count: number;
    dropoffRate: number;
  }>;

  metadata?: Record<string, unknown>;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelAttributionSchema = new Schema({
  channel: String,
  touchpoints: Number,
  conversions: Number,
  attributedValue: Number,
  attributionPercentage: Number
}, { _id: false });

const CampaignAttributionSchema = new Schema({
  campaignId: String,
  campaignName: String,
  touchpoints: Number,
  conversions: Number,
  attributedValue: Number,
  attributionPercentage: Number,
  channelBreakdown: [ChannelAttributionSchema]
}, { _id: false });

const TouchpointContributionSchema = new Schema({
  touchpointId: String,
  touchpointType: String,
  channel: String,
  campaignId: String,
  timestamp: Date,
  contribution: Number,
  contributionPercentage: Number
}, { _id: false });

const FunnelStageSchema = new Schema({
  stage: String,
  count: Number,
  dropoffRate: Number
}, { _id: false });

const AttributionReportSchema = new Schema<IAttributionReport>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    reportType: {
      type: String,
      enum: ['single_conversion', 'campaign', 'merchant', 'channel', 'custom'],
      required: true,
      index: true
    },
    attributionModel: {
      type: String,
      enum: Object.values(AttributionModel),
      required: true,
      index: true
    },
    entityId: {
      type: String,
      index: true
    },
    entityType: {
      type: String,
      enum: ['campaign', 'merchant', 'user', 'custom']
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    lookbackDays: {
      type: Number,
      required: true
    },
    totalTouchpoints: {
      type: Number,
      default: 0
    },
    totalConversions: {
      type: Number,
      default: 0
    },
    totalValue: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    channelAttribution: [ChannelAttributionSchema],
    campaignAttribution: [CampaignAttributionSchema],
    touchpointContributions: [TouchpointContributionSchema],
    firstTouchContribution: Number,
    lastTouchContribution: Number,
    middleTouchContribution: Number,
    funnelData: [FunnelStageSchema],
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    generatedAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'attribution_reports'
  }
);

// Compound indexes for common queries
AttributionReportSchema.index({ reportType: 1, attributionModel: 1, generatedAt: -1 });
AttributionReportSchema.index({ entityId: 1, entityType: 1, generatedAt: -1 });

export const AttributionReport = mongoose.model<IAttributionReport>(
  'AttributionReport',
  AttributionReportSchema
);
