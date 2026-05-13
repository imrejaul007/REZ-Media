import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'REDIS_URL',
  'INTERNAL_SERVICE_TOKEN',
];

const OPTIONAL_ENV_VARS = [
  'PORT',
  'NODE_ENV',
  'ZENDESK_SUBDOMAIN',
  'ZENDESK_EMAIL',
  'ZENDESK_API_TOKEN',
  'FRESHDESK_DOMAIN',
  'FRESHDESK_API_KEY',
  'INTERCOM_ACCESS_TOKEN',
  'INTERCOM_CLIENT_ID',
  'INTERCOM_CLIENT_SECRET',
  'INTERCOM_WEBHOOK_SECRET',
  'SYNC_INTERVAL_MINUTES',
  'SYNC_BATCH_SIZE',
  'WEBHOOK_CONCURRENT_LIMIT',
  'REZ_API_BASE_URL',
  'REZ_API_KEY',
];

// Validate required environment variables
const missingVars = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName]);
if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Config object
export const config = {
  server: {
    port: parseInt(process.env.PORT || '4057', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-support-hub',
      options: {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      },
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'rez:support:',
    retryDelayMs: 1000,
    maxRetries: 3,
  },

  security: {
    internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      max: 100,
    },
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
  },

  platforms: {
    zendesk: {
      subdomain: process.env.ZENDESK_SUBDOMAIN || '',
      email: process.env.ZENDESK_EMAIL || '',
      apiToken: process.env.ZENDESK_API_TOKEN || '',
      baseUrl: (subdomain: string) => `https://${subdomain}.zendesk.com/api/v2`,
      timeout: 30000,
      retryAttempts: 3,
    },
    freshdesk: {
      domain: process.env.FRESHDESK_DOMAIN || '',
      apiKey: process.env.FRESHDESK_API_KEY || '',
      baseUrl: (domain: string) => `https://${domain}/api/v2`,
      timeout: 30000,
      retryAttempts: 3,
    },
    intercom: {
      accessToken: process.env.INTERCOM_ACCESS_TOKEN || '',
      clientId: process.env.INTERCOM_CLIENT_ID || '',
      clientSecret: process.env.INTERCOM_CLIENT_SECRET || '',
      webhookSecret: process.env.INTERCOM_WEBHOOK_SECRET || '',
      baseUrl: 'https://api.intercom.io',
      authUrl: 'https://app.intercom.io/oauth',
      timeout: 30000,
      retryAttempts: 3,
    },
  },

  sync: {
    intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10),
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '100', 10),
    webhookConcurrentLimit: parseInt(process.env.WEBHOOK_CONCURRENT_LIMIT || '10', 10),
    maxRetries: 3,
    retryDelayMs: 5000,
    syncHistoryLimit: 100,
  },

  rez: {
    apiBaseUrl: process.env.REZ_API_BASE_URL || 'http://localhost:3000',
    apiKey: process.env.REZ_API_KEY || '',
    timeout: 30000,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'simple',
  },
};

// Platform status check helpers
export const platformConfig = {
  isZendeskConfigured: () => !!(
    config.platforms.zendesk.subdomain &&
    config.platforms.zendesk.email &&
    config.platforms.zendesk.apiToken
  ),

  isFreshdeskConfigured: () => !!(
    config.platforms.freshdesk.domain &&
    config.platforms.freshdesk.apiKey
  ),

  isIntercomConfigured: () => !!(
    config.platforms.intercom.accessToken ||
    (config.platforms.intercom.clientId && config.platforms.intercom.clientSecret)
  ),
};

// Validate platform credentials
export function validatePlatformCredentials(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!platformConfig.isZendeskConfigured()) {
    errors.push('Zendesk: Missing subdomain, email, or API token');
  }

  if (!platformConfig.isFreshdeskConfigured()) {
    errors.push('Freshdesk: Missing domain or API key');
  }

  if (!platformConfig.isIntercomConfigured()) {
    errors.push('Intercom: Missing access token or OAuth credentials');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export config as default
export default config;
