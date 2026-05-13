/**
 * Template Service
 * Provides pre-built workflow templates
 */

import type { Workflow, WorkflowTemplate } from '../types';

// Template definitions
const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'welcome-series',
    name: 'Welcome Series',
    description: 'Onboard new customers with a 3-email series over 7 days',
    category: 'welcome',
    complexity: 'simple',
    estimatedSteps: 5,
    estimatedDuration: '7 days',
    usageCount: 1250,
    tags: ['onboarding', 'email', 'new-customer'],
  },
  {
    id: 'abandoned-cart-recovery',
    name: 'Abandoned Cart Recovery',
    description: 'Multi-channel abandoned cart recovery with escalating urgency',
    category: 'abandoned_cart',
    complexity: 'moderate',
    estimatedSteps: 8,
    estimatedDuration: '3 days',
    usageCount: 980,
    tags: ['cart-recovery', 'multi-channel', 'urgent'],
  },
  {
    id: 'post-purchase-followup',
    name: 'Post-Purchase Follow-up',
    description: 'Follow up after purchase with review request and cross-sell',
    category: 'post_purchase',
    complexity: 'simple',
    estimatedSteps: 4,
    estimatedDuration: '14 days',
    usageCount: 750,
    tags: ['post-purchase', 'review', 'cross-sell'],
  },
  {
    id: 'win-back-90-days',
    name: 'Win Back Campaign',
    description: 'Re-engage customers inactive for 90 days with increasing discounts',
    category: 'win_back',
    complexity: 'complex',
    estimatedSteps: 12,
    estimatedDuration: '30 days',
    usageCount: 520,
    tags: ['win-back', 're-engagement', 'discounts'],
  },
  {
    id: 'birthday-campaign',
    name: 'Birthday Campaign',
    description: 'Send birthday wishes with special offer',
    category: 'birthday',
    complexity: 'simple',
    estimatedSteps: 3,
    estimatedDuration: '1 day',
    usageCount: 890,
    tags: ['birthday', 'personalization', 'special-offer'],
  },
  {
    id: 'price-drop-alert',
    name: 'Price Drop Alert',
    description: 'Notify customers when products they viewed go on sale',
    category: 'promotional',
    complexity: 'simple',
    estimatedSteps: 3,
    estimatedDuration: 'Immediate',
    usageCount: 430,
    tags: ['price-drop', 'alert', 'product-notification'],
  },
  {
    id: 'reengagement-series',
    name: 'Re-engagement Campaign',
    description: 'Win back customers who haven\'t engaged in 60+ days',
    category: 'reengagement',
    complexity: 'moderate',
    estimatedSteps: 6,
    estimatedDuration: '21 days',
    usageCount: 380,
    tags: ['re-engagement', 'inactive-users', 'retention'],
  },
  {
    id: 'flash-sale',
    name: 'Flash Sale Promotion',
    description: 'Promote a time-limited sale with multiple touchpoints',
    category: 'promotional',
    complexity: 'moderate',
    estimatedSteps: 7,
    estimatedDuration: '3 days',
    usageCount: 610,
    tags: ['promotion', 'flash-sale', 'urgency'],
  },
];

/**
 * Get all templates
 */
export function getAllTemplates(): WorkflowTemplate[] {
  return TEMPLATES;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): WorkflowTemplate[] {
  return TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get templates by complexity
 */
export function getTemplatesByComplexity(
  complexity: 'simple' | 'moderate' | 'complex'
): WorkflowTemplate[] {
  return TEMPLATES.filter((t) => t.complexity === complexity);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase();
  return TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get popular templates
 */
export function getPopularTemplates(limit: number = 5): WorkflowTemplate[] {
  return [...TEMPLATES].sort((a, b) => b.usageCount - a.usageCount).slice(0, limit);
}

/**
 * Get template categories
 */
export function getCategories(): string[] {
  const categories = new Set(TEMPLATES.map((t) => t.category));
  return Array.from(categories);
}

/**
 * Generate full workflow from template
 */
export function generateWorkflowFromTemplate(
  templateId: string,
  customizations?: {
    name?: string;
    description?: string;
    triggerDays?: number;
    channelPreferences?: string[];
  }
): Workflow | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  // Generate workflow based on template
  const workflow: Workflow = generateWorkflowByTemplate(template, customizations);
  return workflow;
}

/**
 * Generate workflow based on template definition
 */
function generateWorkflowByTemplate(
  template: WorkflowTemplate,
  customizations?: {
    name?: string;
    description?: string;
    triggerDays?: number;
    channelPreferences?: string[];
  }
): Workflow {
  const workflow: Workflow = {
    name: customizations?.name || template.name,
    description: customizations?.description || template.description,
    trigger: getTriggerForTemplate(template.id, customizations?.triggerDays),
    steps: getStepsForTemplate(template.id),
    analytics: {
      trackOpens: true,
      trackClicks: true,
      trackConversions: true,
    },
    status: 'draft',
    tags: template.tags,
  };

  return workflow;
}

/**
 * Get trigger configuration for template
 */
function getTriggerForTemplate(
  templateId: string,
  customDays?: number
): Workflow['trigger'] {
  switch (templateId) {
    case 'welcome-series':
      return { type: 'signup' };
    case 'abandoned-cart-recovery':
      return { type: 'abandoned_cart', cartValueMin: 0 };
    case 'post-purchase-followup':
      return { type: 'purchase' };
    case 'win-back-90-days':
      return { type: 'win_back', days: customDays || 90 };
    case 'birthday-campaign':
      return { type: 'birthday' };
    case 'price-drop-alert':
      return { type: 'price_drop' };
    case 'reengagement-series':
      return { type: 'inactivity', days: customDays || 60 };
    case 'flash-sale':
      return { type: 'manual' };
    default:
      return { type: 'manual' };
  }
}

/**
 * Get steps for template
 */
function getStepsForTemplate(templateId: string): Workflow['steps'] {
  switch (templateId) {
    case 'welcome-series':
      return getWelcomeSeriesSteps();
    case 'abandoned-cart-recovery':
      return getAbandonedCartSteps();
    case 'post-purchase-followup':
      return getPostPurchaseSteps();
    case 'win-back-90-days':
      return getWinBackSteps();
    case 'birthday-campaign':
      return getBirthdaySteps();
    default:
      return getGenericSteps();
  }
}

function getWelcomeSeriesSteps(): Workflow['steps'] {
  return [
    {
      id: 'welcome_email',
      type: 'email',
      config: {
        subject: 'Welcome to {{brand_name}}!',
        template: 'welcome',
      },
      position: { x: 250, y: 100 },
      edges: ['delay_1'],
      label: 'Welcome Email',
    },
    {
      id: 'delay_1',
      type: 'delay',
      config: { duration: '2 days' },
      position: { x: 250, y: 180 },
      edges: ['getting_started_email'],
      label: 'Wait 2 Days',
    },
    {
      id: 'getting_started_email',
      type: 'email',
      config: {
        subject: 'Getting Started with {{brand_name}}',
        template: 'getting-started',
      },
      position: { x: 250, y: 260 },
      edges: ['delay_2'],
      label: 'Getting Started',
    },
    {
      id: 'delay_2',
      type: 'delay',
      config: { duration: '5 days' },
      position: { x: 250, y: 340 },
      edges: ['offer_email'],
      label: 'Wait 5 Days',
    },
    {
      id: 'offer_email',
      type: 'email',
      config: {
        subject: 'Special Offer Just for You!',
        template: 'special-offer',
        discount: '15% off',
      },
      position: { x: 250, y: 420 },
      edges: ['end'],
      label: 'Special Offer',
    },
    {
      id: 'end',
      type: 'end',
      config: {},
      position: { x: 250, y: 500 },
      edges: [],
      label: 'End',
    },
  ];
}

function getAbandonedCartSteps(): Workflow['steps'] {
  return [
    {
      id: 'whatsapp_reminder',
      type: 'whatsapp',
      config: {
        template: 'abandoned-cart',
      },
      position: { x: 250, y: 100 },
      edges: ['delay_1h'],
      label: 'WhatsApp Reminder',
    },
    {
      id: 'delay_1h',
      type: 'delay',
      config: { duration: '1 hour' },
      position: { x: 250, y: 180 },
      edges: ['check_purchased'],
      label: 'Wait 1 Hour',
    },
    {
      id: 'check_purchased',
      type: 'condition',
      config: {
        conditions: [{ field: 'purchased', operator: 'equals', value: true }],
      },
      position: { x: 250, y: 260 },
      edges: ['end', 'email_recovery'],
      label: 'Purchased?',
    },
    {
      id: 'email_recovery',
      type: 'email',
      config: {
        subject: 'You left something behind...',
        template: 'abandoned-cart-email',
      },
      position: { x: 450, y: 340 },
      edges: ['delay_24h'],
      label: 'Recovery Email',
    },
    {
      id: 'delay_24h',
      type: 'delay',
      config: { duration: '24 hours' },
      position: { x: 450, y: 420 },
      edges: ['check_purchased_2'],
      label: 'Wait 24 Hours',
    },
    {
      id: 'check_purchased_2',
      type: 'condition',
      config: {
        conditions: [{ field: 'purchased', operator: 'equals', value: true }],
      },
      position: { x: 450, y: 500 },
      edges: ['end', 'sms_urgency'],
      label: 'Purchased?',
    },
    {
      id: 'sms_urgency',
      type: 'sms',
      config: {
        template: 'abandoned-cart-sms',
        discount: 'Free shipping',
      },
      position: { x: 650, y: 580 },
      edges: ['end'],
      label: 'SMS - Free Shipping',
    },
    {
      id: 'end',
      type: 'end',
      config: {},
      position: { x: 250, y: 580 },
      edges: [],
      label: 'End',
    },
  ];
}

function getPostPurchaseSteps(): Workflow['steps'] {
  return [
    {
      id: 'order_confirmation',
      type: 'email',
      config: {
        subject: 'Order Confirmed - #{{order_id}}',
        template: 'order-confirmation',
      },
      position: { x: 250, y: 100 },
      edges: ['delay_review'],
      label: 'Order Confirmation',
    },
    {
      id: 'delay_review',
      type: 'delay',
      config: { duration: '7 days' },
      position: { x: 250, y: 180 },
      edges: ['review_request'],
      label: 'Wait 7 Days',
    },
    {
      id: 'review_request',
      type: 'email',
      config: {
        subject: 'How was your experience?',
        template: 'review-request',
      },
      position: { x: 250, y: 260 },
      edges: ['delay_crosssell'],
      label: 'Review Request',
    },
    {
      id: 'delay_crosssell',
      type: 'delay',
      config: { duration: '14 days' },
      position: { x: 250, y: 340 },
      edges: ['crosssell_email'],
      label: 'Wait 14 Days',
    },
    {
      id: 'crosssell_email',
      type: 'email',
      config: {
        subject: 'You might love these...',
        template: 'cross-sell',
        discount: '10% off next order',
      },
      position: { x: 250, y: 420 },
      edges: ['end'],
      label: 'Cross-sell Email',
    },
    {
      id: 'end',
      type: 'end',
      config: {},
      position: { x: 250, y: 500 },
      edges: [],
      label: 'End',
    },
  ];
}

function getWinBackSteps(): Workflow['steps'] {
  return [
    {
      id: 'miss_you_email',
      type: 'email',
      config: {
        subject: 'We miss you, {{customer_name}}!',
        template: 'miss-you',
      },
      position: { x: 250, y: 100 },
      edges: ['delay_3d'],
      label: 'Miss You Email',
    },
    {
      id: 'delay_3d',
      type: 'delay',
      config: { duration: '3 days' },
      position: { x: 250, y: 180 },
      edges: ['check_opened'],
      label: 'Wait 3 Days',
    },
    {
      id: 'check_opened',
      type: 'condition',
      config: {
        conditions: [{ field: 'opened', operator: 'equals', value: true }],
      },
      position: { x: 250, y: 260 },
      edges: ['sms_10pct', 'delay_7d_retry'],
      label: 'Opened?',
    },
    {
      id: 'delay_7d_retry',
      type: 'delay',
      config: { duration: '7 days' },
      position: { x: 450, y: 340 },
      edges: ['sms_10pct'],
      label: 'Wait 7 Days',
    },
    {
      id: 'sms_10pct',
      type: 'sms',
      config: {
        template: 'win-back-sms',
        discount: '10% off',
      },
      position: { x: 250, y: 340 },
      edges: ['delay_7d'],
      label: 'SMS - 10% Off',
    },
    {
      id: 'delay_7d',
      type: 'delay',
      config: { duration: '7 days' },
      position: { x: 250, y: 420 },
      edges: ['check_purchased'],
      label: 'Wait 7 Days',
    },
    {
      id: 'check_purchased',
      type: 'condition',
      config: {
        conditions: [{ field: 'purchased', operator: 'equals', value: true }],
      },
      position: { x: 250, y: 500 },
      edges: ['end', 'email_20pct'],
      label: 'Purchased?',
    },
    {
      id: 'email_20pct',
      type: 'email',
      config: {
        subject: 'Last chance - 20% off!',
        template: 'final-win-back',
        discount: '20% off',
      },
      position: { x: 250, y: 580 },
      edges: ['end'],
      label: 'Final Offer - 20%',
    },
    {
      id: 'end',
      type: 'end',
      config: {},
      position: { x: 250, y: 660 },
      edges: [],
      label: 'End',
    },
  ];
}

function getBirthdaySteps(): Workflow['steps'] {
  return [
    {
      id: 'birthday_wish',
      type: 'email',
      config: {
        subject: 'Happy Birthday, {{customer_name}}!',
        template: 'birthday-wish',
      },
      position: { x: 250, y: 100 },
      edges: ['birthday_offer'],
      label: 'Birthday Email',
    },
    {
      id: 'birthday_offer',
      type: 'email',
      config: {
        subject: 'Your Birthday Gift - 25% Off!',
        template: 'birthday-offer',
        discount: '25% off',
      },
      position: { x: 250, y: 180 },
      edges: ['end'],
      label: 'Birthday Offer',
    },
    {
      id: 'end',
      type: 'end',
      config: {},
      position: { x: 250, y: 260 },
      edges: [],
      label: 'End',
    },
  ];
}

function getGenericSteps(): Workflow['steps'] {
  return [
    {
      id: 'start',
      type: 'email',
      config: {
        template: 'generic-message',
      },
      position: { x: 250, y: 100 },
      edges: ['end'],
      label: 'Initial Message',
    },
    {
      id: 'end',
      type: 'end',
      config: {},
      position: { x: 250, y: 180 },
      edges: [],
      label: 'End',
    },
  ];
}

export default {
  getAllTemplates,
  getTemplatesByCategory,
  getTemplatesByComplexity,
  getTemplateById,
  searchTemplates,
  getPopularTemplates,
  getCategories,
  generateWorkflowFromTemplate,
};
