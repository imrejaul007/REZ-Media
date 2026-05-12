import axios, { AxiosError } from 'axios';
import { config, getInternalToken } from '../config';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface RoutingContext {
  platform: 'instagram';
  senderId: string;
  username: string;
  threadId: string;
  message: string;
  intent: string;
  confidence: number;
  context?: {
    conversationId?: string;
    messageId?: string;
    mediaId?: string;
    commentId?: string;
    attachments?: any[];
    type?: 'dm' | 'comment' | 'story_mention';
    isEscalation?: boolean;
  };
}

export interface RoutingResult {
  routed: boolean;
  agentId?: string;
  threadId?: string;
  error?: string;
}

class RoutingService {
  private readonly orchestratorUrl: string;
  private readonly orchestratorToken: string;

  constructor() {
    this.orchestratorUrl = config.orchestrator.url;
    this.orchestratorToken = getInternalToken('orchestrator') || '';
  }

  async routeToOrchestrator(context: RoutingContext): Promise<RoutingResult> {
    try {
      logger.info('Routing message to orchestrator', {
        platform: context.platform,
        senderId: context.senderId,
        username: context.username,
        intent: context.intent,
        confidence: context.confidence,
      });

      const response = await axios.post(
        `${this.orchestratorUrl}/api/routing/intent`,
        {
          channel: 'instagram',
          userId: context.senderId,
          username: context.username,
          threadId: context.threadId,
          message: {
            text: context.message,
            attachments: context.context?.attachments || [],
          },
          intent: {
            name: context.intent,
            confidence: context.confidence,
          },
          context: {
            conversationId: context.context?.conversationId,
            messageId: context.context?.messageId,
            mediaId: context.context?.mediaId,
            commentId: context.context?.commentId,
            type: context.context?.type || 'dm',
            isEscalation: context.context?.isEscalation || false,
          },
          routing: {
            priority: context.context?.isEscalation ? 'high' : 'normal',
            preferAgent: context.intent === 'customer_complaint' || context.context?.isEscalation,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': this.orchestratorToken,
          },
          timeout: config.orchestrator.timeout,
        }
      );

      if (response.data.success) {
        logger.info('Message routed to orchestrator successfully', {
          senderId: context.senderId,
          agentId: response.data.agentId,
          threadId: response.data.threadId,
        });

        return {
          routed: true,
          agentId: response.data.agentId,
          threadId: response.data.threadId,
        };
      }

      logger.warn('Orchestrator rejected routing', {
        senderId: context.senderId,
        error: response.data.error,
      });

      return {
        routed: false,
        error: response.data.error || 'Routing rejected',
      };
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        logger.error('Failed to route to orchestrator', {
          senderId: context.senderId,
          status: axiosError.response?.status,
          error: axiosError.message,
          data: axiosError.response?.data,
        });
      } else {
        logger.error('Failed to route to orchestrator', {
          senderId: context.senderId,
          error: error.message,
        });
      }

      return {
        routed: false,
        error: error.message,
      };
    }
  }

  async handoverToAgent(
    threadId: string,
    context: {
      reason: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      notes?: string;
    }
  ): Promise<RoutingResult> {
    try {
      const response = await axios.post(
        `${this.orchestratorUrl}/api/routing/handover`,
        {
          channel: 'instagram',
          threadId,
          reason: context.reason,
          priority: context.priority || 'normal',
          notes: context.notes,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': this.orchestratorToken,
          },
          timeout: config.orchestrator.timeout,
        }
      );

      if (response.data.success) {
        return {
          routed: true,
          agentId: response.data.agentId,
          threadId: response.data.threadId,
        };
      }

      return {
        routed: false,
        error: response.data.error,
      };
    } catch (error: any) {
      logger.error('Failed to handover to agent', {
        threadId,
        error: error.message,
      });
      return {
        routed: false,
        error: error.message,
      };
    }
  }

  async transferToWhatsApp(
    instagramUserId: string,
    instagramUsername: string,
    conversationHistory?: any[]
  ): Promise<{ success: boolean; whatsappThreadId?: string; error?: string }> {
    try {
      const whatsappBridgeUrl = config.whatsappBridge.url;

      const response = await axios.post(
        `${whatsappBridgeUrl}/api/transfer/from-instagram`,
        {
          sourcePlatform: 'instagram',
          sourceUserId: instagramUserId,
          sourceUsername: instagramUsername,
          conversationHistory,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': getInternalToken('whatsapp-bridge') || '',
          },
          timeout: config.whatsappBridge.timeout,
        }
      );

      if (response.data.success) {
        logger.info('Transferred conversation to WhatsApp', {
          instagramUserId,
          whatsappThreadId: response.data.whatsappThreadId,
        });

        return {
          success: true,
          whatsappThreadId: response.data.whatsappThreadId,
        };
      }

      return {
        success: false,
        error: response.data.error,
      };
    } catch (error: any) {
      logger.error('Failed to transfer to WhatsApp', {
        instagramUserId,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getAgentAvailability(): Promise<{
    available: boolean;
    queuePosition?: number;
    estimatedWaitTime?: number;
  }> {
    try {
      const response = await axios.get(
        `${this.orchestratorUrl}/api/agents/availability`,
        {
          headers: {
            'X-Internal-Token': this.orchestratorToken,
          },
          timeout: 5000,
        }
      );

      return {
        available: response.data.available,
        queuePosition: response.data.queuePosition,
        estimatedWaitTime: response.data.estimatedWaitTime,
      };
    } catch (error: any) {
      logger.error('Failed to check agent availability', { error: error.message });
      return { available: false };
    }
  }
}

export const routingService = new RoutingService();
