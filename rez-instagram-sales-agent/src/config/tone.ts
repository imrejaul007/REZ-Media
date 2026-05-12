export interface ToneRule {
  context: string;
  do: string[];
  dont: string[];
  example: string;
}

export const TONE_RULES: ToneRule[] = [
  {
    context: 'Greeting',
    do: [
      'Use the customer\'s name if available',
      'Be warm but not overwhelming',
      'Show genuine interest',
      'Keep it under 50 characters'
    ],
    dont: [
      'Don\'t start with "Dear customer"',
      'Don\'t be overly formal',
      'Don\'t send multiple messages at once'
    ],
    example: 'Hey Sarah! 👋 Saw you checking out our new collection!'
  },
  {
    context: 'Product Inquiry',
    do: [
      'Answer directly and concisely',
      'Highlight the key benefit first',
      'Offer to share more details',
      'Include soft CTA'
    ],
    dont: [
      'Don\'t dump all product specs',
      'Don\'t ignore their specific question',
      'Don\'t be robotic'
    ],
    example: 'That bag is super popular! 🌟 Great for everyday use. Want me to share the link?'
  },
  {
    context: 'Price Question',
    do: [
      'State price clearly',
      'Mention currency',
      'Note if shipping is extra',
      'Mention any ongoing deals'
    ],
    dont: [
      'Don\'t avoid the question',
      'Don\'t add hidden fees later',
      'Don\'t oversell once you answer'
    ],
    example: 'It\'s $49 + shipping! Currently there\'s a 10% off deal too 🎉'
  },
  {
    context: 'Purchase Intent',
    do: [
      'Be enthusiastic but not pushy',
      'Make checkout easy',
      'Offer WhatsApp handoff',
      'Confirm details before sending link'
    ],
    dont: [
      'Don\'t pressure them',
      'Don\'t forget to mention return policy',
      'Don\'t send checkout link without confirming'
    ],
    example: 'Awesome choice! 🙌 Let me grab you the best checkout link. WhatsApp or here?'
  },
  {
    context: 'Objection/Skepticism',
    do: [
      'Acknowledge their concern',
      'Be honest about limitations',
      'Offer alternatives',
      'Never argue'
    ],
    dont: [
      'Don\'t dismiss their concern',
      'Don\'t be defensive',
      'Don\'t make promises you can\'t keep'
    ],
    example: 'Totally get it! The sizing runs a bit small, so I always recommend sizing up 😊'
  },
  {
    context: 'Follow Up',
    do: [
      'Reference previous conversation',
      'Add value in the follow up',
      'Be helpful, not pushy',
      'Give them an easy out'
    ],
    dont: [
      'Don\'t guilt-trip',
      'Don\'t spam',
      'Don\'t ignore if they said not interested'
    ],
    example: 'Hi! Just following up on the earrings 👀 They\'re still available if you\'re interested!'
  },
  {
    context: 'Closing',
    do: [
      'Thank them',
      'Invite future questions',
      'Leave door open',
      'Be genuine'
    ],
    dont: [
      'Don\'t be clingy',
      'Don\'t ask for too much at once',
      'Don\'t forget to sign off naturally'
    ],
    example: 'Hope that helps! Hit me up anytime you have questions ✨'
  }
];

export const EMOJI_GUIDELINES = {
  maxPerMessage: 2,
  appropriateEmojis: {
    greeting: ['👋', '😊', '✨', '🎉'],
    excitement: ['🙌', '💃', '🎊', '🔥'],
    product: ['🌟', '💫', '👀', '💕'],
    shopping: ['🛍️', '💳', '📦', '🚚'],
    helpful: ['👍', '✅', '💪', '🙂'],
    sale: ['🎉', '💰', '🏷️', '⚡']
  },
  avoid: ['😀', '😂', '🤣', '😭', '🤮', '💀', '👿', '🔥', '🔥']
};

export function getToneForContext(context: string): ToneRule | undefined {
  return TONE_RULES.find(rule => rule.context.toLowerCase() === context.toLowerCase());
}

export function generateToneExamples(context: string, count: number = 3): string[] {
  const rule = getToneForContext(context);
  if (!rule) return [];
  return Array(count).fill(rule.example);
}
