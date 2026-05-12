import { dmService, IncomingDM } from '../services/dmService';
import { instagramClient } from '../services/instagramClient';
import { replyService } from '../services/replyService';
import { routingService } from '../services/routingService';
import { sessionLinker } from '../services/sessionLinker';
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

export interface DMHandlerResult {
  success: boolean;
  processed: boolean;
  messageId?: string;
  error?: string;
}

class DMHandler {
  async handle(dm: IncomingDM): Promise<DMHandlerResult> {
    try {
      logger.info('DM Handler processing', {
        senderId: dm.senderId,
        messageId: dm.messageId,
        textPreview: dm.text?.substring(0, 50),
      });

      // Check for link session verification
      if (this.isVerificationCode(dm.text)) {
        return await this.handleVerificationCode(dm);
      }

      // Check for link request
      if (this.isLinkRequest(dm.text)) {
        return await this.handleLinkRequest(dm);
      }

      // Check for quick reply
      if (this.isQuickReply(dm.text)) {
        return await this.handleQuickReplyFlow(dm);
      }

      // Standard DM processing
      const result = await dmService.handleIncomingDM(dm);

      return {
        success: result.success,
        processed: true,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error: any) {
      logger.error('DM Handler error', {
        senderId: dm.senderId,
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

  private isVerificationCode(text: string): boolean {
    // Check if text is exactly 6 digits
    return /^\d{6}$/.test(text.trim());
  }

  private isLinkRequest(text: string): boolean {
    const linkKeywords = ['link', 'connect', 'account', 'verify', 'login', 'sign in'];
    const lowerText = text.toLowerCase();
    return linkKeywords.some((keyword) => lowerText.includes(keyword));
  }

  private isQuickReply(text: string): boolean {
    return text.startsWith('INTENT_') || text.startsWith('QR_');
  }

  private async handleVerificationCode(dm: IncomingDM): Promise<DMHandlerResult> {
    try {
      const verificationCode = dm.text.trim();

      const result = await sessionLinker.verifyLink({ verificationCode });

      if (result.success) {
        const successMessage = instagramTone.formatMessage(
          `✅ Account linked successfully! Welcome${result.rezUserId ? '' : '! Your account is now connected.'} 🎉`,
          'dm'
        );

        await dmService.sendMessageToUser(dm.senderId, successMessage);

        return {
          success: true,
          processed: true,
        };
      }

      const errorMessage = instagramTone.formatMessage(
        `❌ ${result.error || 'Invalid code. Please try again or request a new one.'}`,
        'dm'
      );

      await dmService.sendMessageToUser(dm.senderId, errorMessage);

      return {
        success: false,
        processed: true,
        error: result.error,
      };
    } catch (error: any) {
      logger.error('Verification code handler error', {
        senderId: dm.senderId,
        error: error.message,
      });

      return {
        success: false,
        processed: true,
        error: error.message,
      };
    }
  }

  private async handleLinkRequest(dm: IncomingDM): Promise<DMHandlerResult> {
    try {
      const userProfile = await instagramClient.getUserProfile(dm.senderId);

      const sessionResult = await sessionLinker.createLinkSession({
        instagramUserId: dm.senderId,
        username: dm.senderUsername || userProfile?.username || 'unknown',
        source: 'dm',
        context: {
          intent: 'account_link',
          conversationId: dm.threadId,
          messageId: dm.messageId,
        },
      });

      if (sessionResult.success) {
        const message = instagramTone.formatMessage(
          `To link your account, please enter the verification code: **${sessionResult.verificationCode}**\n\nThis code expires in 24 hours. 🔐`,
          'dm'
        );

        await dmService.sendMessageToUser(dm.senderId, message);

        return {
          success: true,
          processed: true,
          messageId: sessionResult.sessionId,
        };
      }

      const errorMessage = instagramTone.formatMessage(
        `Sorry, we couldn't start the linking process. Please try again later. 😅`,
        'dm'
      );

      await dmService.sendMessageToUser(dm.senderId, errorMessage);

      return {
        success: false,
        processed: true,
        error: sessionResult.error,
      };
    } catch (error: any) {
      logger.error('Link request handler error', {
        senderId: dm.senderId,
        error: error.message,
      });

      return {
        success: false,
        processed: true,
        error: error.message,
      };
    }
  }

  private async handleQuickReplyFlow(dm: IncomingDM): Promise<DMHandlerResult> {
    try {
      const tone = instagramTone.getTone('dm');
      const response = await replyService.handleQuickReplyResponse(dm.text, tone);

      await dmService.sendMessageToUser(dm.senderId, response.message);

      if (response.quickReplies) {
        await dmService.sendQuickReply(
          dm.senderId,
          "Here are some options:",
          response.quickReplies
        );
      }

      return {
        success: true,
        processed: true,
      };
    } catch (error: any) {
      logger.error('Quick reply handler error', {
        senderId: dm.senderId,
        error: error.message,
      });

      return {
        success: false,
        processed: true,
        error: error.message,
      };
    }
  }

  async handleQuickReply(
    senderId: string,
    payload: string
  ): Promise<DMHandlerResult> {
    try {
      logger.info('Handling quick reply', { senderId, payload });

      const tone = instagramTone.getTone('dm');
      const response = await replyService.handleQuickReplyResponse(payload, tone);

      await dmService.sendMessageToUser(senderId, response.message);

      if (response.quickReplies) {
        await dmService.sendQuickReply(
          senderId,
          "Here are some options:",
          response.quickReplies
        );
      }

      return {
        success: true,
        processed: true,
      };
    } catch (error: any) {
      logger.error('Quick reply handler error', {
        senderId,
        payload,
        error: error.message,
      });

      return {
        success: false,
        processed: false,
        error: error.message,
      };
    }
  }

  async handleReferral(
    senderId: string,
    referral: any
  ): Promise<DMHandlerResult> {
    try {
      logger.info('Handling referral', { senderId, referral });

      // Route referral to orchestrator
      await routingService.routeToOrchestrator({
        platform: 'instagram',
        senderId,
        username: '',
        threadId: '',
        message: `Referral: ${JSON.stringify(referral)}`,
        intent: 'referral',
        confidence: 0.9,
        context: {
          type: 'dm',
          referralSource: referral.source,
        },
      });

      return {
        success: true,
        processed: true,
      };
    } catch (error: any) {
      logger.error('Referral handler error', {
        senderId,
        error: error.message,
      });

      return {
        success: false,
        processed: false,
        error: error.message,
      };
    }
  }
}

export const dmHandler = new DMHandler();
