import { mentionService } from '../services/mentionService';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface MentionHandlerResult {
  success: boolean;
  processed: boolean;
  mentionCount: number;
  error?: string;
}

class MentionHandler {
  async handleMentions(mentions: any[]): Promise<MentionHandlerResult> {
    try {
      logger.info('Mention Handler processing', {
        mentionCount: mentions.length,
      });

      await mentionService.handleMentions(mentions);

      return {
        success: true,
        processed: true,
        mentionCount: mentions.length,
      };
    } catch (error: any) {
      logger.error('Mention Handler error', {
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        processed: false,
        mentionCount: 0,
        error: error.message,
      };
    }
  }

  async handleStoryMention(storyData: any): Promise<void> {
    try {
      logger.info('Story mention handler', {
        storyId: storyData.id,
        username: storyData.username,
      });

      const mentions = [
        {
          id: storyData.id,
          username: storyData.username,
          from: { id: storyData.user_id },
          media_url: storyData.media_url,
          caption: storyData.caption,
          timestamp: storyData.timestamp,
        },
      ];

      await mentionService.handleMentions(mentions);
    } catch (error: any) {
      logger.error('Story mention handler error', {
        storyId: storyData.id,
        error: error.message,
      });
    }
  }

  async trackEngagement(
    mentionId: string,
    engagementType: 'view' | 'reply' | 'dm_initiated',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await mentionService.trackMentionEngagement(mentionId, engagementType, metadata);
    } catch (error: any) {
      logger.error('Failed to track mention engagement', {
        mentionId,
        engagementType,
        error: error.message,
      });
    }
  }
}

export const mentionHandler = new MentionHandler();
