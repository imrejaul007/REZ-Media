import mongoose, { Schema, model, Types } from 'mongoose';
import { logger } from '../config/logger.js';

export interface IBadge extends Document {
  name: string;
  description: string;
  icon: string;
  category: 'mission' | 'social' | 'spending' | 'special';
  criteria: {
    type: 'missions_complete' | 'karma_earned' | 'streak_days' | 'social_share' | 'special';
    count?: number;
    karmaRequired?: number;
  };
  rarity: number; // 1=common, 2=rare, 3=epic, 4=legendary
  isActive: boolean;
}

export interface IEarnedBadge extends Document {
  userId: Types.ObjectId;
  badgeId: Types.ObjectId;
  earnedAt: Date;
  message: string;
}

const BadgeSchema = new Schema<IBadge>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, required: true },
  category: {
    type: String,
    enum: ['mission', 'social', 'spending', 'special'],
    required: true
  },
  criteria: {
    type: {
      type: String,
      enum: ['missions_complete', 'karma_earned', 'streak_days', 'social_share', 'special'],
      required: true
    },
    count: Number,
    karmaRequired: Number
  },
  rarity: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true }
});

BadgeSchema.index({ isActive: 1 });
BadgeSchema.index({ category: 1 });

export const Badge = mongoose.models.Badge || model<IBadge>('Badge', BadgeSchema, 'badges');

const EarnedBadgeSchema = new Schema<IEarnedBadge>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  badgeId: { type: Schema.Types.ObjectId, ref: 'Badge', required: true },
  earnedAt: { type: Date, default: Date.now },
  message: String
});

EarnedBadgeSchema.index({ userId: 1 });
EarnedBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

export const EarnedBadge = mongoose.models.EarnedBadge || model<IEarnedBadge>('EarnedBadge', EarnedBadgeSchema, 'earned_badges');

// Seed default badges
export const DEFAULT_BADGES = [
  { name: 'First Mission', description: 'Complete your first mission', icon: '🎯', category: 'mission', criteria: { type: 'missions_complete', count: 1 }, rarity: 1 },
  { name: 'Mission Master', description: 'Complete 10 missions', icon: '🎯', category: 'mission', criteria: { type: 'missions_complete', count: 10 }, rarity: 2 },
  { name: 'Karma Novice', description: 'Earn 100 karma', icon: '⭐', category: 'spending', criteria: { type: 'karma_earned', karmaRequired: 100 }, rarity: 1 },
  { name: 'Karma Master', description: 'Earn 1000 karma', icon: '🌟', category: 'spending', criteria: { type: 'karma_earned', karmaRequired: 1000 }, rarity: 3 },
  { name: 'Karma Legend', description: 'Earn 10000 karma', icon: '👑', category: 'spending', criteria: { type: 'karma_earned', karmaRequired: 10000 }, rarity: 4 },
  { name: '7 Day Streak', description: 'Maintain a 7-day streak', icon: '🔥', category: 'special', criteria: { type: 'streak_days', count: 7 }, rarity: 2 },
  { name: '30 Day Streak', description: 'Maintain a 30-day streak', icon: '🔥', category: 'special', criteria: { type: 'streak_days', count: 30 }, rarity: 3 },
  { name: 'Social Butterfly', description: 'Share 10 times', icon: '🦋', category: 'social', criteria: { type: 'social_share', count: 10 }, rarity: 2 },
];

export async function seedBadges() {
  for (const badge of DEFAULT_BADGES) {
    await Badge.findOneAndUpdate(
      { name: badge.name },
      badge,
      { upsert: true, new: true }
    );
  }
  logger.info('Badges seeded successfully');
}
