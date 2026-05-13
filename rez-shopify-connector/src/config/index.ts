import type { ShopifyConfig, ServiceEndpoints } from '../types';

// ── Environment Validation ───────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

// ── Shopify Configuration ──────────────────────────────────────────────────────

export const shopifyConfig: ShopifyConfig = {
  apiKey: requireEnv('SHOPIFY_API_KEY'),
  apiSecret: requireEnv('SHOPIFY_API_SECRET'),
  webhookSecret: requireEnv('SHOPIFY_WEBHOOK_SECRET'),
  redirectUri: optionalEnv(
    'SHOPIFY_REDIRECT_URI',
    'http://localhost:4050/api/shopify/callback'
  ),
  scopes: (optionalEnv('SHOPIFY_SCOPES', 'read_products,write_products,read_orders,write_orders,read_customers'))
    .split(',')
    .map((s) => s.trim()),
};

// ── Service Endpoints ─────────────────────────────────────────────────────────

export const serviceEndpoints: ServiceEndpoints = {
  catalogService: optionalEnv('REZ_CATALOG_SERVICE_URL', 'http://localhost:3000'),
  orderService: optionalEnv('REZ_ORDER_SERVICE_URL', 'http://localhost:4003'),
  identityService: optionalEnv('REZ_IDENTITY_SERVICE_URL', 'http://localhost:4001'),
  inventoryService: optionalEnv('REZ_INVENTORY_SERVICE_URL', 'http://localhost:4010'),
};

// ── Internal Service Token ────────────────────────────────────────────────────

export function getInternalToken(): string {
  return requireEnv('INTERNAL_SERVICE_TOKEN');
}

// ── Server Configuration ─────────────────────────────────────────────────────

export const serverConfig = {
  port: parseInt(optionalEnv('PORT', '4050'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  serviceVersion: optionalEnv('SERVICE_VERSION', '1.0.0'),
};

// ── Rate Limiting ─────────────────────────────────────────────────────────────

export const rateLimitConfig = {
  requests: parseInt(optionalEnv('RATE_LIMIT_REQUESTS', '100'), 10),
  windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
};

// ── Sync Configuration ────────────────────────────────────────────────────────

export const syncConfig = {
  batchSize: parseInt(optionalEnv('SYNC_BATCH_SIZE', '50'), 10),
  maxRetries: parseInt(optionalEnv('SYNC_MAX_RETRIES', '3'), 10),
  retryDelayMs: parseInt(optionalEnv('SYNC_RETRY_DELAY_MS', '5000'), 10),
  fullSyncIntervalHours: parseInt(optionalEnv('FULL_SYNC_INTERVAL_HOURS', '24'), 10),
};

// ── Webhook Configuration ─────────────────────────────────────────────────────

export const webhookConfig = {
  topics: [
    'orders/create',
    'orders/updated',
    'orders/deleted',
    'products/create',
    'products/update',
    'products/delete',
    'customers/create',
    'customers/update',
    'inventory_levels/update',
  ] as const,
  retentionDays: parseInt(optionalEnv('WEBHOOK_RETENTION_DAYS', '30'), 10),
};

// ── Validation Helper ─────────────────────────────────────────────────────────

export function validateConfig(): void {
  const errors: string[] = [];

  try {
    shopifyConfig.apiKey;
    shopifyConfig.apiSecret;
    shopifyConfig.webhookSecret;
  } catch (err) {
    errors.push('Shopify configuration is incomplete');
  }

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required');
  }

  if (!process.env.REDIS_URL) {
    errors.push('REDIS_URL is required');
  }

  if (!process.env.INTERNAL_SERVICE_TOKEN) {
    errors.push('INTERNAL_SERVICE_TOKEN is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}
