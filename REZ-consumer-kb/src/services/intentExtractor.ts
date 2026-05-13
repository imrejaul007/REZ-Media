import { kbService } from './kbService';
import { profileService } from './profileService';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedIntent {
  id: string;
  type: 'purchase' | 'browse' | 'compare' | 'research' | 'support' | 'general';
  category?: string;
  entities: ExtractedEntity[];
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  rawText: string;
  keyPhrases: string[];
  goals: string[];
}

export interface ExtractedEntity {
  type: string;
  value: string;
  normalized: string;
  confidence: number;
  context?: string;
}

export interface ConversationContext {
  conversationId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}

export interface IntentSignal {
  consumerId: string;
  conversationId?: string;
  text: string;
  entities?: Array<{ type: string; value: string }>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export class IntentExtractor {
  // Patterns for intent recognition
  private readonly purchasePatterns = [
    /\b(buy|purchase|order|get|checkout|add to cart)\b/i,
    /\b(\d+)\s*(?:rs?|rupees?|inr)\b/i,
    /\b(delivery|shipping|address|pincode)\b/i,
    /\b(pay|payment|cod|prepaid)\b/i,
  ];

  private readonly browsePatterns = [
    /\b(look|find|browse|search|explore|check|view|see)\b/i,
    /\b(available|in stock|options|variants)\b/i,
  ];

  private readonly comparePatterns = [
    /\b(compare|versus|vs|difference|better|worse)\b/i,
    /\b(alternative|other options|similar)\b/i,
    /\b(pros|cons|advantages|disadvantages)\b/i,
  ];

  private readonly researchPatterns = [
    /\b(review|reviews|rating|feedback|opinion)\b/i,
    /\b(specifications?|features?|details?|info)\b/i,
    /\b(warranty|return policy|quality)\b/i,
  ];

  private readonly supportPatterns = [
    /\b(track|tracking|status|order status)\b/i,
    /\b(cancel|refund|return|exchange|replace)\b/i,
    /\b(problem|issue|not received|damaged|defective)\b/i,
    /\b(contact|help|support|assistant)\b/i,
  ];

  private readonly categoryPatterns: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /\b(hotel|booking|resort|lodge|homestay|vacation|rental)\b/i, category: 'hotel_stay' },
    { pattern: /\b(flight|airline|plane|ticket|travel)\b/i, category: 'travel_flight' },
    { pattern: /\b(clothing|shirt|pant|dress|saree|kurti|fashion|wear)\b/i, category: 'fashion' },
    { pattern: /\b(electronics|phone|laptop|mobile|tablet|gadget)\b/i, category: 'electronics' },
    { pattern: /\b(grocery|food|vegetable|fruit|medicine|pharmacy)\b/i, category: 'grocery' },
    { pattern: /\b(restaurant|food delivery|order food|pizza|burger|biryani)\b/i, category: 'food_delivery' },
    { pattern: /\b(salon|spa|beauty|makeup|skincare|wellness)\b/i, category: 'beauty_wellness' },
  ];

  private readonly entityPatterns: Array<{ pattern: RegExp; type: string; normalizer: (match: string) => string }> = [
    { pattern: /\b(\d+)\s*(?:rs?|rupees?|inr)\b/gi, type: 'price', normalizer: (m) => m.replace(/[^\d]/g, '') },
    { pattern: /\b(\d+)%\s*(?:off|discount)\b/gi, type: 'discount', normalizer: (m) => m.replace(/[^\d]/g, '') },
    { pattern: /\b([A-Z]{1,2}\d{1,2}\s*\d{4,6})\b/gi, type: 'pincode', normalizer: (m) => m.trim() },
    { pattern: /\b(\d{10,})\b/gi, type: 'phone', normalizer: (m) => m.trim() },
    { pattern: /\b([\w.-]+@[\w.-]+\.\w+)\b/gi, type: 'email', normalizer: (m) => m.toLowerCase() },
  ];

  /**
   * Extract intent from text
   */
  async extractIntent(signal: IntentSignal): Promise<ExtractedIntent> {
    const { consumerId, text, entities, metadata, timestamp } = signal;
    const id = uuidv4();

    // Detect intent type
    const intentType = this.detectIntentType(text);

    // Extract entities
    const extractedEntities = this.extractEntities(text);
    if (entities) {
      for (const entity of entities) {
        extractedEntities.push({
          type: entity.type,
          value: entity.value,
          normalized: entity.value.toLowerCase(),
          confidence: 0.9,
        });
      }
    }

    // Detect category
    const category = this.detectCategory(text);

    // Detect sentiment
    const sentiment = this.detectSentiment(text);

    // Detect urgency
    const urgency = this.detectUrgency(text);

    // Extract key phrases
    const keyPhrases = this.extractKeyPhrases(text);

    // Extract goals
    const goals = this.extractGoals(text);

    // Calculate confidence
    const confidence = this.calculateIntentConfidence(text, intentType, extractedEntities);

    // Store in KB
    await this.storeIntentInKB(consumerId, id, {
      type: intentType,
      category,
      entities: extractedEntities,
      sentiment,
      urgency,
      confidence,
      rawText: text,
      keyPhrases,
      goals,
    });

    return {
      id,
      type: intentType,
      category,
      entities: extractedEntities,
      sentiment,
      urgency,
      confidence,
      rawText: text,
      keyPhrases,
      goals,
    };
  }

  /**
   * Extract intent from conversation context
   */
  async extractFromConversation(context: ConversationContext, consumerId: string): Promise<ExtractedIntent[]> {
    const intents: ExtractedIntent[] = [];

    // Analyze each user message
    for (const message of context.messages) {
      if (message.role === 'user') {
        const intent = await this.extractIntent({
          consumerId,
          conversationId: context.conversationId,
          text: message.content,
          timestamp: message.timestamp,
        });
        intents.push(intent);
      }
    }

    // Generate conversation summary
    const summary = context.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    const allEntities: ExtractedEntity[] = [];
    for (const intent of intents) {
      allEntities.push(...intent.entities);
    }

    // Store conversation in KB
    await kbService.addConversation(
      consumerId,
      context.conversationId,
      context.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }))
    );

    // Extract conversation-level insights
    const conversationIntent = await this.extractConversationIntent(
      consumerId,
      context.conversationId,
      summary,
      allEntities
    );

    if (conversationIntent) {
      intents.unshift(conversationIntent);
    }

    return intents;
  }

  /**
   * Detect primary intent type
   */
  private detectIntentType(text: string): ExtractedIntent['type'] {
    const textLower = text.toLowerCase();

    // Check purchase intent first (highest priority)
    if (this.purchasePatterns.some((p) => p.test(textLower))) {
      return 'purchase';
    }

    // Check support intent
    if (this.supportPatterns.some((p) => p.test(textLower))) {
      return 'support';
    }

    // Check compare intent
    if (this.comparePatterns.some((p) => p.test(textLower))) {
      return 'compare';
    }

    // Check research intent
    if (this.researchPatterns.some((p) => p.test(textLower))) {
      return 'research';
    }

    // Check browse intent
    if (this.browsePatterns.some((p) => p.test(textLower))) {
      return 'browse';
    }

    return 'general';
  }

  /**
   * Detect category from text
   */
  private detectCategory(text: string): string | undefined {
    for (const { pattern, category } of this.categoryPatterns) {
      if (pattern.test(text)) {
        return category;
      }
    }
    return undefined;
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    for (const { pattern, type, normalizer } of this.entityPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          type,
          value: match[0],
          normalized: normalizer(match[0]),
          confidence: 0.95,
          context: this.getEntityContext(text, match.index || 0),
        });
      }
    }

    return entities;
  }

  /**
   * Detect sentiment from text
   */
  private detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const textLower = text.toLowerCase();

    const positiveWords = /\b(love|great|excellent|amazing|perfect|awesome|best|good|nice|wonderful)\b/i;
    const negativeWords = /\b(hate|bad|terrible|awful|worst|horrible|problem|issue|frustrated|angry|disappointed)\b/i;
    const urgentWords = /\b(urgent|immediately|asap|emergency|help|now|quick)\b/i;

    const positiveMatches = (textLower.match(positiveWords) || []).length;
    const negativeMatches = (textLower.match(negativeWords) || []).length;

    if (positiveMatches > negativeMatches) return 'positive';
    if (negativeMatches > positiveMatches) return 'negative';

    // Check for neutral/question patterns
    if (text.includes('?')) return 'neutral';

    return 'neutral';
  }

  /**
   * Detect urgency level
   */
  private detectUrgency(text: string): 'low' | 'medium' | 'high' {
    const textLower = text.toLowerCase();

    const highUrgency = /\b(urgent|immediately|asap|emergency|now|today|as soon as possible)\b/i;
    const mediumUrgency = /\b(soon|quick|fast|this week|by tomorrow)\b/i;

    if (highUrgency.test(textLower)) return 'high';
    if (mediumUrgency.test(textLower)) return 'medium';
    return 'low';
  }

  /**
   * Extract key phrases from text
   */
  private extractKeyPhrases(text: string): string[] {
    // Simple key phrase extraction
    const phrases: string[] = [];

    // Extract noun phrases (simplified)
    const nounPattern = /\b(?:I want|I need|I am looking for|show me|find me|looking for|need a|want a)\s+(.+?)(?:\.|$)/gi;
    let match;
    while ((match = nounPattern.exec(text)) !== null) {
      phrases.push(match[1].trim());
    }

    // Extract quantity patterns
    const quantityPattern = /\b(?:one|two|three|\d+)\s+(?:of\s+)?(?:\w+\s+)?(\w+)/gi;
    while ((match = quantityPattern.exec(text)) !== null) {
      phrases.push(`quantity:${match[1]}`);
    }

    return [...new Set(phrases)];
  }

  /**
   * Extract goals from text
   */
  private extractGoals(text: string): string[] {
    const goals: string[] = [];
    const textLower = text.toLowerCase();

    // Purchase goals
    if (this.purchasePatterns.some((p) => p.test(textLower))) {
      const productMatch = text.match(/\b(buy|purchase|order|get)\s+(?:a\s+)?(.+?)(?:\s+for|\s+with|\.|$)/i);
      if (productMatch) {
        goals.push(`Purchase: ${productMatch[2].trim()}`);
      }
    }

    // Information goals
    if (this.researchPatterns.some((p) => p.test(textLower))) {
      goals.push('Research/Information gathering');
    }

    // Support goals
    if (this.supportPatterns.some((p) => p.test(textLower))) {
      const issueMatch = text.match(/\b(cancel|refund|return|track|exchange)\s+(?:my\s+)?(\w+)/i);
      if (issueMatch) {
        goals.push(`${issueMatch[1]}: ${issueMatch[2]}`);
      } else {
        goals.push('Customer support request');
      }
    }

    return goals;
  }

  /**
   * Calculate intent confidence
   */
  private calculateIntentConfidence(
    text: string,
    intentType: ExtractedIntent['type'],
    entities: ExtractedEntity[]
  ): number {
    let confidence = 0.5;

    // Increase for specific patterns
    const patterns = {
      purchase: this.purchasePatterns,
      support: this.supportPatterns,
      compare: this.comparePatterns,
      research: this.researchPatterns,
      browse: this.browsePatterns,
    };

    const typePatterns = patterns[intentType];
    if (typePatterns && typePatterns.some((p) => p.test(text))) {
      confidence += 0.3;
    }

    // Increase for entities
    confidence += Math.min(0.2, entities.length * 0.05);

    // Decrease for very short texts
    if (text.split(' ').length < 3) {
      confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Store extracted intent in KB
   */
  private async storeIntentInKB(
    consumerId: string,
    intentId: string,
    intent: Omit<ExtractedIntent, 'id'>
  ): Promise<void> {
    await kbService.addMemory(
      consumerId,
      `intent:${intentId}`,
      intent,
      intent.confidence,
      ['intent', intent.type],
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    );

    // Link to intent graph if confidence is high
    if (intent.confidence > 0.7 && intent.category) {
      await kbService.linkToIntentGraph(
        consumerId,
        'intent-extractor',
        intentId,
        intent.confidence
      );
    }
  }

  /**
   * Extract conversation-level intent
   */
  private async extractConversationIntent(
    consumerId: string,
    conversationId: string,
    summary: string,
    entities: ExtractedEntity[]
  ): Promise<ExtractedIntent | null> {
    if (summary.length < 20) return null;

    const intentType = this.detectIntentType(summary);
    const category = this.detectCategory(summary);
    const sentiment = this.detectSentiment(summary);
    const urgency = this.detectUrgency(summary);

    return {
      id: uuidv4(),
      type: intentType,
      category,
      entities: [...new Map(entities.map((e) => [e.value, e])).values()],
      sentiment,
      urgency,
      confidence: 0.6,
      rawText: summary,
      keyPhrases: [],
      goals: this.extractGoals(summary),
    };
  }

  /**
   * Get entity context
   */
  private getEntityContext(text: string, index: number): string {
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + 50);
    return text.substring(start, end);
  }

  /**
   * Link intent to ReZ Mind Intent Graph
   */
  async linkToIntentGraph(
    consumerId: string,
    intent: ExtractedIntent,
    externalIntentId?: string
  ): Promise<void> {
    await kbService.linkToIntentGraph(
      consumerId,
      'intent-extractor',
      externalIntentId || intent.id,
      intent.confidence
    );
  }

  /**
   * Get intent history from KB
   */
  async getIntentHistory(consumerId: string, limit: number = 20): Promise<ExtractedIntent[]> {
    const memories = await kbService.getRelevantMemories(consumerId, ['intent']);

    return memories
      .filter((m) => m.key.startsWith('intent:'))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((m) => m.value as ExtractedIntent);
  }
}

export const intentExtractor = new IntentExtractor();
