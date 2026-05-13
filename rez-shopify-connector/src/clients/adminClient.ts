import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { shopifyConfig } from '../config';
import type {
  ShopifyProduct,
  ShopifyOrder,
  ShopifyCustomer,
  ShopifyInventoryLevel,
  ShopifyLocation,
  ShopifyStoreInfo,
  PaginatedResponse,
  WebhookTopic,
} from '../types';

// ── Rate Limiting ─────────────────────────────────────────────────────────────

interface RateLimitInfo {
  bucket: number;
  renewalTime: number;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_BUCKETS_PER_MINUTE = 40; // Shopify's standard rate limit

async function checkRateLimit(domain: string): Promise<void> {
  const redis = getRedis();
  const key = `shopify:ratelimit:${domain}`;

  const result = await redis.multi()
    .hgetall(key)
    .exec();

  const now = Date.now();
  const rateLimitData = result?.[0]?.[1] as Record<string, string> | null;

  if (!rateLimitData || now > parseInt(rateLimitData.renewalTime || '0', 10)) {
    // Reset or initialize bucket
    await redis.hset(key, {
      bucket: String(MAX_BUCKETS_PER_MINUTE - 1),
      renewalTime: String(now + RATE_LIMIT_WINDOW_MS),
    });
    await redis.expire(key, 60);
    return;
  }

  const bucket = parseInt(rateLimitData.bucket || '0', 10);
  if (bucket <= 0) {
    // Wait until renewal time
    const waitTime = parseInt(rateLimitData.renewalTime || '0', 10) - now;
    if (waitTime > 0) {
      logger.debug(`[AdminClient] Rate limited for ${domain}, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      await redis.hset(key, {
        bucket: String(MAX_BUCKETS_PER_MINUTE - 1),
        renewalTime: String(Date.now() + RATE_LIMIT_WINDOW_MS),
      });
    }
  } else {
    await redis.hincrby(key, 'bucket', -1);
  }
}

async function updateRateLimitInfo(
  domain: string,
  headers: Record<string, string>
): Promise<void> {
  const redis = getRedis();
  const key = `shopify:ratelimit:${domain}`;

  // Shopify returns these headers
  const remainingCalls = parseInt(headers['x-shopify-shop-api-call-limit']?.split('/')[1] || '40', 10);
  const callsRemaining = parseInt(headers['x-shopify-shop-api-call-limit']?.split('/')[0] || '40', 10);

  if (remainingCalls > 0 && callsRemaining <= 3) {
    // Getting close to rate limit, reduce bucket
    const currentBucket = parseInt((await redis.hget(key, 'bucket')) || '5', 10);
    await redis.hset(key, 'bucket', String(Math.min(currentBucket, callsRemaining)));
  }
}

// ── Admin Client ─────────────────────────────────────────────────────────────

export class ShopifyAdminClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly domain: string;
  private client: AxiosInstance;

  constructor(domain: string, accessToken: string) {
    this.domain = domain.toLowerCase();
    this.accessToken = accessToken;
    this.baseUrl = `https://${this.domain}/admin/api/2024-01`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });

    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      await checkRateLimit(this.domain);
      return config;
    });

    // Response interceptor for rate limit updates and retry
    this.client.interceptors.response.use(
      (response) => {
        updateRateLimitInfo(this.domain, response.headers as Record<string, string>);
        return response;
      },
      async (error: AxiosError) => {
        const response = error.response;

        // Handle rate limiting (429)
        if (response?.status === 429) {
          const retryAfter = parseInt(response.headers['retry-after'] || '5', 10);
          logger.warn(`[AdminClient] Rate limited, retrying after ${retryAfter}s`);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return this.client.request(error.config as AxiosRequestConfig);
        }

        // Handle temporary server errors (500-503)
        if (response && response.status >= 500 && response.status < 504) {
          logger.warn(`[AdminClient] Server error ${response.status}, retrying...`);
          return this.client.request(error.config as AxiosRequestConfig);
        }

        return Promise.reject(error);
      }
    );
  }

  // ── Retry Logic with Exponential Backoff ────────────────────────────────────

  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          logger.debug(
            `[AdminClient] Attempt ${attempt + 1} failed, retrying in ${delay}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // ── Store Info ─────────────────────────────────────────────────────────────

  async getStoreInfo(): Promise<ShopifyStoreInfo> {
    const response = await this.withRetry(() =>
      this.client.get<{ shop: ShopifyStoreInfo }>('/shop.json')
    );
    return response.data.shop;
  }

  // ── Products ────────────────────────────────────────────────────────────────

  async getProducts(
    limit = 50,
    sinceId?: number
  ): Promise<PaginatedResponse<ShopifyProduct>> {
    const params: Record<string, string | number> = { limit };
    if (sinceId) params.since_id = sinceId;

    const response = await this.withRetry(() =>
      this.client.get<{ products: ShopifyProduct[] }>('/products.json', { params })
    );

    const products = response.data.products;
    return {
      data: products,
      pageInfo: {
        hasNextPage: products.length === limit,
        hasPreviousPage: !!sinceId,
        endCursor: products.length > 0 ? String(products[products.length - 1].id) : undefined,
        startCursor: products.length > 0 ? String(products[0].id) : undefined,
      },
    };
  }

  async getProduct(productId: number): Promise<ShopifyProduct> {
    const response = await this.withRetry(() =>
      this.client.get<{ product: ShopifyProduct }>(`/products/${productId}.json`)
    );
    return response.data.product;
  }

  async getAllProducts(sinceId?: number): Promise<ShopifyProduct[]> {
    const allProducts: ShopifyProduct[] = [];
    let lastSinceId = sinceId || 0;

    while (true) {
      const result = await this.getProducts(250, lastSinceId);
      allProducts.push(...result.data);

      if (!result.pageInfo.hasNextPage || result.data.length === 0) {
        break;
      }

      lastSinceId = result.data[result.data.length - 1].id;
      logger.debug(
        `[AdminClient] Fetched ${allProducts.length} products so far...`
      );
    }

    return allProducts;
  }

  // ── Orders ───────────────────────────────────────────────────────────────────

  async getOrders(
    limit = 50,
    status: 'any' | 'open' | 'closed' | 'cancelled' = 'any',
    createdAtMin?: string
  ): Promise<PaginatedResponse<ShopifyOrder>> {
    const params: Record<string, string | number> = { limit, status };
    if (createdAtMin) params.created_at_min = createdAtMin;

    const response = await this.withRetry(() =>
      this.client.get<{ orders: ShopifyOrder[] }>('/orders.json', { params })
    );

    const orders = response.data.orders;
    return {
      data: orders,
      pageInfo: {
        hasNextPage: orders.length === limit,
        hasPreviousPage: !!createdAtMin,
        endCursor: orders.length > 0 ? String(orders[orders.length - 1].id) : undefined,
        startCursor: orders.length > 0 ? String(orders[0].id) : undefined,
      },
    };
  }

  async getOrder(orderId: number): Promise<ShopifyOrder> {
    const response = await this.withRetry(() =>
      this.client.get<{ order: ShopifyOrder }>(`/orders/${orderId}.json`)
    );
    return response.data.order;
  }

  async getAllOrders(createdAtMin?: string): Promise<ShopifyOrder[]> {
    const allOrders: ShopifyOrder[] = [];
    let lastId = 0;

    while (true) {
      const result = await this.getOrders(250, 'any', createdAtMin);
      allOrders.push(...result.data);

      if (!result.pageInfo.hasNextPage || result.data.length === 0) {
        break;
      }

      lastId = result.data[result.data.length - 1].id;
      logger.debug(
        `[AdminClient] Fetched ${allOrders.length} orders so far...`
      );
    }

    return allOrders;
  }

  // ── Customers ───────────────────────────────────────────────────────────────

  async getCustomers(
    limit = 50,
    sinceId?: number
  ): Promise<PaginatedResponse<ShopifyCustomer>> {
    const params: Record<string, string | number> = { limit };
    if (sinceId) params.since_id = sinceId;

    const response = await this.withRetry(() =>
      this.client.get<{ customers: ShopifyCustomer[] }>('/customers.json', { params })
    );

    const customers = response.data.customers;
    return {
      data: customers,
      pageInfo: {
        hasNextPage: customers.length === limit,
        hasPreviousPage: !!sinceId,
        endCursor:
          customers.length > 0 ? String(customers[customers.length - 1].id) : undefined,
        startCursor: customers.length > 0 ? String(customers[0].id) : undefined,
      },
    };
  }

  async getCustomer(customerId: number): Promise<ShopifyCustomer> {
    const response = await this.withRetry(() =>
      this.client.get<{ customer: ShopifyCustomer }>(
        `/customers/${customerId}.json`
      )
    );
    return response.data.customer;
  }

  async getAllCustomers(sinceId?: number): Promise<ShopifyCustomer[]> {
    const allCustomers: ShopifyCustomer[] = [];
    let lastSinceId = sinceId || 0;

    while (true) {
      const result = await this.getCustomers(250, lastSinceId);
      allCustomers.push(...result.data);

      if (!result.pageInfo.hasNextPage || result.data.length === 0) {
        break;
      }

      lastSinceId = result.data[result.data.length - 1].id;
      logger.debug(
        `[AdminClient] Fetched ${allCustomers.length} customers so far...`
      );
    }

    return allCustomers;
  }

  // ── Inventory ────────────────────────────────────────────────────────────────

  async getInventoryLevels(
    inventoryItemIds: number[],
    locationId?: number
  ): Promise<ShopifyInventoryLevel[]> {
    const params: Record<string, string | number> = {
      inventory_item_ids: inventoryItemIds.join(','),
    };
    if (locationId) params.location_id = locationId;

    const response = await this.withRetry(() =>
      this.client.get<{ inventory_levels: ShopifyInventoryLevel[] }>(
        '/inventory_levels.json',
        { params }
      )
    );

    return response.data.inventory_levels;
  }

  async getLocations(): Promise<ShopifyLocation[]> {
    const response = await this.withRetry(() =>
      this.client.get<{ locations: ShopifyLocation[] }>('/locations.json')
    );
    return response.data.locations;
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────────

  async registerWebhook(
    topic: WebhookTopic,
    address: string
  ): Promise<{ id: number; address: string; topic: string }> {
    const response = await this.withRetry(() =>
      this.client.post<{ webhook: { id: number; address: string; topic: string } }>(
        '/webhooks.json',
        {
          webhook: {
            topic,
            address,
            format: 'json',
          },
        }
      )
    );
    return response.data.webhook;
  }

  async getWebhooks(): Promise<
    { id: number; address: string; topic: string; created_at: string }[]
  > {
    const response = await this.withRetry(() =>
      this.client.get<{
        webhooks: { id: number; address: string; topic: string; created_at: string }[];
      }>('/webhooks.json')
    );
    return response.data.webhooks;
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    await this.withRetry(() =>
      this.client.delete(`/webhooks/${webhookId}.json`)
    );
  }

  // ── OAuth Token Verification ─────────────────────────────────────────────────

  async verifyAccessToken(): Promise<boolean> {
    try {
      await this.getStoreInfo();
      return true;
    } catch {
      return false;
    }
  }

  // ── Hmac Signature Generation for Request Verification ───────────────────────

  static generateHmac(params: Record<string, string>, secret: string): string {
    const message = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');
  }

  static verifyHmac(
    params: Record<string, string>,
    hmac: string,
    secret: string
  ): boolean {
    const computed = this.generateHmac(params, secret);
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'utf8'),
      Buffer.from(computed, 'utf8')
    );
  }
}

// ── Webhook Verification ───────────────────────────────────────────────────────

export function verifyWebhookSignature(
  body: string,
  hmacHeader: string,
  secret: string
): boolean {
  const computedHmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader, 'utf8'),
      Buffer.from(computedHmac, 'utf8')
    );
  } catch {
    return false;
  }
}
