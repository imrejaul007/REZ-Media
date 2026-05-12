/**
 * Configuration management for REZ Voice Billing Service
 * Loads environment variables and provides typed config objects
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables
dotenv.config();

// Environment variable schema validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4005'),
  HOST: z.string().default('0.0.0.0'),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/rez-voice-billing'),
  MONGODB_USER: z.string().optional(),
  MONGODB_PASSWORD: z.string().optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Internal Service Auth
  INTERNAL_SERVICE_TOKENS_JSON: z.string().optional(),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),

  // REZ Media Wallet Integration
  WALLET_SERVICE_URL: z.string().default('http://localhost:4002'),
  WALLET_SERVICE_TOKEN: z.string().optional(),

  // Billing Configuration
  DEFAULT_RATE_PER_MINUTE: z.string().default('0.05'),
  BILLING_INTERVAL_SECONDS: z.string().default('60'),
  MINIMUM_CHARGE_SECONDS: z.string().default('1'),
  FREE_CALL_DURATION_SECONDS: z.string().default('0'),

  // Call Configuration
  MAX_CALL_DURATION_SECONDS: z.string().default('3600'),
  CALL_TIMEOUT_SECONDS: z.string().default('30'),

  // Analytics
  AGGREGATION_BATCH_SIZE: z.string().default('1000'),
  ANALYTICS_RETENTION_DAYS: z.string().default('90'),

  // Queue Configuration
  QUEUE_CONCURRENCY: z.string().default('5'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (config) {
    return config;
  }

  try {
    config = envSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => e.path.join('.'));
      throw new Error(`Missing or invalid environment variables: ${missingVars.join(', ')}`);
    }
    throw error;
  }
}

// Derived configuration values
export function getBillingConfig() {
  const env = getConfig();
  return {
    defaultRatePerMinute: parseFloat(env.DEFAULT_RATE_PER_MINUTE),
    defaultRatePerSecond: parseFloat(env.DEFAULT_RATE_PER_MINUTE) / 60,
    billingIntervalSeconds: parseInt(env.BILLING_INTERVAL_SECONDS, 10),
    minimumChargeSeconds: parseInt(env.MINIMUM_CHARGE_SECONDS, 10),
    freeCallDurationSeconds: parseInt(env.FREE_CALL_DURATION_SECONDS, 10),
    maxCallDurationSeconds: parseInt(env.MAX_CALL_DURATION_SECONDS, 10),
    callTimeoutSeconds: parseInt(env.CALL_TIMEOUT_SECONDS, 10),
    currency: 'INR',
  };
}

export function getServerConfig() {
  const env = getConfig();
  return {
    port: parseInt(env.PORT, 10),
    host: env.HOST,
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
  };
}

export function getMongoConfig() {
  const env = getConfig();
  return {
    uri: env.MONGODB_URI,
    user: env.MONGODB_USER,
    password: env.MONGODB_PASSWORD,
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  };
}

export function getRedisConfig() {
  const env = getConfig();
  return {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT ? parseInt(env.REDIS_PORT, 10) : undefined,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
  };
}

export function getQueueConfig() {
  const env = getConfig();
  return {
    concurrency: parseInt(env.QUEUE_CONCURRENCY, 10),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 1000,
    },
  };
}

export function getRateLimitConfig() {
  const env = getConfig();
  return {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  };
}

export function getServiceTokens(): Record<string, string> {
  const env = getConfig();
  if (!env.INTERNAL_SERVICE_TOKENS_JSON) {
    return {};
  }
  try {
    return JSON.parse(env.INTERNAL_SERVICE_TOKENS_JSON);
  } catch {
    console.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return {};
  }
}

export function getWalletConfig() {
  const env = getConfig();
  return {
    baseUrl: env.WALLET_SERVICE_URL,
    token: env.WALLET_SERVICE_TOKEN || '',
    timeout: 10000,
  };
}

// Export all config
export const configInstance = getConfig();
