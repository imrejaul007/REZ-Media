import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4061', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/dsp_bidder',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Auth
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // DSP Config
  dsp: {
    name: process.env.DSP_NAME || 'ReZ-DSP',
    id: process.env.DSP_ID || 'rez_dsp_001',
  },

  // Exchange Config
  exchanges: {
    google: {
      endpoint: process.env.GOOGLE_ADX_ENDPOINT || '',
      token: process.env.GOOGLE_ADX_TOKEN || '',
    },
    amazon: {
      endpoint: process.env.AMAZON_TAM_ENDPOINT || '',
      token: process.env.AMAZON_TAM_TOKEN || '',
    },
  },

  // Budget Config
  budget: {
    daily: parseInt(process.env.DAILY_BUDGET || '100000', 10),
    maxBidPrice: parseFloat(process.env.MAX_BID_PRICE || '100'),
    minBidPrice: parseFloat(process.env.MIN_BID_PRICE || '1'),
  },

  // Targeting Defaults
  targeting: {
    defaultGeo: process.env.DEFAULT_GEO || 'IN',
    defaultScreenTypes: (process.env.DEFAULT_SCREEN_TYPES || 'billboard_led,retail_kiosk,cab_tablet').split(','),
  },
};
