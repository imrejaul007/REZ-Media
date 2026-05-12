import { routingService } from './routingService';
import { instagramTone, ChannelTone } from '../utils/instagramTone';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface ReplyContext {
  platform: 'instagram';
  message: string;
  intent?: string;
  confidence?: number;
  userContext: {
    username: string;
    linkedRezUserId?: string | null;
    preferences?: Record<string, any>;
  };
  tone?: ChannelTone;
}

export interface QuickReply {
  title: string;
  payload: string;
}

export interface ReplyResponse {
  success: boolean;
  message?: string;
  quickReplies?: QuickReply[];
  error?: string;
}

class ReplyService {
  private readonly greetingPatterns = [
    /^hi|hey|hello|yo|sup|what'?s up/i,
    /^good (morning|afternoon|evening)/i,
  ];

  private readonly farewellPatterns = [
    /^bye|goodbye|see ya|take care|thanks (for|thx)/i,
    /^okay thanks|got it|perfect|great/i,
  ];

  private readonly helpPatterns = [
    /^help|can you|how do|could you|what is|what are|tell me/i,
    /^(i )?(want|need|have|want to|looking for)/i,
  ];

  private readonly quickRepliesByIntent: Record<string, QuickReply[]> = {
    greeting: [
      { title: '💬 Chat with us', payload: 'INTENT_CHAT' },
      { title: '🛒 View products', payload: 'INTENT_PRODUCTS' },
      { title: '📞 Contact support', payload: 'INTENT_SUPPORT' },
    ],
    product_inquiry: [
      { title: '📦 View catalog', payload: 'INTENT_CATALOG' },
      { title: '💰 Get pricing', payload: 'INTENT_PRICING' },
      { title: '🛒 Order now', payload: 'INTENT_ORDER' },
    ],
    support_request: [
      { title: '📋 Track order', payload: 'INTENT_TRACK_ORDER' },
      { title: '↩️ Return item', payload: 'INTENT_RETURN' },
      { title: '💬 Chat with agent', payload: 'INTENT_CHAT' },
    ],
    booking: [
      { title: '📅 Check availability', payload: 'INTENT_AVAILABILITY' },
      { title: '💰 Get quote', payload: 'INTENT_QUOTE' },
      { title: '✅ Book now', payload: 'INTENT_BOOK' },
    ],
  };

  async generateResponse(context: ReplyContext): Promise<string | null> {
    try {
      const { message, intent, confidence, tone } = context;

      // Handle greeting
      if (this.isGreeting(message)) {
        return this.generateGreetingResponse(tone);
      }

      // Handle farewell
      if (this.isFarewell(message)) {
        return this.generateFarewellResponse(tone);
      }

      // Handle help request
      if (this.isHelpRequest(message)) {
        return this.generateHelpResponse(tone);
      }

      // Handle based on intent
      if (intent && confidence && confidence > 0.7) {
        return this.generateIntentBasedResponse(intent, tone);
      }

      // Default: offer to help
      return this.generateDefaultResponse(tone);
    } catch (error: any) {
      logger.error('Failed to generate response', {
        intent: context.intent,
        error: error.message,
      });
      return null;
    }
  }

  private isGreeting(message: string): boolean {
    return this.greetingPatterns.some((pattern) => pattern.test(message.trim()));
  }

  private isFarewell(message: string): boolean {
    return this.farewellPatterns.some((pattern) => pattern.test(message.trim()));
  }

  private isHelpRequest(message: string): boolean {
    return this.helpPatterns.some((pattern) => pattern.test(message.trim()));
  }

  private generateGreetingResponse(tone: ChannelTone): string {
    const responses = [
      "Hey there! 👋 Welcome! How can we help you today?",
      "Hi! Great to hear from you! What can we do for you?",
      "Hello! 😊 Ready to help! What brings you here today?",
      "Hey! Welcome! Let us know how we can assist you!",
    ];

    const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
    return instagramTone.formatMessage(selectedResponse, tone.context);
  }

  private generateFarewellResponse(tone: ChannelTone): string {
    const responses = [
      "Thanks for reaching out! Have an amazing day! 🌟",
      "You're all set! Don't hesitate to reach out if you need anything else! 😊",
      "Happy to help! Take care and talk soon! 👋",
      "Got it! We're here if you need us. Have a great one! ✨",
    ];

    const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
    return instagramTone.formatMessage(selectedResponse, tone.context);
  }

  private generateHelpResponse(tone: ChannelTone): string {
    const responses = [
      "Of course! I'm here to help! Could you tell us a bit more about what you're looking for? 🤔",
      "Happy to help! What specific information do you need? 💡",
      "Absolutely! Let us know what you'd like to know and we'll get right on it! 🎯",
    ];

    const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
    return instagramTone.formatMessage(selectedResponse, tone.context);
  }

  private generateIntentBasedResponse(intent: string, tone: ChannelTone): string {
    const responses: Record<string, string[]> = {
      product_inquiry: [
        "Love that you're interested! Check out our latest collection 👉 [link]",
        "Great choice! Here's what you need to know about our products 📦",
        "Thanks for asking! Our team can help you find exactly what you need 💫",
      ],
      booking: [
        "Let's get you sorted! What dates work best for you? 📅",
        "Exciting! We'd love to help with your booking. Tell us more! ✨",
        "You're in the right place! Let's plan this together 🌟",
      ],
      support_request: [
        "We're here to help! Give us a moment to look into this for you 🔧",
        "Sorry to hear you're having trouble. Let's fix this right away! 💪",
        "No worries, we've got you! Here's what we can do... 🛠️",
      ],
      pricing: [
        "Great question! Our team will send you the details right away 💰",
        "For the best pricing, our team can give you a personalized quote! 📊",
      ],
      general_inquiry: [
        "Thanks for reaching out! Let me look into this for you 🔍",
        "Good question! Here's what I found... 💡",
      ],
    };

    const intentResponses = responses[intent] || responses.general_inquiry;
    const selectedResponse = intentResponses[Math.floor(Math.random() * intentResponses.length)];
    return instagramTone.formatMessage(selectedResponse, tone.context);
  }

  private generateDefaultResponse(tone: ChannelTone): string {
    const responses = [
      "Thanks for your message! A team member will get back to you shortly 💬",
      "Got it! We've received your message and will respond soon 📬",
      "Thanks for reaching out! We'll have someone help you shortly ✨",
    ];

    const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
    return instagramTone.formatMessage(selectedResponse, tone.context);
  }

  async getQuickReplies(intent: string): Promise<QuickReply[]> {
    return this.quickRepliesByIntent[intent] || this.quickRepliesByIntent.general_inquiry;
  }

  async handleQuickReplyResponse(
    payload: string,
    tone: ChannelTone
  ): Promise<{ message: string; quickReplies?: QuickReply[] }> {
    const intentMap: Record<string, { message: string; nextIntent?: string }> = {
      INTENT_CHAT: {
        message: "Let's chat! What would you like to talk about? 💬",
      },
      INTENT_PRODUCTS: {
        message: "Here are our popular categories! 👇",
      },
      INTENT_SUPPORT: {
        message: "I'll connect you with our support team. What do you need help with? 🎧",
      },
      INTENT_CATALOG: {
        message: "Check out our latest collection! What's catching your eye? 👀",
      },
      INTENT_PRICING: {
        message: "Our pricing varies by product. What are you interested in? 💰",
      },
      INTENT_ORDER: {
        message: "Ready to order! What would you like to get? 🛒",
      },
      INTENT_TRACK_ORDER: {
        message: "I can help track your order! What's your order number? 📦",
      },
      INTENT_RETURN: {
        message: "Let's get your return sorted! What's the order number? 📋",
      },
      INTENT_AVAILABILITY: {
        message: "Let me check the availability for you! 📅",
      },
      INTENT_QUOTE: {
        message: "I'll get you a personalized quote! Tell me more about what you need 📊",
      },
      INTENT_BOOK: {
        message: "Let's get you booked! What works best for your schedule? ✅",
      },
    };

    const response = intentMap[payload];
    if (!response) {
      return {
        message: "Thanks for your selection! How can I help you further? 💬",
      };
    }

    const formattedMessage = instagramTone.formatMessage(response.message, tone.context);

    return {
      message: formattedMessage,
      quickReplies: response.nextIntent ? this.quickRepliesByIntent[response.nextIntent] : undefined,
    };
  }
}

export const replyService = new ReplyService();
