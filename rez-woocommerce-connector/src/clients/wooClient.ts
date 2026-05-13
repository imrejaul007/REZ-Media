/**
 * WooCommerce REST API Client
 *
 * Full-featured WooCommerce REST API v3 client with:
 * - Automatic retry with exponential backoff
 * - Rate limiting handling
 * - Pagination support
 * - HMAC signature verification for webhooks
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto-js';
import {
  WooCommerceCredentials,
  WooCommerceStoreInfo,
  WooCustomer,
  WooProduct,
  WooOrder,
  PaginationParams,
  PaginatedResponse,
  WooCommerceError,
  RateLimitError,
  WebhookPayload,
} from '../types';
import {
  WOOCOMMERCE_RATE_LIMITS,
  appConfig,
} from '../config';

// ============================================
// WooCommerce Client Class
// ============================================

export class WooCommerceClient {
  private client: AxiosInstance;
  private storeUrl: string;
  private consumerKey: string;
  private consumerSecret: string;

  // Rate limiting state
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private requestsThisSecond = 0;

  constructor(credentials: WooCommerceCredentials) {
    this.storeUrl = this.normalizeUrl(credentials.storeUrl);
    this.consumerKey = credentials.consumerKey;
    this.consumerSecret = credentials.consumerSecret;

    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL: `${this.storeUrl}/wp-json/wc/v3`,
      auth: {
        username: this.consumerKey,
        password: this.consumerSecret,
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ReZ-WooCommerce-Connector/1.0',
      },
      timeout: 30000,
    });

    // Configure retry logic
    this.configureRetry();

    // Add response interceptors for error handling
    this.addInterceptors();
  }

  /**
   * Normalize WooCommerce store URL
   */
  private normalizeUrl(url: string): string {
    let normalized = url.trim().replace(/\/$/, '');
    // Add https if no protocol specified
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    return normalized;
  }

  /**
   * Configure automatic retry with exponential backoff
   */
  private configureRetry(): void {
    axiosRetry(this.client, {
      retries: WOOCOMMERCE_RATE_LIMITS.MAX_RETRIES,
      retryDelay: (retryCount) => {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount - 1) * 1000;
        return delay;
      },
      retryCondition: (error: AxiosError) => {
        // Retry on network errors
        if (axiosRetry.isNetworkError(error)) {
          return true;
        }

        // Retry on rate limit (429)
        if (error.response?.status === 429) {
          return true;
        }

        // Retry on server errors (5xx)
        if (error.response?.status && error.response.status >= 500) {
          return true;
        }

        return false;
      },
      onRetry: (retryCount, error) => {
        const retryAfter = error.response?.headers['retry-after'];
        console.log(
          `[WooCommerceClient] Retrying request (attempt ${retryCount + 1}): ${error.config?.url}`,
          retryAfter ? `Retry-After: ${retryAfter}s` : ''
        );
      },
    });
  }

  /**
   * Add response interceptors for error handling
   */
  private addInterceptors(): void {
    // Handle rate limiting
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(
            error.response.headers['retry-after'] || '1',
            10
          );
          return Promise.reject(
            new RateLimitError(
              'Rate limit exceeded',
              retryAfter * 1000
            )
          );
        }

        // Format WooCommerce API errors
        if (error.response?.data) {
          const errorData = error.response.data as any;
          const message = errorData.message || errorData.code || 'Unknown error';
          return Promise.reject(
            new WooCommerceError(
              message,
              errorData.code,
              error.response.status,
              errorData
            )
          );
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Rate limit requests to comply with WooCommerce API limits
   */
  private async rateLimitRequest<T>(
    requestFn: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset counter if a second has passed
    if (timeSinceLastRequest >= 1000) {
      this.requestsThisSecond = 0;
      this.lastRequestTime = now;
    }

    // If we've hit the limit, wait until next second
    if (this.requestsThisSecond >= WOOCOMMERCE_RATE_LIMITS.MAX_REQUESTS_PER_SECOND) {
      const waitTime = 1000 - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.requestsThisSecond = 0;
      this.lastRequestTime = Date.now();
    }

    this.requestsThisSecond++;
    return requestFn();
  }

  /**
   * Make authenticated request with rate limiting
   */
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: unknown,
    params?: Record<string, unknown>
  ): Promise<T> {
    return this.rateLimitRequest(async () => {
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
        data,
        params,
      };
      const response = await this.client.request<T>(config);
      return response.data as T;
    });
  }

  /**
   * Make authenticated request and return full response with headers
   */
  private async requestWithHeaders<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: unknown,
    params?: Record<string, unknown>
  ): Promise<{ data: T; headers: Record<string, string> }> {
    return this.rateLimitRequest(async () => {
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
        data,
        params,
      };
      const response = await this.client.request<T>(config);
      // Convert headers to simple object
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value.join(',');
        }
      }
      return { data: response.data as T, headers };
    });
  }

  // ============================================
  // Store Information
  // ============================================

  /**
   * Get WooCommerce store information
   */
  async getStoreInfo(): Promise<WooCommerceStoreInfo> {
    const response = await this.request<any>('get', '/system_status');
    return {
      siteTitle: response.site_title || '',
      siteUrl: response.site_url || this.storeUrl,
      version: response.version || '',
      storeLogo: response.site_logo || null,
      timezone: response.timezone_string || 'UTC',
      currency: response.currency || 'USD',
      currencyPos: response.currency_pos || 'left',
      weightUnit: response.weight_unit || 'kg',
      dimensionUnit: response.dimension_unit || 'cm',
    };
  }

  // ============================================
  // Customers API
  // ============================================

  /**
   * Get all customers with pagination
   */
  async getCustomers(
    params: PaginationParams & {
      role?: 'all' | 'customer';
      before?: string;
      after?: string;
    } = {}
  ): Promise<PaginatedResponse<WooCustomer>> {
    const response = await this.requestWithHeaders<WooCustomer[]>(
      'get',
      '/customers',
      undefined,
      params as Record<string, unknown>
    );

    // WooCommerce doesn't return pagination headers directly in v3
    // We need to use the X-WP-Total header
    const total = response.headers['x-wp-total'] || '0';
    const totalPages = response.headers['x-wp-totalpages'] || '1';

    return {
      data: response.data,
      pagination: {
        page: params.page || 1,
        per_page: params.per_page || 10,
        total: parseInt(total, 10),
        total_pages: parseInt(totalPages, 10),
      },
    };
  }

  /**
   * Get single customer by ID
   */
  async getCustomer(id: number): Promise<WooCustomer> {
    return this.request<WooCustomer>('get', `/customers/${id}`);
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email: string): Promise<WooCustomer | null> {
    try {
      const customers = await this.request<WooCustomer[]>(
        'get',
        '/customers',
        undefined,
        { email }
      );
      return customers[0] || null;
    } catch (error) {
      if (
        error instanceof WooCommerceError &&
        error.statusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a customer
   */
  async createCustomer(data: {
    email: string;
    first_name: string;
    last_name: string;
    username?: string;
    password?: string;
    billing?: WooCustomer['billing'];
    shipping?: WooCustomer['shipping'];
  }): Promise<WooCustomer> {
    return this.request<WooCustomer>('post', '/customers', data);
  }

  /**
   * Update a customer
   */
  async updateCustomer(
    id: number,
    data: Partial<WooCustomer>
  ): Promise<WooCustomer> {
    return this.request<WooCustomer>('post', `/customers/${id}`, data);
  }

  // ============================================
  // Products API
  // ============================================

  /**
   * Get all products with pagination
   */
  async getProducts(
    params: PaginationParams & {
      status?: string;
      category?: string;
      tag?: string;
      search?: string;
      sku?: string;
      before?: string;
      after?: string;
    } = {}
  ): Promise<PaginatedResponse<WooProduct>> {
    const response = await this.requestWithHeaders<WooProduct[]>(
      'get',
      '/products',
      undefined,
      params as Record<string, unknown>
    );

    const total = response.headers['x-wp-total'] || '0';
    const totalPages = response.headers['x-wp-totalpages'] || '1';

    return {
      data: response.data,
      pagination: {
        page: params.page || 1,
        per_page: params.per_page || 10,
        total: parseInt(total, 10),
        total_pages: parseInt(totalPages, 10),
      },
    };
  }

  /**
   * Get single product by ID
   */
  async getProduct(id: number): Promise<WooProduct> {
    return this.request<WooProduct>('get', `/products/${id}`);
  }

  /**
   * Create a product
   */
  async createProduct(data: Partial<WooProduct>): Promise<WooProduct> {
    return this.request<WooProduct>('post', '/products', data);
  }

  /**
   * Update a product
   */
  async updateProduct(
    id: number,
    data: Partial<WooProduct>
  ): Promise<WooProduct> {
    return this.request<WooProduct>('put', `/products/${id}`, data);
  }

  /**
   * Delete a product
   */
  async deleteProduct(
    id: number,
    force: boolean = false
  ): Promise<WooProduct> {
    return this.request<WooProduct>(
      'delete',
      `/products/${id}`,
      undefined,
      { force }
    );
  }

  // ============================================
  // Orders API
  // ============================================

  /**
   * Get all orders with pagination
   */
  async getOrders(
    params: PaginationParams & {
      status?: string;
      customer?: number;
      before?: string;
      after?: string;
    } = {}
  ): Promise<PaginatedResponse<WooOrder>> {
    const response = await this.requestWithHeaders<WooOrder[]>(
      'get',
      '/orders',
      undefined,
      params as Record<string, unknown>
    );

    const total = response.headers['x-wp-total'] || '0';
    const totalPages = response.headers['x-wp-totalpages'] || '1';

    return {
      data: response.data,
      pagination: {
        page: params.page || 1,
        per_page: params.per_page || 10,
        total: parseInt(total, 10),
        total_pages: parseInt(totalPages, 10),
      },
    };
  }

  /**
   * Get single order by ID
   */
  async getOrder(id: number): Promise<WooOrder> {
    return this.request<WooOrder>('get', `/orders/${id}`);
  }

  /**
   * Create an order
   */
  async createOrder(data: {
    customer_id?: number;
    billing?: WooCustomer['billing'];
    shipping?: WooCustomer['shipping'];
    line_items?: Array<{
      product_id: number;
      quantity: number;
    }>;
  }): Promise<WooOrder> {
    return this.request<WooOrder>('post', '/orders', data);
  }

  /**
   * Update an order
   */
  async updateOrder(
    id: number,
    data: Partial<WooOrder>
  ): Promise<WooOrder> {
    return this.request<WooOrder>('post', `/orders/${id}`, data);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: number,
    status: WooOrder['status']
  ): Promise<WooOrder> {
    return this.request<WooOrder>('post', `/orders/${id}`, { status });
  }

  // ============================================
  // Webhooks API
  // ============================================

  /**
   * Get all webhooks
   */
  async getWebhooks(): Promise<Array<{
    id: number;
    name: string;
    topic: string;
    resource: string;
    event: string;
    delivery_url: string;
  }>> {
    return this.request('get', '/webhooks');
  }

  /**
   * Create a webhook
   */
  async createWebhook(data: {
    name: string;
    topic: string;
    delivery_url: string;
    secret?: string;
  }): Promise<{
    id: number;
    name: string;
    topic: string;
    delivery_url: string;
  }> {
    return this.request('post', '/webhooks', data);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(
    id: number,
    force: boolean = false
  ): Promise<{ id: number }> {
    return this.request(
      'delete',
      `/webhooks/${id}`,
      undefined,
      { force }
    );
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(
    payload: string,
    signature: string,
    secret?: string
  ): boolean {
    const webhookSecret = secret || appConfig.woocommerce.webhookSecret;
    if (!webhookSecret) {
      console.warn('Webhook secret not configured, skipping verification');
      return true;
    }

    const expectedSignature = crypto
      .HmacSHA256(payload, webhookSecret)
      .toString(crypto.enc.Base64);

    // WooCommerce sends signature in different formats
    const cleanSignature = signature.replace(/^sha256=/, '');

    return expectedSignature === cleanSignature;
  }

  /**
   * Parse webhook payload
   */
  static parseWebhookPayload(
    payload: string
  ): WebhookPayload | null {
    try {
      const data = JSON.parse(payload);
      return {
        id: data.id || 0,
        action: data.action || '',
        resource: data.resource || '',
        resource_id: data.resource_id || 0,
        timestamp: data.timestamp || Date.now(),
        data: data.data || {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Test connection to WooCommerce store
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getStoreInfo();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get store URL
   */
  getStoreUrl(): string {
    return this.storeUrl;
  }
}

// ============================================
// Factory Function
// ============================================

export function createWooCommerceClient(
  credentials: WooCommerceCredentials
): WooCommerceClient {
  return new WooCommerceClient(credentials);
}

export default WooCommerceClient;
