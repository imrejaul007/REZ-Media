export const config = {
  // Instagram API Configuration
  instagram: {
    appId: process.env.INSTAGRAM_APP_ID || '',
    appSecret: process.env.INSTAGRAM_APP_SECRET || '',
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    graphApiVersion: 'v18.0',
    baseUrl: 'https://graph.facebook.com',
  },

  // Meta Graph API Configuration
  meta: {
    apiVersion: 'v18.0',
    baseUrl: 'https://graph.facebook.com',
    timeout: 30000,
  },

  // Webhook Configuration
  webhook: {
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'default-verify-token',
    callbackUrl: process.env.WEBHOOK_CALLBACK_URL || '',
  },

  // REZ Orchestrator Configuration
  orchestrator: {
    url: process.env.ORCHESTRATOR_URL || 'http://localhost:4000',
    timeout: 30000,
  },

  // WhatsApp Bridge Configuration
  whatsappBridge: {
    url: process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:4091',
    timeout: 30000,
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    prefix: 'rez:instagram:',
  },

  // Session Configuration
  session: {
    linkExpiry: 24 * 60 * 60 * 1000, // 24 hours
    maxAttempts: 3,
  },

  // Rate Limiting
  rateLimit: {
    dmPerUser: 50, // DMs per user per hour
    commentPerUser: 100, // Comments per user per hour
    messageLength: 2000, // Max message length
  },

  // Intent Detection
  intent: {
    confidenceThreshold: 0.7,
    defaultIntent: 'general_inquiry',
  },
};

// Internal service tokens for service-to-service communication
export function getInternalToken(serviceName: string): string | null {
  try {
    const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    const tokens = JSON.parse(tokensJson);
    return tokens[serviceName] || null;
  } catch {
    return null;
  }
}
