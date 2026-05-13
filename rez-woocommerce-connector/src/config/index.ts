/**
 * Configuration Module
 *
 * Centralized configuration management using environment variables.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment variable schema validation
const envSchema = z.object({
  PORT: z.string().default('4051'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/woocommerce-connector'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Internal Service Token (RABTUL pattern)
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  INTERNAL_SERVICE_TOKENS_JSON: z.string().optional(),

  // WooCommerce specific
  WOOCOMMERCE_WEBHOOK_SECRET: z.string().optional(),

  // ReZ Platform Services
  REZ_IDENTITY_SERVICE_URL: z.string().default('http://localhost:4001'),
  REZ_ORDER_SERVICE_URL: z.string().default('http://localhost:4003'),
  REZ_PRODUCT_SERVICE_URL: z.string().default('http://localhost:4005'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Configuration validation failed:', error.errors);
    throw new Error(`Invalid environment configuration: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
  }
  throw error;
}

// Export parsed configuration
export const appConfig = {
  port: parseInt(config.PORT, 10),
  nodeEnv: config.NODE_ENV,
  isProduction: config.NODE_ENV === 'production',
  isDevelopment: config.NODE_ENV === 'development',
  isTest: config.NODE_ENV === 'test',

  mongodb: {
    uri: config.MONGODB_URI,
  },

  redis: {
    url: config.REDIS_URL,
  },

  internalServiceToken: config.INTERNAL_SERVICE_TOKEN,
  internalServiceTokensJson: config.INTERNAL_SERVICE_TOKENS_JSON,

  woocommerce: {
    webhookSecret: config.WOOCOMMERCE_WEBHOOK_SECRET,
  },

  rezServices: {
    identityServiceUrl: config.REZ_IDENTITY_SERVICE_URL,
    orderServiceUrl: config.REZ_ORDER_SERVICE_URL,
    productServiceUrl: config.REZ_PRODUCT_SERVICE_URL,
  },

  logging: {
    level: config.LOG_LEVEL,
  },
} as const;

// Parse internal service tokens
export function getServiceTokens(): Record<string, string> {
  if (!appConfig.internalServiceTokensJson) {
    if (appConfig.internalServiceToken) {
      return { default: appConfig.internalServiceToken };
    }
    return {};
  }
  try {
    return JSON.parse(appConfig.internalServiceTokensJson);
  } catch {
    console.error('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return {};
  }
}

// Redis key prefixes
export const REDIS_KEYS = {
  STORE_PREFIX: 'woo:store:',
  SYNC_STATUS_PREFIX: 'woo:sync:',
  RATE_LIMIT_PREFIX: 'woo:ratelimit:',
  WEBHOOK_DEDUP_PREFIX: 'woo:webhook:',
} as const;

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  STORE_DATA: 300,      // 5 minutes
  SYNC_STATUS: 60,      // 1 minute
  RATE_LIMIT_WINDOW: 60, // 1 minute
  WEBHOOK_DEDUP: 86400, // 24 hours
} as const;

// WooCommerce API rate limits
export const WOOCOMMERCE_RATE_LIMITS = {
  MAX_REQUESTS_PER_SECOND: 4,
  RETRY_AFTER_SECONDS: 1,
  MAX_RETRIES: 3,
} as const;

export default appConfig;
