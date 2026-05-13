import { VoiceTemplate } from '../types';

export const cartRecoveryTemplate: VoiceTemplate = {
  id: 'cart_recovery',
  greeting: 'Hi {{customerName}}, this is {{storeName}} calling.',
  message: 'We noticed you left some items in your shopping cart. Your cart contains {{itemCount}} items totaling {{totalAmount}}. Would you like to complete your order today?',
  confirmIntent: "Great! I've sent a payment link to your phone. You can complete your purchase there. Is there anything else I can help you with?",
  declineIntent: 'No problem at all. Is there anything else I can help you with?',
  transferToAgent: "I'll connect you with a customer service representative who can assist you. Please hold the line.",
  goodbye: 'Thank you for your time. Have a great day!'
};

// Alternative templates for different tones
export const cartRecoveryTemplateFriendly: VoiceTemplate = {
  id: 'cart_recovery_friendly',
  greeting: 'Hey {{customerName}}! This is {{storeName}} calling.',
  message: 'Just checking in - we noticed you had some items waiting in your cart. Your cart has {{itemCount}} items worth {{totalAmount}}. Would you love to complete your purchase today?',
  confirmIntent: "That's wonderful! I've sent a secure payment link to your phone. Once you complete the payment, your order will be on its way. Anything else I can help with?",
  declineIntent: 'No worries at all! If you change your mind, your cart is still saved. Anything else I can help you with today?',
  transferToAgent: "Let me connect you with one of our team members who can help you out. Please stay on the line.",
  goodbye: 'Thanks for chatting with us today! Take care and enjoy your shopping!'
};

export const cartRecoveryTemplateUrgent: VoiceTemplate = {
  id: 'cart_recovery_urgent',
  greeting: 'Hello {{customerName}}, this is {{storeName}} calling regarding your pending order.',
  message: 'Your shopping cart with {{itemCount}} items worth {{totalAmount}} will expire soon. Would you like to complete your purchase now to secure these items?',
  confirmIntent: "Excellent! Please check your phone for the payment link. Completing your payment now will guarantee these items at the current price.",
  declineIntent: 'Understood. Please note that these items may sell out soon. Is there anything else I can assist you with?',
  transferToAgent: "I'll transfer you to a representative who can help address your concerns immediately.",
  goodbye: 'Thank you for your time. We hope to serve you again soon.'
};
