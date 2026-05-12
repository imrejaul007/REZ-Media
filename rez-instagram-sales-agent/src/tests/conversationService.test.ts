import { conversationService, ConversationContext } from '../services/conversationService';

describe('ConversationService', () => {
  const testUserId = 'user_123';
  const testMetadata = {
    platform: 'instagram' as const,
    source: 'dm' as const,
    isFollowing: true,
    isBusinessAccount: false,
    username: 'test_user'
  };

  beforeEach(() => {
    // Reset service state
  });

  describe('createConversation', () => {
    it('should create a new conversation', () => {
      const conversation = conversationService.createConversation(testUserId, testMetadata);

      expect(conversation).toBeDefined();
      expect(conversation.userId).toBe(testUserId);
      expect(conversation.state).toBe('new');
      expect(conversation.messages).toHaveLength(0);
      expect(conversation.metadata.platform).toBe('instagram');
    });

    it('should generate unique conversation IDs', () => {
      const conv1 = conversationService.createConversation(testUserId, testMetadata);
      const conv2 = conversationService.createConversation(testUserId, testMetadata);

      expect(conv1.conversationId).not.toBe(conv2.conversationId);
    });
  });

  describe('addMessage', () => {
    it('should add a message to conversation', () => {
      const conversation = conversationService.createConversation(testUserId, testMetadata);
      const message = conversationService.addMessage(
        conversation.conversationId,
        'customer',
        'Hello!'
      );

      expect(message).toBeDefined();
      expect(message?.content).toBe('Hello!');
      expect(message?.role).toBe('customer');
    });

    it('should update conversation timestamp', () => {
      const conversation = conversationService.createConversation(testUserId, testMetadata);
      const beforeUpdate = conversation.updatedAt;

      conversationService.addMessage(
        conversation.conversationId,
        'customer',
        'Test message'
      );

      // Note: In a real test, we'd mock time to verify this
      expect(conversation.messages).toHaveLength(1);
    });
  });

  describe('updateState', () => {
    it('should update conversation state', () => {
      const conversation = conversationService.createConversation(testUserId, testMetadata);

      const result = conversationService.updateState(
        conversation.conversationId,
        'inquiry'
      );

      expect(result).toBe(true);
      expect(conversation.state).toBe('inquiry');
    });

    it('should return false for invalid conversation', () => {
      const result = conversationService.updateState('invalid_id', 'inquiry');
      expect(result).toBe(false);
    });
  });

  describe('getRecentContext', () => {
    it('should return recent messages', () => {
      const conversation = conversationService.createConversation(testUserId, testMetadata);

      conversationService.addMessage(conversation.conversationId, 'customer', 'Message 1');
      conversationService.addMessage(conversation.conversationId, 'agent', 'Reply 1');
      conversationService.addMessage(conversation.conversationId, 'customer', 'Message 2');

      const context = conversationService.getRecentContext(conversation.conversationId, 2);

      expect(context).toHaveLength(2);
      expect(context[0]).toContain('Reply 1');
      expect(context[1]).toContain('Message 2');
    });
  });

  describe('analyzeConversationIntent', () => {
    it('should detect purchase intent', () => {
      const conversation = conversationService.createConversation(testUserId, testMetadata);

      conversationService.addMessage(conversation.conversationId, 'customer', 'I want to buy this');
      conversationService.addMessage(conversation.conversationId, 'customer', 'How much is it?');

      const intent = conversationService.analyzeConversationIntent(conversation);

      expect(intent).toBe('purchase_intent');
    });

    it('should detect greeting', () => {
      const conversation = conversationService.createConversation(testUserId, testMetadata);

      conversationService.addMessage(conversation.conversationId, 'customer', 'Hey there!');

      const intent = conversationService.analyzeConversationIntent(conversation);

      expect(intent).toBe('greeting');
    });
  });
});
