import { config } from '../config';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, string[]>;
  shouldRoute: boolean;
  routingReason?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

const intentPatterns: Record<string, { patterns: RegExp[]; keywords: string[]; priority?: number }> = {
  greeting: {
    patterns: [/^hi|hey|hello|yo|sup|what'?s up/i, /^good (morning|afternoon|evening)/i],
    keywords: ['hi', 'hello', 'hey', 'yo', 'greetings'],
  },
  product_inquiry: {
    patterns: [/(do you have|is there|can i get|looking for|want to buy)/i],
    keywords: ['product', 'buy', 'price', 'cost', 'available', 'stock', 'order'],
    priority: 2,
  },
  booking: {
    patterns: [/(book|reserve|schedule|appointment|check in|check-out)/i],
    keywords: ['booking', 'reservation', 'appointment', 'schedule', 'book'],
    priority: 2,
  },
  support_request: {
    patterns: [/(help|support|issue|problem|broken|not working|error)/i],
    keywords: ['help', 'support', 'issue', 'problem', 'error', 'broken'],
    priority: 3,
  },
  customer_complaint: {
    patterns: [/(complaint|unhappy|disappointed|angry|worst|terrible|refund|cancel)/i],
    keywords: ['complaint', 'unhappy', 'disappointed', 'refund', 'cancel', 'terrible'],
    priority: 4,
  },
  pricing: {
    patterns: [/(how much|price|cost|quote|rate|charge)/i],
    keywords: ['price', 'cost', 'quote', 'rate', 'pricing', 'expensive', 'cheap'],
    priority: 2,
  },
  shipping: {
    patterns: [/(ship|delivery|track|arrive|package|order status)/i],
    keywords: ['shipping', 'delivery', 'track', 'arrived', 'package', 'order'],
    priority: 2,
  },
  return_exchange: {
    patterns: [/(return|refund|exchange|swap|give back)/i],
    keywords: ['return', 'refund', 'exchange', 'swap'],
    priority: 3,
  },
  account: {
    patterns: [/(account|login|sign in|password|profile|settings)/i],
    keywords: ['account', 'login', 'password', 'profile', 'settings', 'email'],
    priority: 2,
  },
  feedback: {
    patterns: [/(feedback|review|rating|suggest|recommend)/i],
    keywords: ['feedback', 'review', 'rating', 'suggestion', 'recommend'],
    priority: 1,
  },
  hours_operation: {
    patterns: [/(hours|open|close|available|when|time)/i],
    keywords: ['hours', 'open', 'close', 'available', 'time', 'when'],
    priority: 1,
  },
  location: {
    patterns: [/(where|location|address|directions|map|find)/i],
    keywords: ['location', 'address', 'directions', 'where', 'map', 'find'],
    priority: 1,
  },
  general_inquiry: {
    patterns: [],
    keywords: ['what', 'how', 'why', 'when', 'where', 'can', 'could', 'would'],
  },
};

const escalationKeywords = [
  'urgent',
  'immediately',
  'lawsuit',
  'lawyer',
  'sue',
  'legal',
  'police',
  'authority',
  'report',
  'complain to',
  'manager',
  'supervisor',
];

const positiveKeywords = [
  'love',
  'great',
  'amazing',
  'wonderful',
  'excellent',
  'awesome',
  'fantastic',
  'thank',
  'thanks',
  'appreciate',
  'happy',
  'pleased',
  'satisfied',
  'perfect',
];

const negativeKeywords = [
  'hate',
  'terrible',
  'awful',
  'horrible',
  'worst',
  'angry',
  'frustrated',
  'disappointed',
  'unhappy',
  'upset',
  'annoyed',
  'furious',
  'not happy',
  'not good',
  'broken',
  'scam',
  'fraud',
];

class IntentExtractor {
  /**
   * Extract intent from a message
   */
  async extract(message: string): Promise<IntentResult> {
    const normalizedMessage = message.toLowerCase().trim();

    // Detect intent
    const { intent, confidence, matchedPatterns } = this.detectIntent(normalizedMessage);

    // Extract entities
    const entities = this.extractEntities(normalizedMessage);

    // Detect sentiment
    const sentiment = this.detectSentiment(normalizedMessage);

    // Determine if routing is needed
    const { shouldRoute, routingReason } = this.determineRouting(intent, confidence, sentiment, normalizedMessage);

    logger.debug('Intent extracted', {
      message: message.substring(0, 50),
      intent,
      confidence,
      sentiment,
      shouldRoute,
    });

    return {
      intent,
      confidence,
      entities,
      shouldRoute,
      routingReason,
      sentiment,
    };
  }

  /**
   * Detect the primary intent
   */
  private detectIntent(message: string): { intent: string; confidence: number; matchedPatterns: string[] } {
    const scores: Record<string, { score: number; matchedPatterns: string[] }> = {};

    for (const [intentName, config] of Object.entries(intentPatterns)) {
      scores[intentName] = { score: 0, matchedPatterns: [] };

      // Check patterns
      for (const pattern of config.patterns) {
        if (pattern.test(message)) {
          scores[intentName].score += 0.4;
          scores[intentName].matchedPatterns.push(pattern.source);
        }
      }

      // Check keywords
      for (const keyword of config.keywords) {
        if (message.includes(keyword.toLowerCase())) {
          scores[intentName].score += 0.2;
        }
      }

      // Apply priority multiplier
      if (config.priority) {
        scores[intentName].score *= 1 + (config.priority * 0.1);
      }
    }

    // Find highest scoring intent
    let bestIntent = 'general_inquiry';
    let bestScore = 0;

    for (const [intentName, data] of Object.entries(scores)) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestIntent = intentName;
      }
    }

    // Normalize confidence to 0-1
    const confidence = Math.min(1, bestScore);

    return {
      intent: bestIntent,
      confidence,
      matchedPatterns: scores[bestIntent].matchedPatterns,
    };
  }

  /**
   * Extract entities from message
   */
  private extractEntities(message: string): Record<string, string[]> {
    const entities: Record<string, string[]> = {
      products: [],
      times: [],
      prices: [],
      locations: [],
      orderNumbers: [],
    };

    // Extract prices (e.g., $50, 50 dollars)
    const priceMatches = message.match(/\$\d+(?:\.\d{2})?|\d+\s*dollars?/gi);
    if (priceMatches) {
      entities.prices = priceMatches;
    }

    // Extract order numbers (e.g., #12345, order 12345)
    const orderMatches = message.match(/#?\d{5,}(?:\s*\d+)*|order\s*#?\s*\d+/gi);
    if (orderMatches) {
      entities.orderNumbers = orderMatches;
    }

    // Extract common locations
    const locationKeywords = ['store', 'shop', 'location', 'address', 'here', 'there'];
    for (const keyword of locationKeywords) {
      if (message.includes(keyword)) {
        entities.locations.push(keyword);
      }
    }

    // Extract time references
    const timeKeywords = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'week', 'morning', 'afternoon', 'evening'];
    for (const keyword of timeKeywords) {
      if (message.includes(keyword)) {
        entities.times.push(keyword);
      }
    }

    return entities;
  }

  /**
   * Detect sentiment
   */
  private detectSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    let positiveCount = 0;
    let negativeCount = 0;

    for (const keyword of positiveKeywords) {
      if (message.includes(keyword)) positiveCount++;
    }

    for (const keyword of negativeKeywords) {
      if (message.includes(keyword)) negativeCount++;
    }

    if (negativeCount > positiveCount) return 'negative';
    if (positiveCount > negativeCount) return 'positive';
    return 'neutral';
  }

  /**
   * Determine if message should be routed to orchestrator
   */
  private determineRouting(
    intent: string,
    confidence: number,
    sentiment: 'positive' | 'neutral' | 'negative',
    message: string
  ): { shouldRoute: boolean; routingReason?: string } {
    // Always route complaints with high confidence
    if (intent === 'customer_complaint' && confidence >= 0.6) {
      return {
        shouldRoute: true,
        routingReason: 'Customer complaint with high confidence',
      };
    }

    // Route negative sentiment with escalation keywords
    if (sentiment === 'negative') {
      for (const keyword of escalationKeywords) {
        if (message.includes(keyword)) {
          return {
            shouldRoute: true,
            routingReason: 'Escalation keyword detected',
          };
        }
      }
    }

    // Route support requests
    if (intent === 'support_request' && confidence >= 0.7) {
      return {
        shouldRoute: true,
        routingReason: 'Support request with high confidence',
      };
    }

    // Route based on confidence threshold
    if (confidence < config.intent.confidenceThreshold) {
      return {
        shouldRoute: true,
        routingReason: 'Low confidence - needs human review',
      };
    }

    // Route return/exchange requests
    if (intent === 'return_exchange' && confidence >= 0.7) {
      return {
        shouldRoute: true,
        routingReason: 'Return/exchange request',
      };
    }

    return { shouldRoute: false };
  }
}

export const intentExtractor = new IntentExtractor();
