import mongoose, { Document, Schema } from 'mongoose';

export enum ConversionType {
  PURCHASE = 'purchase',
  SIGNUP = 'signup',
  SUBSCRIPTION = 'subscription',
  LEAD = 'lead',
  DOWNLOAD = 'download',
  APP_INSTALL = 'app_install'
}

export enum ConversionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export interface IConversion extends Document {
  id: string;
  userId: string;
  sessionId: string;
  type: ConversionType;
  status: ConversionStatus;
  merchantId: string;
  storeId?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  items?: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    category?: string;
  }>;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  attributionData?: {
    touchpointIds: string[];
    attributionModel: string;
    attributedChannel: string;
    attributedCampaignId?: string;
  };
  metadata?: Record<string, unknown>;
  conversionTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversionSchema = new Schema<IConversion>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(ConversionType),
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(ConversionStatus),
      required: true,
      default: ConversionStatus.PENDING,
      index: true
    },
    merchantId: {
      type: String,
      required: true,
      index: true
    },
    storeId: {
      type: String,
      index: true
    },
    orderId: {
      type: String,
      index: true
    },
    value: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    items: [{
      productId: String,
      name: String,
      quantity: Number,
      price: Number,
      category: String
    }],
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    attributionData: {
      touchpointIds: [String],
      attributionModel: String,
      attributedChannel: String,
      attributedCampaignId: String
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    conversionTimestamp: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'conversions'
  }
);

// Compound indexes for attribution queries
ConversionSchema.index({ userId: 1, conversionTimestamp: -1 });
ConversionSchema.index({ merchantId: 1, conversionTimestamp: -1 });
ConversionSchema.index({ status: 1, conversionTimestamp: -1 });

export const Conversion = mongoose.model<IConversion>('Conversion', ConversionSchema);
