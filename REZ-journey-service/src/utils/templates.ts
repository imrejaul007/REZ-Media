import { JourneyTemplate } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Welcome Email Sequence Template
export const welcomeEmailTemplate: JourneyTemplate = {
  id: 'template_welcome_email',
  name: 'Welcome Email Sequence',
  description: 'A 3-email welcome sequence for new signups',
  category: 'onboarding',
  tags: ['welcome', 'onboarding', 'email'],
  journey: {
    name: '',
    description: 'Welcome new users with a series of emails',
    trigger: {
      type: 'signup',
      conditions: []
    },
    steps: [
      {
        id: 'step_welcome_1',
        name: 'Welcome Email',
        description: 'Send welcome email immediately',
        type: 'action',
        actionType: 'email',
        actionConfig: {
          type: 'email',
          emailSubject: 'Welcome to Our Platform!',
          emailTemplate: 'Hi {{firstName}}, welcome aboard! We are excited to have you.',
          emailFrom: 'welcome@company.com'
        },
        nextStepId: 'step_delay_1',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 100 },
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true
        },
        timeout: 30000,
        analytics: {
          stepId: 'step_welcome_1',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_delay_1',
        name: 'Wait 1 Day',
        description: 'Delay before second email',
        type: 'action',
        actionType: 'delay',
        actionConfig: {
          type: 'delay',
          delayDuration: 1,
          delayUnit: 'days'
        },
        nextStepId: 'step_welcome_2',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 200 },
        retryConfig: {
          maxRetries: 0,
          retryDelay: 0,
          exponentialBackoff: false
        },
        timeout: 0,
        analytics: {
          stepId: 'step_delay_1',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_welcome_2',
        name: 'Feature Introduction',
        description: 'Highlight key features',
        type: 'action',
        actionType: 'email',
        actionConfig: {
          type: 'email',
          emailSubject: 'Discover What You Can Do',
          emailTemplate: 'Hi {{firstName}}, check out these amazing features!',
          emailFrom: 'features@company.com'
        },
        nextStepId: 'step_delay_2',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 300 },
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true
        },
        timeout: 30000,
        analytics: {
          stepId: 'step_welcome_2',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_delay_2',
        name: 'Wait 3 Days',
        description: 'Delay before final email',
        type: 'action',
        actionType: 'delay',
        actionConfig: {
          type: 'delay',
          delayDuration: 3,
          delayUnit: 'days'
        },
        nextStepId: 'step_welcome_3',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 400 },
        retryConfig: {
          maxRetries: 0,
          retryDelay: 0,
          exponentialBackoff: false
        },
        timeout: 0,
        analytics: {
          stepId: 'step_delay_2',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_welcome_3',
        name: 'Getting Started Guide',
        description: 'Send getting started guide',
        type: 'action',
        actionType: 'email',
        actionConfig: {
          type: 'email',
          emailSubject: 'Your Getting Started Guide',
          emailTemplate: 'Hi {{firstName}}, here is everything you need to get started!',
          emailFrom: 'help@company.com'
        },
        nextStepId: '',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 500 },
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true
        },
        timeout: 30000,
        analytics: {
          stepId: 'step_welcome_3',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      }
    ],
    entryStepId: 'step_welcome_1',
    abTest: {
      enabled: false,
      variants: []
    }
  }
};

// Abandoned Cart Recovery Template
export const abandonedCartTemplate: JourneyTemplate = {
  id: 'template_abandoned_cart',
  name: 'Abandoned Cart Recovery',
  description: 'Recover abandoned carts with reminder emails',
  category: 'ecommerce',
  tags: ['cart', 'recovery', 'ecommerce', 'email'],
  journey: {
    name: '',
    description: 'Re-engage customers who abandoned their cart',
    trigger: {
      type: 'custom',
      conditions: [],
      customEvent: 'cart_abandoned'
    },
    steps: [
      {
        id: 'step_cart_1',
        name: 'Cart Abandoned Email',
        description: 'Send cart recovery email after 1 hour',
        type: 'action',
        actionType: 'email',
        actionConfig: {
          type: 'email',
          emailSubject: 'You Left Something Behind!',
          emailTemplate: 'Hi {{firstName}}, complete your purchase of {{cartItems}}!',
          emailFrom: 'sales@company.com'
        },
        nextStepId: 'step_cart_delay',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 100 },
        retryConfig: {
          maxRetries: 2,
          retryDelay: 3600000,
          exponentialBackoff: false
        },
        timeout: 30000,
        analytics: {
          stepId: 'step_cart_1',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_cart_delay',
        name: 'Wait 24 Hours',
        description: 'Delay before follow-up',
        type: 'action',
        actionType: 'delay',
        actionConfig: {
          type: 'delay',
          delayDuration: 24,
          delayUnit: 'hours'
        },
        nextStepId: 'step_cart_2',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 200 },
        retryConfig: {
          maxRetries: 0,
          retryDelay: 0,
          exponentialBackoff: false
        },
        timeout: 0,
        analytics: {
          stepId: 'step_cart_delay',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_cart_2',
        name: 'Urgency Email',
        description: 'Create urgency with discount offer',
        type: 'action',
        actionType: 'email',
        actionConfig: {
          type: 'email',
          emailSubject: 'Last Chance! 10% Off Your Cart',
          emailTemplate: 'Hi {{firstName}}, do not miss out! Use code SAVE10 for 10% off.',
          emailFrom: 'deals@company.com'
        },
        nextStepId: '',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 300 },
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true
        },
        timeout: 30000,
        analytics: {
          stepId: 'step_cart_2',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      }
    ],
    entryStepId: 'step_cart_1',
    abTest: {
      enabled: false,
      variants: []
    }
  }
};

// Churn Risk Prevention Template
export const churnRiskTemplate: JourneyTemplate = {
  id: 'template_churn_prevention',
  name: 'Churn Risk Prevention',
  description: 'Win back at-risk customers',
  category: 'retention',
  tags: ['churn', 'retention', 'win-back', 'email'],
  journey: {
    name: '',
    description: 'Target customers showing signs of churn',
    trigger: {
      type: 'churn_risk',
      conditions: []
    },
    steps: [
      {
        id: 'step_churn_1',
        name: 'Check Engagement',
        description: 'Check if customer is highly at risk',
        type: 'condition',
        actionType: 'condition',
        actionConfig: {
          type: 'condition',
          conditions: [
            {
              field: 'churnScore',
              operator: 'greater_than',
              value: 80
            }
          ]
        },
        nextStepId: 'step_churn_sms',
        errorStepId: 'step_churn_email',
        status: 'pending',
        position: { x: 100, y: 100 },
        retryConfig: {
          maxRetries: 0,
          retryDelay: 0,
          exponentialBackoff: false
        },
        timeout: 0,
        analytics: {
          stepId: 'step_churn_1',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_churn_sms',
        name: 'Personal SMS',
        description: 'Send personal SMS for high-risk customers',
        type: 'action',
        actionType: 'SMS',
        actionConfig: {
          type: 'SMS',
          smsTemplate: 'Hi {{firstName}}, we noticed you have not been around. Is everything okay?',
          smsFrom: 'COMPANY'
        },
        nextStepId: 'step_churn_delay',
        errorStepId: '',
        status: 'pending',
        position: { x: 200, y: 200 },
        retryConfig: {
          maxRetries: 2,
          retryDelay: 3600000,
          exponentialBackoff: false
        },
        timeout: 15000,
        analytics: {
          stepId: 'step_churn_sms',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_churn_email',
        name: 'Win-Back Email',
        description: 'Send win-back email',
        type: 'action',
        actionType: 'email',
        actionConfig: {
          type: 'email',
          emailSubject: 'We Miss You, {{firstName}}!',
          emailTemplate: 'Hi {{firstName}}, we have not seen you in a while. Come back for 20% off!',
          emailFrom: 'reconnect@company.com'
        },
        nextStepId: 'step_churn_delay',
        errorStepId: '',
        status: 'pending',
        position: { x: 0, y: 200 },
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true
        },
        timeout: 30000,
        analytics: {
          stepId: 'step_churn_email',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_churn_delay',
        name: 'Wait 3 Days',
        description: 'Delay before special offer',
        type: 'action',
        actionType: 'delay',
        actionConfig: {
          type: 'delay',
          delayDuration: 3,
          delayUnit: 'days'
        },
        nextStepId: 'step_churn_offer',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 300 },
        retryConfig: {
          maxRetries: 0,
          retryDelay: 0,
          exponentialBackoff: false
        },
        timeout: 0,
        analytics: {
          stepId: 'step_churn_delay',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_churn_offer',
        name: 'Special Offer Push',
        description: 'Send push notification with special offer',
        type: 'action',
        actionType: 'push',
        actionConfig: {
          type: 'push',
          pushTitle: 'Exclusive Offer Just For You',
          pushBody: 'Get 25% off when you come back. Limited time only!',
          pushData: { offerCode: 'COMEBACK25', discount: 25 }
        },
        nextStepId: '',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 400 },
        retryConfig: {
          maxRetries: 2,
          retryDelay: 3600000,
          exponentialBackoff: false
        },
        timeout: 10000,
        analytics: {
          stepId: 'step_churn_offer',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      }
    ],
    entryStepId: 'step_churn_1',
    abTest: {
      enabled: false,
      variants: []
    }
  }
};

// Post-Purchase Follow-Up Template
export const postPurchaseTemplate: JourneyTemplate = {
  id: 'template_post_purchase',
  name: 'Post-Purchase Follow-Up',
  description: 'Delight customers after purchase',
  category: 'ecommerce',
  tags: ['purchase', 'follow-up', 'review', 'email'],
  journey: {
    name: '',
    description: 'Engage customers after they make a purchase',
    trigger: {
      type: 'purchase',
      conditions: []
    },
    steps: [
      {
        id: 'step_purchase_1',
        name: 'Order Confirmation',
        description: 'Send order confirmation',
        type: 'action',
        actionType: 'email',
        actionConfig: {
          type: 'email',
          emailSubject: 'Your Order is Confirmed!',
          emailTemplate: 'Hi {{firstName}}, your order #{{orderId}} is confirmed. Total: ${{orderTotal}}',
          emailFrom: 'orders@company.com'
        },
        nextStepId: 'step_purchase_delay',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 100 },
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true
        },
        timeout: 30000,
        analytics: {
          stepId: 'step_purchase_1',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_purchase_delay',
        name: 'Wait 7 Days',
        description: 'Wait for delivery',
        type: 'action',
        actionType: 'delay',
        actionConfig: {
          type: 'delay',
          delayDuration: 7,
          delayUnit: 'days'
        },
        nextStepId: 'step_purchase_review',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 200 },
        retryConfig: {
          maxRetries: 0,
          retryDelay: 0,
          exponentialBackoff: false
        },
        timeout: 0,
        analytics: {
          stepId: 'step_purchase_delay',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_purchase_review',
        name: 'Review Request',
        description: 'Ask for product review',
        type: 'action',
        actionType: 'email',
        actionConfig: {
          type: 'email',
          emailSubject: 'How Was Your Experience?',
          emailTemplate: 'Hi {{firstName}}, how do you like your {{productName}}? Leave a review and get 50 points!',
          emailFrom: 'reviews@company.com'
        },
        nextStepId: 'step_purchase_social',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 300 },
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true
        },
        timeout: 30000,
        analytics: {
          stepId: 'step_purchase_review',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      },
      {
        id: 'step_purchase_social',
        name: 'Social Share Request',
        description: 'Ask to share on social media',
        type: 'action',
        actionType: 'push',
        actionConfig: {
          type: 'push',
          pushTitle: 'Share Your Experience',
          pushBody: 'Tag us on social media for a chance to be featured!',
          pushData: { action: 'share_social', campaign: 'post_purchase' }
        },
        nextStepId: '',
        errorStepId: '',
        status: 'pending',
        position: { x: 100, y: 400 },
        retryConfig: {
          maxRetries: 2,
          retryDelay: 86400000,
          exponentialBackoff: false
        },
        timeout: 10000,
        analytics: {
          stepId: 'step_purchase_social',
          entered: 0,
          started: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          avgTimeToComplete: 0,
          conversionRate: 0,
          lastUpdated: new Date()
        }
      }
    ],
    entryStepId: 'step_purchase_1',
    abTest: {
      enabled: false,
      variants: []
    }
  }
};

// All default templates
export const defaultTemplates: JourneyTemplate[] = [
  welcomeEmailTemplate,
  abandonedCartTemplate,
  churnRiskTemplate,
  postPurchaseTemplate
];

// Template categories
export const templateCategories = [
  { id: 'onboarding', name: 'Onboarding', description: 'Welcome and guide new customers' },
  { id: 'ecommerce', name: 'E-Commerce', description: 'Purchase and cart related journeys' },
  { id: 'retention', name: 'Retention', description: 'Win-back and retain customers' },
  { id: 'engagement', name: 'Engagement', description: 'Increase customer engagement' },
  { id: 'reactivation', name: 'Reactivation', description: 'Re-engage inactive customers' }
];
