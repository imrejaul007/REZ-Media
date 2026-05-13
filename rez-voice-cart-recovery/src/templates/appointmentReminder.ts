import { VoiceTemplate } from '../types';

export const appointmentReminderTemplate: VoiceTemplate = {
  id: 'appointment_reminder',
  greeting: 'Hello {{customerName}}, this is {{storeName}} calling with an appointment reminder.',
  message: "This is a reminder about your upcoming appointment scheduled for {{appointmentTime}}. Would you like to confirm your appointment?",
  confirmIntent: "Great! Your appointment on {{appointmentTime}} is confirmed. We look forward to seeing you. Is there anything else I can help you with?",
  declineIntent: 'I understand you need to reschedule. Would you like me to connect you with our scheduling team?',
  transferToAgent: "I'll transfer you to our scheduling team who can help you reschedule or modify your appointment.",
  goodbye: 'Thank you. Have a great day!'
};

// Alternative templates
export const appointmentReminderTemplate24Hour: VoiceTemplate = {
  id: 'appointment_reminder_24h',
  greeting: 'Good day {{customerName}}, this is {{storeName}} calling.',
  message: "This is a friendly reminder that you have an appointment scheduled for tomorrow at {{appointmentTime}}. We wanted to make sure you're still available. Please say yes to confirm your appointment, or no if you need to reschedule.",
  confirmIntent: "Wonderful! Your appointment for tomorrow at {{appointmentTime}} is all set. We look forward to seeing you then. Is there anything else?",
  declineIntent: 'No problem. Let me connect you with our team so you can find a more convenient time.',
  transferToAgent: "I'll connect you with our scheduling department right away.",
  goodbye: 'Thank you for your time. See you tomorrow!'
};

export const appointmentReminderTemplateMedical: VoiceTemplate = {
  id: 'appointment_reminder_medical',
  greeting: 'Hello {{customerName}}, this is {{storeName}} calling.',
  message: "This is a reminder about your appointment tomorrow at {{appointmentTime}}. Please arrive 15 minutes early to complete any necessary paperwork. Also, please bring any relevant medical documents or insurance information. Would you like to confirm your appointment?",
  confirmIntent: "Perfect! Your appointment is confirmed for tomorrow at {{appointmentTime}}. Remember to arrive 15 minutes early with your documents. We look forward to seeing you.",
  declineIntent: 'I understand. Let me transfer you to our scheduling desk to reschedule your appointment.',
  transferToAgent: "I'll transfer you to our scheduling team who can help you reschedule or address any concerns.",
  goodbye: 'Thank you. Take care!'
};
