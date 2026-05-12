import { InstagramIntent } from '../intents/instagramIntents';
import { logger } from '../config/logger';

export interface ResponseTemplate {
  id: string;
  intent: InstagramIntent;
  variants: string[];
  quickReplies?: string[];
}

export interface GeneratedResponse {
  message: string;
  quickReplies?: string[];
  links?: string[];
  imageUrl?: string;
  isFollowUp: boolean;
}

// Core response templates organized by intent
export const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  // Greeting templates
  {
    id: 'greeting_1',
    intent: 'greeting',
    variants: [
      'Hey! 👋 Welcome! How can I help you today?',
      'Hi there! 😊 What are you looking for?',
      'Hello! ✨ Ready to find something great?'
    ],
    quickReplies: ['Browse products', 'Need help finding something', 'I have a question']
  },
  {
    id: 'greeting_returning',
    intent: 'greeting',
    variants: [
      'Welcome back! 👋 What can I help you with today?',
      'Hey again! 😊 Missed you! Looking for something specific?'
    ],
    quickReplies: ['Check my order', 'Continue shopping', 'New arrivals']
  },

  // Product inquiry templates
  {
    id: 'product_inquiry_1',
    intent: 'product_inquiry',
    variants: [
      'Love that item! 💫 Here\'s what I know...',
      'Great choice! Let me tell you more...',
      'You have good taste! This one is...'
    ],
    quickReplies: ['What sizes?', 'How much?', 'Is it in stock?']
  },
  {
    id: 'product_inquiry_general',
    intent: 'product_inquiry',
    variants: [
      'What kind of thing are you looking for?',
      'Tell me more about what you need!',
      'I can help you find the perfect match!'
    ],
    quickReplies: ['Something casual', 'For a gift', 'Show me bestsellers']
  },

  // Price inquiry templates
  {
    id: 'price_1',
    intent: 'price_inquiry',
    variants: [
      'It\'s ${price}! Plus we have free shipping on orders over $50 🌟',
      '${price} - great value for this quality!',
      'Priced at ${price}. Want me to check for any current deals?'
    ]
  },
  {
    id: 'price_with_discount',
    intent: 'price_inquiry',
    variants: [
      'Right now it\'s ${price} with our ${discount}% off deal! 🎉',
      'Good timing! Currently on sale for ${price} (usually ${original})'
    ],
    quickReplies: ['Where do I buy?', 'Apply a discount', 'Size info']
  },

  // Size inquiry templates
  {
    id: 'size_1',
    intent: 'size_inquiry',
    variants: [
      'We have sizes S through XXL! Which one are you?',
      'It runs true to size, but I\'d recommend sizing up if you\'re between!',
      'Sizes available: S, M, L, XL, XXL - all in stock!'
    ],
    quickReplies: ['I\'m a size M', 'Size chart please', 'Which is most popular?']
  },

  // Availability templates
  {
    id: 'available_1',
    intent: 'availability_inquiry',
    variants: [
      'Yes! It\'s in stock and ready to ship 🚚',
      'Good news - currently available!',
      'In stock! Want me to hold one for you?'
    ],
    quickReplies: ['Great! Buy now', 'How long to ship?']
  },
  {
    id: 'out_of_stock',
    intent: 'availability_inquiry',
    variants: [
      'That one\'s currently sold out, but I can notify you when it\'s back!',
      'Just sold out! Want me to put you on the restock list?',
      'Out of stock right now. Want to see similar options?'
    ],
    quickReplies: ['Notify me!', 'Show similar items', 'When back in stock?']
  },

  // Purchase intent templates
  {
    id: 'purchase_intent_1',
    intent: 'purchase_intent',
    variants: [
      'Awesome choice! 🙌 Let\'s get you checked out!',
      'Love it! Ready to make it yours?',
      'Perfect pick! Let me help you order...'
    ],
    quickReplies: ['Yes, buy now!', 'Need more info first', 'What about shipping?']
  },

  // Checkout templates
  {
    id: 'checkout_1',
    intent: 'checkout_request',
    variants: [
      'Let\'s wrap this up! 👉',
      'Ready when you are! Checkout here:',
      'Click below to complete your order! 🛍️'
    ],
    quickReplies: ['Continue to checkout', 'I\'ll use WhatsApp', 'Apply promo code']
  },

  // Payment inquiry templates
  {
    id: 'payment_1',
    intent: 'payment_inquiry',
    variants: [
      'We take card, PayPal, Apple Pay & more! 💳',
      'Cards, PayPal, Apple Pay, Google Pay - whatever works for you!',
      'Multiple payment options available: Card, PayPal, Apple Pay, and Cash on Delivery in select areas'
    ]
  },

  // Shipping templates
  {
    id: 'shipping_1',
    intent: 'shipping_inquiry',
    variants: [
      'Standard shipping is ${days} days, express is ${express}! 📦',
      'Free standard shipping on orders $50+, or ${price} for express!',
      'Standard: ${days} days | Express: ${express} days'
    ],
    quickReplies: ['Free shipping options', 'Express shipping', 'Track my order']
  },

  // Return templates
  {
    id: 'return_1',
    intent: 'return_inquiry',
    variants: [
      'Easy returns within 14 days! Just reach out if anything\'s not right 😊',
      'No worries! We offer hassle-free returns within 14 days.',
      'Changed your mind? No problem - 14 day returns, no questions asked!'
    ],
    quickReplies: ['How to return', 'Return policy details', 'Exchange options']
  },

  // Discount templates
  {
    id: 'discount_1',
    intent: 'discount_request',
    variants: [
      'Want to use a discount code? I\'ve got you!',
      'I can apply a special offer for you!',
      'Let me check what discounts are available...'
    ],
    quickReplies: ['I have a code', 'What offers do you have?']
  },
  {
    id: 'promo_1',
    intent: 'promo_code_request',
    variants: [
      'Sure thing! Drop your code here and I\'ll apply it 🎉',
      'I\'d be happy to use your promo code!',
      'Let\'s get that discount applied for you!'
    ],
    quickReplies: ['First time buyer?', 'Check for current deals']
  },

  // Complaint templates
  {
    id: 'complaint_1',
    intent: 'complaint',
    variants: [
      'I\'m so sorry to hear that! Let me help make this right 💙',
      'That\'s not the experience we want for you. Let me fix this!',
      'I completely understand your frustration. Let\'s sort this out!'
    ],
    quickReplies: ['I need a refund', 'Send me a replacement', 'Talk to support']
  },

  // Thanks templates
  {
    id: 'thanks_1',
    intent: 'thanks',
    variants: [
      'You\'re welcome! 😊 Happy to help!',
      'Of course! Anytime! 💫',
      'My pleasure! Let me know if you need anything else!'
    ],
    quickReplies: ['Order status', 'Another question', 'I\'m all set!']
  },

  // Goodbye templates
  {
    id: 'goodbye_1',
    intent: 'goodbye',
    variants: [
      'Take care! Come back anytime! 👋',
      'Bye for now! Thanks for chatting! ✨',
      'See you soon! 💫 Don\'t forget your cart!'
    ]
  },

  // Recommendation templates
  {
    id: 'recommend_1',
    intent: 'recommendation_request',
    variants: [
      'Based on what you\'re looking for, I\'d suggest...',
      'Ooh, great question! I have some ideas...',
      'Let me find something perfect for you!'
    ],
    quickReplies: ['Show me!', 'What\'s trending?', 'Bestsellers']
  }
];

export class ResponseGenerator {
  private templateMap: Map<InstagramIntent, ResponseTemplate[]> = new Map();

  constructor() {
    this.buildTemplateMap();
  }

  private buildTemplateMap(): void {
    for (const template of RESPONSE_TEMPLATES) {
      const existing = this.templateMap.get(template.intent) || [];
      existing.push(template);
      this.templateMap.set(template.intent, existing);
    }
  }

  generateResponse(
    intent: InstagramIntent,
    context?: {
      productName?: string;
      price?: number;
      originalPrice?: number;
      discount?: number;
      size?: string;
      availability?: 'in_stock' | 'out_of_stock' | 'limited';
      shippingDays?: number;
      expressDays?: number;
      userName?: string;
      isReturning?: boolean;
    }
  ): GeneratedResponse {
    const templates = this.templateMap.get(intent) || [];
    const fallbackTemplates = this.templateMap.get('unknown') || [];

    const selectedTemplates = templates.length > 0 ? templates : fallbackTemplates;

    if (selectedTemplates.length === 0) {
      return {
        message: 'Let me help you with that!',
        isFollowUp: false
      };
    }

    // Select random template from the list
    const template = selectedTemplates[Math.floor(Math.random() * selectedTemplates.length)];

    // Select random variant
    let message = template.variants[Math.floor(Math.random() * template.variants.length)];

    // Replace placeholders
    message = this.interpolateMessage(message, context);

    // Check for out of stock variant
    if (context?.availability === 'out_of_stock' && intent === 'availability_inquiry') {
      const outOfStockTemplates = selectedTemplates.find(t => t.id.includes('out_of_stock'));
      if (outOfStockTemplates) {
        message = outOfStockTemplates.variants[0];
      }
    }

    return {
      message,
      quickReplies: template.quickReplies,
      isFollowUp: false
    };
  }

  private interpolateMessage(
    message: string,
    context?: {
      productName?: string;
      price?: number;
      originalPrice?: number;
      discount?: number;
      size?: string;
      shippingDays?: number;
      expressDays?: number;
      userName?: string;
    }
  ): string {
    if (!context) return message;

    let result = message;

    result = result.replace(/\${price}/g, context.price?.toFixed(2) || '??');
    result = result.replace(/\${original}/g, context.originalPrice?.toFixed(2) || '??');
    result = result.replace(/\${discount}/g, context.discount?.toString() || '10');
    result = result.replace(/\${size}/g, context.size || 'your size');
    result = result.replace(/\${days}/g, context.shippingDays?.toString() || '5');
    result = result.replace(/\${express}/g, context.expressDays?.toString() || '2');
    result = result.replace(/\${product}/g, context.productName || 'this item');

    return result;
  }

  // Generate a follow-up message
  generateFollowUp(
    type: 'abandoned_cart' | 'price_reminder' | 'back_in_stock' | 'general'
  ): GeneratedResponse {
    const templates: Record<string, string[]> = {
      abandoned_cart: [
        'Hey! You left something behind 👀',
        'Your cart misses you!',
        'Still thinking about it? We\'ve got it waiting for you!'
      ],
      price_reminder: [
        'Just a reminder - that item you liked is still available!',
        'Still interested? The price hasn\'t changed!',
        'Hey! Your item is still waiting for you'
      ],
      back_in_stock: [
        'Good news! 🎉 Something you liked is back!',
        'It\'s back! Your favorite item just restocked!',
        'Back in stock alert! 🎊'
      ],
      general: [
        'Just checking in! 😊',
        'Hey there! Anything I can help with?',
        'Hi! Let me know if you have questions!'
      ]
    };

    const options = templates[type] || templates.general;
    const message = options[Math.floor(Math.random() * options.length)];

    return {
      message,
      quickReplies: ['Yes, I\'m interested!', 'Show me more', 'Remove from list'],
      isFollowUp: true
    };
  }

  // Generate carousel text
  generateCarouselIntro(): string {
    const intros = [
      'Here are some options for you! 👇',
      'Check these out! 👀',
      'I found some great picks! ✨',
      'Perfect matches for you! 🌟'
    ];
    return intros[Math.floor(Math.random() * intros.length)];
  }

  // Generate quick checkout message
  generateQuickCheckout(productName: string, price: number): GeneratedResponse {
    return {
      message: `Want to grab the ${productName} for $${price.toFixed(2)}? Quick checkout here!`,
      quickReplies: ['Yes, buy now!', 'Tell me more', 'Need a discount'],
      isFollowUp: false
    };
  }
}

export const responseGenerator = new ResponseGenerator();
