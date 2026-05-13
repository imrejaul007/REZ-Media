import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface Config {
  // Server
  port: number;
  nodeEnv: string;

  // OpenAI
  openaiApiKey: string;
  openaiModel: string;
  openaiTemperature: number;
  openaiMaxTokens: number;

  // MongoDB
  mongodbUri: string;
  mongodbOptions: {
    maxPoolSize: number;
    serverSelectionTimeoutMS: number;
  };

  // Redis
  redisUrl: string;
  redisEnabled: boolean;

  // Internal Service
  internalServiceToken: string;

  // Journey Service
  journeyServiceUrl: string;

  // Rate Limiting
  rateLimitRequests: number;
  rateLimitWindowMs: number;

  // Service
  serviceName: string;
  logLevel: string;
}

const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '4054', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  openaiTemperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  openaiMaxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000', 10),

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-prompt-workflow-ai',
  mongodbOptions: {
    maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
    serverSelectionTimeoutMS: parseInt(process.env.MONGODB_TIMEOUT || '5000', 10),
  },

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisEnabled: process.env.REDIS_ENABLED !== 'false',

  // Internal Service
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',

  // Journey Service
  journeyServiceUrl: process.env.JOURNEY_SERVICE_URL || 'http://localhost:4019',

  // Rate Limiting
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),

  // Service
  serviceName: 'rez-prompt-workflow-ai',
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required config
const requiredConfig: (keyof Config)[] = ['openaiApiKey'];

const missingConfig = requiredConfig.filter((key) => !config[key]);

if (missingConfig.length > 0 && config.nodeEnv === 'production') {
  throw new Error(
    `Missing required configuration: ${missingConfig.join(', ')}. Please set these environment variables.`
  );
}

// Warn about missing config in development
if (missingConfig.length > 0 && config.nodeEnv !== 'production') {
  console.warn(
    `[Warning] Missing configuration: ${missingConfig.join(', ')}. Some features may not work.`
  );
}

export default config;
export type { Config };
