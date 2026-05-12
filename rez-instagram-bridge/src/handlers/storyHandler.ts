import { mentionHandler } from './mentionHandler';
import { routingService } from '../services/routingService';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface StoryEvent {
  eventType: 'story_mention' | 'story_reply' | 'story_share' | 'story_insight';
  storyId: string;
  username: string;
  userId: string;
  timestamp: string;
  metadata?: {
    mediaUrl?: string;
    replyText?: string;
    shareRecipients?: string[];
    viewCount?: number;
    replyCount?: number;
    impressions?: number;
  };
}

export interface StoryHandlerResult {
  success: boolean;
  processed: boolean;
  routed?: boolean;
  error?: string;
}

class StoryHandler {
  async handle(event: StoryEvent): Promise<StoryHandlerResult> {
    try {
      logger.info('Story Handler processing', {
        eventType: event.eventType,
        storyId: event.storyId,
        username: event.username,
      });

      switch (event.eventType) {
        case 'story_mention':
          return await this.handleStoryMention(event);

        case 'story_reply':
          return await this.handleStoryReply(event);

        case 'story_share':
          return await this.handleStoryShare(event);

        case 'story_insight':
          return await this.handleStoryInsight(event);

        default:
          logger.warn('Unknown story event type', { eventType: event.eventType });
          return {
            success: false,
            processed: false,
            error: 'Unknown event type',
          };
      }
    } catch (error: any) {
      logger.error('Story Handler error', {
        eventType: event.eventType,
        storyId: event.storyId,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        processed: false,
        error: error.message,
      };
    }
  }

  private async handleStoryMention(event: StoryEvent): Promise<StoryHandlerResult> {
    try {
      await mentionHandler.handleStoryMention({
        id: event.storyId,
        username: event.username,
        user_id: event.userId,
        media_url: event.metadata?.mediaUrl,
        timestamp: event.timestamp,
      });

      return {
        success: true,
        processed: true,
      };
    } catch (error: any) {
      return {
        success: false,
        processed: false,
        error: error.message,
      };
    }
  }

  private async handleStoryReply(event: StoryEvent): Promise<StoryHandlerResult> {
    try {
      // Route story reply to orchestrator
      const routingResult = await routingService.routeToOrchestrator({
        platform: 'instagram',
        senderId: event.userId,
        username: event.username,
        threadId: event.storyId,
        message: event.metadata?.replyText || 'Story reply',
        intent: 'story_reply',
        confidence: 0.85,
        context: {
          mediaId: event.storyId,
          type: 'story_mention',
        },
      });

      if (routingResult.routed) {
        await mentionHandler.trackEngagement(event.storyId, 'reply', {
          routedTo: routingResult.agentId,
        });
      }

      return {
        success: true,
        processed: true,
        routed: routingResult.routed,
      };
    } catch (error: any) {
      return {
        success: false,
        processed: false,
        error: error.message,
      };
    }
  }

  private async handleStoryShare(event: StoryEvent): Promise<StoryHandlerResult> {
    try {
      // Track story share for analytics
      logger.info('Story shared', {
        storyId: event.storyId,
        username: event.username,
        recipients: event.metadata?.shareRecipients?.length || 0,
      });

      // Route share to orchestrator for engagement tracking
      await routingService.routeToOrchestrator({
        platform: 'instagram',
        senderId: event.userId,
        username: event.username,
        threadId: event.storyId,
        message: 'Story shared',
        intent: 'story_share',
        confidence: 0.9,
        context: {
          mediaId: event.storyId,
          type: 'story_share',
          shareCount: event.metadata?.shareRecipients?.length || 1,
        },
      });

      return {
        success: true,
        processed: true,
      };
    } catch (error: any) {
      return {
        success: false,
        processed: false,
        error: error.message,
      };
    }
  }

  private async handleStoryInsight(event: StoryEvent): Promise<StoryHandlerResult> {
    try {
      logger.info('Story insight received', {
        storyId: event.storyId,
        views: event.metadata?.viewCount,
        replies: event.metadata?.replyCount,
        impressions: event.metadata?.impressions,
      });

      // Store insights for analytics
      // This would typically be stored in a database

      return {
        success: true,
        processed: true,
      };
    } catch (error: any) {
      return {
        success: false,
        processed: false,
        error: error.message,
      };
    }
  }

  async handleWebhookStoryEvents(entry: any): Promise<void> {
    try {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field === 'story_insights') {
          const event: StoryEvent = {
            eventType: 'story_insight',
            storyId: change.value?.story_id || change.value?.id,
            username: '',
            userId: '',
            timestamp: new Date().toISOString(),
            metadata: {
              viewCount: change.value?.views,
              replyCount: change.value?.replies,
              impressions: change.value?.impressions,
            },
          };

          await this.handle(event);
        }
      }
    } catch (error: any) {
      logger.error('Failed to handle webhook story events', {
        error: error.message,
      });
    }
  }
}

export const storyHandler = new StoryHandler();
