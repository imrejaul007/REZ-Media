import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  // Server
  port: number;
  env: string;

  // Twilio
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  voiceWebhookUrl: string;

  // MongoDB
  mongodbUri: string;
  mongodbDbName: string;

  // Redis
  redisUrl: string;

  // Service URLs
  automationServiceUrl: string;
  leadIntelligenceUrl: string;
  orderServiceUrl: string;
  unifiedChatUrl: string;

  // Security
  internalServiceToken: string;

  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMax: number;

  // Logging
  logLevel: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '4053', 10),
  env: process.env.NODE_ENV || 'development',

  // Twilio Configuration
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  voiceWebhookUrl: process.env.VOICE_WEBHOOK_URL || '',

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-voice-cart-recovery',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'rez-voice-cart-recovery',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Service URLs
  automationServiceUrl: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:4028',
  leadIntelligenceUrl: process.env.LEAD_INTELLIGENCE_URL || 'http://localhost:3000',
  orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:4003',
  unifiedChatUrl: process.env.UNIFIED_CHAT_URL || 'http://localhost:3000',

  // Security
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',

  // Rate Limiting (100 requests per minute)
  rateLimitWindowMs: 60 * 1000,
  rateLimitMax: 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Validation
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'VOICE_WEBHOOK_URL'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0 && config.env === 'production') {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

if (config.env === 'development') {
  console.warn('⚠️  Running in development mode without all required environment variables');
}

export default config;

export { Config };
