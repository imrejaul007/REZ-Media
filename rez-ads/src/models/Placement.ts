import mongoose, { Schema, Document } from 'mongoose';
import { PlacementType, Placement } from '../types/index.js';

const DimensionsSchema = new Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
}, { _id: false });

const FloorPriceHistorySchema = new Schema({
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const StatsSchema = new Schema({
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
}, { _id: false });

const PlacementSchema = new Schema<Placement & Document>({
  placementId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  siteId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 255,
  },
  type: {
    type: String,
    enum: Object.values(PlacementType),
    required: true,
  },
  dimensions: {
    type: DimensionsSchema,
    required: true,
  },
  position: {
    type: String,
    enum: ['above_fold', 'below_fold', 'sidebar', 'footer', 'header'],
    required: true,
  },
  floorPrice: {
    type: Number,
    required: true,
    min: 0.01,
    default: 0.01,
  },
  floorPriceHistory: [FloorPriceHistorySchema],
  allowedCategories: [String],
  blockedCategories: [String],
  status: {
    type: String,
    enum: ['active', 'paused', 'inactive'],
    default: 'active',
    index: true,
  },
  stats: {
    type: StatsSchema,
    default: () => ({}),
  },
}, {
  timestamps: true,
});

// Indexes
PlacementSchema.index({ siteId: 1, status: 1 });
PlacementSchema.index({ type: 1, status: 1 });
PlacementSchema.index({ 'dimensions.width': 1, 'dimensions.height': 1 });
PlacementSchema.index({ status: 1, floorPrice: 1 });
PlacementSchema.index({ createdAt: -1 });

// Methods
PlacementSchema.methods.isActive = function(): boolean {
  return this.status === 'active';
};

PlacementSchema.methods.updateFloorPrice = async function(newPrice: number): Promise<void> {
  // Add to history
  this.floorPriceHistory.push({
    price: this.floorPrice,
    timestamp: new Date(),
  });

  // Keep only last 100 price changes
  if (this.floorPriceHistory.length > 100) {
    this.floorPriceHistory = this.floorPriceHistory.slice(-100);
  }

  this.floorPrice = newPrice;
  await this.save();
};

PlacementSchema.methods.addRevenue = async function(amount: number): Promise<void> {
  this.stats.revenue += amount;
  await this.save();
};

PlacementSchema.methods.incrementImpressions = async function(): Promise<void> {
  this.stats.impressions += 1;
  await this.save();
};

PlacementSchema.methods.incrementClicks = async function(): Promise<void> {
  this.stats.clicks += 1;
  await this.save();
};

// Statics
PlacementSchema.statics.findActiveBySite = async function(siteId: string): Promise<Placement[]> {
  return this.find({ siteId, status: 'active' }).exec();
};

PlacementSchema.statics.findByDimensions = async function(
  width: number,
  height: number
): Promise<Placement[]> {
  return this.find({
    'dimensions.width': width,
    'dimensions.height': height,
    status: 'active',
  }).exec();
};

PlacementSchema.statics.findByType = async function(
  type: PlacementType
): Promise<Placement[]> {
  return this.find({ type, status: 'active' }).exec();
};

// Virtual for CTR
PlacementSchema.virtual('ctr').get(function() {
  if (this.stats.impressions === 0) return 0;
  return (this.stats.clicks / this.stats.impressions) * 100;
});

// Virtual for effective CPM
PlacementSchema.virtual('effectiveCpm').get(function() {
  if (this.stats.impressions === 0) return 0;
  return (this.stats.revenue / this.stats.impressions) * 1000;
});

// Ensure virtuals are included in JSON output
PlacementSchema.set('toJSON', { virtuals: true });
PlacementSchema.set('toObject', { virtuals: true });

export const PlacementModel = mongoose.model<Placement & Document>('Placement', PlacementSchema);

// Site model for publisher management
const SiteSchema = new Schema({
  siteId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 255,
  },
  domain: {
    type: String,
    required: true,
    unique: true,
  },
  ownerId: {
    type: String,
    required: true,
    index: true,
  },
  categories: [String],
  status: {
    type: String,
    enum: ['active', 'paused', 'inactive', 'suspended'],
    default: 'active',
  },
  verification: {
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    verificationMethod: String,
  },
  settings: {
    defaultCpmFloor: Number,
    acceptedAdTypes: [{
      type: String,
      enum: ['text', 'image', 'video', 'carousel'],
    }],
    allowedCategories: [String],
    blockedCategories: [String],
  },
  stats: {
    totalPlacements: { type: Number, default: 0 },
    activePlacements: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
  },
}, { timestamps: true });

SiteSchema.index({ ownerId: 1, status: 1 });
SiteSchema.index({ domain: 1 });

export const SiteModel = mongoose.model('Site', SiteSchema);
