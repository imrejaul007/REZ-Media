import { Schema, model, Document, Types } from 'mongoose';

/**
 * UserInterestProfile — computed interest tags per user.
 *
 * Built nightly by interestSyncWorker from Order history.
 * Also tracks location signals and institution affiliation.
 *
 * Interests are scored: higher score = stronger signal.
 * Decayed weekly so stale interests don't dominate targeting.
 */

export interface IInterestTag {
  tag: string;           // 'coffee', 'fast_food', 'electronics', 'fashion'
  score: number;         // 0–100, higher = stronger interest
  orderCount: number;    // orders in this category
  lastOrderAt: Date;     // most recent order in this category
}

export interface ILocationSignal {
  city?: string;
  area?: string;         // 'BTM Layout', 'Koramangala'
  pincode?: string;
  coordinates?: [number, number]; // [lng, lat] — most frequent location
  source: 'order_address' | 'profile' | 'checkin';
  updatedAt: Date;
}

export interface IUserInterestProfile extends Document {
  userId: Types.ObjectId;
  interests: IInterestTag[];

  // Location signals (derived from order delivery addresses)
  primaryLocation?: ILocationSignal;
  locationHistory: ILocationSignal[];

  // Institution (set by user in profile or inferred from location)
  institution?: {
    name: string;
    type: 'college' | 'school' | 'office' | 'hospital' | 'other';
    area?: string;
    confidence: 'user_set' | 'inferred';
  };

  // Keyword searches (from REZ consumer app search events)
  recentSearches: Array<{
    term: string;
    searchedAt: Date;
  }>;

  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InterestTagSchema = new Schema<IInterestTag>(
  {
    tag: { type: String, required: true },
    score: { type: Number, default: 0, min: 0, max: 100 },
    orderCount: { type: Number, default: 0 },
    lastOrderAt: Date,
  },
  { _id: false },
);

const LocationSignalSchema = new Schema<ILocationSignal>(
  {
    city: String,
    area: String,
    pincode: String,
    coordinates: { type: [Number] },
    source: { type: String, enum: ['order_address', 'profile', 'checkin'] },
    updatedAt: Date,
  },
  { _id: false },
);

const UserInterestProfileSchema = new Schema<IUserInterestProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    interests: [InterestTagSchema],
    primaryLocation: LocationSignalSchema,
    locationHistory: [LocationSignalSchema],
    institution: {
      name: String,
      type: { type: String, enum: ['college', 'school', 'office', 'hospital', 'other'] },
      area: String,
      confidence: { type: String, enum: ['user_set', 'inferred'] },
    },
    recentSearches: [
      {
        term: { type: String },
        searchedAt: { type: Date },
        _id: false,
      },
    ],
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Targeting indexes
UserInterestProfileSchema.index({ 'interests.tag': 1 });
UserInterestProfileSchema.index({ 'primaryLocation.city': 1 });
UserInterestProfileSchema.index({ 'primaryLocation.area': 1 });
UserInterestProfileSchema.index({ 'primaryLocation.pincode': 1 });
UserInterestProfileSchema.index({ 'institution.name': 1 });
UserInterestProfileSchema.index({ 'recentSearches.term': 1, 'recentSearches.searchedAt': -1 });

export const UserInterestProfile = model<IUserInterestProfile>(
  'UserInterestProfile',
  UserInterestProfileSchema,
);
export default UserInterestProfile;
