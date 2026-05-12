export interface ProductCategory {
  id: string;
  name: string;
  keywords: string[];
  commonQuestions: string[];
  trendingTopics: string[];
}

export interface CommerceKnowledge {
  categories: ProductCategory[];
  shipping: {
    standardDays: number;
    expressDays: number;
    freeThreshold: number;
    regions: string[];
  };
  paymentMethods: string[];
  returnPolicy: string;
  commonHashtags: Record<string, string[]>;
}

export const COMMERCE_KNOWLEDGE: CommerceKnowledge = {
  categories: [
    {
      id: 'fashion',
      name: 'Fashion & Apparel',
      keywords: ['outfit', 'dress', 'top', 'bottom', 'shoes', 'wear', 'style', 'fashion', 'clothes', 'clothing'],
      commonQuestions: [
        'What sizes are available?',
        'Is this true to size?',
        'What material is this?',
        'How do I style this?',
        'Is it stretchy?'
      ],
      trendingTopics: ['#OOTD', '#FashionLover', '#StyleInspo', '#WhatsInMyBag']
    },
    {
      id: 'beauty',
      name: 'Beauty & Cosmetics',
      keywords: ['makeup', 'skincare', 'lip', 'eye', 'face', 'skin', 'cream', 'serum', 'glow', 'beauty'],
      commonQuestions: [
        'What\'s my shade?',
        'Is this suitable for sensitive skin?',
        'How long does this last?',
        'Is this cruelty-free?',
        'What\'s the finish like?'
      ],
      trendingTopics: ['#BeautyTips', '#SkincareRoutine', '#MakeupTutorial', '#GlowUp']
    },
    {
      id: 'electronics',
      name: 'Electronics & Gadgets',
      keywords: ['phone', 'charger', 'headphone', 'speaker', 'gadget', 'tech', 'wireless', 'bluetooth', 'power'],
      commonQuestions: [
        'Is this compatible with...?',
        'What\'s the battery life?',
        'How do I set this up?',
        'What\'s included in the box?',
        'Is there a warranty?'
      ],
      trendingTopics: ['#TechTuesday', '#GadgetLover', '#NewDrop', '#MustHave']
    },
    {
      id: 'home',
      name: 'Home & Living',
      keywords: ['home', 'decor', 'kitchen', 'bedroom', 'living room', 'organization', 'storage', 'plant', 'candle'],
      commonQuestions: [
        'What are the dimensions?',
        'Is this easy to clean?',
        'Does this come assembled?',
        'What material is this?',
        'How do I care for this?'
      ],
      trendingTopics: ['#HomeDecor', '#InteriorDesign', '#HomeGoals', '#CozyVibes']
    },
    {
      id: 'food',
      name: 'Food & Beverages',
      keywords: ['snack', 'drink', 'supplement', 'vitamin', 'organic', 'natural', 'healthy', 'tasty', 'delicious'],
      commonQuestions: [
        'Is this organic?',
        'What\'s the expiration date?',
        'Is this suitable for vegetarians/vegans?',
        'How should I store this?',
        'What\'s the serving size?'
      ],
      trendingTopics: ['#Foodie', '#HealthyEats', '#SnackTime', '#TasteTest']
    },
    {
      id: 'wellness',
      name: 'Health & Wellness',
      keywords: ['wellness', 'health', 'fitness', 'yoga', 'meditation', 'self-care', 'spa', 'relax', 'energy'],
      commonQuestions: [
        'Is this safe for pregnancy?',
        'Any side effects?',
        'How often should I use this?',
        'Does this interact with medications?',
        'When will I see results?'
      ],
      trendingTopics: ['#SelfCareSunday', '#WellnessJourney', '#HealthyLifestyle', '#Mindfulness']
    }
  ],

  shipping: {
    standardDays: 5,
    expressDays: 2,
    freeThreshold: 50,
    regions: ['North America', 'Europe', 'Asia Pacific', 'Middle East', 'Australia']
  },

  paymentMethods: [
    'Credit/Debit Card',
    'PayPal',
    'Apple Pay',
    'Google Pay',
    'Bank Transfer',
    'Cash on Delivery (select regions)'
  ],

  returnPolicy: 'We offer hassle-free returns within 14 days of delivery. Items must be unused and in original packaging. Contact us to initiate a return.',

  commonHashtags: {
    general: ['#REZLife', '#ShopREZ', '#REZFinds', '#NewArrivals'],
    fashion: ['#REZFashion', '#REZStyle', '#OutfitIdeas', '#FashionForward'],
    beauty: ['#REZBeauty', '#Beauty Finds', '#GlowWithREZ', '#BeautyEssentials'],
    sale: ['#REZSale', '#LimitedTime', '#FlashSale', '#DealAlert', '#SaveNow']
  }
};

export function detectProductCategory(text: string): ProductCategory | undefined {
  const lowerText = text.toLowerCase();

  for (const category of COMMERCE_KNOWLEDGE.categories) {
    const matchCount = category.keywords.filter(keyword =>
      lowerText.includes(keyword)
    ).length;

    if (matchCount >= 2 || category.keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }

  return undefined;
}

export function getRelevantHashtags(categoryId?: string, purpose: 'general' | 'sale' = 'general'): string[] {
  const hashtags = COMMERCE_KNOWLEDGE.commonHashtags.general;

  if (categoryId) {
    const category = COMMERCE_KNOWLEDGE.categories.find(c => c.id === categoryId);
    if (category) {
      const categoryHashtags = COMMERCE_KNOWLEDGE.commonHashtags[categoryId as keyof typeof COMMERCE_KNOWLEDGE.commonHashtags] || [];
      return [...hashtags.slice(0, 2), ...categoryHashtags.slice(0, 3)];
    }
  }

  return purpose === 'sale'
    ? [...hashtags, ...COMMERCE_KNOWLEDGE.commonHashtags.sale.slice(0, 3)]
    : hashtags;
}

export function formatShippingInfo(): string {
  const { standardDays, expressDays, freeThreshold } = COMMERCE_KNOWLEDGE.shipping;
  return `Shipping: ${freeThreshold}$+ for free standard (${standardDays} days) or ${expressDays} day express available.`;
}

export function formatReturnPolicy(): string {
  return `Easy returns within 14 days - just reach out if anything's not right!`;
}
