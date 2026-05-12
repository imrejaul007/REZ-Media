import { instagramClient } from './instagramClient';
import { routingService } from './routingService';
import { replyService } from './replyService';
import { instagramTone } from '../utils/instagramTone';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface StoryMention {
  mentionId: string;
  storyId: string;
  username: string;
  userId: string;
  mediaUrl: string;
  timestamp: string;
  replied: boolean;
}

export interface MentionResponse {
  success: boolean;
  replyText?: string;
  error?: string;
}

class MentionService {
  private readonly mentionKeywords = [
    'help',
    'info',
    'price',
    'book',
    'order',
    'contact',
    'dm',
    'message',
    'question',
  ];

  async handleMentions(mentions: any[]): Promise<void> {
    logger.info('Processing mentions', { count: mentions.length });

    for (const mention of mentions) {
      try {
        await this.processMention(mention);
      } catch (error: any) {
        logger.error('Failed to process mention', {
          mentionId: mention.id,
          error: error.message,
        });
      }
    }
  }

  private async processMention(mention: any): Promise<MentionResponse> {
    try {
      const storyData = await this.extractStoryData(mention);
      const hasRelevantKeyword = this.containsRelevantKeyword(storyData.caption || '');

      if (hasRelevantKeyword) {
        logger.info('Mention contains relevant keyword', {
          username: storyData.username,
          mediaId: storyData.mediaId,
        });

        // Route to orchestrator for engagement
        const routingResult = await routingService.routeToOrchestrator({
          platform: 'instagram',
          senderId: storyData.userId,
          username: storyData.username,
          threadId: storyData.mediaId,
          message: storyData.caption || 'Story mention',
          intent: 'story_mention',
          confidence: 0.8,
          context: {
            mediaId: storyData.mediaId,
            type: 'story_mention',
            mediaUrl: storyData.mediaUrl,
          },
        });

        if (routingResult.routed) {
          return {
            success: true,
            replyText: 'Routed to orchestrator for engagement',
          };
        }
      }

      return {
        success: true,
      };
    } catch (error: any) {
      logger.error('Failed to process mention', {
        mentionId: mention.id,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private extractStoryData(mention: any): {
    mediaId: string;
    username: string;
    userId: string;
    mediaUrl: string;
    caption: string;
    timestamp: string;
  } {
    return {
      mediaId: mention.id || mention.media?.id || '',
      username: mention.username || mention.from?.username || '',
      userId: mention.from?.id || mention.user_id || '',
      mediaUrl: mention.media_url || mention.media?.media_url || '',
      caption: mention.caption || mention.text || '',
      timestamp: mention.timestamp || mention.created_at || new Date().toISOString(),
    };
  }

  private containsRelevantKeyword(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.mentionKeywords.some((keyword) => lowerText.includes(keyword));
  }

  async getRecentMentions(limit: number = 20): Promise<StoryMention[]> {
    try {
      const mentions = await instagramClient.getMentions();
      return mentions.slice(0, limit).map((m: any) => ({
        mentionId: m.id,
        storyId: m.id,
        username: m.username,
        userId: '',
        mediaUrl: m.media_url || '',
        timestamp: m.timestamp || m.created_at || new Date().toISOString(),
        replied: false,
      }));
    } catch (error: any) {
      logger.error('Failed to get recent mentions', { error: error.message });
      return [];
    }
  }

  async trackMentionEngagement(
    mentionId: string,
    engagementType: 'view' | 'reply' | 'dm_initiated',
    metadata?: Record<string, any>
  ): Promise<void> {
    logger.info('Tracking mention engagement', {
      mentionId,
      engagementType,
      metadata,
    });
  }
}

export const mentionService = new MentionService();
