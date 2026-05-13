import { ConversationEngine } from '../src/services/conversationEngine';
import { ConversationState, UserIntent, CallContext } from '../src/types';

describe('ConversationEngine', () => {
  let engine: ConversationEngine;

  beforeEach(() => {
    engine = new ConversationEngine();
  });

  describe('detectIntent', () => {
    it('should detect confirmation intent from "yes"', async () => {
      const result = await engine.detectIntent('yes');
      expect(result.intent).toBe(UserIntent.CONFIRM);
      expect(result.transcript).toBe('yes');
    });

    it('should detect confirmation intent from "yeah"', async () => {
      const result = await engine.detectIntent('yeah');
      expect(result.intent).toBe(UserIntent.CONFIRM);
    });

    it('should detect confirmation intent from "sure"', async () => {
      const result = await engine.detectIntent('sure, let me do that');
      expect(result.intent).toBe(UserIntent.CONFIRM);
    });

    it('should detect decline intent from "no"', async () => {
      const result = await engine.detectIntent('no');
      expect(result.intent).toBe(UserIntent.DECLINE);
    });

    it('should detect decline intent from "not interested"', async () => {
      const result = await engine.detectIntent("not interested");
      expect(result.intent).toBe(UserIntent.DECLINE);
    });

    it('should detect transfer intent from "agent"', async () => {
      const result = await engine.detectIntent('I want to speak to an agent');
      expect(result.intent).toBe(UserIntent.TRANSFER);
    });

    it('should detect transfer intent from "human"', async () => {
      const result = await engine.detectIntent('let me talk to a human');
      expect(result.intent).toBe(UserIntent.TRANSFER);
    });

    it('should detect question intent', async () => {
      const result = await engine.detectIntent('what is the delivery time?');
      expect(result.intent).toBe(UserIntent.ASK_QUESTION);
    });

    it('should detect silence/empty input', async () => {
      const result = await engine.detectIntent('');
      expect(result.intent).toBe(UserIntent.SILENCE);
    });

    it('should detect unknown intent for random speech', async () => {
      const result = await engine.detectIntent('the weather is nice today');
      expect(result.intent).toBe(UserIntent.UNKNOWN);
    });
  });

  describe('getResponse', () => {
    const mockContext: CallContext = {
      customerName: 'John',
      storeName: 'ReZ Store',
      itemCount: 3,
      totalAmount: '₹1,299'
    };

    it('should return greeting message in GREETING state', async () => {
      const result = await engine.getResponse(
        ConversationState.GREETING,
        UserIntent.UNKNOWN,
        mockContext
      );

      expect(result.response).toContain('Hi John');
      expect(result.response).toContain('ReZ Store');
      expect(result.nextState).toBe(ConversationState.MESSAGE);
    });

    it('should handle CONFIRM intent in MESSAGE state', async () => {
      const result = await engine.getResponse(
        ConversationState.MESSAGE,
        UserIntent.CONFIRM,
        mockContext
      );

      expect(result.response).toContain("Great");
      expect(result.nextState).toBe(ConversationState.CONFIRM_INTENT);
      expect(result.shouldTransfer).toBe(false);
    });

    it('should handle DECLINE intent in MESSAGE state', async () => {
      const result = await engine.getResponse(
        ConversationState.MESSAGE,
        UserIntent.DECLINE,
        mockContext
      );

      expect(result.response).toContain("No problem");
      expect(result.nextState).toBe(ConversationState.DECLINE_INTENT);
    });

    it('should handle TRANSFER intent and set shouldTransfer', async () => {
      const result = await engine.getResponse(
        ConversationState.MESSAGE,
        UserIntent.TRANSFER,
        mockContext
      );

      expect(result.response).toContain("transfer");
      expect(result.nextState).toBe(ConversationState.TRANSFER_TO_AGENT);
      expect(result.shouldTransfer).toBe(true);
    });

    it('should handle ASK_QUESTION intent and transfer', async () => {
      const result = await engine.getResponse(
        ConversationState.MESSAGE,
        UserIntent.ASK_QUESTION,
        mockContext
      );

      expect(result.shouldTransfer).toBe(true);
    });

    it('should handle silence with clarification prompt', async () => {
      const result = await engine.getResponse(
        ConversationState.MESSAGE,
        UserIntent.SILENCE,
        mockContext
      );

      expect(result.response).toContain("didn't catch");
      expect(result.nextState).toBe(ConversationState.MESSAGE);
    });
  });

  describe('interpolateTemplate', () => {
    it('should replace customer name placeholder', () => {
      const result = engine.interpolateTemplate(
        'Hello {{customerName}}!',
        { customerName: 'John' }
      );
      expect(result).toBe('Hello John!');
    });

    it('should replace multiple placeholders', () => {
      const result = engine.interpolateTemplate(
        'Hi {{customerName}}, your cart has {{itemCount}} items.',
        { customerName: 'John', itemCount: 5 }
      );
      expect(result).toBe('Hi John, your cart has 5 items.');
    });

    it('should handle missing context values', () => {
      const result = engine.interpolateTemplate(
        'Hello {{customerName}}!',
        {}
      );
      expect(result).toBe('Hello !');
    });

    it('should preserve text without placeholders', () => {
      const result = engine.interpolateTemplate(
        'This is static text.',
        { customerName: 'John' }
      );
      expect(result).toBe('This is static text.');
    });
  });

  describe('generateConversationSummary', () => {
    it('should summarize confirmed conversation', () => {
      const history = [
        { speaker: 'ai' as const, transcript: 'Hello!' },
        { speaker: 'user' as const, transcript: 'yes', intent: UserIntent.CONFIRM }
      ];

      const summary = engine.generateConversationSummary(history);

      expect(summary.finalIntent).toBe(UserIntent.CONFIRM);
      expect(summary.summary).toContain('confirmed');
      expect(summary.userTurns).toBe(1);
      expect(summary.aiTurns).toBe(1);
    });

    it('should summarize declined conversation', () => {
      const history = [
        { speaker: 'ai' as const, transcript: 'Hello!' },
        { speaker: 'user' as const, transcript: 'no', intent: UserIntent.DECLINE }
      ];

      const summary = engine.generateConversationSummary(history);

      expect(summary.finalIntent).toBe(UserIntent.DECLINE);
      expect(summary.summary).toContain('declined');
    });

    it('should summarize transfer request', () => {
      const history = [
        { speaker: 'ai' as const, transcript: 'Hello!' },
        { speaker: 'user' as const, transcript: 'agent', intent: UserIntent.TRANSFER }
      ];

      const summary = engine.generateConversationSummary(history);

      expect(summary.finalIntent).toBe(UserIntent.TRANSFER);
      expect(summary.summary).toContain('human agent');
    });

    it('should handle empty history', () => {
      const summary = engine.generateConversationSummary([]);

      expect(summary.totalTurns).toBe(0);
      expect(summary.userTurns).toBe(0);
      expect(summary.aiTurns).toBe(0);
    });
  });

  describe('getTemplate', () => {
    it('should return cart recovery template for cart_abandoned trigger', () => {
      const template = engine.getTemplate('cart_abandoned');
      expect(template.id).toBe('cart_recovery');
      expect(template.greeting).toContain('Hi {{customerName}}');
    });

    it('should return COD template for cod_unconfirmed trigger', () => {
      const template = engine.getTemplate('cod_unconfirmed');
      expect(template.id).toBe('cod_confirmation');
    });

    it('should return appointment template for appointment_reminder trigger', () => {
      const template = engine.getTemplate('appointment_reminder');
      expect(template.id).toBe('appointment_reminder');
    });

    it('should return order delayed template', () => {
      const template = engine.getTemplate('order_delayed');
      expect(template.id).toBe('order_delayed');
    });

    it('should fall back to cart recovery for unknown trigger', () => {
      const template = engine.getTemplate('unknown_trigger');
      expect(template.id).toBe('cart_recovery');
    });
  });
});
