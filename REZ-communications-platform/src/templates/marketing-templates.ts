/**
 * Marketing Campaign Templates for REZ Communications Platform
 *
 * These templates are used for marketing campaigns across all REZ-Media apps.
 * Each template defines:
 * - name: Human-readable name
 * - description: What the campaign is for
 * - channels: Supported delivery channels
 * - title: Default push/notification title
 * - body: Message body (supports Handlebars variables)
 * - emailSubject: Email subject line (if applicable)
 * - emailHtml: Full HTML email content (if applicable)
 * - variables: Required/optional template variables
 */

export interface MarketingTemplate {
  name: string;
  description: string;
  channels: ('email' | 'sms' | 'whatsapp' | 'push')[];
  title: string;
  body: string;
  emailSubject?: string;
  emailHtml?: string;
  variables: {
    required: string[];
    optional: string[];
  };
  metadata?: {
    category: string;
    tags: string[];
    priority: 'high' | 'normal' | 'low';
    cooldownHours?: number;
  };
}

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

export const MARKETING_TEMPLATES: Record<string, MarketingTemplate> = {
  // ==========================================================================
  // ADVERTISING TEMPLATES
  // ==========================================================================

  ad_approved: {
    name: 'Ad Approved',
    description: 'Notifies advertisers when their ad has been approved',
    channels: ['email', 'push'],
    title: 'Your Ad is Live!',
    body: 'Great news! Your ad "{{adTitle}}" has been approved and is now live. Start reaching customers today!',
    emailSubject: 'Your Ad "{{adTitle}}" is Now Live!',
    emailHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4CAF50;">Congratulations!</h1>
        <p>Your ad <strong>"{{adTitle}}"</strong> has been approved and is now live.</p>
        <p>Here's a summary of your campaign:</p>
        <ul>
          <li><strong>Budget:</strong> {{budget}}</li>
          <li><strong>Target:</strong> {{targetAudience}}</li>
          <li><strong>Start Date:</strong> {{startDate}}</li>
        </ul>
        <p>Monitor your ad performance in your REZ dashboard.</p>
        <a href="{{dashboardUrl}}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">View Dashboard</a>
      </div>
    `,
    variables: {
      required: ['adTitle'],
      optional: ['budget', 'targetAudience', 'startDate', 'dashboardUrl'],
    },
    metadata: {
      category: 'advertising',
      tags: ['ad', 'approval', 'live'],
      priority: 'high',
      cooldownHours: 24,
    },
  },

  ad_rejected: {
    name: 'Ad Rejected',
    description: 'Notifies advertisers when their ad has been rejected with reason',
    channels: ['email', 'push'],
    title: 'Ad Update Required',
    body: 'Your ad "{{adTitle}}" was not approved. Reason: {{rejectionReason}}. Please review and resubmit.',
    emailSubject: 'Action Required: Your Ad "{{adTitle}}" Needs Review',
    emailHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #FF9800;">Action Required</h1>
        <p>Your ad <strong>"{{adTitle}}"</strong> was not approved.</p>
        <div style="background-color: #FFF3E0; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <strong>Rejection Reason:</strong><br>
          {{rejectionReason}}
        </div>
        <p>To get your ad approved:</p>
        <ol>
          <li>Review the rejection reason above</li>
          <li>Make necessary changes to your ad</li>
          <li>Resubmit for review</li>
        </ol>
        <a href="{{editAdUrl}}" style="display: inline-block; padding: 12px 24px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 4px;">Edit Ad</a>
      </div>
    `,
    variables: {
      required: ['adTitle', 'rejectionReason'],
      optional: ['editAdUrl', 'policyUrl'],
    },
    metadata: {
      category: 'advertising',
      tags: ['ad', 'rejection', 'action-required'],
      priority: 'high',
    },
  },

  ad_spend_milestone: {
    name: 'Ad Spend Milestone',
    description: 'Notifies advertisers when they reach spending milestones',
    channels: ['push', 'email'],
    title: 'Ad Spend Alert',
    body: 'Your ad "{{adTitle}}" has reached {{percent}}% of its {{budget}} budget.',
    emailSubject: 'Budget Alert: {{adTitle}} - {{percent}}% Reached',
    variables: {
      required: ['adTitle', 'percent', 'budget'],
      optional: ['remainingAmount', 'daysRemaining'],
    },
    metadata: {
      category: 'advertising',
      tags: ['ad', 'budget', 'spend', 'alert'],
      priority: 'normal',
    },
  },

  // ==========================================================================
  // GAMIFICATION TEMPLATES
  // ==========================================================================

  achievement_unlocked: {
    name: 'Achievement Unlocked',
    description: 'Celebrates when users earn achievements or badges',
    channels: ['push', 'email'],
    title: 'Achievement Unlocked!',
    body: 'You earned the "{{achievementName}}" badge! Keep crushing it!',
    emailSubject: 'You Unlocked: {{achievementName}}!',
    emailHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
        <h1 style="color: #FFD700;">Achievement Unlocked!</h1>
        <div style="font-size: 64px; margin: 24px 0;">{{achievementIcon}}</div>
        <h2 style="color: #333;">{{achievementName}}</h2>
        <p>{{achievementDescription}}</p>
        <p style="color: #666;">You've earned {{points}} bonus points!</p>
        <p>Keep going to unlock more achievements!</p>
      </div>
    `,
    variables: {
      required: ['achievementName'],
      optional: ['achievementIcon', 'achievementDescription', 'points', 'badgeImageUrl'],
    },
    metadata: {
      category: 'gamification',
      tags: ['achievement', 'badge', 'gamification', 'celebration'],
      priority: 'high',
      cooldownHours: 1,
    },
  },

  streak_milestone: {
    name: 'Streak Milestone',
    description: 'Celebrates streak milestones (7 days, 30 days, etc.)',
    channels: ['push'],
    title: 'Streak Milestone!',
    body: 'You have maintained a {{streakDays}} day streak! Keep the fire burning!',
    variables: {
      required: ['streakDays'],
      optional: ['rewardPoints', 'nextMilestone'],
    },
    metadata: {
      category: 'gamification',
      tags: ['streak', 'milestone', 'engagement'],
      priority: 'normal',
    },
  },

  challenge_completed: {
    name: 'Challenge Completed',
    description: 'Notifies users when they complete a challenge',
    channels: ['push', 'email'],
    title: 'Challenge Complete!',
    body: 'You completed the "{{challengeName}}" challenge! You won {{reward}}!',
    emailSubject: 'Challenge Complete: {{challengeName}}!',
    variables: {
      required: ['challengeName', 'reward'],
      optional: ['leaderboardPosition', 'nextChallengeUrl'],
    },
    metadata: {
      category: 'gamification',
      tags: ['challenge', 'completed', 'reward'],
      priority: 'high',
      cooldownHours: 4,
    },
  },

  leaderboard_update: {
    name: 'Leaderboard Update',
    description: 'Notifies users about their leaderboard ranking changes',
    channels: ['push'],
    title: 'Leaderboard Update',
    body: 'You are now ranked #{{rank}}! {{movedUp}} positions from last week.',
    variables: {
      required: ['rank'],
      optional: ['movedUp', 'pointsToNextRank', 'topThreePreview'],
    },
    metadata: {
      category: 'gamification',
      tags: ['leaderboard', 'ranking', 'competition'],
      priority: 'normal',
    },
  },

  points_expiring: {
    name: 'Points Expiring',
    description: 'Warns users about expiring reward points',
    channels: ['push', 'email'],
    title: 'Points Expiring Soon',
    body: 'You have {{points}} points expiring in {{days}} days. Use them before they are gone!',
    emailSubject: 'Your {{points}} Points Expire in {{days}} Days!',
    variables: {
      required: ['points', 'days'],
      optional: ['expirationDate', 'redeemUrl', 'recommendedRewards'],
    },
    metadata: {
      category: 'gamification',
      tags: ['points', 'expiration', 'retention', 'urgent'],
      priority: 'high',
      cooldownHours: 168, // 1 week
    },
  },

  // ==========================================================================
  // MARKETING TEMPLATES
  // ==========================================================================

  abandonment_recovery: {
    name: 'Abandonment Recovery',
    description: 'Recovers abandoned carts or incomplete actions',
    channels: ['email', 'sms', 'whatsapp'],
    title: 'Complete Your Order',
    body: 'You left items in your cart! Complete your purchase now and get {{discount}}% off.',
    emailSubject: 'Forgot Something? Complete Your Order and Save {{discount}}%!',
    emailHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #E91E63;">You left something behind!</h1>
        <p>Hi {{userName}},</p>
        <p>You left these items in your cart:</p>
        <div style="border: 1px solid #ddd; padding: 16px; border-radius: 8px; margin: 16px 0;">
          {{cartItems}}
        </div>
        <p style="font-size: 24px; color: #E91E63;"><strong>{{discount}}% OFF</strong></p>
        <p>Use code: <strong style="font-size: 20px;">COMEBACK</strong></p>
        <a href="{{cartUrl}}" style="display: inline-block; padding: 16px 32px; background-color: #E91E63; color: white; text-decoration: none; border-radius: 4px; font-size: 18px;">Complete Order</a>
        <p style="color: #999; margin-top: 24px;">Offer expires in {{hours}} hours</p>
      </div>
    `,
    variables: {
      required: ['discount', 'cartUrl'],
      optional: ['userName', 'cartItems', 'hours', 'courierUrl'],
    },
    metadata: {
      category: 'marketing',
      tags: ['abandonment', 'recovery', 'cart', 'conversion'],
      priority: 'high',
      cooldownHours: 24,
    },
  },

  win_back: {
    name: 'Win Back',
    description: 'Re-engages inactive users with special offers',
    channels: ['email', 'sms', 'whatsapp'],
    title: 'We Want You Back!',
    body: 'It has been {{daysSinceLastVisit}} days since your last visit. Here is {{bonusPoints}} bonus points just for coming back!',
    emailSubject: 'We Miss You! Here\'s a Special Welcome Back Offer',
    emailHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #9C27B0;">We Miss You!</h1>
        <p>Hi {{userName}},</p>
        <p>It has been {{daysSinceLastVisit}} days since your last visit. We have missed you!</p>
        <div style="background: linear-gradient(135deg, #9C27B0, #E91E63); color: white; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
          <p style="font-size: 18px; margin: 0;">Welcome Back Bonus</p>
          <p style="font-size: 48px; font-weight: bold; margin: 8px 0;">{{bonusPoints}}</p>
          <p style="font-size: 14px; margin: 0;">Points just for you!</p>
        </div>
        <p>Here is what is new:</p>
        <ul>
          <li>{{newFeature1}}</li>
          <li>{{newFeature2}}</li>
          <li>{{newFeature3}}</li>
        </ul>
        <a href="{{returnUrl}}" style="display: inline-block; padding: 16px 32px; background-color: #9C27B0; color: white; text-decoration: none; border-radius: 4px;">Come Back Now</a>
      </div>
    `,
    variables: {
      required: ['daysSinceLastVisit', 'bonusPoints', 'returnUrl'],
      optional: ['userName', 'newFeature1', 'newFeature2', 'newFeature3', 'specialOffer'],
    },
    metadata: {
      category: 'marketing',
      tags: ['win-back', 'reengagement', 'inactive', 'retention'],
      priority: 'normal',
      cooldownHours: 720, // 30 days
    },
  },

  referral: {
    name: 'Referral Campaign',
    description: 'Drives referral program participation',
    channels: ['email', 'sms', 'whatsapp'],
    title: 'Share REZ & Earn Rewards!',
    body: 'Invite friends to REZ and you both get {{reward}}! Share your code: {{referralCode}}',
    emailSubject: 'Invite Friends to REZ - You Both Get Rewarded!',
    emailHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00BCD4;">Share the Love!</h1>
        <p>Hi {{userName}},</p>
        <p>You have earned the ability to invite friends to REZ!</p>
        <div style="text-align: center; padding: 24px; background-color: #E0F7FA; border-radius: 12px; margin: 24px 0;">
          <p style="font-size: 14px; color: #666; margin: 0;">Your Referral Code</p>
          <p style="font-size: 36px; font-weight: bold; letter-spacing: 4px; color: #00BCD4;">{{referralCode}}</p>
        </div>
        <div style="display: flex; gap: 12px; justify-content: center; margin: 24px 0;">
          <a href="{{shareWhatsAppUrl}}" style="padding: 12px 24px; background-color: #25D366; color: white; text-decoration: none; border-radius: 4px;">WhatsApp</a>
          <a href="{{shareEmailUrl}}" style="padding: 12px 24px; background-color: #EA4335; color: white; text-decoration: none; border-radius: 4px;">Email</a>
          <a href="{{shareSmsUrl}}" style="padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">SMS</a>
        </div>
        <p>For every friend who joins:</p>
        <ul>
          <li>You get: {{yourReward}}</li>
          <li>They get: {{friendReward}}</li>
        </ul>
        <p style="color: #666; font-size: 12px;">{{referralTerms}}</p>
      </div>
    `,
    variables: {
      required: ['referralCode', 'reward'],
      optional: ['userName', 'yourReward', 'friendReward', 'shareUrls', 'referralTerms'],
    },
    metadata: {
      category: 'marketing',
      tags: ['referral', 'invite', 'viral', 'growth'],
      priority: 'normal',
    },
  },

  welcome_sequence: {
    name: 'Welcome Sequence',
    description: 'Onboarding sequence for new users',
    channels: ['email', 'whatsapp'],
    title: 'Welcome to REZ!',
    body: 'Welcome aboard! Start exploring great deals and experiences near you.',
    emailSubject: 'Welcome to REZ - Your Journey Begins!',
    emailHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4CAF50;">Welcome to REZ!</h1>
        <p>Hi {{userName}},</p>
        <p>Welcome to the REZ family! We are excited to have you here.</p>
        <p>Here is how to get started:</p>
        <div style="display: flex; gap: 16px; margin: 24px 0;">
          <div style="flex: 1; text-align: center; padding: 16px; border: 1px solid #ddd; border-radius: 8px;">
            <div style="font-size: 24px;">1</div>
            <p>Set up your profile</p>
          </div>
          <div style="flex: 1; text-align: center; padding: 16px; border: 1px solid #ddd; border-radius: 8px;">
            <div style="font-size: 24px;">2</div>
            <p>Explore nearby deals</p>
          </div>
          <div style="flex: 1; text-align: center; padding: 16px; border: 1px solid #ddd; border-radius: 8px;">
            <div style="font-size: 24px;">3</div>
            <p>Start earning rewards</p>
          </div>
        </div>
        <p>Use code <strong>WELCOME{{welcomePoints}}</strong> for {{welcomePoints}} bonus points!</p>
        <a href="{{exploreUrl}}" style="display: inline-block; padding: 16px 32px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; font-size: 18px;">Start Exploring</a>
      </div>
    `,
    variables: {
      required: ['userName'],
      optional: ['welcomePoints', 'exploreUrl', 'firstDealUrl'],
    },
    metadata: {
      category: 'onboarding',
      tags: ['welcome', 'onboarding', 'new-user', 'first-steps'],
      priority: 'high',
      cooldownHours: 0,
    },
  },

  promotion: {
    name: 'Promotion',
    description: 'General promotional campaigns',
    channels: ['email', 'push'],
    title: '{{promotionTitle}}',
    body: '{{promotionDescription}} Valid until {{expiryDate}}.',
    emailSubject: '{{promotionTitle}} - {{discount}}% Off!',
    variables: {
      required: ['promotionTitle', 'promotionDescription', 'expiryDate'],
      optional: ['discount', 'promoCode', 'promoUrl', 'termsConditions'],
    },
    metadata: {
      category: 'marketing',
      tags: ['promotion', 'sale', 'discount', 'offer'],
      priority: 'normal',
    },
  },

  // ==========================================================================
  // TRANSACTIONAL TEMPLATES
  // ==========================================================================

  order_confirmation: {
    name: 'Order Confirmation',
    description: 'Confirms order placement',
    channels: ['email', 'sms'],
    title: 'Order Confirmed!',
    body: 'Your order #{{orderId}} has been confirmed. Total: {{total}}. Estimated delivery: {{deliveryDate}}.',
    emailSubject: 'Order Confirmation - #{{orderId}}',
    variables: {
      required: ['orderId', 'total', 'deliveryDate'],
      optional: ['orderItems', 'trackingUrl', 'supportPhone'],
    },
    metadata: {
      category: 'transactional',
      tags: ['order', 'confirmation', 'purchase'],
      priority: 'high',
      cooldownHours: 0,
    },
  },

  payment_success: {
    name: 'Payment Success',
    description: 'Confirms successful payment',
    channels: ['email', 'push'],
    title: 'Payment Successful!',
    body: 'Your payment of {{amount}} was successful. Transaction ID: {{transactionId}}',
    emailSubject: 'Payment Confirmation - {{amount}}',
    variables: {
      required: ['amount', 'transactionId'],
      optional: ['paymentMethod', 'transactionDate', 'receiptUrl'],
    },
    metadata: {
      category: 'transactional',
      tags: ['payment', 'confirmation', 'transaction'],
      priority: 'high',
      cooldownHours: 0,
    },
  },

  // ==========================================================================
  // NOTIFICATION TEMPLATES
  // ==========================================================================

  price_alert: {
    name: 'Price Alert',
    description: 'Notifies users of price drops on watched items',
    channels: ['push', 'email'],
    title: 'Price Drop Alert!',
    body: 'Good news! {{productName}} is now {{newPrice}} (was {{oldPrice}}). Save {{savings}}!',
    emailSubject: 'Price Drop: {{productName}} is Now {{newPrice}}!',
    variables: {
      required: ['productName', 'newPrice', 'oldPrice'],
      optional: ['savings', 'productUrl', 'expiresAt'],
    },
    metadata: {
      category: 'notification',
      tags: ['price', 'alert', 'drop', 'savings'],
      priority: 'normal',
    },
  },

  new_deal: {
    name: 'New Deal Alert',
    description: 'Notifies users about new deals matching their preferences',
    channels: ['push', 'email'],
    title: 'New Deal Near You!',
    body: '{{merchantName}} has a new {{dealType}} deal: {{dealTitle}}',
    emailSubject: 'New Deal: {{dealTitle}} at {{merchantName}}',
    variables: {
      required: ['merchantName', 'dealType', 'dealTitle'],
      optional: ['dealValue', 'dealUrl', 'expiresAt', 'distance'],
    },
    metadata: {
      category: 'notification',
      tags: ['deal', 'new', 'nearby', 'alert'],
      priority: 'normal',
    },
  },

  reservation_reminder: {
    name: 'Reservation Reminder',
    description: 'Reminds users about upcoming reservations',
    channels: ['push', 'sms'],
    title: 'Reservation Tomorrow',
    body: 'Reminder: {{reservationType}} at {{merchantName}} tomorrow at {{time}}. Address: {{address}}',
    variables: {
      required: ['reservationType', 'merchantName', 'time'],
      optional: ['address', 'confirmationCode', 'cancelUrl'],
    },
    metadata: {
      category: 'notification',
      tags: ['reservation', 'reminder', 'appointment'],
      priority: 'high',
      cooldownHours: 0,
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all marketing templates
 */
export function getMarketingTemplates(): Record<string, MarketingTemplate> {
  return { ...MARKETING_TEMPLATES };
}

/**
 * Get a specific template by ID
 */
export function getTemplate(templateId: string): MarketingTemplate | null {
  return MARKETING_TEMPLATES[templateId] || null;
}

/**
 * Get templates by channel
 */
export function getTemplatesByChannel(channel: 'email' | 'sms' | 'whatsapp' | 'push'): MarketingTemplate[] {
  return Object.values(MARKETING_TEMPLATES).filter(template =>
    template.channels.includes(channel)
  );
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): MarketingTemplate[] {
  return Object.values(MARKETING_TEMPLATES).filter(template =>
    template.metadata?.category === category
  );
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string): MarketingTemplate[] {
  return Object.values(MARKETING_TEMPLATES).filter(template =>
    template.metadata?.tags?.includes(tag)
  );
}

/**
 * Validate template variables
 */
export function validateTemplateVariables(
  templateId: string,
  variables: Record<string, string>
): { valid: boolean; missing: string[] } {
  const template = getTemplate(templateId);

  if (!template) {
    return { valid: false, missing: ['template not found'] };
  }

  const missing = template.variables.required.filter(
    req => !variables[req] && variables[req] !== ''
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Render template with variables (simple Handlebars-like substitution)
 */
export function renderTemplate(
  templateId: string,
  variables: Record<string, string>
): { title: string; body: string; emailSubject?: string; emailHtml?: string } | null {
  const template = getTemplate(templateId);

  if (!template) {
    return null;
  }

  const validation = validateTemplateVariables(templateId, variables);
  if (!validation.valid) {
    console.warn(`Template ${templateId} missing required variables:`, validation.missing);
  }

  const rendered = {
    title: replaceVariables(template.title, variables),
    body: replaceVariables(template.body, variables),
    emailSubject: template.emailSubject
      ? replaceVariables(template.emailSubject, variables)
      : undefined,
    emailHtml: template.emailHtml
      ? replaceVariables(template.emailHtml, variables)
      : undefined,
  };

  return rendered;
}

/**
 * Replace {{variable}} placeholders with actual values
 */
function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}
