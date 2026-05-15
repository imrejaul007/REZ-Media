// @ts-nocheck
// @ts-ignore
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Challenge Types
export type ChallengeType = 'individual' | 'group' | 'social';
export type GoalType = 'missions_complete' | 'karma_earned' | 'orders_placed' | 'days_streak';
export type RewardType = 'karma' | 'perk' | 'badge';

export interface IChallengeGoal {
  type: GoalType;
  count: number;
}

export interface IChallengeReward {
  type: RewardType;
  value: number | string;
}

export interface IChallenge {
  _id: Types.ObjectId;
  name: string;
  description: string;
  type: ChallengeType;
  goal: IChallengeGoal;
  reward: IChallengeReward;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  maxParticipants: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChallengeDocument extends Omit<IChallenge, '_id'>, Document {
  _id: Types.ObjectId;
}

// ChallengeParticipant Types
export interface IChallengeParticipant {
  _id: Types.ObjectId;
  challengeId: Types.ObjectId;
  userId: Types.ObjectId;
  progress: number;
  completed: boolean;
  completedAt: Date;
  teamId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChallengeParticipantDocument extends IChallengeParticipant, Document {
  _id: Types.ObjectId;
}

// Schemas
const ChallengeGoalSchema = new Schema<IChallengeGoal>(
  {
    type: {
      type: String,
      enum: ['missions_complete', 'karma_earned', 'orders_placed', 'days_streak'] as GoalType[],
      required: true,
    },
    count: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const ChallengeRewardSchema = new Schema<IChallengeReward>(
  {
    type: {
      type: String,
      enum: ['karma', 'perk', 'badge'] as RewardType[],
      required: true,
    },
    value: { type: Schema.Types.Mixed, required: true }, // number for karma, string for perk/badge id
  },
  { _id: false },
);

const ChallengeSchema = new Schema<ChallengeDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['individual', 'group', 'social'] as ChallengeType[],
      required: true,
    },
    goal: { type: ChallengeGoalSchema, required: true },
    reward: { type: ChallengeRewardSchema, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    maxParticipants: { type: Number, min: 0 }, // 0 or null means unlimited
  },
  {
    timestamps: true,
    collection: 'challenges',
  },
);

// Indexes for efficient queries
ChallengeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
ChallengeSchema.index({ type: 1, isActive: 1 });

const ChallengeParticipantSchema = new Schema<ChallengeParticipantDocument>(
  {
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    progress: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
    },
  },
  {
    timestamps: true,
    collection: 'challenge_participants',
  },
);

// Compound index to ensure user can only join a challenge once
ChallengeParticipantSchema.index({ challengeId: 1, userId: 1 }, { unique: true });
// Index for leaderboard queries
ChallengeParticipantSchema.index({ challengeId: 1, progress: -1 });
// Index for active participation lookups
ChallengeParticipantSchema.index({ userId: 1, completed: 1 });

export const Challenge: Model<ChallengeDocument> =
  mongoose.models.Challenge ||
  mongoose.model<ChallengeDocument>('Challenge', ChallengeSchema);

export const ChallengeParticipant: Model<ChallengeParticipantDocument> =
  mongoose.models.ChallengeParticipant ||
  mongoose.model<ChallengeParticipantDocument>('ChallengeParticipant', ChallengeParticipantSchema);
