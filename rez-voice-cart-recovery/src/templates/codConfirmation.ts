import { VoiceTemplate } from '../types';

export const codConfirmationTemplate: VoiceTemplate = {
  id: 'cod_confirmation',
  greeting: 'Hi {{customerName}}, this is {{storeName}} calling about your cash on delivery order.',
  message: "We're calling to confirm your order number {{orderId}}. This is a cash on delivery order. Please confirm if you'd like to proceed with this order. The total amount is {{totalAmount}}.",
  confirmIntent: "Perfect! Your order has been confirmed. The package will be delivered to you and you can pay {{totalAmount}} in cash upon delivery. Is there anything else you'd like to confirm?",
  declineIntent: 'I understand. Your order will be cancelled. Is there anything else I can help you with?',
  transferToAgent: "I'll connect you with our order support team to help resolve any concerns about your order.",
  goodbye: 'Thank you for your time. Have a great day!'
};

// Alternative templates
export const codConfirmationTemplateDetailed: VoiceTemplate = {
  id: 'cod_confirmation_detailed',
  greeting: 'Hello {{customerName}}, this is {{storeName}} calling.',
  message: "We're calling to confirm your order number {{orderId}}. This order is for cash on delivery payment. The total amount to be paid is {{totalAmount}}. Please confirm if you would like to receive this order. If you have any questions about your order, I can help you.",
  confirmIntent: "Thank you for confirming! Your order {{orderId}} is confirmed for cash on delivery. You will receive your package soon, and you can pay {{totalAmount}} in cash when it arrives. Is there anything else you'd like to know?",
  declineIntent: 'I understand. Let me cancel your order. Is there anything else I can help you with?',
  transferToAgent: "I'll transfer you to our order support team who can help you with any questions about your order details.",
  goodbye: 'Thank you for calling. Have a wonderful day!'
};

export const codConfirmationTemplateQuick: VoiceTemplate = {
  id: 'cod_confirmation_quick',
  greeting: 'Hi {{customerName}}, this is {{storeName}} calling.',
  message: "Quick call to confirm your COD order {{orderId}}. Total: {{totalAmount}}. Say yes to confirm, or no to cancel.",
  confirmIntent: "Confirmed! Order {{orderId}} for {{totalAmount}} on delivery. Thanks!",
  declineIntent: 'Order cancelled. Anything else?',
  transferToAgent: "Transferring you now.",
  goodbye: 'Thanks, bye!'
};
