import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export type ChannelContext = 'dm' | 'comment' | 'story' | 'mention';

export interface ChannelTone {
  context: ChannelContext;
  style: 'casual' | 'friendly' | 'professional';
  maxLength: number;
  useEmoji: boolean;
  useGifs: boolean;
  greeting?: string;
}

const tonePresets: Record<ChannelContext, ChannelTone> = {
  dm: {
    context: 'dm',
    style: 'friendly',
    maxLength: 2000,
    useEmoji: true,
    useGifs: true,
    greeting: 'Hey there!',
  },
  comment: {
    context: 'comment',
    style: 'casual',
    maxLength: 500,
    useEmoji: true,
    useGifs: false,
    greeting: undefined,
  },
  story: {
    context: 'story',
    style: 'casual',
    maxLength: 150,
    useEmoji: true,
    useGifs: false,
    greeting: undefined,
  },
  mention: {
    context: 'mention',
    style: 'friendly',
    maxLength: 300,
    useEmoji: true,
    useGifs: true,
    greeting: 'Thanks for the mention!',
  },
};

class InstagramTone {
  private readonly emojiMap: Record<string, string> = {
    thanks: '🙏',
    happy: '😊',
    sad: '😢',
    excited: '🎉',
    love: '❤️',
    ok: '👌',
    think: '🤔',
    sorry: '😔',
    wave: '👋',
    star: '⭐',
    fire: '🔥',
    rocket: '🚀',
    eyes: '👀',
    check: '✅',
    alert: '⚠️',
    info: '💡',
  };

  /**
   * Get tone configuration for a channel context
   */
  getTone(context: ChannelContext): ChannelTone {
    return tonePresets[context];
  }

  /**
   * Format a message for Instagram channel
   */
  formatMessage(message: string, context: ChannelContext | ChannelTone): string {
    const tone = typeof context === 'string' ? this.getTone(context) : context;

    let formatted = message.trim();

    // Truncate if exceeds max length
    if (formatted.length > tone.maxLength) {
      formatted = formatted.substring(0, tone.maxLength - 3) + '...';
    }

    // Add greeting for DMs if message doesn't start with one
    if (context === 'dm' && tone.greeting && !this.startsWithGreeting(formatted)) {
      formatted = `${tone.greeting} ${formatted}`;
    }

    // Replace text emoji codes with actual emojis
    formatted = this.replaceEmojiCodes(formatted);

    return formatted;
  }

  /**
   * Generate a greeting message
   */
  generateGreeting(context: ChannelContext, username?: string): string {
    const tone = this.getTone(context);
    const name = username ? ` @${username}` : '';

    const greetings: Record<ChannelContext, string[]> = {
      dm: [
        `Hey${name}! 👋`,
        `Hi${name}! 😊`,
        `Hello${name}! Great to hear from you!`,
        `Hey${name}! What's up?`,
      ],
      comment: [
        'Hey! 👋',
        'Thanks for commenting!',
        'Appreciate it! 😊',
      ],
      story: [
        'Thanks for watching!',
        'Appreciate the view! 👀',
      ],
      mention: [
        'Thanks for the mention! 🙏',
        'Hey! Thanks for tagging us! 😊',
      ],
    };

    const options = greetings[context];
    return this.formatMessage(options[Math.floor(Math.random() * options.length)], context);
  }

  /**
   * Generate a closing message
   */
  generateClosing(context: ChannelContext): string {
    const closings: Record<ChannelContext, string[]> = {
      dm: [
        'Have a great day! 🌟',
        'Talk soon! 💬',
        'Take care! 😊',
        'See you around! 👋',
      ],
      comment: [
        '💬',
        '❤️',
        '🙏',
      ],
      story: [
        '👋',
        '❤️',
      ],
      mention: [
        '👋',
        '❤️',
      ],
    };

    const options = closings[context];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Add emoji to message
   */
  addEmoji(message: string, emojiType: keyof typeof this.emojiMap): string {
    const emoji = this.emojiMap[emojiType] || '😊';
    return `${message} ${emoji}`;
  }

  /**
   * Replace text emoji codes with actual emojis
   */
  private replaceEmojiCodes(message: string): string {
    let formatted = message;

    for (const [code, emoji] of Object.entries(this.emojiMap)) {
      const regex = new RegExp(`:${code}:`, 'gi');
      formatted = formatted.replace(regex, emoji);
    }

    return formatted;
  }

  /**
   * Check if message starts with a greeting
   */
  private startsWithGreeting(message: string): boolean {
    const greetingWords = ['hey', 'hi', 'hello', 'yo', 'sup', "what's", 'howdy'];
    const firstWord = message.toLowerCase().split(/\s+/)[0];

    return greetingWords.some((g) => firstWord.startsWith(g));
  }

  /**
   * Adjust tone based on sentiment
   */
  adjustForSentiment(message: string, sentiment: 'positive' | 'neutral' | 'negative', context: ChannelContext): string {
    if (sentiment === 'negative') {
      // More empathetic tone
      const empathyPrefixes = [
        "I'm sorry to hear that. ",
        "I understand this is frustrating. ",
        "Let me help you with this. ",
      ];
      const prefix = empathyPrefixes[Math.floor(Math.random() * empathyPrefixes.length)];
      return this.formatMessage(prefix + message, context);
    }

    return this.formatMessage(message, context);
  }

  /**
   * Generate quick reply options
   */
  generateQuickReplies(
    options: string[],
    context: ChannelContext
  ): { title: string; payload: string }[] {
    return options.map((option) => ({
      title: this.formatMessage(option, context).substring(0, 20),
      payload: `QR_${option.toUpperCase().replace(/\s+/g, '_')}`,
    }));
  }
}

export const instagramTone = new InstagramTone();
