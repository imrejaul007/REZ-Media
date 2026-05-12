import { commentService, IncomingComment } from '../services/commentService';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface CommentHandlerResult {
  success: boolean;
  processed: boolean;
  status?: string;
  replyId?: string;
  error?: string;
}

class CommentHandler {
  async handle(comment: IncomingComment): Promise<CommentHandlerResult> {
    try {
      logger.info('Comment Handler processing', {
        commentId: comment.commentId,
        mediaId: comment.mediaId,
        username: comment.username,
        textPreview: comment.text.substring(0, 50),
      });

      const result = await commentService.handleIncomingComment(comment);

      return {
        success: result.success,
        processed: true,
        status: result.status,
        replyId: result.replyId,
        error: result.error,
      };
    } catch (error: any) {
      logger.error('Comment Handler error', {
        commentId: comment.commentId,
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

  async handleComments(changes: any[]): Promise<void> {
    for (const change of changes) {
      try {
        if (change.field === 'comments') {
          const value = change.value;

          if (value.item === 'comment') {
            const comment: IncomingComment = {
              commentId: value.id,
              mediaId: value.media_id,
              username: value.from?.username || 'anonymous',
              userId: value.from?.id || '',
              text: value.text || '',
              createdAt: value.timestamp || new Date().toISOString(),
              likeCount: value.like_count,
            };

            await this.handle(comment);
          }
        }
      } catch (error: any) {
        logger.error('Failed to handle comment change', {
          change,
          error: error.message,
        });
      }
    }
  }

  async hideComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await commentService.hideComment(commentId);
    } catch (error: any) {
      logger.error('Failed to hide comment', {
        commentId,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async escalateComment(
    commentId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Import here to avoid circular dependency
      const { InstagramComment } = await import('../models/InstagramComment');

      await InstagramComment.escalate(commentId, reason);

      logger.info('Comment escalated', { commentId, reason });

      return { success: true };
    } catch (error: any) {
      logger.error('Failed to escalate comment', {
        commentId,
        reason,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getAnalytics(mediaId?: string): Promise<any> {
    try {
      return await commentService.getCommentAnalytics(mediaId);
    } catch (error: any) {
      logger.error('Failed to get comment analytics', {
        mediaId,
        error: error.message,
      });
      return null;
    }
  }
}

export const commentHandler = new CommentHandler();
