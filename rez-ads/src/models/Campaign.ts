import mongoose, { Schema, Document } from 'mongoose';
import { CampaignStatus, BidStrategy, Campaign } from '../types/index.js';

const GeoTargetingSchema = new Schema({
  countries: [String],
  regions: [String],
  cities: [String],
  postalCodes: [String],
  radius: {
    lat: Number,
    lng: Number,
    radiusKm: Number,
  },
}, { _id: false });

const DeviceTargetingSchema = new Schema({
  devices: [{
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
  }],
  operatingSystems: [{
    type: String,
    enum: ['ios', 'android', 'windows', 'macos', 'linux'],
  }],
  browsers: [String],
}, { _id: false });

const TimeSlotSchema = new Schema({
  dayOfWeek: [Number],
  startHour: Number,
  endHour: Number,
}, { _id: false });

const ScheduleSchema = new Schema({
  startDate: String,
  endDate: String,
  timeSlots: [TimeSlotSchema],
}, { _id: false });

const BudgetSchema = new Schema({
  daily: Number,
  total: Number,
  spent: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
}, { _id: false });

const BidStrategySchema = new Schema({
  type: {
    type: String,
    enum: Object.values(BidStrategy),
    required: true,
  },
  amount: { type: Number, required: true, min: 0.01 },
  maxBid: Number,
}, { _id: false });

const TargetingSchema = new Schema({
  geo: GeoTargetingSchema,
  devices: DeviceTargetingSchema,
  schedule: ScheduleSchema,
  ageGroups: [String],
  interests: [String],
  keywords: [String],
}, { _id: false });

const StatisticsSchema = new Schema({
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  spend: { type: Number, default: 0 },
  ctr: { type: Number, default: 0 },
  cpc: { type: Number, default: 0 },
  cpm: { type: Number, default: 0 },
}, { _id: false });

const CampaignSchema = new Schema<Campaign & Document>({
  campaignId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  advertiserId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 255,
  },
  objective: {
    type: String,
    enum: ['awareness', 'traffic', 'engagement', 'conversions'],
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(CampaignStatus),
    default: CampaignStatus.DRAFT,
    index: true,
  },
  budget: {
    type: BudgetSchema,
    required: true,
  },
  bidStrategy: {
    type: BidStrategySchema,
    required: true,
  },
  targeting: TargetingSchema,
  adIds: [{
    type: String,
    ref: 'Ad',
  }],
  statistics: {
    type: StatisticsSchema,
    default: () => ({}),
  },
}, {
  timestamps: true,
});

// Indexes
CampaignSchema.index({ status: 1, 'budget.total': 1 });
CampaignSchema.index({ advertiserId: 1, status: 1 });
CampaignSchema.index({ 'targeting.keywords': 1 });
CampaignSchema.index({ 'targeting.interests': 1 });
CampaignSchema.index({ createdAt: -1 });

// Methods
CampaignSchema.methods.isActive = function(): boolean {
  return this.status === CampaignStatus.ACTIVE;
};

CampaignSchema.methods.isWithinBudget = function(amount: number): boolean {
  const remaining = this.budget.total - this.budget.spent;
  return remaining >= amount;
};

CampaignSchema.methods.isDailyBudgetAvailable = function(amount: number): boolean {
  if (!this.budget.daily) return true;
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const dailySpent = await mongoose.model('CampaignDailyStats').findOne({
    campaignId: this.campaignId,
    date: startOfDay,
  }).then(stat => stat?.spent || 0);
  return (this.budget.daily - dailySpent) >= amount;
};

CampaignSchema.methods.updateStatistics = async function(stats: Partial<Campaign['statistics']>): Promise<void> {
  Object.assign(this.statistics, stats);

  // Recalculate derived metrics
  if (this.statistics.impressions > 0) {
    this.statistics.ctr = (this.statistics.clicks / this.statistics.impressions) * 100;
    this.statistics.cpm = (this.statistics.spend / this.statistics.impressions) * 1000;
  }
  if (this.statistics.clicks > 0) {
    this.statistics.cpc = this.statistics.spend / this.statistics.clicks;
  }

  await this.save();
};

CampaignSchema.methods.addSpend = async function(amount: number): Promise<void> {
  this.budget.spent += amount;
  this.statistics.spend += amount;

  // Update daily stats
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  await mongoose.model('CampaignDailyStats').findOneAndUpdate(
    { campaignId: this.campaignId, date: dateStr },
    { $inc: { spent: amount } },
    { upsert: true },
  );

  // Check if budget exhausted
  if (this.budget.spent >= this.budget.total) {
    this.status = CampaignStatus.COMPLETED;
  }

  await this.save();
};

// Statics
CampaignSchema.statics.findActiveCampaigns = function(): Promise<Campaign[]> {
  return this.find({ status: CampaignStatus.ACTIVE }).exec();
};

CampaignSchema.statics.findByAdvertiser = function(advertiserId: string): Promise<Campaign[]> {
  return this.find({ advertiserId }).sort({ createdAt: -1 }).exec();
};

// Valid status transitions
const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [CampaignStatus.PENDING, CampaignStatus.DRAFT],
  [CampaignStatus.PENDING]: [CampaignStatus.ACTIVE, CampaignStatus.REJECTED, CampaignStatus.DRAFT],
  [CampaignStatus.ACTIVE]: [CampaignStatus.PAUSED, CampaignStatus.COMPLETED],
  [CampaignStatus.PAUSED]: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT],
  [CampaignStatus.COMPLETED]: [],
  [CampaignStatus.REJECTED]: [CampaignStatus.DRAFT],
};

CampaignSchema.methods.canTransitionTo = function(newStatus: CampaignStatus): boolean {
  return VALID_TRANSITIONS[this.status].includes(newStatus);
};

// Export
export const CampaignModel = mongoose.model<Campaign & Document>('Campaign', CampaignSchema);

// Daily stats for budget tracking
const CampaignDailyStatsSchema = new Schema({
  campaignId: { type: String, required: true },
  date: { type: String, required: true },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  spend: { type: Number, default: 0 },
});

CampaignDailyStatsSchema.index({ campaignId: 1, date: 1 }, { unique: true });

export const CampaignDailyStatsModel = mongoose.model('CampaignDailyStats', CampaignDailyStatsSchema);
