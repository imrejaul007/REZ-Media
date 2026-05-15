// @ts-nocheck
// @ts-ignore
/**
 * Challenge Service — business logic for challenges system
 *
 * Provides operations for:
 * - Challenge CRUD
 * - Joining/leaving challenges
 * - Progress tracking
 * - Leaderboard queries
 * - Reward distribution
 */
import mongoose from 'mongoose';
import { Challenge, ChallengeParticipant } from '../models/Challenge.js';
import type { ChallengeDocument, ChallengeParticipantDocument, IChallenge, GoalType } from '../models/Challenge.js';
import { KarmaProfile } from '../models/index.js';
import { logger } from '../config/logger.js';
import { emitKarmaAwardedEvent } from '../utils/gamificationBridge.js';

// ---------------------------------------------------------------------------
// Challenge CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new challenge
 */
export async function createChallenge(data: Partial<IChallenge>): Promise<ChallengeDocument> {
  const challenge = new Challenge({
    name: data.name,
    description: data.description,
    type: data.type,
    goal: data.goal,
    reward: data.reward,
    startDate: data.startDate || new Date(),
    endDate: data.endDate,
    isActive: data.isActive !== false,
    maxParticipants: data.maxParticipants || 0,
  });

  await challenge.save();
  logger.info(`Challenge created: ${challenge._id} - ${challenge.name}`);
  return challenge;
}

/**
 * Get challenge by ID
 */
export async function getChallenge(challengeId: string): Promise<ChallengeDocument | null> {
  if (!mongoose.Types.ObjectId.isValid(challengeId)) {
    return null;
  }
  return Challenge.findById(challengeId).lean() as Promise<ChallengeDocument | null>;
}

/**
 * Get all active challenges
 */
export async function getActiveChallenges(): Promise<ChallengeDocument[]> {
  const now = new Date();
  return Challenge.find({
    isActive: true,
    $or: [
      { startDate: { $lte: now } },
      { startDate: { $exists: false } },
    ],
    $or: [
      { endDate: { $gte: now } },
      { endDate: { $exists: false } },
    ],
  }).sort({ startDate: 1 }).lean() as Promise<ChallengeDocument[]>;
}

/**
 * Get challenges by type
 */
export async function getChallengesByType(type: string): Promise<ChallengeDocument[]> {
  return Challenge.find({ type, isActive: true }).sort({ createdAt: -1 }).lean() as Promise<ChallengeDocument[]>;
}

/**
 * Update a challenge
 */
export async function updateChallenge(
  challengeId: string,
  updates: Partial<IChallenge>,
): Promise<ChallengeDocument | null> {
  return Challenge.findByIdAndUpdate(
    challengeId,
    { $set: updates },
    { new: true },
  ).lean() as Promise<ChallengeDocument | null>;
}

/**
 * Deactivate a challenge
 */
export async function deactivateChallenge(challengeId: string): Promise<boolean> {
  const result = await Challenge.findByIdAndUpdate(
    challengeId,
    { $set: { isActive: false } },
    { new: true },
  );
  return !!result;
}

// ---------------------------------------------------------------------------
// Participation
// ---------------------------------------------------------------------------

/**
 * Join a challenge
 */
export async function joinChallenge(
  userId: string,
  challengeId: string,
  teamId?: string,
): Promise<ChallengeParticipantDocument> {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(challengeId)) {
    throw new Error('Invalid userId or challengeId');
  }

  // Check if challenge exists and is active
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new Error('Challenge not found');
  }
  if (!challenge.isActive) {
    throw new Error('Challenge is not active');
  }

  // Check if already joined
  const existing = await ChallengeParticipant.findOne({
    challengeId: new mongoose.Types.ObjectId(challengeId),
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (existing) {
    return existing;
  }

  // Check participant limit for group challenges
  if (challenge.maxParticipants && challenge.maxParticipants > 0) {
    const count = await ChallengeParticipant.countDocuments({ challengeId });
    if (count >= challenge.maxParticipants) {
      throw new Error('Challenge is full');
    }
  }

  // Check date constraints
  const now = new Date();
  if (challenge.startDate && now < challenge.startDate) {
    throw new Error('Challenge has not started yet');
  }
  if (challenge.endDate && now > challenge.endDate) {
    throw new Error('Challenge has ended');
  }

  const participant = new ChallengeParticipant({
    challengeId: new mongoose.Types.ObjectId(challengeId),
    userId: new mongoose.Types.ObjectId(userId),
    progress: 0,
    completed: false,
    teamId: teamId ? new mongoose.Types.ObjectId(teamId) : undefined,
  });

  await participant.save();
  logger.info(`User ${userId} joined challenge ${challengeId}`);

  return participant;
}

/**
 * Leave a challenge
 */
export async function leaveChallenge(userId: string, challengeId: string): Promise<boolean> {
  const result = await ChallengeParticipant.findOneAndDelete({
    challengeId: new mongoose.Types.ObjectId(challengeId),
    userId: new mongoose.Types.ObjectId(userId),
  });
  return !!result;
}

/**
 * Get user's participation in a challenge
 */
export async function getParticipation(
  userId: string,
  challengeId: string,
): Promise<ChallengeParticipantDocument | null> {
  return ChallengeParticipant.findOne({
    challengeId: new mongoose.Types.ObjectId(challengeId),
    userId: new mongoose.Types.ObjectId(userId),
  }).lean() as Promise<ChallengeParticipantDocument | null>;
}

/**
 * Get all challenges a user is participating in
 */
export async function getUserParticipations(userId: string): Promise<ChallengeParticipantDocument[]> {
  return ChallengeParticipant.find({
    userId: new mongoose.Types.ObjectId(userId),
    completed: false,
  })
    .populate('challengeId')
    .lean() as Promise<ChallengeParticipantDocument[]>;
}

// ---------------------------------------------------------------------------
// Progress Tracking
// ---------------------------------------------------------------------------

/**
 * Update progress for a specific metric type
 * Called when relevant actions occur (mission completed, karma earned, etc.)
 */
export async function updateProgress(
  userId: string,
  metric: GoalType,
  value: number,
): Promise<void> {
  // Find all active challenges where user is participating
  const participations = await ChallengeParticipant.find({
    userId: new mongoose.Types.ObjectId(userId),
    completed: false,
  }).populate('challengeId');

  for (const participation of participations) {
    const challenge = participation.challengeId as unknown as ChallengeDocument;

    // Check if this challenge's goal matches the metric
    if (challenge.goal.type !== metric) continue;

    // Check date constraints
    const now = new Date();
    if (challenge.startDate && now < challenge.startDate) continue;
    if (challenge.endDate && now > challenge.endDate) continue;

    // Update progress
    participation.progress = value;

    // Check if goal is achieved
    if (value >= challenge.goal.count) {
      participation.completed = true;
      participation.completedAt = new Date();
      await participation.save();

      // Award reward
      await awardReward(userId, challenge.reward);

      logger.info(`User ${userId} completed challenge ${challenge._id}`);
    } else {
      await participation.save();
    }
  }
}

/**
 * Increment progress by a delta value
 */
export async function incrementProgress(
  userId: string,
  metric: GoalType,
  delta: number,
): Promise<void> {
  const participations = await ChallengeParticipant.find({
    userId: new mongoose.Types.ObjectId(userId),
    completed: false,
  }).populate('challengeId');

  for (const participation of participations) {
    const challenge = participation.challengeId as unknown as ChallengeDocument;

    if (challenge.goal.type !== metric) continue;

    // Check date constraints
    const now = new Date();
    if (challenge.startDate && now < challenge.startDate) continue;
    if (challenge.endDate && now > challenge.endDate) continue;

    const newProgress = participation.progress + delta;
    participation.progress = newProgress;

    if (newProgress >= challenge.goal.count && !participation.completed) {
      participation.completed = true;
      participation.completedAt = new Date();
      await participation.save();

      await awardReward(userId, challenge.reward);

      logger.info(`User ${userId} completed challenge ${challenge._id}`);
    } else {
      await participation.save();
    }
  }
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

/**
 * Award reward to user for completing a challenge
 */
async function awardReward(
  userId: string,
  reward: { type: string; value: number | string },
): Promise<void> {
  switch (reward.type) {
    case 'karma':
      // Emit event to award karma
      emitKarmaAwardedEvent(userId, {
        source: 'challenge_reward',
        amount: reward.value as number,
        reason: 'Challenge completion reward',
      });
      break;

    case 'badge':
      // Add badge to user's karma profile
      await KarmaProfile.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId) },
        {
          $push: {
            badges: {
              id: reward.value,
              name: String(reward.value),
              earnedAt: new Date(),
            },
          },
        },
      );
      break;

    case 'perk':
      // Perk claims are handled by perkClaimService
      // This just logs the reward; actual perk claim creation happens elsewhere
      logger.info(`User ${userId} earned perk: ${reward.value}`);
      break;

    default:
      logger.warn(`Unknown reward type: ${reward.type}`);
  }
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/**
 * Get leaderboard for a challenge
 */
export async function getLeaderboard(
  challengeId: string,
  limit: number = 10,
): Promise<Array<{ rank: number; userId: string; progress: number; completed: boolean }>> {
  const participations = await ChallengeParticipant.find({ challengeId: new mongoose.Types.ObjectId(challengeId) })
    .sort({ progress: -1, completedAt: 1 })
    .limit(limit)
    .select('userId progress completed')
    .lean();

  return participations.map((p, index) => ({
    rank: index + 1,
    userId: p.userId.toString(),
    progress: p.progress,
    completed: p.completed,
  }));
}

/**
 * Get user's rank in a challenge
 */
export async function getUserRank(
  userId: string,
  challengeId: string,
): Promise<{ rank: number; totalParticipants: number } | null> {
  const participation = await ChallengeParticipant.findOne({
    challengeId: new mongoose.Types.ObjectId(challengeId),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!participation) {
    return null;
  }

  // Count how many participants have higher progress
  const higherCount = await ChallengeParticipant.countDocuments({
    challengeId: new mongoose.Types.ObjectId(challengeId),
    $or: [
      { progress: { $gt: participation.progress } },
      {
        progress: { $eq: participation.progress },
        completedAt: { $lt: participation.completedAt || new Date() },
      },
    ],
  });

  const totalParticipants = await ChallengeParticipant.countDocuments({
    challengeId: new mongoose.Types.ObjectId(challengeId),
  });

  return {
    rank: higherCount + 1,
    totalParticipants,
  };
}

// ---------------------------------------------------------------------------
// Team Challenges (Group)
// ---------------------------------------------------------------------------

/**
 * Get team leaderboard for a group challenge
 */
export async function getTeamLeaderboard(
  challengeId: string,
  limit: number = 10,
): Promise<Array<{ rank: number; teamId: string; totalProgress: number; memberCount: number }>> {
  const result = await ChallengeParticipant.aggregate([
    {
      $match: {
        challengeId: new mongoose.Types.ObjectId(challengeId),
        teamId: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$teamId',
        totalProgress: { $sum: '$progress' },
        memberCount: { $sum: 1 },
      },
    },
    {
      $sort: { totalProgress: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  return result.map((r, index) => ({
    rank: index + 1,
    teamId: r._id.toString(),
    totalProgress: r.totalProgress,
    memberCount: r.memberCount,
  }));
}
