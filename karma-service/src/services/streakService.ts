// @ts-nocheck
// @ts-ignore
/**
 * Streak Service — user-facing streak management
 *
 * Provides real-time streak operations:
 * - Get streak status for a user
 * - Record activity and update streak
 * - Check if user already logged today
 */
import moment from 'moment';
import mongoose from 'mongoose';
import { KarmaProfile } from '../models/KarmaProfile.js';
import { notifyStreakMilestone } from './notificationService.js';
import { logger } from '../config/logger.js';

// Milestone bonuses: days -> karma reward
const STREAK_BONUSES: Record<number, number> = {
  7: 50,
  14: 100,
  30: 250,
  60: 500,
  90: 750,
  100: 1000,
  180: 1500,
  365: 3000,
};

export interface StreakStatus {
  currentStreak: number;
  longestStreak: number;
  status: 'active' | 'at_risk' | 'broken';
  lastActivityDate: Date | null;
  activityHistory: Date[];
  nextMilestone: number | null;
  daysToNextMilestone: number | null;
}

export interface RecordActivityResult {
  currentStreak: number;
  isNewDay: boolean;
  alreadyRecorded: boolean;
  bonusAwarded: number;
  milestoneHit: number | null;
}

/**
 * Get the current streak status for a user.
 */
export async function getStreakStatus(userId: string): Promise<StreakStatus | null> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  const profile = await KarmaProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) })
    .select('currentStreak longestStreak lastStreakUpdatedAt lastActivityAt activityHistory')
    .lean();

  if (!profile) {
    return null;
  }

  const now = moment();
  const todayStart = moment().startOf('day');
  const yesterdayStart = moment().subtract(1, 'day').startOf('day');

  let status: 'active' | 'at_risk' | 'broken' = 'active';
  const lastActivityDate = profile.lastStreakUpdatedAt ? new Date(profile.lastStreakUpdatedAt) : null;

  if (!lastActivityDate) {
    // Never had a streak
    status = 'broken';
  } else {
    const lastActivityDay = moment(lastActivityDate).startOf('day');
    const wasYesterday = lastActivityDay.isSame(yesterdayStart, 'day');
    const wasToday = lastActivityDay.isSame(todayStart, 'day');

    if (wasToday) {
      status = 'active';
    } else if (wasYesterday) {
      status = 'at_risk'; // Need to be active today
    } else {
      status = 'broken';
    }
  }

  // Calculate next milestone
  const currentStreak = profile.currentStreak ?? 0;
  const nextMilestone = Object.keys(STREAK_BONUSES)
    .map(Number)
    .sort((a, b) => a - b)
    .find((days) => days > currentStreak) ?? null;

  const daysToNextMilestone = nextMilestone !== null ? nextMilestone - currentStreak : null;

  return {
    currentStreak,
    longestStreak: profile.longestStreak ?? 0,
    status,
    lastActivityDate,
    activityHistory: profile.activityHistory?.slice(-30) ?? [],
    nextMilestone,
    daysToNextMilestone,
  };
}

/**
 * Record activity for a user and update their streak.
 * Returns whether a new day was recorded and any bonus awarded.
 */
export async function recordActivity(userId: string): Promise<RecordActivityResult> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid userId');
  }

  const now = new Date();
  const todayStart = moment(now).startOf('day').toDate();
  const yesterdayStart = moment(now).subtract(1, 'day').startOf('day').toDate();
  const profile = await KarmaProfile.findOne({ userId: new mongoose.Types.ObjectId(userId) });

  if (!profile) {
    // Create profile with initial streak
    const newProfile = await KarmaProfile.create({
      userId: new mongoose.Types.ObjectId(userId),
      currentStreak: 1,
      longestStreak: 1,
      lastStreakUpdatedAt: now,
      lastActivityAt: now,
      activityHistory: [now],
    });

    return {
      currentStreak: 1,
      isNewDay: true,
      alreadyRecorded: false,
      bonusAwarded: 0,
      milestoneHit: null,
    };
  }

  // Check if already recorded today
  const lastUpdated = profile.lastStreakUpdatedAt ? new Date(profile.lastStreakUpdatedAt) : null;
  if (lastUpdated) {
    const lastUpdatedDay = moment(lastUpdated).startOf('day').toDate();
    if (lastUpdatedDay.getTime() === todayStart.getTime()) {
      // Already recorded today
      return {
        currentStreak: profile.currentStreak ?? 0,
        isNewDay: false,
        alreadyRecorded: true,
        bonusAwarded: 0,
        milestoneHit: null,
      };
    }
  }

  // Determine if continuing streak (last activity was yesterday)
  let newStreak: number;
  if (lastUpdated) {
    const lastUpdatedDay = moment(lastUpdated).startOf('day').toDate();
    const wasYesterday = lastUpdatedDay.getTime() === yesterdayStart.getTime();

    if (wasYesterday) {
      // Continue streak
      newStreak = (profile.currentStreak ?? 0) + 1;
    } else {
      // Streak broken - start fresh
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const newLongest = Math.max(newStreak, profile.longestStreak ?? 0);

  // Update profile
  await KarmaProfile.updateOne(
    { _id: profile._id },
    {
      $set: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastStreakUpdatedAt: now,
        lastActivityAt: now,
      },
      $push: {
        activityHistory: {
          $each: [now],
          $slice: -30, // Keep last 30 days
        },
      },
    },
  );

  // Check for milestone bonus
  let bonusAwarded = 0;
  let milestoneHit: number | null = null;

  if (STREAK_BONUSES[newStreak]) {
    bonusAwarded = STREAK_BONUSES[newStreak];
    milestoneHit = newStreak;

    // Award karma bonus
    const { addKarma } = await import('./karmaService.js');
    try {
      await addKarma(userId, bonusAwarded, { hours: 0 });
      logger.info(`Streak bonus awarded: user=${userId}, streak=${newStreak}, bonus=${bonusAwarded}`);
    } catch (err) {
      logger.warn(`Failed to award streak bonus`, { userId, streak: newStreak, bonus: bonusAwarded, error: err });
    }

    // Send milestone notification
    notifyStreakMilestone(userId, newStreak).catch((err) => {
      logger.warn('Streak milestone notification failed', { userId, streakDays: newStreak, error: err });
    });
  }

  return {
    currentStreak: newStreak,
    isNewDay: true,
    alreadyRecorded: false,
    bonusAwarded,
    milestoneHit,
  };
}

/**
 * Get all streak milestones with their bonuses.
 */
export function getStreakMilestones(): Array<{ days: number; bonus: number }> {
  return Object.entries(STREAK_BONUSES)
    .map(([days, bonus]) => ({ days: Number(days), bonus }))
    .sort((a, b) => a.days - b.days);
}
