import { logger } from '../config/logger';

export interface ConversationContext {
  userId: string;
  conversationId: string;
  messages: ConversationMessage[];
  metadata: ConversationMetadata;
  state: ConversationState;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  role: 'customer' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  metadata?: Record<string, unknown>;
}

export interface ConversationMetadata {
  platform: 'instagram' | 'whatsapp';
  source: 'dm' | 'comment' | 'story_reply';
  username?: string;
  displayName?: string;
  profilePicture?: string;
  isFollowing: boolean;
  isBusinessAccount: boolean;
  tags?: string[];
  referredProduct?: string;
  campaignSource?: string;
}

export type ConversationState =
  | 'new'
  | 'greeting'
  | 'browsing'
  | 'inquiry'
  | 'consideration'
  | 'purchase_intent'
  | 'checkout'
  | 'completed'
  | 'abandoned'
  | 'follow_up';

export class ConversationService {
  private conversations: Map<string, ConversationContext> = new Map();
  private readonly MAX_CONTEXT_MESSAGES = 10;
  private readonly CONVERSATION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  generateConversationId(userId: string): string {
    return `ig_${userId}_${Date.now()}`;
  }

  createConversation(
    userId: string,
    metadata: ConversationMetadata
  ): ConversationContext {
    const conversationId = this.generateConversationId(userId);

    const conversation: ConversationContext = {
      userId,
      conversationId,
      messages: [],
      metadata,
      state: 'new',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.set(conversationId, conversation);
    logger.info('Conversation created', { conversationId, userId });

    return conversation;
  }

  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }

  getConversationByUserId(userId: string): ConversationContext | undefined {
    for (const conversation of this.conversations.values()) {
      if (conversation.userId === userId) {
        const timeSinceUpdate = Date.now() - conversation.updatedAt.getTime();
        if (timeSinceUpdate < this.CONVERSATION_TIMEOUT_MS) {
          return conversation;
        }
      }
    }
    return undefined;
  }

  addMessage(
    conversationId: string,
    role: ConversationMessage['role'],
    content: string,
    metadata?: Record<string, unknown>
  ): ConversationMessage | undefined {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      logger.warn('Conversation not found', { conversationId });
      return undefined;
    }

    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    // Trim old messages to keep context manageable
    if (conversation.messages.length > this.MAX_CONTEXT_MESSAGES * 2) {
      conversation.messages = conversation.messages.slice(-this.MAX_CONTEXT_MESSAGES);
    }

    logger.debug('Message added', { conversationId, role });
    return message;
  }

  updateState(conversationId: string, newState: ConversationState): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      logger.warn('Conversation not found for state update', { conversationId });
      return false;
    }

    const previousState = conversation.state;
    conversation.state = newState;
    conversation.updatedAt = new Date();

    logger.info('Conversation state updated', {
      conversationId,
      from: previousState,
      to: newState
    });

    return true;
  }

  updateMetadata(
    conversationId: string,
    metadata: Partial<ConversationMetadata>
  ): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    conversation.metadata = { ...conversation.metadata, ...metadata };
    conversation.updatedAt = new Date();
    return true;
  }

  getRecentContext(conversationId: string, messageCount: number = 5): string[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];

    return conversation.messages
      .slice(-messageCount)
      .map(msg => `${msg.role}: ${msg.content}`);
  }

  analyzeConversationIntent(conversation: ConversationContext): string | null {
    if (conversation.messages.length === 0) return null;

    const recentMessages = conversation.messages.slice(-3);
    const combinedText = recentMessages.map(m => m.content.toLowerCase()).join(' ');

    // Simple intent detection based on keywords
    const intentPatterns: Record<string, string[]> = {
      'purchase_intent': ['buy', 'order', 'get this', 'want', 'checkout', 'price', 'cost'],
      'inquiry': ['how', 'what', 'when', 'where', 'is it', 'does it', 'size', 'color'],
      'browsing': ['show', 'more', 'similar', 'other', 'options', 'browse'],
      'greeting': ['hi', 'hello', 'hey', 'good morning', 'good afternoon'],
      'follow_up': ['check', 'update', 'status', 'tracking', 'when will', 'delivery']
    };

    for (const [intent, keywords] of Object.entries(intentPatterns)) {
      if (keywords.some(keyword => combinedText.includes(keyword))) {
        return intent;
      }
    }

    return null;
  }

  getConversationSummary(conversationId: string): {
    messageCount: number;
    state: ConversationState;
    lastMessageTime: Date | null;
    intents: string[];
  } | undefined {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return undefined;

    const intents = conversation.messages
      .map(m => m.intent)
      .filter((i): i is string => i !== undefined);

    return {
      messageCount: conversation.messages.length,
      state: conversation.state,
      lastMessageTime: conversation.messages.length > 0
        ? conversation.messages[conversation.messages.length - 1].timestamp
        : null,
      intents: [...new Set(intents)]
    };
  }

  archiveConversation(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return false;

    // In production, this would move to persistent storage
    logger.info('Conversation archived', {
      conversationId,
      duration: Date.now() - conversation.createdAt.getTime(),
      messageCount: conversation.messages.length
    });

    this.conversations.delete(conversationId);
    return true;
  }

  cleanupOldConversations(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [id, conversation] of this.conversations.entries()) {
      if (now - conversation.updatedAt.getTime() > this.CONVERSATION_TIMEOUT_MS) {
        this.archiveConversation(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old conversations', { count: cleaned });
    }

    return cleaned;
  }

  getActiveConversationCount(): number {
    return this.conversations.size;
  }
}

export const conversationService = new ConversationService();
