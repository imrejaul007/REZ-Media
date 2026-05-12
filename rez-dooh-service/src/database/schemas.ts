/**
 * DOOH Service - Database Schemas
 *
 * MongoDB schemas for all DOOH entities.
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// Screen Schema
// ============================================================================

export interface IScreenDocument extends Document {
  _id: mongoose.Types.ObjectId;
  screenId: string;
  name: string;
  type: string;
  networkType: string;
  locationType: string;
  location: {
    city: string;
    area: string;
    zone?: string;
    lat: number;
    lng: number;
    address?: string;
  };
  hardware?: {
    model?: string;
    os?: string;
    resolution?: string;
    screenSize?: number;
  };
  ownerId: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerType: 'owned' | 'partner' | 'external';
  status: 'active' | 'inactive' | 'offline' | 'maintenance';
  lastSeen?: Date;
  lastSync?: Date;
  playlistVersion: number;
  operatingHours?: {
    open: string;
    close: string;
    timezone: string;
  };
  audienceProfile?: {
    primary: { type: string; percentage: number }[];
    secondary?: { type: string; percentage: number }[];
    peakHours: { start: string; end: string; dayType: string }[];
    avgDwellTime: number;
    dailyFootfall?: number;
  };
  cpm: number;
  slotPricing?: {
    slotType: 'prime' | 'standard' | 'off_peak';
    durationSeconds: number;
    price: number;
    multiplier: number;
  }[];
  earningsBalance: number;
  earningsPaid: number;
  totalImpressions: number;
  totalScans: number;
  apiKeyHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScreenLocationSchema = new Schema({
  city: { type: String, required: true, index: true },
  area: { type: String, required: true, index: true },
  zone: String,
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  address: String,
}, { _id: false });

const HardwareSchema = new Schema({
  model: String,
  os: String,
  resolution: String,
  screenSize: Number,
}, { _id: false });

const OperatingHoursSchema = new Schema({
  open: { type: String, required: true },
  close: { type: String, required: true },
  timezone: { type: String, required: true },
}, { _id: false });

const AudienceProfileSchema = new Schema({
  primary: [{
    type: String,
    percentage: Number,
  }],
  secondary: [{
    type: String,
    percentage: Number,
  }],
  peakHours: [{
    start: String,
    end: String,
    dayType: String,
  }],
  avgDwellTime: { type: Number, required: true },
  dailyFootfall: Number,
}, { _id: false });

const SlotPricingSchema = new Schema({
  slotType: {
    type: String,
    enum: ['prime', 'standard', 'off_peak'],
  },
  durationSeconds: Number,
  price: Number,
  multiplier: Number,
}, { _id: false });

const ScreenSchema = new Schema<IScreenDocument>({
  screenId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true, index: true },
  networkType: { type: String, default: 'mass' },
  locationType: { type: String, required: true },
  location: { type: ScreenLocationSchema, required: true },
  hardware: HardwareSchema,
  ownerId: { type: String, required: true, index: true },
  ownerEmail: String,
  ownerPhone: String,
  ownerType: {
    type: String,
    enum: ['owned', 'partner', 'external'],
    default: 'partner',
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'offline', 'maintenance'],
    default: 'active',
    index: true,
  },
  lastSeen: Date,
  lastSync: Date,
  playlistVersion: { type: Number, default: 0 },
  operatingHours: OperatingHoursSchema,
  audienceProfile: AudienceProfileSchema,
  cpm: { type: Number, required: true },
  slotPricing: [SlotPricingSchema],
  earningsBalance: { type: Number, default: 0 },
  earningsPaid: { type: Number, default: 0 },
  totalImpressions: { type: Number, default: 0 },
  totalScans: { type: Number, default: 0 },
  apiKeyHash: { type: String, required: true },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// Compound indexes for common queries
ScreenSchema.index({ 'location.city': 1, 'location.area': 1 });
ScreenSchema.index({ status: 1, type: 1 });
ScreenSchema.index({ ownerId: 1, status: 1 });

export const ScreenModel = mongoose.model<IScreenDocument>('Screen', ScreenSchema);

// ============================================================================
// Campaign Schema
// ============================================================================

export interface ICampaignDocument extends Document {
  _id: mongoose.Types.ObjectId;
  campaignId: string;
  name: string;
  merchantId: string;
  brandId?: string;
  creatives: {
    id: string;
    type: 'image' | 'video' | 'html5';
    url: string;
    thumbnail?: string;
    name: string;
    duration: number;
  }[];
  targeting: {
    cities?: string[];
    areas?: string[];
    screenTypes?: string[];
    locationTypes?: string[];
    audienceSegments?: string[];
    dayParts?: {
      morning?: boolean;
      afternoon?: boolean;
      evening?: boolean;
    };
    weekdaysOnly?: boolean;
  };
  budget: number;
  spent: number;
  startDate: Date;
  endDate: Date;
  scheduleType: 'continuous' | 'scheduled' | 'time_slots';
  screenFilter?: {
    minFootfall?: number;
    audienceOverlap?: number;
    cpmMax?: number;
    cpmMin?: number;
  };
  status: 'draft' | 'active' | 'paused' | 'completed' | 'budget_exhausted';
  metrics: {
    impressions: number;
    uniqueImpressions: number;
    avgViewDuration: number;
    interactions: number;
    scans: number;
    visits: number;
    purchases: number;
    revenue: number;
    scanRate: number;
    visitRate: number;
    purchaseRate: number;
    totalSpent: number;
    cpmActual: number;
    cpcActual: number;
    cpuActual: number;
    cppActual: number;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CreativeSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['image', 'video', 'html5'], required: true },
  url: { type: String, required: true },
  thumbnail: String,
  name: { type: String, required: true },
  duration: { type: Number, required: true },
}, { _id: false });

const TargetingSchema = new Schema({
  cities: [String],
  areas: [String],
  screenTypes: [String],
  locationTypes: [String],
  audienceSegments: [String],
  dayParts: {
    morning: Boolean,
    afternoon: Boolean,
    evening: Boolean,
  },
  weekdaysOnly: Boolean,
}, { _id: false });

const ScreenFilterSchema = new Schema({
  minFootfall: Number,
  audienceOverlap: Number,
  cpmMax: Number,
  cpmMin: Number,
}, { _id: false });

const MetricsSchema = new Schema({
  impressions: { type: Number, default: 0 },
  uniqueImpressions: { type: Number, default: 0 },
  avgViewDuration: { type: Number, default: 0 },
  interactions: { type: Number, default: 0 },
  scans: { type: Number, default: 0 },
  visits: { type: Number, default: 0 },
  purchases: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  scanRate: { type: Number, default: 0 },
  visitRate: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  cpmActual: { type: Number, default: 0 },
  cpcActual: { type: Number, default: 0 },
  cpuActual: { type: Number, default: 0 },
  cppActual: { type: Number, default: 0 },
  lastUpdated: Date,
}, { _id: false });

const CampaignSchema = new Schema<ICampaignDocument>({
  campaignId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  merchantId: { type: String, required: true, index: true },
  brandId: String,
  creatives: [CreativeSchema],
  targeting: TargetingSchema,
  budget: { type: Number, required: true },
  spent: { type: Number, default: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  scheduleType: {
    type: String,
    enum: ['continuous', 'scheduled', 'time_slots'],
    default: 'continuous',
  },
  screenFilter: ScreenFilterSchema,
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'budget_exhausted'],
    default: 'draft',
    index: true,
  },
  metrics: { type: MetricsSchema, default: () => ({}) },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
});

// Indexes
CampaignSchema.index({ status: 1, startDate: 1, endDate: 1 });
CampaignSchema.index({ merchantId: 1, status: 1 });

export const CampaignModel = mongoose.model<ICampaignDocument>('Campaign', CampaignSchema);

// ============================================================================
// Impression Event Schema
// ============================================================================

export interface IImpressionEventDocument extends Document {
  _id: mongoose.Types.ObjectId;
  screenId: string;
  campaignId?: string;
  adId: string;
  userId?: string;
  timestamp: Date;
  durationPlayed: number;
  viewable: boolean;
  metadata?: Record<string, unknown>;
}

const ImpressionEventSchema = new Schema<IImpressionEventDocument>({
  screenId: { type: String, required: true, index: true },
  campaignId: { type: String, index: true },
  adId: { type: String, required: true },
  userId: String,
  timestamp: { type: Date, default: Date.now, index: true },
  durationPlayed: { type: Number, default: 0 },
  viewable: { type: Boolean, default: true },
  metadata: Schema.Types.Mixed,
}, {
  timestamps: true,
});

// TTL index - auto-delete after 90 days
ImpressionEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Aggregation indexes
ImpressionEventSchema.index({ screenId: 1, timestamp: -1 });
ImpressionEventSchema.index({ campaignId: 1, timestamp: -1 });

export const ImpressionEventModel = mongoose.model<IImpressionEventDocument>('ImpressionEvent', ImpressionEventSchema);

// ============================================================================
// Playlist Schema
// ============================================================================

export interface IPlaylistDocument extends Document {
  _id: mongoose.Types.ObjectId;
  playlistId: string;
  screenId: string;
  date: Date;
  slots: {
    position: number;
    campaignId: string;
    creativeId: string;
    startTime: string;
    duration: number;
    scheduledImpressions: number;
    actualImpressions?: number;
  }[];
  totalDuration: number;
  generatedAt: Date;
  version: number;
  createdAt: Date;
}

const PlaylistSlotSchema = new Schema({
  position: Number,
  campaignId: String,
  creativeId: String,
  startTime: String,
  duration: Number,
  scheduledImpressions: Number,
  actualImpressions: Number,
}, { _id: false });

const PlaylistSchema = new Schema<IPlaylistDocument>({
  playlistId: { type: String, required: true, unique: true },
  screenId: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  slots: [PlaylistSlotSchema],
  totalDuration: Number,
  generatedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: false },
});

// Index for latest playlist per screen
PlaylistSchema.index({ screenId: 1, date: -1, version: -1 }, { unique: true });

export const PlaylistModel = mongoose.model<IPlaylistDocument>('Playlist', PlaylistSchema);

// ============================================================================
// Payout Schema
// ============================================================================

export interface IPayoutDocument extends Document {
  _id: mongoose.Types.ObjectId;
  payoutId: string;
  screenId: string;
  periodStart: Date;
  periodEnd: Date;
  impressions: number;
  grossRevenue: number;
  platformFee: number;
  ownerAmount: number;
  status: 'pending' | 'processed' | 'paid';
  paidAt?: Date;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema = new Schema<IPayoutDocument>({
  payoutId: { type: String, required: true, unique: true },
  screenId: { type: String, required: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  impressions: { type: Number, default: 0 },
  grossRevenue: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  ownerAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'processed', 'paid'],
    default: 'pending',
    index: true,
  },
  paidAt: Date,
  transactionId: String,
}, {
  timestamps: true,
});

export const PayoutModel = mongoose.model<IPayoutDocument>('Payout', PayoutSchema);

// ============================================================================
// Heartbeat Schema
// ============================================================================

export interface IHeartbeatDocument extends Document {
  _id: mongoose.Types.ObjectId;
  screenId: string;
  timestamp: Date;
  status: string;
  playlistVersion: number;
  impressionsLastHour: number;
  errors?: string[];
  metadata?: Record<string, unknown>;
}

const HeartbeatSchema = new Schema<IHeartbeatDocument>({
  screenId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  status: String,
  playlistVersion: Number,
  impressionsLastHour: { type: Number, default: 0 },
  errors: [String],
  metadata: Schema.Types.Mixed,
}, {
  timestamps: true,
});

// TTL index - auto-delete after 7 days
HeartbeatSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const HeartbeatModel = mongoose.model<IHeartbeatDocument>('Heartbeat', HeartbeatSchema);

// ============================================================================
// Database Connection
// ============================================================================

let connection: mongoose.Connection | null = null;

export async function connectDatabase(uri?: string): Promise<mongoose.Connection> {
  if (connection && connection.readyState === 1) {
    return connection;
  }

  const mongoUri = uri || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  connection = mongoose.connection;

  connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err);
  });

  connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected');
  });

  connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected');
  });

  console.log('[DB] Connected to MongoDB');

  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  if (connection) {
    await mongoose.disconnect();
    connection = null;
    console.log('[DB] Disconnected from MongoDB');
  }
}

export function getConnection(): mongoose.Connection | null {
  return connection;
}
