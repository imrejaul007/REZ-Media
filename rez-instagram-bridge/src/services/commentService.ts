import { instagramClient } from './instagramClient';
import { InstagramComment } from '../models/InstagramComment';
import { InstagramUser } from '../models/InstagramUser';
import { routingService } from './routingService';
import { replyService } from './replyService';
import { intentExtractor } from '../utils/intentExtractor';
import { instagramTone } from '../utils/instagramTone';
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

export interface IncomingComment {
  commentId: string;
  mediaId: string;
  username: string;
  userId: string;
  text: string;
  createdAt: string;
  likeCount?: number;
}

export interface CommentResponse {
  success: boolean;
  replyId?: string;
  replyText?: string;
  status?: string;
  error?: string;
}

class CommentService {
  private readonly escalationKeywords = [
    'help',
    'urgent',
    'complaint',
    'problem',
    'issue',
    'broken',
    'refund',
    'cancel',
    'speak to manager',
    'not happy',
    'disappointed',
    'worst',
  ];

  async handleIncomingComment(comment: IncomingComment): Promise<CommentResponse> {
    try {
      logger.info('Handling incoming comment', {
        commentId: comment.commentId,
        mediaId: comment.mediaId,
        username: comment.username,
      });

      // Get or create user
      const userProfile = await instagramClient.getUserProfile(comment.userId);
      let userId: Types.ObjectId;

      if (userProfile) {
        userId = await instagramClient.getOrCreateUser(userProfile);
      } else {
        const existingUser = await InstagramUser.findByUsername(comment.username);
        if (!existingUser) {
          const basicUser = new InstagramUser({
            instagramId: comment.userId,
            username: comment.username,
            displayName: comment.username,
          });
          await basicUser.save();
          userId = basicUser._id as Types.ObjectId;
        } else {
          userId = existingUser._id as Types.ObjectId;
        }
      }

      // Create or update comment record
      const commentDoc = await this.createOrUpdateComment(comment, userId);

      // Check for escalation keywords
      const shouldEscalate = this.containsEscalationKeywords(comment.text);

      if (shouldEscalate) {
        return await this.handleEscalatedComment(comment, commentDoc);
      }

      // Extract intent
      const intentResult = await intentExtractor.extract(comment.text);

      // Check if should route to orchestrator
      if (intentResult.shouldRoute) {
        const routingResult = await routingService.routeToOrchestrator({
          platform: 'instagram',
          senderId: comment.userId,
          username: comment.username,
          threadId: comment.mediaId,
          message: comment.text,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          context: {
            commentId: comment.commentId,
            mediaId: comment.mediaId,
            type: 'comment',
          },
        });

        if (routingResult.routed) {
          await InstagramComment.findByIdAndUpdate(commentDoc._id, {
            status: 'escalated',
            escalatedTo: routingResult.agentId,
            escalatedAt: new Date(),
          });

          return {
            success: true,
            status: 'escalated',
          };
        }
      }

      // Generate automated response
      const tone = instagramTone.getTone('comment');
      const responseText = await replyService.generateResponse({
        platform: 'instagram',
        message: comment.text,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        userContext: {
          username: comment.username,
          linkedRezUserId: null,
        },
        tone,
      });

      if (responseText) {
        const result = await instagramClient.replyToComment(comment.commentId, responseText);

        if (result.success) {
          await InstagramComment.markAsReplied(comment.commentId, responseText, 'automation');

          return {
            success: true,
            replyId: result.replyId,
            replyText: responseText,
            status: 'replied',
          };
        }

        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        status: 'pending',
      };
    } catch (error: any) {
      logger.error('Failed to handle incoming comment', {
        commentId: comment.commentId,
        error: error.message,
        stack: error.stack,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async createOrUpdateComment(
    comment: IncomingComment,
    userId: Types.ObjectId
  ): Promise<any> {
    const existingComment = await InstagramComment.findByCommentId(comment.commentId);

    if (existingComment) {
      existingComment.likeCount = comment.likeCount || existingComment.likeCount;
      await existingComment.save();
      return existingComment;
    }

    // Get media info for context
    const mediaInfo = await instagramClient.getMediaInfo(comment.mediaId);

    const commentDoc = new InstagramComment({
      commentId: comment.commentId,
      mediaId: comment.mediaId,
      instagramUserId: userId,
      username: comment.username,
      text: comment.text,
      createdAt: new Date(comment.createdAt),
      likeCount: comment.likeCount || 0,
      mediaType: mediaInfo?.mediaType || 'IMAGE',
      mediaUrl: mediaInfo?.mediaUrl,
      mediaCaption: mediaInfo?.caption,
    });

    await commentDoc.save();
    return commentDoc;
  }

  private containsEscalationKeywords(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.escalationKeywords.some((keyword) => lowerText.includes(keyword));
  }

  private async handleEscalatedComment(
    comment: IncomingComment,
    commentDoc: any
  ): Promise<CommentResponse> {
    try {
      // Route to orchestrator for human handling
      const routingResult = await routingService.routeToOrchestrator({
        platform: 'instagram',
        senderId: comment.userId,
        username: comment.username,
        threadId: comment.mediaId,
        message: comment.text,
        intent: 'customer_complaint',
        confidence: 0.9,
        context: {
          commentId: comment.commentId,
          mediaId: comment.mediaId,
          type: 'comment',
          isEscalation: true,
        },
      });

      await InstagramComment.findByIdAndUpdate(commentDoc._id, {
        status: 'escalated',
        escalatedTo: routingResult.agentId || 'human_agent',
        escalatedAt: new Date(),
        intent: 'customer_complaint',
        confidence: 0.9,
      });

      // Send acknowledgment to user
      const ackMessage = instagramTone.formatMessage(
        "Thanks for reaching out! A team member will get back to you shortly.",
        'comment'
      );

      await instagramClient.replyToComment(comment.commentId, ackMessage);

      return {
        success: true,
        replyId: comment.commentId,
        replyText: ackMessage,
        status: 'escalated',
      };
    } catch (error: any) {
      logger.error('Failed to handle escalated comment', {
        commentId: comment.commentId,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async hideComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await instagramClient.hideComment(commentId);

      if (result.success) {
        await InstagramComment.findOneAndUpdate(
          { commentId },
          { status: 'hidden' }
        );
      }

      return result;
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

  async getPendingComments(mediaId: string): Promise<any[]> {
    return await InstagramComment.findPendingByMedia(mediaId);
  }

  async getCommentAnalytics(mediaId?: string): Promise<any> {
    const matchStage = mediaId ? { mediaId } : {};

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalComments: { $sum: 1 },
          pendingComments: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          repliedComments: {
            $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] },
          },
          escalatedComments: {
            $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] },
          },
          hiddenComments: {
            $sum: { $cond: [{ $eq: ['$status', 'hidden'] }, 1, 0] },
          },
          avgConfidence: { $avg: '$confidence' },
          positiveSentiment: {
            $sum: { $cond: [{ $eq: ['$sentiment', 'positive'] }, 1, 0] },
          },
          negativeSentiment: {
            $sum: { $cond: [{ $eq: ['$sentiment', 'negative'] }, 1, 0] },
          },
        },
      },
    ];

    const results = await InstagramComment.aggregate(pipeline);
    return results[0] || {
      totalComments: 0,
      pendingComments: 0,
      repliedComments: 0,
      escalatedComments: 0,
      hiddenComments: 0,
      avgConfidence: 0,
      positiveSentiment: 0,
      negativeSentiment: 0,
    };
  }
}

export const commentService = new CommentService();
