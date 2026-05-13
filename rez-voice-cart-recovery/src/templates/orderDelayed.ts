import { VoiceTemplate } from '../types';

export const orderDelayedTemplate: VoiceTemplate = {
  id: 'order_delayed',
  greeting: 'Hello {{customerName}}, this is {{storeName}} calling about your order.',
  message: "We're calling to inform you that your order {{orderId}} has been delayed. The estimated new delivery date is {{estimatedDelivery}}. We apologize for any inconvenience. Would you like to speak with someone about this?",
  confirmIntent: "Thank you for your patience. Your order is being prioritized and will arrive by {{estimatedDelivery}}. You can track your order using the tracking number {{trackingNumber}}. Is there anything else I can help you with?",
  declineIntent: 'I understand. We apologize for the delay. Is there anything else I can assist you with?',
  transferToAgent: "I'll connect you with our customer support team who can provide more details and assist you further.",
  goodbye: 'Thank you for your patience and understanding. Have a great day!'
};

// Alternative templates
export const orderDelayedTemplateApologetic: VoiceTemplate = {
  id: 'order_delayed_apologetic',
  greeting: 'Dear {{customerName}}, this is {{storeName}} calling.',
  message: "We sincerely apologize, but your order {{orderId}} has experienced a delay. We know how important timely delivery is, and we're working hard to get your order to you as soon as possible. The new estimated delivery date is {{estimatedDelivery}}. We truly appreciate your patience and understanding.",
  confirmIntent: "Thank you so much for your understanding! Your order is our priority and will arrive by {{estimatedDelivery}}. You can track your order anytime using tracking number {{trackingNumber}}. Is there anything else we can help you with?",
  declineIntent: "We completely understand your frustration, and we're sorry for the inconvenience. Let me transfer you to a specialist who can discuss compensation options.",
  transferToAgent: "I want to make this right for you. Let me connect you with our customer satisfaction team.",
  goodbye: 'Again, we sincerely apologize for the inconvenience. Thank you for choosing us.'
};

export const orderDelayedTemplateQuick: VoiceTemplate = {
  id: 'order_delayed_quick',
  greeting: 'Hi {{customerName}}, this is {{storeName}} calling.',
  message: "Quick update: Your order {{orderId}} is running late. New delivery: {{estimatedDelivery}}. Want details? Say yes.",
  confirmIntent: "Got it. Your order arrives by {{estimatedDelivery}}. Track with {{trackingNumber}}. Anything else?",
  declineIntent: 'Sorry for the wait. Need anything else?',
  transferToAgent: "Transferring you now.",
  goodbye: 'Thanks for your patience, bye!'
};
