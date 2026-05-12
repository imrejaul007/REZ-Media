import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4005'),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/rez-whatsapp-store'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Internal Service Tokens
  INTERNAL_SERVICE_TOKENS_JSON: z.string(),

  // JWT
  JWT_SECRET: z.string(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_WHATSAPP_FROM_NUMBER: z.string(),

  // WhatsApp Business
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string(),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  WHATSAPP_VERIFY_TOKEN: z.string(),
  WHATSAPP_APP_SECRET: z.string(),

  // Razorpay
  RAZORPAY_KEY_ID: z.string(),
  RAZORPAY_KEY_SECRET: z.string(),

  // Service URLs
  WALLET_SERVICE_URL: z.string().default('http://localhost:4002'),
  PAYMENT_SERVICE_URL: z.string().default('http://localhost:4003'),
  ORDER_SERVICE_URL: z.string().default('http://localhost:4004'),
  USER_SERVICE_URL: z.string().default('http://localhost:4001'),
  COMMUNICATIONS_URL: z.string().default('http://localhost:3000'),

  // Store Settings
  STORE_NAME: z.string().default('REZ Store'),
  DEFAULT_CURRENCY: z.string().default('INR'),
  DEFAULT_LANGUAGE: z.string().default('en'),

  // Delivery
  DEFAULT_DELIVERY_FEE: z.coerce.number().default(30),
  FREE_DELIVERY_THRESHOLD: z.coerce.number().default(499),
  MAX_DELIVERY_RADIUS_KM: z.coerce.number().default(10),

  // Cart
  CART_EXPIRY_HOURS: z.coerce.number().default(24),
  MIN_ORDER_VALUE: z.coerce.number().default(99),
  MAX_ORDER_VALUE: z.coerce.number().default(50000),

  // Rate Limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().default(60),
  RATE_LIMIT_BURST: z.coerce.number().default(10),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Environment validation failed:', error.errors);
    throw new Error(`Invalid environment configuration: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
  }
  throw error;
}

// Parse internal service tokens
const internalServiceTokens = JSON.parse(config.INTERNAL_SERVICE_TOKENS_JSON) as Record<string, string>;

export const appConfig = {
  env: config.NODE_ENV,
  port: parseInt(config.PORT, 10),

  mongodb: {
    uri: config.MONGODB_URI,
  },

  redis: {
    url: config.REDIS_URL,
  },

  internalTokens: internalServiceTokens,

  jwt: {
    secret: config.JWT_SECRET,
  },

  twilio: {
    accountSid: config.TWILIO_ACCOUNT_SID,
    authToken: config.TWILIO_AUTH_TOKEN,
    whatsappFrom: config.TWILIO_WHATSAPP_FROM_NUMBER,
  },

  whatsapp: {
    businessAccountId: config.WHATSAPP_BUSINESS_ACCOUNT_ID,
    phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: config.WHATSAPP_VERIFY_TOKEN,
    appSecret: config.WHATSAPP_APP_SECRET,
  },

  razorpay: {
    keyId: config.RAZORPAY_KEY_ID,
    keySecret: config.RAZORPAY_KEY_SECRET,
  },

  services: {
    wallet: config.WALLET_SERVICE_URL,
    payment: config.PAYMENT_SERVICE_URL,
    order: config.ORDER_SERVICE_URL,
    user: config.USER_SERVICE_URL,
    communications: config.COMMUNICATIONS_URL,
  },

  store: {
    name: config.STORE_NAME,
    currency: config.DEFAULT_CURRENCY,
    language: config.DEFAULT_LANGUAGE,
  },

  delivery: {
    defaultFee: config.DEFAULT_DELIVERY_FEE,
    freeThreshold: config.FREE_DELIVERY_THRESHOLD,
    maxRadiusKm: config.MAX_DELIVERY_RADIUS_KM,
  },

  cart: {
    expiryHours: config.CART_EXPIRY_HOURS,
    minOrderValue: config.MIN_ORDER_VALUE,
    maxOrderValue: config.MAX_ORDER_VALUE,
  },

  rateLimit: {
    requestsPerMinute: config.RATE_LIMIT_REQUESTS_PER_MINUTE,
    burst: config.RATE_LIMIT_BURST,
  },

  logging: {
    level: config.LOG_LEVEL,
  },
} as const;

export type AppConfig = typeof appConfig;

// Singleton for runtime config updates
export class ConfigManager {
  private static instance: ConfigManager;
  private currentConfig: typeof appConfig;

  private constructor() {
    this.currentConfig = appConfig;
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  get(): typeof appConfig {
    return this.currentConfig;
  }

  getInternalToken(serviceName: string): string | undefined {
    return this.currentConfig.internalTokens[serviceName];
  }

  isProduction(): boolean {
    return this.currentConfig.env === 'production';
  }

  isDevelopment(): boolean {
    return this.currentConfig.env === 'development';
  }
}

export const configManager = ConfigManager.getInstance();

export default appConfig;
