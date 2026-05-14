import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4060', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/ssp_adapter',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Auth
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // SSP Config
  ssp: {
    google: {
      apiKey: process.env.GOOGLE_ADX_API_KEY || '',
      advertiserId: process.env.GOOGLE_ADX_ADVERTISER_ID || '',
    },
    pubmatic: {
      apiKey: process.env.PUBMATIC_API_KEY || '',
      publisherId: process.env.PUBMATIC_PUBLISHER_ID || '',
    },
    indexExchange: {
      apiKey: process.env.INDEX_EXCHANGE_API_KEY || '',
    },
  },

  // DOOH Service
  doohService: {
    url: process.env.DOOH_SERVICE_URL || 'http://localhost:4018',
    token: process.env.DOOH_SERVICE_TOKEN || '',
  },
};

export function validateConfig(): boolean {
  const required = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env: ${key}`);
      return false;
    }
  }
  return true;
}
