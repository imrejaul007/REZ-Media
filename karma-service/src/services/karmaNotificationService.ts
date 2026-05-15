// @ts-nocheck
// @ts-ignore
/**
 * Karma Notification Service — In-app notification management
 *
 * Handles creating, storing, and managing in-app notifications for karma events.
 * Integrates with the push notification service for real-time delivery.
 */
import mongoose from 'mongoose';
import { logger } from '../config/logger.js';
import { Notification, type NotificationType, type NotificationPriority } from '../models/Notification.js';
import { KarmaProfile } from '../models/KarmaProfile.js';
import {
  sendToUser,
  type SendToUserPayload,
} from './notificationService.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KarmaNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
}

export interface KarmaNotificationResult {
  notificationId: string;
  pushSent: boolean;
}

// ── Level Names ────────────────────────────────────────────────────────────────

const LEVEL_NAMES: Record<string, string> = {
  L1: 'Seed',
  L2: 'Sprout',
  L3: 'Bloom',
  L4: 'Pinnacle',
};

// ── Notification Creation ─────────────────────────────────────────────────────

/**
 * Create an in-app notification and optionally send a push notification.
 * This is a fire-and-forget operation — errors are logged but never thrown.
 */
export async function createNotification(
  input: KarmaNotificationInput,
  sendPush: boolean = true,
): Promise<KarmaNotificationResult | null> {
  try {
    const notification = await Notification.create({
      userId: new mongoose.Types.ObjectId(input.userId),
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data || {},
      priority: input.priority || 'medium',
    });

    logger.info('[KarmaNotification] Created notification', {
      notificationId: notification._id,
      userId: input.userId,
      type: input.type,
    });

    // Send push notification if requested and FCM token exists
    let pushSent = false;
    if (sendPush) {
      const pushPayload: SendToUserPayload = {
        title: input.title,
        body: input.body,
        data: {
          type: `karma_${input.type}`,
          notificationId: notification._id.toString(),
          ...Object.fromEntries(
            Object.entries(input.data || {}).map(([k, v]) => [k, String(v)]),
          ),
        },
      };
      await sendToUser(input.userId, pushPayload);
      pushSent = true;
    }

    return {
      notificationId: notification._id.toString(),
      pushSent,
    };
  } catch (err) {
    logger.error('[KarmaNotification] Failed to create notification', {
      error: err instanceof Error ? err.message : String(err),
      userId: input.userId,
      type: input.type,
    });
    return null;
  }
}

// ── Convenience Methods ────────────────────────────────────────────────────────

/**
 * Notify user of a level up.
 */
export async function notifyLevelUp(
  userId: string,
  newLevel: string,
  currentKarma?: number,
): Promise<KarmaNotificationResult | null> {
  const levelName = LEVEL_NAMES[newLevel] ?? 'new level';

  return createNotification({
    userId,
    type: 'level_up',
    title: 'Level Up!',
    body: `Congratulations! You've reached ${newLevel} — ${levelName}.`,
    data: { level: newLevel, karma: currentKarma },
    priority: 'high',
  });
}

/**
 * Notify user of a badge earned.
 */
export async function notifyBadgeEarned(
  userId: string,
  badgeId: string,
  badgeName: string,
  badgeIcon?: string,
): Promise<KarmaNotificationResult | null> {
  return createNotification({
    userId,
    type: 'badge_earned',
    title: 'Badge Earned!',
    body: `You earned the "${badgeName}" badge! Keep up the great work.`,
    data: { badgeId, badgeName, badgeIcon },
    priority: 'medium',
  });
}

/**
 * Notify user of a streak milestone.
 */
export async function notifyStreakMilestone(
  userId: string,
  streakDays: number,
): Promise<KarmaNotificationResult | null> {
  return createNotification({
    userId,
    type: 'streak_milestone',
    title: 'Streak Milestone!',
    body: `Amazing! You've maintained a ${streakDays}-day streak! Keep it going!`,
    data: { streakDays },
    priority: 'medium',
  });
}

/**
 * Notify user of mission completion.
 */
export async function notifyMissionComplete(
  userId: string,
  missionId: string,
  missionName: string,
  karmaReward?: number,
): Promise<KarmaNotificationResult | null> {
  return createNotification({
    userId,
    type: 'mission_complete',
    title: 'Mission Complete!',
    body: karmaReward
      ? `You completed "${missionName}" and earned +${karmaReward} karma!`
      : `You completed "${missionName}"! Great work!`,
    data: { missionId, missionName, karmaReward },
    priority: 'low',
  });
}

/**
 * Notify user of a perk unlocked.
 */
export async function notifyPerkUnlocked(
  userId: string,
  perkId: string,
  perkName: string,
  perkDescription?: string,
): Promise<KarmaNotificationResult | null> {
  return createNotification({
    userId,
    type: 'perk_unlocked',
    title: 'Perk Unlocked!',
    body: perkDescription || `You unlocked "${perkName}"! Check out your new perks.`,
    data: { perkId, perkName, perkDescription },
    priority: 'high',
  });
}

/**
 * Notify user of karma received.
 */
export async function notifyKarmaReceived(
  userId: string,
  karmaAmount: number,
  senderName?: string,
): Promise<KarmaNotificationResult | null> {
  return createNotification({
    userId,
    type: 'karma_received',
    title: 'Karma Received!',
    body: senderName
      ? `+${karmaAmount} karma from ${senderName}!`
      : `+${karmaAmount} karma received!`,
    data: { karmaAmount, senderName },
    priority: 'low',
  });
}

// ── Notification Retrieval ────────────────────────────────────────────────────

/**
 * Get paginated notifications for a user.
 */
export async function getUserNotifications(
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.getUserNotifications(userId, page, limit),
    Notification.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }),
    Notification.getUnreadCount(userId),
  ]);

  return { notifications, total, unreadCount };
}

/**
 * Get a single notification by ID (if it belongs to the user).
 */
export async function getNotificationById(
  notificationId: string,
  userId: string,
): Promise<any | null> {
  return Notification.findOne({
    _id: new mongoose.Types.ObjectId(notificationId),
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();
}

// ── Mark as Read ─────────────────────────────────────────────────────────────

/**
 * Mark a single notification as read.
 */
export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const updated = await Notification.markAsRead(notificationId, userId);
  if (updated) {
    logger.info('[KarmaNotification] Marked notification as read', {
      notificationId,
      userId,
    });
  }
  return updated;
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const count = await Notification.markAllAsRead(userId);
  if (count > 0) {
    logger.info('[KarmaNotification] Marked all notifications as read', {
      userId,
      count,
    });
  }
  return count;
}

// ── Unread Count ─────────────────────────────────────────────────────────────

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.getUnreadCount(userId);
}

// ── Delete Notifications ──────────────────────────────────────────────────────

/**
 * Delete a single notification (if it belongs to the user).
 */
export async function deleteNotification(
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const result = await Notification.deleteOne({
    _id: new mongoose.Types.ObjectId(notificationId),
    userId: new mongoose.Types.ObjectId(userId),
  });
  return result.deletedCount > 0;
}

/**
 * Delete all read notifications for a user.
 */
export async function deleteReadNotifications(userId: string): Promise<number> {
  const result = await Notification.deleteMany({
    userId: new mongoose.Types.ObjectId(userId),
    readAt: { $ne: null }, // Only delete read notifications
  });
  logger.info('[KarmaNotification] Deleted read notifications', {
    userId,
    count: result.deletedCount,
  });
  return result.deletedCount;
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Delete old notifications (older than days specified).
 * Used for periodic cleanup of old notifications.
 */
export async function cleanupOldNotifications(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await Notification.deleteMany({
    createdAt: { $lt: cutoffDate },
    readAt: { $ne: null }, // Only delete old read notifications
  });

  if (result.deletedCount > 0) {
    logger.info('[KarmaNotification] Cleaned up old notifications', {
      daysOld,
      count: result.deletedCount,
    });
  }

  return result.deletedCount;
}
