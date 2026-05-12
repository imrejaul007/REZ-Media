import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  apiKey: string;
  apiSecret: string;
  whatsappSandboxNumber: string;
}

export interface WebhookConfig {
  baseUrl: string;
  inboundPath: string;
  statusPath: string;
  outboundPath: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface ProvisioningLimits {
  maxPhoneNumbersPerMerchant: number;
  maxTemplatesPerMerchant: number;
}

export const twilioConfig: TwilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  apiKey: process.env.TWILIO_API_KEY || '',
  apiSecret: process.env.TWILIO_API_SECRET || '',
  whatsappSandboxNumber: process.env.TWILIO_WHATSAPP_SANDBOX_NUMBER || '+14155238886',
};

export const webhookConfig: WebhookConfig = {
  baseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3005',
  inboundPath: process.env.INBOUND_WEBHOOK_PATH || '/webhooks/whatsapp/inbound',
  statusPath: process.env.STATUS_WEBHOOK_PATH || '/webhooks/whatsapp/status',
  outboundPath: process.env.OUTBOUND_WEBHOOK_PATH || '/webhooks/whatsapp/outbound',
};

export const rateLimitConfig: RateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
};

export const provisioningLimits: ProvisioningLimits = {
  maxPhoneNumbersPerMerchant: parseInt(process.env.MAX_PHONE_NUMBERS_PER_MERCHANT || '10', 10),
  maxTemplatesPerMerchant: parseInt(process.env.MAX_TEMPLATES_PER_MERCHANT || '50', 10),
};

export const getTwilioClient = (): twilio.Twilio => {
  return twilio(twilioConfig.accountSid, twilioConfig.authToken);
};

export const getTwilioPricingClient = (): twilio.Twilio => {
  return twilio(twilioConfig.accountSid, twilioConfig.authToken);
};

export const validateTwilioConfig = (): void => {
  const required = ['accountSid', 'authToken'];
  const missing = required.filter(key => !twilioConfig[key as keyof TwilioConfig]);

  if (missing.length > 0) {
    throw new Error(`Missing required Twilio configuration: ${missing.join(', ')}`);
  }

  if (!twilioConfig.accountSid.startsWith('AC')) {
    throw new Error('Invalid Twilio Account SID format. Must start with "AC"');
  }
};

export const getWebhookUrl = (path: string): string => {
  const baseUrl = webhookConfig.baseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};

export default {
  twilioConfig,
  webhookConfig,
  rateLimitConfig,
  provisioningLimits,
  getTwilioClient,
  getTwilioPricingClient,
  validateTwilioConfig,
  getWebhookUrl,
};
