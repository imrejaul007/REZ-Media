import { logger } from '../config/logger';

export interface StoryMention {
  id: string;
  storyId: string;
  mentionerUsername: string;
  mentionerId: string;
  taggedUsernames: string[];
  taggedProductIds: string[];
  caption?: string;
  hashtags: string[];
  imageUrl?: string;
  timestamp: Date;
  engagement?: {
    views: number;
    replies: number;
    shares: number;
  };
}

export interface StoryMentionResponse {
  mentionId: string;
  action: 'tag_product' | 'reply_story' | 'dm_followup' | 'save_lead';
  response?: string;
  quickReplies?: string[];
  productIds?: string[];
}

export class StoryMentionHandler {
  private mentions: Map<string, StoryMention> = new Map();

  parseMentionPayload(payload: {
    storyId: string;
    mentionerUsername: string;
    mentionerId: string;
    caption?: string;
    imageUrl?: string;
    timestamp: string;
  }): StoryMention {
    const mention: StoryMention = {
      id: `mention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      storyId: payload.storyId,
      mentionerUsername: payload.mentionerUsername,
      mentionerId: payload.mentionerId,
      taggedUsernames: [],
      taggedProductIds: [],
      caption: payload.caption,
      hashtags: this.extractHashtags(payload.caption || ''),
      imageUrl: payload.imageUrl,
      timestamp: new Date(payload.timestamp),
      engagement: {
        views: 0,
        replies: 0,
        shares: 0
      }
    };

    this.mentions.set(mention.id, mention);
    logger.info('Story mention captured', { mentionId: mention.id, username: mention.mentionerUsername });

    return mention;
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
  }

  getMention(mentionId: string): StoryMention | undefined {
    return this.mentions.get(mentionId);
  }

  tagProduct(mentionId: string, productId: string): boolean {
    const mention = this.mentions.get(mentionId);
    if (!mention) return false;

    if (!mention.taggedProductIds.includes(productId)) {
      mention.taggedProductIds.push(productId);
    }

    logger.debug('Product tagged in mention', { mentionId, productId });
    return true;
  }

  detectMentionIntent(mention: StoryMention): StoryMentionResponse {
    const caption = mention.caption?.toLowerCase() || '';
    const hashtags = mention.hashtags.join(' ');

    // Intent detection patterns
    const intentPatterns = {
      productInquiry: ['price', 'cost', 'buy', 'where to get', 'how much', 'shop', 'link'],
      interest: ['love', 'want', 'need', 'obsessed', 'beautiful', 'gorgeous', 'amazing'],
      question: ['how', 'what', 'when', 'where', 'is this', 'does this'],
      saleInterest: ['available', 'in stock', 'can i buy', 'order', 'purchase']
    };

    const matchedIntents: string[] = [];

    for (const [intent, keywords] of Object.entries(intentPatterns)) {
      if (keywords.some(k => caption.includes(k) || hashtags.includes(k))) {
        matchedIntents.push(intent);
      }
    }

    // Determine best response action
    if (matchedIntents.includes('productInquiry') || matchedIntents.includes('saleInterest')) {
      return {
        mentionId: mention.id,
        action: 'dm_followup',
        response: this.generateResponseForIntent('inquiry', mention),
        quickReplies: ['Tell me more', 'Send me the link', 'What sizes?']
      };
    }

    if (matchedIntents.includes('question')) {
      return {
        mentionId: mention.id,
        action: 'dm_followup',
        response: this.generateResponseForIntent('question', mention)
      };
    }

    if (matchedIntents.includes('interest')) {
      return {
        mentionId: mention.id,
        action: 'dm_followup',
        response: this.generateResponseForIntent('interest', mention),
        quickReplies: ['Want to buy?', 'Check it out!', 'More info?']
      };
    }

    // Default: save lead for follow-up
    return {
      mentionId: mention.id,
      action: 'save_lead',
      response: this.generateResponseForIntent('default', mention)
    };
  }

  private generateResponseForIntent(
    intent: 'inquiry' | 'question' | 'interest' | 'default',
    mention: StoryMention
  ): string {
    const responses = {
      inquiry: `Hey ${mention.mentionerUsername}! Saw your story 📸 You interested in that? I can DM you details!`,
      question: `Hi ${mention.mentionerUsername}! Have a question about something from your story? Let me help! 😊`,
      interest: `${mention.mentionerUsername} loves it! 🙌 Want me to share more? Just ask!`,
      default: `Thanks for the shoutout ${mention.mentionerUsername}! 💫 Let me know if you have questions!`
    };

    return responses[intent];
  }

  generateStoryReplyText(mention: StoryMention, type: 'thanks' | 'product' | 'sale'): string {
    switch (type) {
      case 'thanks':
        return `Thanks ${mention.mentionerUsername}! You're awesome! 🙌`;
      case 'product':
        return `Check out our products! Link in bio 👆`;
      case 'sale':
        return `Sale alert! 🎉 ${mention.mentionerUsername} found a deal!`;
      default:
        return `Thanks for the mention! 💫`;
    }
  }

  updateEngagement(mentionId: string, engagement: Partial<StoryMention['engagement']>): boolean {
    const mention = this.mentions.get(mentionId);
    if (!mention) return false;

    if (engagement.views !== undefined) mention.engagement!.views = engagement.views;
    if (engagement.replies !== undefined) mention.engagement!.replies = engagement.replies;
    if (engagement.shares !== undefined) mention.engagement!.shares = engagement.shares;

    return true;
  }

  getMentionsByHashtag(hashtag: string): StoryMention[] {
    const normalizedTag = hashtag.toLowerCase().startsWith('#')
      ? hashtag.toLowerCase()
      : `#${hashtag.toLowerCase()}`;

    return Array.from(this.mentions.values()).filter(m =>
      m.hashtags.includes(normalizedTag)
    );
  }

  getRecentMentions(limit: number = 20): StoryMention[] {
    return Array.from(this.mentions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getMentionStats(): {
    total: number;
    byDay: Record<string, number>;
    topMentioners: Array<{ username: string; count: number }>;
    topHashtags: Array<{ hashtag: string; count: number }>;
  } {
    const mentions = Array.from(this.mentions.values());

    // By day
    const byDay: Record<string, number> = {};
    for (const mention of mentions) {
      const day = mention.timestamp.toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }

    // Top mentioners
    const mentionerCounts: Record<string, number> = {};
    for (const mention of mentions) {
      mentionerCounts[mention.mentionerUsername] =
        (mentionerCounts[mention.mentionerUsername] || 0) + 1;
    }
    const topMentioners = Object.entries(mentionerCounts)
      .map(([username, count]) => ({ username, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top hashtags
    const hashtagCounts: Record<string, number> = {};
    for (const mention of mentions) {
      for (const tag of mention.hashtags) {
        hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
      }
    }
    const topHashtags = Object.entries(hashtagCounts)
      .map(([hashtag, count]) => ({ hashtag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: mentions.length,
      byDay,
      topMentioners,
      topHashtags
    };
  }

  // Process incoming webhook from Instagram Story mentions
  async processStoryMentionEvent(event: {
    mentioned_usernames?: string[];
    story_id?: string;
    message?: string;
    timestamp?: string;
  }): Promise<StoryMentionResponse | null> {
    if (!event.mentioned_usernames || event.mentioned_usernames.length === 0) {
      return null;
    }

    const mention = this.parseMentionPayload({
      storyId: event.story_id || `story_${Date.now()}`,
      mentionerUsername: event.mentioned_usernames[0],
      mentionerId: event.mentioned_usernames[0],
      caption: event.message,
      timestamp: event.timestamp || new Date().toISOString()
    });

    logger.info('Story mention event processed', {
      mentionId: mention.id,
      taggedUsernames: event.mentioned_usernames
    });

    return this.detectMentionIntent(mention);
  }
}

export const storyMentionHandler = new StoryMentionHandler();
