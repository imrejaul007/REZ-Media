import { instagramClient, MessagePayload } from './instagramClient';
import { InstagramConversation } from '../models/InstagramConversation';
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

export interface IncomingDM {
  senderId: string;
  senderUsername: string;
  threadId: string;
  messageId: string;
  text: string;
  timestamp: string;
  attachments?: { type: string; url: string }[];
}

export interface DMResponse {
  success: boolean;
  messageId?: string;
  routed?: boolean;
  routedTo?: string;
  replyText?: string;
  error?: string;
}

class DMService {
  async handleIncomingDM(dm: IncomingDM): Promise<DMResponse> {
    try {
      logger.info('Handling incoming DM', {
        senderId: dm.senderId,
        senderUsername: dm.senderUsername,
        threadId: dm.threadId,
        messageId: dm.messageId,
        textLength: dm.text?.length || 0,
      });

      // Get or create user
      const userProfile = await instagramClient.getUserProfile(dm.senderId);
      let userId: Types.ObjectId;

      if (userProfile) {
        userId = await instagramClient.getOrCreateUser(userProfile);
      } else {
        const existingUser = await InstagramUser.findOne({ instagramId: dm.senderId });
        if (!existingUser) {
          // Create a basic user entry
          const basicUser = new InstagramUser({
            instagramId: dm.senderId,
            username: dm.senderUsername,
            displayName: dm.senderUsername,
          });
          await basicUser.save();
          userId = basicUser._id as Types.ObjectId;
        } else {
          userId = existingUser._id as Types.ObjectId;
        }
      }

      // Update or create conversation
      await this.updateConversation(dm, userId);

      // Update user interaction
      await InstagramUser.findByIdAndUpdate(userId, {
        lastInteractionAt: new Date(),
        $inc: { totalMessagesReceived: 1 },
      });

      // Extract intent from message
      const intentResult = await intentExtractor.extract(dm.text);

      // Check if routing is needed
      if (intentResult.shouldRoute && intentResult.routingReason) {
        const routingResult = await routingService.routeToOrchestrator({
          platform: 'instagram',
          senderId: dm.senderId,
          username: dm.senderUsername,
          threadId: dm.threadId,
          message: dm.text,
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          context: {
            messageId: dm.messageId,
            attachments: dm.attachments,
          },
        });

        if (routingResult.routed) {
          logger.info('DM routed to orchestrator', {
            senderId: dm.senderId,
            routedTo: routingResult.agentId,
          });

          return {
            success: true,
            routed: true,
            routedTo: routingResult.agentId,
          };
        }
      }

      // Generate automated response
      const tone = instagramTone.getTone('dm');
      const responseText = await replyService.generateResponse({
        platform: 'instagram',
        message: dm.text,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        userContext: {
          username: dm.senderUsername,
          linkedRezUserId: null,
        },
        tone,
      });

      if (responseText) {
        const payload: MessagePayload = {
          recipientId: dm.senderId,
          message: responseText,
        };

        const result = await instagramClient.sendMessage(payload);

        if (result.success) {
          // Update conversation with sent message
          await this.recordSentMessage(dm.threadId, result.messageId!);

          // Update user stats
          await InstagramUser.findByIdAndUpdate(userId, {
            $inc: { totalMessagesSent: 1 },
            lastMessageId: result.messageId,
          });

          return {
            success: true,
            messageId: result.messageId,
            replyText: responseText,
          };
        }

        return {
          success: false,
          error: result.error,
        };
      }

      return { success: true };
    } catch (error: any) {
      logger.error('Failed to handle incoming DM', {
        senderId: dm.senderId,
        error: error.message,
        stack: error.stack,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async updateConversation(dm: IncomingDM, userId: Types.ObjectId): Promise<void> {
    try {
      const conversation = await InstagramConversation.findByThreadId(dm.threadId);

      if (conversation) {
        conversation.lastMessageText = dm.text;
        conversation.lastMessageAt = new Date(dm.timestamp);
        conversation.lastMessageId = dm.messageId;
        conversation.lastMessageFrom = dm.senderId;
        conversation.unreadCount += 1;
        conversation.messageCount += 1;
        await conversation.save();
      } else {
        const newConversation = new InstagramConversation({
          threadId: dm.threadId,
          instagramUserId: userId,
          participantIds: [dm.senderId],
          participantUsernames: [dm.senderUsername],
          lastMessageText: dm.text,
          lastMessageAt: new Date(dm.timestamp),
          lastMessageId: dm.messageId,
          lastMessageFrom: dm.senderId,
          unreadCount: 1,
          messageCount: 1,
          context: {
            conversationStage: 'new',
            tags: [],
          },
        });
        await newConversation.save();
      }
    } catch (error: any) {
      logger.error('Failed to update conversation', {
        threadId: dm.threadId,
        error: error.message,
      });
    }
  }

  private async recordSentMessage(threadId: string, messageId: string): Promise<void> {
    try {
      await InstagramConversation.findOneAndUpdate(
        { threadId },
        {
          $set: {
            lastMessageId: messageId,
            lastMessageFrom: 'business',
          },
          $inc: { messageCount: 1 },
        }
      );
    } catch (error: any) {
      logger.error('Failed to record sent message', {
        threadId,
        messageId,
        error: error.message,
      });
    }
  }

  async sendMessageToUser(
    recipientId: string,
    message: string,
    context?: {
      conversationId?: string;
      messageType?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const payload: MessagePayload = {
        recipientId,
        message: instagramTone.formatMessage(message, 'dm'),
      };

      const result = await instagramClient.sendMessage(payload);

      if (result.success && result.messageId) {
        // Update conversation if context provided
        if (context?.conversationId) {
          await this.recordSentMessage(context.conversationId, result.messageId);
        }

        // Update user sent count
        await InstagramUser.findOneAndUpdate(
          { instagramId: recipientId },
          { $inc: { totalMessagesSent: 1 } }
        );
      }

      return result;
    } catch (error: any) {
      logger.error('Failed to send message to user', {
        recipientId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async sendQuickReply(
    recipientId: string,
    message: string,
    quickReplies: { title: string; payload: string }[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const payload: MessagePayload = {
        recipientId,
        message,
        quickReplies: quickReplies.map((qr) => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload,
        })),
      };

      return await instagramClient.sendMessage(payload);
    } catch (error: any) {
      logger.error('Failed to send quick reply', {
        recipientId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async getConversationHistory(
    threadId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      return await instagramClient.getMessages(threadId);
    } catch (error: any) {
      logger.error('Failed to get conversation history', {
        threadId,
        error: error.message,
      });
      return [];
    }
  }

  async markConversationAsRead(threadId: string): Promise<void> {
    try {
      await InstagramConversation.markAsRead(threadId);
      logger.info('Conversation marked as read', { threadId });
    } catch (error: any) {
      logger.error('Failed to mark conversation as read', {
        threadId,
        error: error.message,
      });
    }
  }
}

export const dmService = new DMService();
