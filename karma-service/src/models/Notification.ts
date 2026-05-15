// @ts-nocheck
// @ts-ignore
/**
 * Notification Model — In-app notification storage for karma events
 *
 * Stores notifications that users can view in the app.
 * Complements the push notification system (notificationService.ts).
 */
import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'level_up'
  | 'badge_earned'
  | 'mission_complete'
  | 'streak_milestone'
  | 'perk_unlocked'
  | 'karma_received'
  | 'community_post';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface INotification {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority: NotificationPriority;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDocument extends INotification, Document {
  _id: mongoose.Types.ObjectId;
}

interface NotificationModel extends Model<NotificationDocument> {
  getUserNotifications(
    userId: string,
    page: number,
    limit: number,
  ): Promise<NotificationDocument[]>;
  markAsRead(notificationId: string, userId: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<number>;
  getUnreadCount(userId: string): Promise<number>;
}

const NotificationSchema = new Schema<NotificationDocument, NotificationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'level_up',
        'badge_earned',
        'mission_complete',
        'streak_milestone',
        'perk_unlocked',
        'karma_received',
        'community_post',
      ] as NotificationType[],
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 500,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'] as NotificationPriority[],
      default: 'medium',
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  },
);

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1 });

// ── Static Methods ─────────────────────────────────────────────────────────────

/**
 * Get paginated notifications for a user, sorted by newest first.
 */
NotificationSchema.statics.getUserNotifications = async function (
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<NotificationDocument[]> {
  const skip = (page - 1) * limit;
  return this.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Mark a single notification as read.
 * Returns true if the notification was found and updated.
 */
NotificationSchema.statics.markAsRead = async function (
  notificationId: string,
  userId: string,
): Promise<boolean> {
  const result = await this.updateOne(
    {
      _id: new mongoose.Types.ObjectId(notificationId),
      userId: new mongoose.Types.ObjectId(userId),
      readAt: null, // Only update if not already read
    },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount > 0;
};

/**
 * Mark all unread notifications as read for a user.
 * Returns the number of notifications marked as read.
 */
NotificationSchema.statics.markAllAsRead = async function (
  userId: string,
): Promise<number> {
  const result = await this.updateMany(
    {
      userId: new mongoose.Types.ObjectId(userId),
      readAt: null,
    },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
};

/**
 * Get the count of unread notifications for a user.
 */
NotificationSchema.statics.getUnreadCount = async function (
  userId: string,
): Promise<number> {
  return this.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    readAt: null,
  });
};

export const Notification: NotificationModel =
  (mongoose.models.Notification as NotificationModel) ||
  mongoose.model<NotificationDocument, NotificationModel>('Notification', NotificationSchema);
