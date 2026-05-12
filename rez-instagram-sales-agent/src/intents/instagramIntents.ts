import { logger } from '../config/logger';

export type InstagramIntent =
  | 'greeting'
  | 'product_inquiry'
  | 'price_inquiry'
  | 'size_inquiry'
  | 'availability_inquiry'
  | 'purchase_intent'
  | 'checkout_request'
  | 'payment_inquiry'
  | 'shipping_inquiry'
  | 'return_inquiry'
  | 'comparison_request'
  | 'recommendation_request'
  | 'discount_request'
  | 'promo_code_request'
  | 'abandoned_cart'
  | 'follow_up'
  | 'complaint'
  | 'feedback'
  | 'thanks'
  | 'goodbye'
  | 'unknown';

export interface IntentMatch {
  intent: InstagramIntent;
  confidence: number;
  entities: IntentEntity[];
  context: IntentContext;
}

export interface IntentEntity {
  type: 'product' | 'category' | 'price' | 'size' | 'color' | 'brand' | 'hashtag' | 'username';
  value: string;
  confidence?: number;
}

export interface IntentContext {
  mentionedProducts: string[];
  mentionedCategories: string[];
  detectedSentiment: 'positive' | 'neutral' | 'negative';
  urgencyLevel: 'low' | 'medium' | 'high';
  conversionProbability: number;
}

export interface IntentPattern {
  intent: InstagramIntent;
  patterns: RegExp[];
  keywords: string[];
  weight: number;
}

export class InstagramIntentClassifier {
  private patterns: IntentPattern[] = [
    {
      intent: 'greeting',
      patterns: [
        /^(hi|hey|hello|howdy|yo|wassup|sup|good (morning|afternoon|evening))/i,
        /^(hey|hi|hello).*(there|there!)/i
      ],
      keywords: ['hi', 'hey', 'hello', 'good morning', 'good afternoon', 'good evening'],
      weight: 1.0
    },
    {
      intent: 'product_inquiry',
      patterns: [
        /do you have/i,
        /is this available/i,
        /tell me about/i,
        /more info/i,
        /what is this/i,
        /what's this/i,
        /about (this|that|product)/i,
        /can i get (info|details)/i
      ],
      keywords: ['available', 'info', 'details', 'about', 'tell me', 'show me', 'looking for'],
      weight: 0.9
    },
    {
      intent: 'price_inquiry',
      patterns: [
        /how much/i,
        /what('s| is) the price/i,
        /cost/i,
        /dollar/i,
        /\$\d+/,
        /price/i
      ],
      keywords: ['how much', 'price', 'cost', 'dollars', 'rupees', ' bucks'],
      weight: 1.0
    },
    {
      intent: 'size_inquiry',
      patterns: [
        /what size/i,
        /size available/i,
        /do you have (size|my size)/i,
        /sizing/i,
        /fit/i
      ],
      keywords: ['size', 'sizing', 'fit', 'small', 'medium', 'large', 'xl', 'xxl'],
      weight: 1.0
    },
    {
      intent: 'availability_inquiry',
      patterns: [
        /is (it|this|product) (in stock|available)/i,
        /when (will|does) (it|stock)/i,
        /sold out/i,
        /back in stock/i
      ],
      keywords: ['in stock', 'available', 'out of stock', 'sold out', 'backorder'],
      weight: 1.0
    },
    {
      intent: 'purchase_intent',
      patterns: [
        /i want to buy/i,
        /i('d| would) like (to )?(buy|get|order)/i,
        /add to (cart|order)/i,
        /can i (buy|order|get)/i,
        /take (my|this) (money|order)/i,
        /where (can|do) i (buy|get|order)/i
      ],
      keywords: ['buy', 'order', 'get', 'purchase', 'checkout', 'cart', 'want this'],
      weight: 0.95
    },
    {
      intent: 'checkout_request',
      patterns: [
        /checkout/i,
        /complete (my )?(order|purchase)/i,
        /pay (now|today)/i,
        /finalize/i
      ],
      keywords: ['checkout', 'pay now', 'complete order', 'buy now', 'order now'],
      weight: 1.0
    },
    {
      intent: 'payment_inquiry',
      patterns: [
        /what (payment|pay) (methods|options)/i,
        /do you accept/i,
        /can i pay with/i,
        /payment (info|methods|options)/i
      ],
      keywords: ['payment', 'paypal', 'card', 'cash', 'apple pay', 'google pay', 'cod'],
      weight: 0.9
    },
    {
      intent: 'shipping_inquiry',
      patterns: [
        /how long (does|will|to)/i,
        /shipping (time|cost|info)/i,
        /when (will|can) i (receive|get)/i,
        /delivery/i,
        /track(ing)?/i
      ],
      keywords: ['shipping', 'delivery', 'arrive', 'receive', 'track', 'how long'],
      weight: 0.9
    },
    {
      intent: 'return_inquiry',
      patterns: [
        /return(s|ing)?/i,
        /exchange/i,
        /refund/i,
        /send back/i
      ],
      keywords: ['return', 'exchange', 'refund', 'send back', 'come back'],
      weight: 0.95
    },
    {
      intent: 'discount_request',
      patterns: [
        /discount/i,
        /coupon/i,
        /code/i,
        /(lower|reduce|decrease) (price|cost)/i,
        /deal/i,
        /sale/i
      ],
      keywords: ['discount', 'coupon', 'deal', 'sale', 'off', 'lower price', 'cheaper'],
      weight: 0.85
    },
    {
      intent: 'promo_code_request',
      patterns: [
        /promo(code)?/i,
        /voucher/i,
        /gift (card|certificate)/i,
        /have a code/i
      ],
      keywords: ['promo', 'code', 'coupon', 'voucher', 'gift'],
      weight: 1.0
    },
    {
      intent: 'complaint',
      patterns: [
        /not happy/i,
        /disappointed/i,
        /terrible/i,
        /worst/i,
        /issue(s)?/i,
        /problem(s)?/i,
        /broken/i,
        /damaged/i,
        /not what (i|we) expected/i
      ],
      keywords: ['not happy', 'disappointed', 'issue', 'problem', 'broken', 'damaged', 'terrible', 'worst'],
      weight: 0.9
    },
    {
      intent: 'thanks',
      patterns: [
        /thank(s| you)/i,
        /thx/i,
        /ty/i,
        /appreciate/i,
        /(that('s| is) )?great (help|thanks)/i
      ],
      keywords: ['thank', 'thanks', 'thx', 'ty', 'appreciate', 'grateful'],
      weight: 1.0
    },
    {
      intent: 'goodbye',
      patterns: [
        /bye/i,
        /see you/i,
        /talk later/i,
        /have to go/i,
        /later/i
      ],
      keywords: ['bye', 'later', 'see you', 'talk later', 'have to go'],
      weight: 1.0
    },
    {
      intent: 'recommendation_request',
      patterns: [
        /recommend/i,
        /suggest/i,
        /what do you (recommend|suggest)/i,
        /what('s| is) good/i,
        /what should i (get|buy|try)/i
      ],
      keywords: ['recommend', 'suggest', 'good for', 'best', 'popular'],
      weight: 0.9
    },
    {
      intent: 'follow_up',
      patterns: [
        /checking (in|on)/i,
        /following up/i,
        /any update/i,
        /just checking/i
      ],
      keywords: ['checking', 'update', 'follow up', 'any news'],
      weight: 0.85
    }
  ];

  classify(message: string, context?: {
    previousIntent?: InstagramIntent;
    mentionedProducts?: string[];
    conversationState?: string;
  }): IntentMatch {
    const normalizedMessage = message.toLowerCase().trim();

    // Score all patterns
    const scores: Array<{ intent: InstagramIntent; score: number; entities: IntentEntity[] }> = [];

    for (const pattern of this.patterns) {
      let matchCount = 0;

      // Check patterns
      for (const regex of pattern.patterns) {
        if (regex.test(normalizedMessage)) {
          matchCount += pattern.weight;
        }
      }

      // Check keywords
      for (const keyword of pattern.keywords) {
        if (normalizedMessage.includes(keyword.toLowerCase())) {
          matchCount += pattern.weight * 0.5;
        }
      }

      if (matchCount > 0) {
        const entities = this.extractEntities(normalizedMessage);
        scores.push({
          intent: pattern.intent,
          score: matchCount,
          entities
        });
      }
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    // Get best match
    const bestMatch = scores[0] || {
      intent: 'unknown' as InstagramIntent,
      score: 0,
      entities: []
    };

    // Apply context modifiers
    let confidence = Math.min(bestMatch.score / 2, 1.0);
    if (context?.previousIntent && bestMatch.intent === context.previousIntent) {
      confidence *= 1.2; // Boost confidence for consistent intent
    }

    // Calculate intent context
    const intentContext: IntentContext = {
      mentionedProducts: context?.mentionedProducts || [],
      mentionedCategories: this.extractCategories(normalizedMessage),
      detectedSentiment: this.detectSentiment(normalizedMessage),
      urgencyLevel: this.detectUrgency(normalizedMessage),
      conversionProbability: this.calculateConversionProbability(bestMatch.intent)
    };

    logger.debug('Intent classified', {
      message: message.slice(0, 50),
      intent: bestMatch.intent,
      confidence: Math.round(confidence * 100) + '%'
    });

    return {
      intent: bestMatch.intent,
      confidence: Math.min(confidence, 1.0),
      entities: bestMatch.entities,
      context: intentContext
    };
  }

  private extractEntities(message: string): IntentEntity[] {
    const entities: IntentEntity[] = [];

    // Extract prices
    const priceRegex = /\$\d+(?:\.\d{2})?|\d+\s?(?:dollars| rupees| bucks)/gi;
    const prices = message.match(priceRegex);
    if (prices) {
      entities.push(...prices.map(p => ({
        type: 'price' as const,
        value: p
      })));
    }

    // Extract sizes
    const sizeKeywords = ['xs', 's', 'small', 'm', 'medium', 'l', 'large', 'xl', 'xxl', 'xxx', 'extra small', 'extra large'];
    for (const size of sizeKeywords) {
      if (message.includes(size)) {
        entities.push({
          type: 'size',
          value: size
        });
        break;
      }
    }

    // Extract hashtags
    const hashtagRegex = /#(\w+)/g;
    let match;
    while ((match = hashtagRegex.exec(message)) !== null) {
      entities.push({
        type: 'hashtag',
        value: match[1]
      });
    }

    // Extract usernames
    const usernameRegex = /@(\w+)/g;
    while ((match = usernameRegex.exec(message)) !== null) {
      entities.push({
        type: 'username',
        value: match[1]
      });
    }

    return entities;
  }

  private extractCategories(message: string): string[] {
    const categories: string[] = [];
    const categoryMap: Record<string, string[]> = {
      fashion: ['dress', 'shirt', 'pants', 'jacket', 'shoes', 'sneakers', 'outfit', 'wear', 'clothing'],
      beauty: ['makeup', 'lipstick', 'skincare', 'foundation', 'mascara', 'glow'],
      electronics: ['phone', 'charger', 'headphone', 'speaker', 'gadget', 'tech'],
      home: ['home', 'decor', 'kitchen', 'candle', 'pillow', 'blanket']
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(k => message.includes(k))) {
        categories.push(category);
      }
    }

    return categories;
  }

  private detectSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['love', 'amazing', 'great', 'perfect', 'beautiful', 'awesome', 'gorgeous', 'excellent'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'disappointed', 'worst', 'angry', 'frustrated'];

    const positiveCount = positiveWords.filter(w => message.includes(w)).length;
    const negativeCount = negativeWords.filter(w => message.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private detectUrgency(message: string): 'low' | 'medium' | 'high' {
    const urgentPatterns = [
      /urgent/i,
      /asap/i,
      /need (it|this) now/i,
      /right away/i,
      /immediately/i,
      /!{2,}/
    ];

    const mediumPatterns = [
      /today/i,
      /this (week|weekend)/i,
      /soon/i,
      /by (monday|tuesday|...)/i
    ];

    if (urgentPatterns.some(p => p.test(message))) return 'high';
    if (mediumPatterns.some(p => p.test(message))) return 'medium';
    return 'low';
  }

  private calculateConversionProbability(intent: InstagramIntent): number {
    const probabilityMap: Record<InstagramIntent, number> = {
      purchase_intent: 0.9,
      checkout_request: 0.95,
      price_inquiry: 0.6,
      product_inquiry: 0.5,
      size_inquiry: 0.55,
      availability_inquiry: 0.6,
      recommendation_request: 0.4,
      discount_request: 0.65,
      shipping_inquiry: 0.7,
      payment_inquiry: 0.75,
      return_inquiry: 0.5,
      greeting: 0.1,
      thanks: 0.2,
      goodbye: 0.1,
      complaint: 0.3,
      feedback: 0.4,
      promo_code_request: 0.7,
      comparison_request: 0.45,
      abandoned_cart: 0.6,
      follow_up: 0.4,
      unknown: 0.2
    };

    return probabilityMap[intent] || 0.2;
  }
}

export const instagramIntentClassifier = new InstagramIntentClassifier();
