import { logger } from '../config/logger';

export interface QuickReply {
  title: string;
  payload?: string;
  action?: 'postback' | 'web_url';
  url?: string;
}

export interface QuickReplyCategory {
  id: string;
  name: string;
  replies: QuickReply[];
}

export const QUICK_REPLY_CATEGORIES: QuickReplyCategory[] = [
  {
    id: 'navigation',
    name: 'Navigation',
    replies: [
      { title: 'Shop Now', payload: 'NAV_SHOP' },
      { title: 'New Arrivals', payload: 'NAV_NEW' },
      { title: 'Best Sellers', payload: 'NAV_BESTSELLERS' },
      { title: 'Sale', payload: 'NAV_SALE' }
    ]
  },
  {
    id: 'browse',
    name: 'Browse',
    replies: [
      { title: 'Dresses', payload: 'BROWSE_DRESSES' },
      { title: 'Tops', payload: 'BROWSE_TOPS' },
      { title: 'Accessories', payload: 'BROWSE_ACCESSORIES' },
      { title: 'All Products', payload: 'BROWSE_ALL' }
    ]
  },
  {
    id: 'help',
    name: 'Help',
    replies: [
      { title: 'Track Order', payload: 'HELP_TRACK' },
      { title: 'Return Item', payload: 'HELP_RETURN' },
      { title: 'Size Guide', payload: 'HELP_SIZE' },
      { title: 'Contact Support', payload: 'HELP_SUPPORT' }
    ]
  },
  {
    id: 'checkout',
    name: 'Checkout',
    replies: [
      { title: 'Continue to Checkout', payload: 'CHECKOUT_CONTINUE' },
      { title: 'Use WhatsApp', payload: 'CHECKOUT_WHATSAPP' },
      { title: 'Apply Promo Code', payload: 'CHECKOUT_PROMO' },
      { title: 'View Cart', payload: 'CHECKOUT_CART' }
    ]
  },
  {
    id: 'product',
    name: 'Product Actions',
    replies: [
      { title: 'What sizes?', payload: 'PRODUCT_SIZES' },
      { title: 'More colors', payload: 'PRODUCT_COLORS' },
      { title: 'Shipping info', payload: 'PRODUCT_SHIPPING' },
      { title: 'Buy now', payload: 'PRODUCT_BUY' }
    ]
  }
];

export class QuickReplyGenerator {
  private static MAX_REPLIES = 11; // Instagram's limit

  // Get quick replies for specific context
  static getForContext(context: 'browse' | 'product' | 'checkout' | 'help' | 'greeting' | 'general'): QuickReply[] {
    switch (context) {
      case 'greeting':
        return [
          { title: 'Shop now', payload: 'GREET_SHOP' },
          { title: 'Need help', payload: 'GREET_HELP' },
          { title: 'New arrivals', payload: 'GREET_NEW' },
          { title: 'Show me everything', payload: 'GREET_ALL' }
        ];

      case 'browse':
        return [
          { title: 'Dresses', payload: 'BROWSE_DRESSES' },
          { title: 'Tops', payload: 'BROWSE_TOPS' },
          { title: 'Accessories', payload: 'BROWSE_ACCESS' },
          { title: 'Best sellers', payload: 'BROWSE_BESTSELLERS' },
          { title: 'On sale', payload: 'BROWSE_SALE' }
        ];

      case 'product':
        return [
          { title: 'What sizes?', payload: 'PROD_SIZES' },
          { title: 'Colors available', payload: 'PROD_COLORS' },
          { title: 'How much?', payload: 'PROD_PRICE' },
          { title: 'In stock?', payload: 'PROD_STOCK' },
          { title: 'Buy now', payload: 'PROD_BUY' }
        ];

      case 'checkout':
        return [
          { title: 'Continue here', payload: 'CHECK_HERE' },
          { title: 'WhatsApp checkout', payload: 'CHECK_WHATSAPP' },
          { title: 'Have a code', payload: 'CHECK_PROMO' },
          { title: 'View cart', payload: 'CHECK_CART' }
        ];

      case 'help':
        return [
          { title: 'Track order', payload: 'HELP_TRACK' },
          { title: 'Return/Exchange', payload: 'HELP_RETURN' },
          { title: 'Size guide', payload: 'HELP_SIZE' },
          { title: 'Chat with support', payload: 'HELP_CHAT' }
        ];

      default:
        return [
          { title: 'Yes, please!', payload: 'GEN_YES' },
          { title: 'Tell me more', payload: 'GEN_MORE' },
          { title: 'Show options', payload: 'GEN_OPTIONS' }
        ];
    }
  }

  // Generate quick replies for cart actions
  static forCartAction(action: 'view' | 'add' | 'remove' | 'checkout'): QuickReply[] {
    switch (action) {
      case 'view':
        return [
          { title: 'View cart', payload: 'CART_VIEW' },
          { title: 'Add more', payload: 'CART_ADD' },
          { title: 'Checkout', payload: 'CART_CHECKOUT' }
        ];
      case 'add':
        return [
          { title: 'View cart', payload: 'CART_VIEW' },
          { title: 'Continue shopping', payload: 'CART_CONTINUE' },
          { title: 'Checkout now', payload: 'CART_CHECKOUT' }
        ];
      case 'remove':
        return [
          { title: 'Undo', payload: 'CART_UNDO' },
          { title: 'View cart', payload: 'CART_VIEW' },
          { title: 'Browse more', payload: 'CART_BROWSE' }
        ];
      case 'checkout':
        return [
          { title: 'Checkout now', payload: 'CART_CHECKOUT' },
          { title: 'WhatsApp checkout', payload: 'CART_WHATSAPP' },
          { title: 'Apply promo', payload: 'CART_PROMO' },
          { title: 'Continue shopping', payload: 'CART_MORE' }
        ];
    }
  }

  // Generate quick replies for shipping info
  static forShipping(): QuickReply[] {
    return [
      { title: 'Standard (5 days)', payload: 'SHIP_STANDARD' },
      { title: 'Express (2 days)', payload: 'SHIP_EXPRESS' },
      { title: 'Free shipping', payload: 'SHIP_FREE' },
      { title: 'More details', payload: 'SHIP_DETAILS' }
    ];
  }

  // Generate quick replies for payment
  static forPayment(): QuickReply[] {
    return [
      { title: 'Credit Card', payload: 'PAY_CARD' },
      { title: 'PayPal', payload: 'PAY_PAYPAL' },
      { title: 'Apple Pay', payload: 'PAY_APPLE' },
      { title: 'WhatsApp payment', payload: 'PAY_WHATSAPP' }
    ];
  }

  // Generate quick replies for order confirmation
  static forConfirmation(): QuickReply[] {
    return [
      { title: 'Track order', payload: 'CONFIRM_TRACK' },
      { title: 'Need help?', payload: 'CONFIRM_HELP' },
      { title: 'Browse more', payload: 'CONFIRM_BROWSE' }
    ];
  }

  // Generate quick replies for abandoned cart follow-up
  static forAbandonedCart(productName?: string): QuickReply[] {
    return [
      { title: 'Yes, buy now!', payload: 'CART_YES' },
      { title: 'Tell me more', payload: 'CART_INFO' },
      { title: 'Have a discount?', payload: 'CART_DISCOUNT' },
      { title: 'Remove item', payload: 'CART_REMOVE' }
    ];
  }

  // Generate quick replies for back in stock notification
  static forBackInStock(): QuickReply[] {
    return [
      { title: 'Yes, buy now!', payload: 'STOCK_BUY' },
      { title: 'Size info', payload: 'STOCK_SIZES' },
      { title: 'Notify me later', payload: 'STOCK_LATER' }
    ];
  }

  // Convert quick replies to Instagram API format
  static toInstagramFormat(replies: QuickReply[]): Array<{ title: string; payload?: string }> {
    return replies.slice(0, this.MAX_REPLIES).map(reply => ({
      title: reply.title.slice(0, 20), // Instagram title limit
      payload: reply.payload
    }));
  }

  // Create a single quick reply
  static create(title: string, payload?: string): QuickReply {
    return { title, payload };
  }

  // Create URL quick reply
  static createUrl(title: string, url: string): QuickReply {
    return { title, action: 'web_url', url };
  }
}

// Pre-built quick reply sets for common scenarios
export const QUICK_REPLY_SETS = {
  initial: [
    QuickReplyGenerator.create('Shop now'),
    QuickReplyGenerator.create('Need help'),
    QuickReplyGenerator.create('New arrivals'),
    QuickReplyGenerator.create('Sale items')
  ],

  productInterest: [
    QuickReplyGenerator.create('Size info'),
    QuickReplyGenerator.create('How much?'),
    QuickReplyGenerator.create('In stock?'),
    QuickReplyGenerator.create('Buy now')
  ],

  checkoutReady: [
    QuickReplyGenerator.create('Checkout here'),
    QuickReplyGenerator.create('WhatsApp checkout'),
    QuickReplyGenerator.create('Apply promo'),
    QuickReplyGenerator.create('Continue shopping')
  ],

  orderComplete: [
    QuickReplyGenerator.create('Track order'),
    QuickReplyGenerator.create('Need help'),
    QuickReplyGenerator.create('Shop more')
  ],

  browse: [
    QuickReplyGenerator.create('Dresses'),
    QuickReplyGenerator.create('Tops'),
    QuickReplyGenerator.create('Accessories'),
    QuickReplyGenerator.create('Show all')
  ],

  help: [
    QuickReplyGenerator.create('Track my order'),
    QuickReplyGenerator.create('Return item'),
    QuickReplyGenerator.create('Size guide'),
    QuickReplyGenerator.create('Chat with support')
  ],

  yesNo: [
    QuickReplyGenerator.create('Yes, please!'),
    QuickReplyGenerator.create('Not right now')
  ]
};
