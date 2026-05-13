/**
 * Few-shot Examples for Workflow Generation
 * These examples demonstrate the expected output format
 */

import type { Workflow } from '../types';

export interface WorkflowExample {
  input: string;
  output: Workflow;
}

export const WORKFLOW_EXAMPLES: WorkflowExample[] = [
  {
    input: 'Welcome new customers with a 3-email series over 7 days',
    output: {
      name: 'Welcome Series',
      description: 'Onboard new customers with a 3-email series introducing the brand over 7 days',
      trigger: {
        type: 'signup',
      },
      steps: [
        {
          id: 'email_1',
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
          config: {
            duration: '2 days',
          },
          position: { x: 250, y: 180 },
          edges: ['email_2'],
          label: 'Wait 2 Days',
        },
        {
          id: 'email_2',
          type: 'email',
          config: {
            subject: 'Getting Started with {{brand_name}}',
            template: 'getting-started',
          },
          position: { x: 250, y: 260 },
          edges: ['delay_2'],
          label: 'Getting Started Email',
        },
        {
          id: 'delay_2',
          type: 'delay',
          config: {
            duration: '5 days',
          },
          position: { x: 250, y: 340 },
          edges: ['email_3'],
          label: 'Wait 5 Days',
        },
        {
          id: 'email_3',
          type: 'email',
          config: {
            subject: 'Special Offer Just for You!',
            template: 'special-offer',
            discount: '15% off first order',
          },
          position: { x: 250, y: 420 },
          edges: ['end'],
          label: 'Special Offer Email',
        },
        {
          id: 'end',
          type: 'end',
          config: {},
          position: { x: 250, y: 500 },
          edges: [],
          label: 'End',
        },
      ],
      analytics: {
        trackOpens: true,
        trackClicks: true,
        trackConversions: true,
      },
    },
  },
  {
    input:
      'Win back customers who have not purchased in 90 days with increasing discounts',
    output: {
      name: 'Win Back Campaign',
      description:
        'Re-engage customers inactive for 90+ days with progressively increasing discounts',
      trigger: {
        type: 'win_back',
        days: 90,
      },
      steps: [
        {
          id: 'email_1',
          type: 'email',
          config: {
            subject: 'We miss you, {{customer_name}}!',
            template: 'miss-you',
          },
          position: { x: 250, y: 100 },
          edges: ['delay_1'],
          label: 'Miss You Email',
        },
        {
          id: 'delay_1',
          type: 'delay',
          config: {
            duration: '3 days',
          },
          position: { x: 250, y: 180 },
          edges: ['condition_1'],
          label: 'Wait 3 Days',
        },
        {
          id: 'condition_1',
          type: 'condition',
          config: {
            conditions: [{ field: 'opened', operator: 'equals', value: true }],
            conditionLogic: 'AND',
          },
          position: { x: 250, y: 260 },
          edges: ['sms_discount', 'delay_2'],
          label: 'Opened Email?',
        },
        {
          id: 'delay_2',
          type: 'delay',
          config: {
            duration: '7 days',
          },
          position: { x: 450, y: 340 },
          edges: ['email_1_retry'],
          label: 'Wait 7 Days',
        },
        {
          id: 'email_1_retry',
          type: 'email',
          config: {
            subject: 'Last chance to come back!',
            template: 'come-back',
          },
          position: { x: 450, y: 420 },
          edges: ['sms_discount'],
          label: 'Retry Email',
        },
        {
          id: 'sms_discount',
          type: 'sms',
          config: {
            template: 'discount-offer',
            discount: '10% off',
          },
          position: { x: 250, y: 340 },
          edges: ['delay_3'],
          label: 'SMS - 10% Discount',
        },
        {
          id: 'delay_3',
          type: 'delay',
          config: {
            duration: '7 days',
          },
          position: { x: 250, y: 420 },
          edges: ['condition_2'],
          label: 'Wait 7 Days',
        },
        {
          id: 'condition_2',
          type: 'condition',
          config: {
            conditions: [{ field: 'purchased', operator: 'equals', value: true }],
            conditionLogic: 'AND',
          },
          position: { x: 250, y: 500 },
          edges: ['end', 'sms_bigger_discount'],
          label: 'Made Purchase?',
        },
        {
          id: 'sms_bigger_discount',
          type: 'sms',
          config: {
            template: 'bigger-discount',
            discount: '20% off',
          },
          position: { x: 250, y: 580 },
          edges: ['delay_4'],
          label: 'SMS - 20% Discount',
        },
        {
          id: 'delay_4',
          type: 'delay',
          config: {
            duration: '5 days',
          },
          position: { x: 250, y: 660 },
          edges: ['final_email'],
          label: 'Wait 5 Days',
        },
        {
          id: 'final_email',
          type: 'email',
          config: {
            subject: 'Final offer - {{final_discount}} off!',
            template: 'final-chance',
            discount: '25% off',
          },
          position: { x: 250, y: 740 },
          edges: ['end'],
          label: 'Final Offer Email',
        },
        {
          id: 'end',
          type: 'end',
          config: {},
          position: { x: 250, y: 820 },
          edges: [],
          label: 'End',
        },
      ],
      analytics: {
        trackOpens: true,
        trackClicks: true,
        trackConversions: true,
        attributionWindow: {
          click: 7 * 24,
          view: 24,
        },
      },
    },
  },
  {
    input:
      'Create a workflow to follow up on abandoned carts after 1 hour with WhatsApp, then email after 24 hours if no response, then SMS after 48 hours',
    output: {
      name: 'Abandoned Cart Recovery',
      description:
        'Multi-channel abandoned cart recovery with escalating urgency',
      trigger: {
        type: 'abandoned_cart',
        cartValueMin: 0,
      },
      steps: [
        {
          id: 'whatsapp_1',
          type: 'whatsapp',
          config: {
            channel: 'whatsapp',
            template: 'abandoned-cart-reminder',
            variables: {
              cart_items: '{{cart_items}}',
              total: '{{cart_total}}',
            },
          },
          position: { x: 250, y: 100 },
          edges: ['delay_1'],
          label: 'WhatsApp - Cart Reminder',
        },
        {
          id: 'delay_1',
          type: 'delay',
          config: {
            duration: '1 hour',
          },
          position: { x: 250, y: 180 },
          edges: ['condition_1'],
          label: 'Wait 1 Hour',
        },
        {
          id: 'condition_1',
          type: 'condition',
          config: {
            conditions: [{ field: 'purchased', operator: 'equals', value: true }],
            conditionLogic: 'AND',
          },
          position: { x: 250, y: 260 },
          edges: ['end', 'delay_2'],
          label: 'Purchased?',
        },
        {
          id: 'delay_2',
          type: 'delay',
          config: {
            duration: '24 hours',
          },
          position: { x: 450, y: 340 },
          edges: ['email_recovery'],
          label: 'Wait 24 Hours',
        },
        {
          id: 'email_recovery',
          type: 'email',
          config: {
            subject: 'You left something behind...',
            template: 'abandoned-cart-email',
            variables: {
              cart_items: '{{cart_items}}',
              checkout_link: '{{checkout_link}}',
            },
          },
          position: { x: 450, y: 420 },
          edges: ['delay_3'],
          label: 'Email - Recovery',
        },
        {
          id: 'delay_3',
          type: 'delay',
          config: {
            duration: '24 hours',
          },
          position: { x: 450, y: 500 },
          edges: ['condition_2'],
          label: 'Wait 24 Hours',
        },
        {
          id: 'condition_2',
          type: 'condition',
          config: {
            conditions: [{ field: 'purchased', operator: 'equals', value: true }],
            conditionLogic: 'AND',
          },
          position: { x: 450, y: 580 },
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
          position: { x: 450, y: 660 },
          edges: ['delay_4'],
          label: 'SMS - Free Shipping',
        },
        {
          id: 'delay_4',
          type: 'delay',
          config: {
            duration: '48 hours',
          },
          position: { x: 450, y: 740 },
          edges: ['condition_3'],
          label: 'Wait 48 Hours',
        },
        {
          id: 'condition_3',
          type: 'condition',
          config: {
            conditions: [{ field: 'purchased', operator: 'equals', value: true }],
            conditionLogic: 'AND',
          },
          position: { x: 450, y: 820 },
          edges: ['end', 'email_final'],
          label: 'Purchased?',
        },
        {
          id: 'email_final',
          type: 'email',
          config: {
            subject: 'Last chance! Your cart expires soon',
            template: 'cart-expiry',
            discount: '10% off',
          },
          position: { x: 650, y: 900 },
          edges: ['end'],
          label: 'Final Email - 10% Off',
        },
        {
          id: 'end',
          type: 'end',
          config: {},
          position: { x: 250, y: 900 },
          edges: [],
          label: 'End',
        },
      ],
      analytics: {
        trackOpens: true,
        trackClicks: true,
        trackConversions: true,
        attributionWindow: {
          click: 7 * 24,
          view: 24,
        },
      },
    },
  },
];

/**
 * Get example for a specific workflow type
 */
export function getExampleForType(type: string): WorkflowExample | undefined {
  return WORKFLOW_EXAMPLES.find((example) =>
    example.output.trigger.type === type
  );
}

/**
 * Format examples for prompt injection
 */
export function formatExamplesForPrompt(): string {
  return WORKFLOW_EXAMPLES.map((example, index) => {
    return `Example ${index + 1}:
Input: "${example.input}"
Output: ${JSON.stringify(example.output, null, 2)}`;
  }).join('\n\n');
}

export default WORKFLOW_EXAMPLES;
