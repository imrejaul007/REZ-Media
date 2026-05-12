/**
 * Push Notification Templates
 * Pre-defined templates for all REZ Media apps
 */

import { SupportedApp } from './deviceRegistry';

export type TemplateType =
  | 'ad_notification'
  | 'achievement_unlocked'
  | 'streak_reminder'
  | 'campaign_available'
  | 'order_update'
  | 'appointment_reminder'
  | 'promo_alert'
  | 'content_available'
  | 'social_activity'
  | 'system_alert';

export interface PushTemplate {
  type: TemplateType;
  title: string;
  body: string;
  data: Record<string, string>;
  priority: 'high' | 'normal' | 'low';
  badge?: number;
  sound?: string;
}

export interface RenderedPushNotification {
  title: string;
  body: string;
  data: Record<string, string>;
  priority: 'high' | 'normal' | 'low';
  badge?: number;
  sound?: string;
}

export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

// ============================================
// APP-SPECIFIC TEMPLATES
// ============================================

const adBazaarTemplates: Record<TemplateType, PushTemplate> = {
  ad_notification: {
    type: 'ad_notification',
    title: 'New Ad Available!',
    body: 'A new ad matching your interests is available. Tap to view details.',
    data: {
      type: 'ad_notification',
      action: 'view_ad',
      screen: '/ads/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  achievement_unlocked: {
    type: 'achievement_unlocked',
    title: 'Achievement Unlocked!',
    body: 'Congratulations! You\'ve earned the "{{achievementName}}" badge!',
    data: {
      type: 'achievement',
      action: 'view_achievements',
      screen: '/profile/achievements'
    },
    priority: 'normal',
    sound: 'achievement'
  },
  streak_reminder: {
    type: 'streak_reminder',
    title: 'Keep Your Streak Alive!',
    body: 'You\'re on a {{currentStreak}} day streak! Complete an action to keep it going.',
    data: {
      type: 'streak_reminder',
      action: 'open_app',
      screen: '/home'
    },
    priority: 'normal',
    sound: 'reminder'
  },
  campaign_available: {
    type: 'campaign_available',
    title: 'New Campaign!',
    body: 'Join the "{{campaignName}}" campaign and earn rewards!',
    data: {
      type: 'campaign',
      action: 'view_campaign',
      screen: '/campaigns/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  order_update: {
    type: 'order_update',
    title: 'Order Update',
    body: 'Your order #{{orderId}} status: {{status}}',
    data: {
      type: 'order',
      action: 'view_order',
      screen: '/orders/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  appointment_reminder: {
    type: 'appointment_reminder',
    title: 'Appointment Reminder',
    body: 'Your appointment with {{vendorName}} is scheduled for {{dateTime}}.',
    data: {
      type: 'appointment',
      action: 'view_appointment',
      screen: '/appointments/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  promo_alert: {
    type: 'promo_alert',
    title: 'Special Offer!',
    body: '{{promoTitle}} - {{promoDescription}}',
    data: {
      type: 'promotion',
      action: 'view_promo',
      screen: '/promotions/details'
    },
    priority: 'high',
    sound: 'promo'
  },
  content_available: {
    type: 'content_available',
    title: 'New Content',
    body: 'Check out the latest {{contentType}}: "{{contentTitle}}"',
    data: {
      type: 'content',
      action: 'view_content',
      screen: '/content/details'
    },
    priority: 'normal',
    sound: 'default'
  },
  social_activity: {
    type: 'social_activity',
    title: '{{actorName}} {{action}}',
    body: '{{targetName}}',
    data: {
      type: 'social',
      action: 'view_activity',
      screen: '/social/feed'
    },
    priority: 'normal',
    sound: 'social'
  },
  system_alert: {
    type: 'system_alert',
    title: '{{alertTitle}}',
    body: '{{alertMessage}}',
    data: {
      type: 'system',
      action: 'view_alert',
      screen: '/alerts'
    },
    priority: 'high',
    sound: 'alert'
  }
};

const creatorsTemplates: Record<TemplateType, PushTemplate> = {
  ad_notification: {
    type: 'ad_notification',
    title: 'New Brand Collaboration!',
    body: '{{brandName}} wants to partner with you. Tap to review.',
    data: {
      type: 'collaboration',
      action: 'view_collaboration',
      screen: '/collaborations/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  achievement_unlocked: {
    type: 'achievement_unlocked',
    title: 'Milestone Reached!',
    body: 'You\'ve hit {{followerCount}} followers! Keep creating!',
    data: {
      type: 'milestone',
      action: 'view_insights',
      screen: '/insights'
    },
    priority: 'normal',
    sound: 'achievement'
  },
  streak_reminder: {
    type: 'streak_reminder',
    title: 'Content Streak at Risk!',
    body: 'Post today to maintain your {{currentStreak}} day streak!',
    data: {
      type: 'content_streak',
      action: 'create_content',
      screen: '/create'
    },
    priority: 'normal',
    sound: 'reminder'
  },
  campaign_available: {
    type: 'campaign_available',
    title: 'Campaign Match Found!',
    body: 'A campaign for {{category}} matches your profile. View details?',
    data: {
      type: 'campaign_match',
      action: 'view_campaign',
      screen: '/campaigns/discover'
    },
    priority: 'high',
    sound: 'notification'
  },
  order_update: {
    type: 'order_update',
    title: 'Payout Processed!',
    body: '{{amount}} has been added to your wallet.',
    data: {
      type: 'payout',
      action: 'view_wallet',
      screen: '/wallet'
    },
    priority: 'high',
    sound: 'notification'
  },
  appointment_reminder: {
    type: 'appointment_reminder',
    title: 'Upcoming Live Session',
    body: 'Your live session with {{brandName}} starts in {{timeUntil}}.',
    data: {
      type: 'live_session',
      action: 'join_session',
      screen: '/live/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  promo_alert: {
    type: 'promo_alert',
    title: 'Featured Creator!',
    body: 'You\'ve been featured on the Explore page!',
    data: {
      type: 'feature',
      action: 'view_feature',
      screen: '/explore/featured'
    },
    priority: 'high',
    sound: 'promo'
  },
  content_available: {
    type: 'content_available',
    title: 'Content Performing Well!',
    body: 'Your post "{{contentTitle}}" is going viral with {{viewCount}} views!',
    data: {
      type: 'performance',
      action: 'view_analytics',
      screen: '/analytics/post'
    },
    priority: 'normal',
    sound: 'default'
  },
  social_activity: {
    type: 'social_activity',
    title: 'New Engagement',
    body: 'You have {{likeCount}} likes and {{commentCount}} comments.',
    data: {
      type: 'engagement',
      action: 'view_notifications',
      screen: '/notifications'
    },
    priority: 'normal',
    sound: 'social'
  },
  system_alert: {
    type: 'system_alert',
    title: 'Policy Update',
    body: 'Creator guidelines have been updated. Review now.',
    data: {
      type: 'policy',
      action: 'view_policy',
      screen: '/settings/policy'
    },
    priority: 'high',
    sound: 'alert'
  }
};

const hotelOtaTemplates: Record<TemplateType, PushTemplate> = {
  ad_notification: {
    type: 'ad_notification',
    title: 'Last Minute Deal!',
    body: '{{propertyName}} - {{discount}}% off for tonight only!',
    data: {
      type: 'deal',
      action: 'view_deal',
      screen: '/deals/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  achievement_unlocked: {
    type: 'achievement_unlocked',
    title: 'Traveler Badge Earned!',
    body: 'You\'ve completed {{stayCount}} stays. Level {{level}} reached!',
    data: {
      type: 'badge',
      action: 'view_badges',
      screen: '/profile/badges'
    },
    priority: 'normal',
    sound: 'achievement'
  },
  streak_reminder: {
    type: 'streak_reminder',
    title: 'Plan Your Next Adventure!',
    body: 'You haven\'t traveled in {{daysSinceLastTrip}} days. Explore new destinations!',
    data: {
      type: 'travel_reminder',
      action: 'explore',
      screen: '/explore'
    },
    priority: 'normal',
    sound: 'reminder'
  },
  campaign_available: {
    type: 'campaign_available',
    title: 'Loyalty Reward Available!',
    body: 'You\'ve earned {{points}} points. Redeem for free nights!',
    data: {
      type: 'loyalty',
      action: 'view_rewards',
      screen: '/rewards'
    },
    priority: 'high',
    sound: 'notification'
  },
  order_update: {
    type: 'order_update',
    title: 'Booking Confirmed!',
    body: 'Your stay at {{propertyName}} from {{checkIn}} to {{checkOut}} is confirmed.',
    data: {
      type: 'booking',
      action: 'view_booking',
      screen: '/bookings/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  appointment_reminder: {
    type: 'appointment_reminder',
    title: 'Check-in Reminder',
    body: 'Your check-in at {{propertyName}} is tomorrow. Review your booking.',
    data: {
      type: 'checkin_reminder',
      action: 'view_booking',
      screen: '/bookings/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  promo_alert: {
    type: 'promo_alert',
    title: 'Member Exclusive Deal!',
    body: 'Get {{discount}}% off on your next booking with code {{code}}.',
    data: {
      type: 'member_deal',
      action: 'view_promo',
      screen: '/promos/details'
    },
    priority: 'high',
    sound: 'promo'
  },
  content_available: {
    type: 'content_available',
    title: 'Trending Destination',
    body: '{{destination}} is trending! See why travelers love it.',
    data: {
      type: 'trending',
      action: 'view_destination',
      screen: '/destinations/details'
    },
    priority: 'normal',
    sound: 'default'
  },
  social_activity: {
    type: 'social_activity',
    title: 'Travel Inspiration',
    body: '{{friendName}} just booked {{propertyName}}. Want to join?',
    data: {
      type: 'social_booking',
      action: 'view_property',
      screen: '/properties/details'
    },
    priority: 'normal',
    sound: 'social'
  },
  system_alert: {
    type: 'system_alert',
    title: 'Price Drop Alert!',
    body: '{{propertyName}} price dropped by {{amount}}! Book now.',
    data: {
      type: 'price_drop',
      action: 'view_property',
      screen: '/properties/details'
    },
    priority: 'high',
    sound: 'alert'
  }
};

const rendezTemplates: Record<TemplateType, PushTemplate> = {
  ad_notification: {
    type: 'ad_notification',
    title: 'Event Near You!',
    body: '{{eventName}} happening {{date}}. {{distance}} away. Interested?',
    data: {
      type: 'event',
      action: 'view_event',
      screen: '/events/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  achievement_unlocked: {
    type: 'achievement_unlocked',
    title: 'Explorer Badge!',
    body: 'You\'ve attended {{eventCount}} events. Keep exploring!',
    data: {
      type: 'explorer',
      action: 'view_profile',
      screen: '/profile/badges'
    },
    priority: 'normal',
    sound: 'achievement'
  },
  streak_reminder: {
    type: 'streak_reminder',
    title: 'New Events This Week!',
    body: 'Don\'t miss {{eventCount}} events matching your interests.',
    data: {
      type: 'event_reminder',
      action: 'explore_events',
      screen: '/events'
    },
    priority: 'normal',
    sound: 'reminder'
  },
  campaign_available: {
    type: 'campaign_available',
    title: 'VIP Access!',
    body: 'You\'ve been invited to {{campaignName}}. Limited spots!',
    data: {
      type: 'vip_access',
      action: 'view_campaign',
      screen: '/campaigns/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  order_update: {
    type: 'order_update',
    title: 'Ticket Confirmed!',
    body: 'Your {{ticketType}} ticket for {{eventName}} is ready.',
    data: {
      type: 'ticket',
      action: 'view_ticket',
      screen: '/tickets/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  appointment_reminder: {
    type: 'appointment_reminder',
    title: 'Event Starting Soon!',
    body: '{{eventName}} starts in {{timeUntil}}. Don\'t be late!',
    data: {
      type: 'event_start',
      action: 'view_event',
      screen: '/events/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  promo_alert: {
    type: 'promo_alert',
    title: 'Early Bird Offer!',
    body: '{{discount}}% off for {{eventName}}. Expires {{expiresAt}}.',
    data: {
      type: 'early_bird',
      action: 'purchase',
      screen: '/tickets/purchase'
    },
    priority: 'high',
    sound: 'promo'
  },
  content_available: {
    type: 'content_available',
    title: 'New Event Posted!',
    body: '{{hostName}} just announced {{eventName}}.',
    data: {
      type: 'new_event',
      action: 'view_event',
      screen: '/events/details'
    },
    priority: 'normal',
    sound: 'default'
  },
  social_activity: {
    type: 'social_activity',
    title: 'Friend Attending!',
    body: '{{friendName}} is going to {{eventName}}. Join them!',
    data: {
      type: 'friend_attending',
      action: 'view_event',
      screen: '/events/details'
    },
    priority: 'normal',
    sound: 'social'
  },
  system_alert: {
    type: 'system_alert',
    title: 'Event Cancelled',
    body: '{{eventName}} has been cancelled. Refund processing.',
    data: {
      type: 'cancellation',
      action: 'view_events',
      screen: '/events'
    },
    priority: 'high',
    sound: 'alert'
  }
};

const foodDeliveryTemplates: Record<TemplateType, PushTemplate> = {
  ad_notification: {
    type: 'ad_notification',
    title: 'New Restaurant!',
    body: '{{restaurantName}} just joined! Get {{discount}}% off first order.',
    data: {
      type: 'new_restaurant',
      action: 'view_restaurant',
      screen: '/restaurants/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  achievement_unlocked: {
    type: 'achievement_unlocked',
    title: 'Foodie Badge!',
    body: 'You\'ve ordered {{orderCount}} times. Level {{level}} foodie!',
    data: {
      type: 'foodie_badge',
      action: 'view_badges',
      screen: '/profile/badges'
    },
    priority: 'normal',
    sound: 'achievement'
  },
  streak_reminder: {
    type: 'streak_reminder',
    title: 'Hungry?',
    body: 'Your favorite {{cuisineType}} is calling. Order now!',
    data: {
      type: 'hunger_reminder',
      action: 'order',
      screen: '/order'
    },
    priority: 'normal',
    sound: 'reminder'
  },
  campaign_available: {
    type: 'campaign_available',
    title: 'Free Delivery!',
    body: 'No delivery fee on orders over {{minAmount}} today only!',
    data: {
      type: 'free_delivery',
      action: 'order',
      screen: '/order'
    },
    priority: 'high',
    sound: 'notification'
  },
  order_update: {
    type: 'order_update',
    title: 'Order Update',
    body: 'Order #{{orderId}}: {{status}}. {{message}}',
    data: {
      type: 'order_status',
      action: 'track_order',
      screen: '/orders/track'
    },
    priority: 'high',
    sound: 'notification'
  },
  appointment_reminder: {
    type: 'appointment_reminder',
    title: 'Order Arriving!',
    body: 'Your order will arrive in {{eta}} minutes. Track live!',
    data: {
      type: 'delivery_update',
      action: 'track_order',
      screen: '/orders/track'
    },
    priority: 'high',
    sound: 'notification'
  },
  promo_alert: {
    type: 'promo_alert',
    title: '{{restaurantName}} Special!',
    body: '{{dealDescription}}. Use code {{code}} to save!',
    data: {
      type: 'restaurant_deal',
      action: 'order',
      screen: '/order'
    },
    priority: 'high',
    sound: 'promo'
  },
  content_available: {
    type: 'content_available',
    title: 'New on Menu!',
    body: '{{restaurantName}} added {{itemName}} to their menu.',
    data: {
      type: 'menu_update',
      action: 'view_menu',
      screen: '/restaurants/menu'
    },
    priority: 'normal',
    sound: 'default'
  },
  social_activity: {
    type: 'social_activity',
    title: 'Friend Ordered!',
    body: '{{friendName}} ordered from {{restaurantName}}. Want to try?',
    data: {
      type: 'social_order',
      action: 'view_restaurant',
      screen: '/restaurants/details'
    },
    priority: 'normal',
    sound: 'social'
  },
  system_alert: {
    type: 'system_alert',
    title: 'Review Reminder',
    body: 'How was your order from {{restaurantName}}? Rate now!',
    data: {
      type: 'review_request',
      action: 'write_review',
      screen: '/reviews/write'
    },
    priority: 'normal',
    sound: 'default'
  }
};

const doohMobileTemplates: Record<TemplateType, PushTemplate> = {
  ad_notification: {
    type: 'ad_notification',
    title: 'Campaign Live!',
    body: 'Your campaign "{{campaignName}}" is now running on {{screenCount}} screens.',
    data: {
      type: 'campaign_live',
      action: 'view_campaign',
      screen: '/campaigns/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  achievement_unlocked: {
    type: 'achievement_unlocked',
    title: 'Campaign Milestone!',
    body: 'Your campaign reached {{impressionCount}} impressions!',
    data: {
      type: 'milestone',
      action: 'view_analytics',
      screen: '/analytics/campaign'
    },
    priority: 'normal',
    sound: 'achievement'
  },
  streak_reminder: {
    type: 'streak_reminder',
    title: 'Campaign Expiring Soon',
    body: '{{campaignName}} ends in {{daysLeft}} days. Extend or review stats.',
    data: {
      type: 'campaign_expiry',
      action: 'view_campaign',
      screen: '/campaigns/details'
    },
    priority: 'normal',
    sound: 'reminder'
  },
  campaign_available: {
    type: 'campaign_available',
    title: 'Screen Available!',
    body: 'New screen inventory available in {{location}}. Book now!',
    data: {
      type: 'inventory_available',
      action: 'view_inventory',
      screen: '/inventory'
    },
    priority: 'high',
    sound: 'notification'
  },
  order_update: {
    type: 'order_update',
    title: 'Booking Confirmed',
    body: 'Your screen booking at {{location}} for {{date}} is confirmed.',
    data: {
      type: 'booking',
      action: 'view_booking',
      screen: '/bookings/details'
    },
    priority: 'high',
    sound: 'notification'
  },
  appointment_reminder: {
    type: 'appointment_reminder',
    title: 'Creative Review Needed',
    body: 'New creative uploaded for {{campaignName}}. Approve or request changes.',
    data: {
      type: 'creative_review',
      action: 'review_creative',
      screen: '/creatives/review'
    },
    priority: 'high',
    sound: 'notification'
  },
  promo_alert: {
    type: 'promo_alert',
    title: 'Volume Discount!',
    body: 'Book {{screenCount}}+ screens and save {{discount}}%. Limited time!',
    data: {
      type: 'volume_discount',
      action: 'view_deals',
      screen: '/deals'
    },
    priority: 'high',
    sound: 'promo'
  },
  content_available: {
    type: 'content_available',
    title: 'Analytics Report Ready',
    body: 'Your {{reportType}} report for {{campaignName}} is ready to view.',
    data: {
      type: 'report_ready',
      action: 'view_report',
      screen: '/reports/details'
    },
    priority: 'normal',
    sound: 'default'
  },
  social_activity: {
    type: 'social_activity',
    title: 'Campaign Shared',
    body: '{{userName}} shared your campaign "{{campaignName}}".',
    data: {
      type: 'share',
      action: 'view_campaign',
      screen: '/campaigns/details'
    },
    priority: 'normal',
    sound: 'social'
  },
  system_alert: {
    type: 'system_alert',
    title: 'Creative Rejected',
    body: 'Your creative for {{campaignName}} was rejected. View reasons.',
    data: {
      type: 'creative_rejection',
      action: 'view_creative',
      screen: '/creatives/details'
    },
    priority: 'high',
    sound: 'alert'
  }
};

// ============================================
// TEMPLATE REGISTRY
// ============================================

const appTemplates: Record<SupportedApp, Record<TemplateType, PushTemplate>> = {
  'adBazaar': adBazaarTemplates,
  'creators': creatorsTemplates,
  'dooh-mobile': doohMobileTemplates,
  'hotel-ota': hotelOtaTemplates,
  'rendez': rendezTemplates,
  'food-delivery': foodDeliveryTemplates
};

/**
 * Get template for an app
 */
export function getTemplate(appId: SupportedApp, type: TemplateType): PushTemplate | null {
  const appTemplateSet = appTemplates[appId];
  if (!appTemplateSet) {
    return null;
  }
  return appTemplateSet[type] || null;
}

/**
 * Get all templates for an app
 */
export function getTemplatesForApp(appId: SupportedApp): Record<TemplateType, PushTemplate> {
  return appTemplates[appId] || {};
}

/**
 * Render a template with variables
 */
export function renderTemplate(
  appId: SupportedApp,
  type: TemplateType,
  variables: TemplateVariables
): RenderedPushNotification | null {
  const template = getTemplate(appId, type);
  if (!template) {
    return null;
  }

  return {
    title: interpolate(template.title, variables),
    body: interpolate(template.body, variables),
    data: template.data,
    priority: template.priority,
    badge: template.badge,
    sound: template.sound
  };
}

/**
 * Interpolate variables into template strings
 */
function interpolate(text: string, variables: TemplateVariables): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined) {
      return match; // Keep placeholder if variable not provided
    }
    return String(value);
  });
}

/**
 * Get all supported template types
 */
export function getSupportedTemplateTypes(): TemplateType[] {
  return [
    'ad_notification',
    'achievement_unlocked',
    'streak_reminder',
    'campaign_available',
    'order_update',
    'appointment_reminder',
    'promo_alert',
    'content_available',
    'social_activity',
    'system_alert'
  ];
}

/**
 * Get template metadata
 */
export function getTemplateMetadata(appId: SupportedApp, type: TemplateType): {
  appId: SupportedApp;
  type: TemplateType;
  title: string;
  body: string;
  variables: string[];
} | null {
  const template = getTemplate(appId, type);
  if (!template) {
    return null;
  }

  // Extract variable names from title and body
  const allText = template.title + ' ' + template.body;
  const variables = [...new Set(allText.match(/\{\{(\w+)\}\}/g) || [])]
    .map(v => v.replace(/\{\{|\}\}/g, ''));

  return {
    appId,
    type,
    title: template.title,
    body: template.body,
    variables
  };
}

/**
 * Validate that all required variables are provided
 */
export function validateTemplateVariables(
  appId: SupportedApp,
  type: TemplateType,
  variables: TemplateVariables
): { valid: boolean; missingVariables: string[] } {
  const metadata = getTemplateMetadata(appId, type);
  if (!metadata) {
    return { valid: false, missingVariables: [] };
  }

  const missing = metadata.variables.filter(v => variables[v] === undefined);
  return {
    valid: missing.length === 0,
    missingVariables: missing
  };
}

/**
 * PushTemplateEngine class for advanced template operations
 */
export class PushTemplateEngine {
  /**
   * Render multiple notifications from a single request
   */
  renderBatch(
    appId: SupportedApp,
    type: TemplateType,
    items: TemplateVariables[]
  ): RenderedPushNotification[] {
    return items
      .map(variables => renderTemplate(appId, type, variables))
      .filter((n): n is RenderedPushNotification => n !== null);
  }

  /**
   * Get templates grouped by app
   */
  getTemplatesByApp(): Record<SupportedApp, TemplateType[]> {
    const result: Partial<Record<SupportedApp, TemplateType[]>> = {};

    for (const appId of Object.keys(appTemplates) as SupportedApp[]) {
      result[appId] = Object.keys(appTemplates[appId]) as TemplateType[];
    }

    return result as Record<SupportedApp, TemplateType[]>;
  }

  /**
   * List all available templates
   */
  listAllTemplates(): Array<{ appId: SupportedApp; type: TemplateType; template: PushTemplate }> {
    const templates: Array<{ appId: SupportedApp; type: TemplateType; template: PushTemplate }> = [];

    for (const appId of Object.keys(appTemplates) as SupportedApp[]) {
      for (const type of Object.keys(appTemplates[appId]) as TemplateType[]) {
        templates.push({
          appId,
          type,
          template: appTemplates[appId][type]
        });
      }
    }

    return templates;
  }
}

// Export singleton instance
export const pushTemplateEngine = new PushTemplateEngine();
