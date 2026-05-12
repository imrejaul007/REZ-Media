import { instagramConfig, InstagramUser, InstagramMedia } from '../config/instagram';
import { InstagramUser as InstagramUserModel } from '../models/InstagramUser';
import winston from 'winston';
import { Types } from 'mongoose';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface MessagePayload {
  recipientId: string;
  message: string;
  quickReplies?: { content_type: string; title: string; payload: string }[];
  attachment?: { type: string; url: string };
}

export interface MentionPayload {
  username: string;
  mediaId: string;
  caption: string;
  mediaType: string;
  permalink: string;
  timestamp: string;
}

class InstagramClient {
  private accountId: string;

  constructor() {
    this.accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '';
  }

  async sendMessage(payload: MessagePayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await instagramConfig.sendDirectMessage(payload.recipientId, payload.message);
      logger.info('Message sent successfully', {
        recipientId: payload.recipientId,
        messageId: result.messageId,
      });
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      logger.error('Failed to send message', {
        recipientId: payload.recipientId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async replyToComment(commentId: string, message: string): Promise<{ success: boolean; replyId?: string; error?: string }> {
    try {
      const result = await instagramConfig.replyToComment(commentId, message);
      logger.info('Comment reply sent', { commentId, replyId: result.id });
      return { success: true, replyId: result.id };
    } catch (error: any) {
      logger.error('Failed to reply to comment', {
        commentId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async hideComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await instagramConfig.hideComment(commentId);
      logger.info('Comment hidden', { commentId });
      return { success: true };
    } catch (error: any) {
      logger.error('Failed to hide comment', {
        commentId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async getOrCreateUser(profile: InstagramUser): Promise<Types.ObjectId> {
    try {
      let user = await InstagramUserModel.findByInstagramId(profile.id);

      if (!user) {
        user = new InstagramUserModel({
          instagramId: profile.id,
          username: profile.username,
          displayName: profile.name || profile.username,
          fullName: profile.name || '',
          biography: profile.biography,
          profilePictureUrl: profile.profilePictureUrl,
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
          mediaCount: profile.mediaCount,
          website: profile.website,
        });
        await user.save();
        logger.info('Created new Instagram user', { instagramId: profile.id, username: profile.username });
      } else {
        // Update profile data
        user.followersCount = profile.followersCount;
        user.followingCount = profile.followingCount;
        user.mediaCount = profile.mediaCount;
        user.biography = profile.biography;
        await user.save();
      }

      return user._id as Types.ObjectId;
    } catch (error: any) {
      logger.error('Failed to get or create user', {
        instagramId: profile.id,
        error: error.message,
      });
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<InstagramUser | null> {
    try {
      return await instagramConfig.getUserProfile(userId);
    } catch (error: any) {
      logger.error('Failed to get user profile', { userId, error: error.message });
      return null;
    }
  }

  async getMediaComments(mediaId: string): Promise<any[]> {
    try {
      return await instagramConfig.getMediaComments(mediaId);
    } catch (error: any) {
      logger.error('Failed to get media comments', { mediaId, error: error.message });
      return [];
    }
  }

  async getMentions(): Promise<MentionPayload[]> {
    try {
      const mentions = await instagramConfig.getMentions();
      return mentions.map((m: any) => ({
        username: m.username,
        mediaId: m.id,
        caption: m.caption || '',
        mediaType: m.media_type,
        permalink: m.permalink,
        timestamp: m.timestamp,
      }));
    } catch (error: any) {
      logger.error('Failed to get mentions', { error: error.message });
      return [];
    }
  }

  async getMediaInfo(mediaId: string): Promise<InstagramMedia | null> {
    try {
      return await instagramConfig.getMedia(mediaId);
    } catch (error: any) {
      logger.error('Failed to get media info', { mediaId, error: error.message });
      return null;
    }
  }

  async getConversations(): Promise<any[]> {
    try {
      return await instagramConfig.getConversations();
    } catch (error: any) {
      logger.error('Failed to get conversations', { error: error.message });
      return [];
    }
  }

  async getMessages(threadId: string): Promise<any[]> {
    try {
      return await instagramConfig.getMessages(threadId);
    } catch (error: any) {
      logger.error('Failed to get messages', { threadId, error: error.message });
      return [];
    }
  }
}

export const instagramClient = new InstagramClient();
