/**
 * WhatsApp Pre-built Templates for REZ Communications Platform
 *
 * This script contains pre-built WhatsApp message templates ready for
 * submission to WhatsApp for approval.
 *
 * Each template includes:
 * - name: Unique template identifier
 * - displayName: Human-readable name for WhatsApp Business Manager
 * - body: Message body with {{variable}} placeholders
 * - variables: Array of variable definitions with descriptions
 * - category: Template category (MARKETING, UTILITY, AUTHENTICATION)
 * - sampleData: Example values for testing
 *
 * Usage:
 *   npx ts-node scripts/whatsapp-templates.ts
 *
 * To submit templates:
 *   1. Copy the template body to WhatsApp Business Manager
 *   2. Replace variables with numbered placeholders {{1}}, {{2}}, etc.
 *   3. Submit for review
 */

export interface WhatsAppTemplateVariable {
  name: string;
  placeholder: string;
  description: string;
  example: string;
  type: 'text' | 'date_time' | 'currency' | 'url';
}

export interface WhatsAppTemplate {
  name: string;
  displayName: string;
  description: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  body: string;
  variables: WhatsAppTemplateVariable[];
  header?: {
    type: 'text' | 'image' | 'video';
    text?: string;
    mediaUrl?: string;
  };
  footer?: string;
  buttons?: Array<{
    type: 'url' | 'phone_number' | 'quick_reply';
    text: string;
    value?: string;
  }>;
  sampleData: Record<string, string>;
}

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

export const WHATSAPP_TEMPLATES: Record<string, WhatsAppTemplate> = {

  // ==========================================================================
  // WELCOME TEMPLATE
  // ==========================================================================

  welcome_rez: {
    name: 'welcome_rez',
    displayName: 'Welcome to REZ',
    description: 'Welcome message for new users joining REZ platform',
    category: 'MARKETING',
    body: 'Hello {{1}}! Welcome to REZ. Your account is ready. Start exploring deals and experiences near you. Use code WELCOME50 for 50 bonus points!',
    variables: [
      {
        name: 'userName',
        placeholder: '{{1}}',
        description: 'User first name',
        example: 'John',
        type: 'text'
      }
    ],
    header: {
      type: 'text',
      text: 'Welcome to REZ!'
    },
    footer: 'Reply STOP to unsubscribe',
    buttons: [
      {
        type: 'url',
        text: 'Explore Deals',
        value: 'https://rez.io/explore'
      }
    ],
    sampleData: {
      '1': 'John'
    }
  },

  // ==========================================================================
  // ORDER CONFIRMATION TEMPLATE
  // ==========================================================================

  order_confirmation_rez: {
    name: 'order_confirmation_rez',
    displayName: 'Order Confirmation',
    description: 'Order confirmation with details and tracking',
    category: 'UTILITY',
    body: 'REZ Order Confirmed! Order #{{1}} | Total: {{2}} | Delivery: {{3}}. Track: {{4}}. Thank you for shopping with us!',
    variables: [
      {
        name: 'orderId',
        placeholder: '{{1}}',
        description: 'Order reference number',
        example: 'REZ-2024-12345',
        type: 'text'
      },
      {
        name: 'total',
        placeholder: '{{2}}',
        description: 'Order total amount',
        example: '$49.99',
        type: 'currency'
      },
      {
        name: 'deliveryDate',
        placeholder: '{{3}}',
        description: 'Estimated delivery date',
        example: 'May 15, 2024',
        type: 'date_time'
      },
      {
        name: 'trackingUrl',
        placeholder: '{{4}}',
        description: 'Order tracking URL',
        example: 'https://rez.io/track/REZ-2024-12345',
        type: 'url'
      }
    ],
    header: {
      type: 'text',
      text: 'Order Confirmed!'
    },
    footer: 'Need help? Contact support@rez.io',
    buttons: [
      {
        type: 'url',
        text: 'Track Order',
        value: 'https://rez.io/track/'
      },
      {
        type: 'quick_reply',
        text: 'Get Help'
      }
    ],
    sampleData: {
      '1': 'REZ-2024-12345',
      '2': '$49.99',
      '3': 'May 15, 2024',
      '4': 'https://rez.io/track/REZ-2024-12345'
    }
  },

  // ==========================================================================
  // ABANDONED CART TEMPLATE
  // ==========================================================================

  abandoned_cart_rez: {
    name: 'abandoned_cart_rez',
    displayName: 'Abandoned Cart Recovery',
    description: 'Reminder for users who left items in their cart',
    category: 'MARKETING',
    body: 'Hi {{1}}, you left items in your cart! Complete your purchase now and get {{2}}% off. Shop now: {{3}}. Offer expires in {{4}} hours!',
    variables: [
      {
        name: 'userName',
        placeholder: '{{1}}',
        description: 'User first name',
        example: 'John',
        type: 'text'
      },
      {
        name: 'discountPercent',
        placeholder: '{{2}}',
        description: 'Discount percentage',
        example: '15',
        type: 'text'
      },
      {
        name: 'cartUrl',
        placeholder: '{{3}}',
        description: 'Link to cart',
        example: 'https://rez.io/cart',
        type: 'url'
      },
      {
        name: 'expiryHours',
        placeholder: '{{4}}',
        description: 'Hours until offer expires',
        example: '24',
        type: 'text'
      }
    ],
    header: {
      type: 'text',
      text: 'Complete Your Order!'
    },
    footer: 'Use code CART15 at checkout',
    buttons: [
      {
        type: 'url',
        text: 'Complete Purchase',
        value: 'https://rez.io/cart'
      },
      {
        type: 'quick_reply',
        text: 'Remove Items'
      }
    ],
    sampleData: {
      '1': 'John',
      '2': '15',
      '3': 'https://rez.io/cart',
      '4': '24'
    }
  },

  // ==========================================================================
  // PROMOTIONAL OFFER TEMPLATE
  // ==========================================================================

  promotional_offer_rez: {
    name: 'promotional_offer_rez',
    displayName: 'Promotional Offer',
    description: 'General promotional campaign message',
    category: 'MARKETING',
    body: '{{1}}! {{2}} only! Use code {{3}} for {{4}}% off {{5}}. Valid until {{6}}. {{7}}',
    variables: [
      {
        name: 'greeting',
        placeholder: '{{1}}',
        description: 'Personalized greeting or user name',
        example: 'Hi John!',
        type: 'text'
      },
      {
        name: 'offerType',
        placeholder: '{{2}}',
        description: 'Type of offer (Flash Sale, Limited Time, etc.)',
        example: 'Flash Sale',
        type: 'text'
      },
      {
        name: 'promoCode',
        placeholder: '{{3}}',
        description: 'Promotional code',
        example: 'SAVE20',
        type: 'text'
      },
      {
        name: 'discountPercent',
        placeholder: '{{4}}',
        description: 'Discount percentage',
        example: '20',
        type: 'text'
      },
      {
        name: 'applicableItems',
        placeholder: '{{5}}',
        description: 'What the discount applies to',
        example: 'on all orders',
        type: 'text'
      },
      {
        name: 'expiryDate',
        placeholder: '{{6}}',
        description: 'Offer expiration date',
        example: 'May 31, 2024',
        type: 'date_time'
      },
      {
        name: 'cta',
        placeholder: '{{7}}',
        description: 'Call to action text',
        example: 'Shop now!',
        type: 'text'
      }
    ],
    header: {
      type: 'text',
      text: 'Special Offer Inside!'
    },
    footer: 'Terms apply. Cannot be combined with other offers.',
    buttons: [
      {
        type: 'url',
        text: 'Shop Now',
        value: 'https://rez.io/shop'
      },
      {
        type: 'quick_reply',
        text: 'View All Deals'
      }
    ],
    sampleData: {
      '1': 'Hi John!',
      '2': 'Flash Sale',
      '3': 'SAVE20',
      '4': '20',
      '5': 'on all orders',
      '6': 'May 31, 2024',
      '7': 'Shop now!'
    }
  },

  // ==========================================================================
  // APPOINTMENT REMINDER TEMPLATE
  // ==========================================================================

  appointment_reminder_rez: {
    name: 'appointment_reminder_rez',
    displayName: 'Appointment Reminder',
    description: 'Reminder for upcoming appointments or reservations',
    category: 'UTILITY',
    body: 'Reminder: {{1}} appointment at {{2}} tomorrow at {{3}}. Address: {{4}}. Need to reschedule? {{5}}',
    variables: [
      {
        name: 'serviceType',
        placeholder: '{{1}}',
        description: 'Type of appointment/service',
        example: 'Haircut',
        type: 'text'
      },
      {
        name: 'merchantName',
        placeholder: '{{2}}',
        description: 'Business name',
        example: 'Studio Cuts',
        type: 'text'
      },
      {
        name: 'appointmentTime',
        placeholder: '{{3}}',
        description: 'Appointment time',
        example: '2:00 PM',
        type: 'date_time'
      },
      {
        name: 'address',
        placeholder: '{{4}}',
        description: 'Business address',
        example: '123 Main St, New York',
        type: 'text'
      },
      {
        name: 'rescheduleUrl',
        placeholder: '{{5}}',
        description: 'Link to reschedule',
        example: 'https://rez.io/reschedule',
        type: 'url'
      }
    ],
    header: {
      type: 'text',
      text: 'Appointment Tomorrow'
    },
    footer: 'See you soon!',
    buttons: [
      {
        type: 'url',
        text: 'Get Directions',
        value: 'https://rez.io/directions/'
      },
      {
        type: 'quick_reply',
        text: 'Confirm'
      },
      {
        type: 'quick_reply',
        text: 'Reschedule'
      }
    ],
    sampleData: {
      '1': 'Haircut',
      '2': 'Studio Cuts',
      '3': '2:00 PM',
      '4': '123 Main St, New York, NY 10001',
      '5': 'https://rez.io/reschedule'
    }
  },

  // ==========================================================================
  // ADDITIONAL UTILITY TEMPLATES
  // ==========================================================================

  payment_success_rez: {
    name: 'payment_success_rez',
    displayName: 'Payment Success',
    description: 'Confirmation of successful payment',
    category: 'UTILITY',
    body: 'Payment received! {{1}} paid to REZ. Transaction ID: {{2}}. {{3}}',
    variables: [
      {
        name: 'amount',
        placeholder: '{{1}}',
        description: 'Amount paid',
        example: '$100.00',
        type: 'currency'
      },
      {
        name: 'transactionId',
        placeholder: '{{2}}',
        description: 'Payment transaction ID',
        example: 'TXN-123456',
        type: 'text'
      },
      {
        name: 'additionalInfo',
        placeholder: '{{3}}',
        description: 'Additional payment info',
        example: 'Thank you for your purchase!',
        type: 'text'
      }
    ],
    header: {
      type: 'text',
      text: 'Payment Successful'
    },
    footer: 'Questions? support@rez.io',
    buttons: [
      {
        type: 'url',
        text: 'View Receipt',
        value: 'https://rez.io/receipt/'
      }
    ],
    sampleData: {
      '1': '$100.00',
      '2': 'TXN-123456',
      '3': 'Thank you for your purchase!'
    }
  },

  delivery_update_rez: {
    name: 'delivery_update_rez',
    displayName: 'Delivery Update',
    description: 'Shipping/delivery status update',
    category: 'UTILITY',
    body: 'Your order #{{1}} is on its way! Status: {{2}}. {{3}}. Track: {{4}}',
    variables: [
      {
        name: 'orderId',
        placeholder: '{{1}}',
        description: 'Order reference number',
        example: 'REZ-2024-12345',
        type: 'text'
      },
      {
        name: 'status',
        placeholder: '{{2}}',
        description: 'Current delivery status',
        example: 'Out for delivery',
        type: 'text'
      },
      {
        name: 'eta',
        placeholder: '{{3}}',
        description: 'Estimated arrival time',
        example: 'Arriving by 5 PM today',
        type: 'date_time'
      },
      {
        name: 'trackingUrl',
        placeholder: '{{4}}',
        description: 'Tracking page URL',
        example: 'https://rez.io/track/REZ-2024-12345',
        type: 'url'
      }
    ],
    header: {
      type: 'text',
      text: 'Delivery Update'
    },
    footer: 'Need help? Reply to this message',
    buttons: [
      {
        type: 'url',
        text: 'Track Package',
        value: 'https://rez.io/track/'
      }
    ],
    sampleData: {
      '1': 'REZ-2024-12345',
      '2': 'Out for delivery',
      '3': 'Arriving by 5 PM today',
      '4': 'https://rez.io/track/REZ-2024-12345'
    }
  },

  // ==========================================================================
  // AUTHENTICATION TEMPLATES
  // ==========================================================================

  otp_verification_rez: {
    name: 'otp_verification_rez',
    displayName: 'OTP Verification',
    description: 'One-time password for authentication',
    category: 'AUTHENTICATION',
    body: 'REZ Verification Code: {{1}}. Valid for {{2}} minutes. Do not share this code with anyone.',
    variables: [
      {
        name: 'otpCode',
        placeholder: '{{1}}',
        description: '6-digit verification code',
        example: '123456',
        type: 'text'
      },
      {
        name: 'validityMinutes',
        placeholder: '{{2}}',
        description: 'Code validity in minutes',
        example: '10',
        type: 'text'
      }
    ],
    footer: 'If you did not request this, ignore this message.',
    sampleData: {
      '1': '123456',
      '2': '10'
    }
  },

  // ==========================================================================
  // CUSTOMER ENGAGEMENT TEMPLATES
  // ==========================================================================

  review_request_rez: {
    name: 'review_request_rez',
    displayName: 'Review Request',
    description: 'Request customer review after purchase',
    category: 'MARKETING',
    body: 'Hi {{1}}! How was your experience at {{2}}? Your feedback helps other customers. {{3}}',
    variables: [
      {
        name: 'userName',
        placeholder: '{{1}}',
        description: 'Customer first name',
        example: 'John',
        type: 'text'
      },
      {
        name: 'merchantName',
        placeholder: '{{2}}',
        description: 'Business name',
        example: 'Studio Cuts',
        type: 'text'
      },
      {
        name: 'reviewUrl',
        placeholder: '{{3}}',
        description: 'Link to leave review',
        example: 'https://rez.io/review/order123',
        type: 'url'
      }
    ],
    header: {
      type: 'text',
      text: 'How Was Your Visit?'
    },
    footer: 'Thank you for being a REZ customer!',
    buttons: [
      {
        type: 'url',
        text: 'Leave Review',
        value: 'https://rez.io/review/'
      },
      {
        type: 'quick_reply',
        text: 'Contact Support'
      }
    ],
    sampleData: {
      '1': 'John',
      '2': 'Studio Cuts',
      '3': 'https://rez.io/review/order123'
    }
  },

  loyalty_reward_rez: {
    name: 'loyalty_reward_rez',
    displayName: 'Loyalty Reward',
    description: 'Reward notification for loyal customers',
    category: 'MARKETING',
    body: 'Congratulations {{1}}! You earned {{2}} bonus points! {{3}}. Redeem at checkout. Points expire {{4}}.',
    variables: [
      {
        name: 'userName',
        placeholder: '{{1}}',
        description: 'Customer first name',
        example: 'John',
        type: 'text'
      },
      {
        name: 'points',
        placeholder: '{{2}}',
        description: 'Number of points earned',
        example: '500',
        type: 'text'
      },
      {
        name: 'reason',
        placeholder: '{{3}}',
        description: 'Reason for reward',
        example: 'Thank you for your recent purchase!',
        type: 'text'
      },
      {
        name: 'expiryDate',
        placeholder: '{{4}}',
        description: 'Points expiration date',
        example: 'June 30, 2024',
        type: 'date_time'
      }
    ],
    header: {
      type: 'text',
      text: 'Points Earned!'
    },
    footer: 'Check your rewards wallet in the app.',
    buttons: [
      {
        type: 'url',
        text: 'View Rewards',
        value: 'https://rez.io/rewards'
      }
    ],
    sampleData: {
      '1': 'John',
      '2': '500',
      '3': 'Thank you for your recent purchase!',
      '4': 'June 30, 2024'
    }
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all templates
 */
export function getAllTemplates(): Record<string, WhatsAppTemplate> {
  return { ...WHATSAPP_TEMPLATES };
}

/**
 * Get template by name
 */
export function getTemplate(name: string): WhatsAppTemplate | null {
  return WHATSAPP_TEMPLATES[name] || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: WhatsAppTemplate['category']): WhatsAppTemplate[] {
  return Object.values(WHATSAPP_TEMPLATES).filter(
    template => template.category === category
  );
}

/**
 * Get template body formatted for WhatsApp Business Manager submission
 */
export function getTemplateForSubmission(name: string): string | null {
  const template = getTemplate(name);
  if (!template) return null;

  let formatted = template.body;

  // Add header if exists
  if (template.header?.type === 'text' && template.header.text) {
    formatted = `${template.header.text}\n\n${formatted}`;
  }

  // Add footer if exists
  if (template.footer) {
    formatted = `${formatted}\n\n${template.footer}`;
  }

  return formatted;
}

/**
 * Generate Twilio Content SID format (for use in API calls)
 * Note: This is the SID assigned by Twilio after template approval
 */
export function getTemplateContentSid(name: string): string {
  // Format: Content SID starts with 'HX' for WhatsApp templates
  // After approval in Twilio Console, the SID will be like: HXxxxxxxxx
  return `HX${name.replace(/_/g, '')}`;
}

/**
 * Validate template has all required variables
 */
export function validateTemplate(template: WhatsAppTemplate): {
  valid: boolean;
  errors: string[]
} {
  const errors: string[] = [];

  // Check body has variables defined
  const bodyVariableMatches = template.body.match(/\{\{(\d+)\}\}/g) || [];
  const definedPlaceholders = template.variables.map(v => v.placeholder);

  // Check all placeholders in body have definitions
  const missingVariables = bodyVariableMatches.filter(
    match => !definedPlaceholders.includes(match)
  );

  if (missingVariables.length > 0) {
    errors.push(`Missing variable definitions for: ${[...new Set(missingVariables)].join(', ')}`);
  }

  // Check body length (max 4096 characters for WhatsApp)
  if (template.body.length > 4096) {
    errors.push(`Body exceeds 4096 character limit (current: ${template.body.length})`);
  }

  // Check header text length (max 60 characters)
  if (template.header?.type === 'text' && template.header.text) {
    if (template.header.text.length > 60) {
      errors.push(`Header text exceeds 60 character limit (current: ${template.header.text.length})`);
    }
  }

  // Check footer text length (max 60 characters)
  if (template.footer && template.footer.length > 60) {
    errors.push(`Footer text exceeds 60 character limit (current: ${template.footer.length})`);
  }

  // Check button count (max 3 quick reply or 2 URL + 1 quick reply)
  const urlButtons = template.buttons?.filter(b => b.type === 'url').length || 0;
  const quickReplyButtons = template.buttons?.filter(b => b.type === 'quick_reply').length || 0;
  if (urlButtons > 2) {
    errors.push('Maximum 2 URL buttons allowed');
  }
  if ((urlButtons + quickReplyButtons) > 3) {
    errors.push('Maximum 3 buttons total allowed');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// CLI OUTPUT
// ============================================================================

function printTemplate(template: WhatsAppTemplate): void {
  console.log('\n' + '='.repeat(80));
  console.log(`TEMPLATE: ${template.name}`);
  console.log('='.repeat(80));
  console.log(`Display Name: ${template.displayName}`);
  console.log(`Category: ${template.category}`);
  console.log(`Description: ${template.description}`);
  console.log('\n--- MESSAGE BODY ---');
  console.log(template.body);
  console.log('\n--- VARIABLES ---');
  template.variables.forEach(v => {
    console.log(`  ${v.placeholder} (${v.type}): ${v.description}`);
    console.log(`    Example: ${v.example}`);
  });
  if (template.header) {
    console.log('\n--- HEADER ---');
    console.log(`  Type: ${template.header.type}`);
    if (template.header.text) console.log(`  Text: ${template.header.text}`);
    if (template.header.mediaUrl) console.log(`  Media: ${template.header.mediaUrl}`);
  }
  if (template.footer) {
    console.log('\n--- FOOTER ---');
    console.log(`  ${template.footer}`);
  }
  if (template.buttons && template.buttons.length > 0) {
    console.log('\n--- BUTTONS ---');
    template.buttons.forEach((b, i) => {
      console.log(`  ${i + 1}. [${b.type}] ${b.text}`);
      if (b.value) console.log(`     Value: ${b.value}`);
    });
  }
  console.log('\n--- SAMPLE DATA ---');
  Object.entries(template.sampleData).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  const validation = validateTemplate(template);
  if (!validation.valid) {
    console.log('\n--- VALIDATION ERRORS ---');
    validation.errors.forEach(err => console.log(`  ERROR: ${err}`));
  }
}

function printSummary(): void {
  const templates = Object.values(WHATSAPP_TEMPLATES);
  const byCategory = {
    MARKETING: templates.filter(t => t.category === 'MARKETING').length,
    UTILITY: templates.filter(t => t.category === 'UTILITY').length,
    AUTHENTICATION: templates.filter(t => t.category === 'AUTHENTICATION').length,
  };

  console.log('\n' + '='.repeat(80));
  console.log('WHATSAPP TEMPLATES SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Templates: ${templates.length}`);
  console.log(`  - MARKETING: ${byCategory.MARKETING}`);
  console.log(`  - UTILITY: ${byCategory.UTILITY}`);
  console.log(`  - AUTHENTICATION: ${byCategory.AUTHENTICATION}`);

  console.log('\n--- USAGE INSTRUCTIONS ---');
  console.log(`
1. Go to Twilio Console > Messaging > Templates
   OR WhatsApp Business Manager > Templates

2. Click "Create Template"

3. Fill in:
   - Template Name: ${templates[0].name.replace('_rez', '')}
   - Language: English (en)
   - Category: Select based on template type

4. Copy the MESSAGE BODY (use {{1}}, {{2}} placeholders)

5. Add variables as defined in VARIABLES section

6. Add header, footer, and buttons as needed

7. Submit for review (typically 24-48 hours)

8. Once approved, use the Content SID in API calls:
   twilioClient.messages.create({
     to: 'whatsapp:+1234567890',
     from: 'whatsapp:+0987654321',
     contentSid: 'HX...' // Assigned by Twilio after approval
   });
  `);
}

// ============================================================================
// MAIN
// ============================================================================

if (require.main === module) {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     REZ Communications Platform - WhatsApp Templates                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');

  printSummary();

  // Print all templates
  Object.values(WHATSAPP_TEMPLATES).forEach(printTemplate);

  console.log('\n' + '='.repeat(80));
  console.log('Run "npx ts-node scripts/whatsapp-templates.ts <template-name>" to get a specific template');
  console.log('='.repeat(80) + '\n');
}

// Export for use in other modules
export default WHATSAPP_TEMPLATES;
