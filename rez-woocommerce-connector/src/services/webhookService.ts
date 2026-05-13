/**
 * Webhook Service
 *
 * Handles WooCommerce webhook events with HMAC verification,
 * deduplication, and proper routing to handlers.
 */

import Redis from 'ioredis';
import { Store } from '../models/Store';
import { WooCommerceClient } from '../clients/wooClient';
import {
  WebhookPayload,
  WebhookResponse,
  WooCustomer,
  WooProduct,
  WooOrder,
  WebhookEvent,
} from '../types';
import { appConfig, REDIS_KEYS, CACHE_TTL } from '../config';
import { WooCommerceError, WebhookVerificationError } from '../types';
import logger from '../utils/logger';
import { getServiceTokens } from '../config';

// ============================================
// Event Handlers
// ============================================

interface EventHandlers {
  onCustomerCreated?: (customer: WooCustomer, storeUrl: string) => Promise<void>;
  onCustomerUpdated?: (customer: WooCustomer, storeUrl: string) => Promise<void>;
  onCustomerDeleted?: (customerId: number, storeUrl: string) => Promise<void>;
  onProductCreated?: (product: WooProduct, storeUrl: string) => Promise<void>;
  onProductUpdated?: (product: WooProduct, storeUrl: string) => Promise<void>;
  onProductDeleted?: (productId: number, storeUrl: string) => Promise<void>;
  onOrderCreated?: (order: WooOrder, storeUrl: string) => Promise<void>;
  onOrderUpdated?: (order: WooOrder, storeUrl: string) => Promise<void>;
  onOrderDeleted?: (orderId: number, storeUrl: string) => Promise<void>;
}

// ============================================
// Webhook Service Class
// ============================================

export class WebhookService {
  private redis: Redis | null = null;
  private handlers: EventHandlers = {};

  constructor() {
    this.initRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initRedis(): Promise<void> {
    try {
      this.redis = new Redis(appConfig.redis.url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error:', error);
      });

      await this.redis.connect();
      logger.info('Redis connected for webhook service');
    } catch (error) {
      logger.warn('Redis not available, continuing without deduplication');
      this.redis = null;
    }
  }

  /**
   * Register event handlers
   */
  setHandlers(handlers: EventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    return WooCommerceClient.verifyWebhookSignature(
      payload,
      signature,
      appConfig.woocommerce.webhookSecret
    );
  }

  /**
   * Check for duplicate webhook delivery
   */
  private async isDuplicate(deliveryId: string): Promise<boolean> {
    if (!this.redis) return false;

    const key = `${REDIS_KEYS.WEBHOOK_DEDUP_PREFIX}${deliveryId}`;
    const exists = await this.redis.exists(key);

    if (!exists) {
      // Mark as processed with TTL
      await this.redis.setex(key, CACHE_TTL.WEBHOOK_DEDUP, '1');
      return false;
    }

    return true;
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(
    payload: WebhookPayload,
    storeId?: string
  ): Promise<WebhookResponse> {
    const { id: deliveryId, action, resource, resource_id } = payload;

    logger.info(`Processing webhook: ${action} for ${resource}:${resource_id}`);

    // Deduplicate webhook delivery
    if (deliveryId && await this.isDuplicate(deliveryId.toString())) {
      logger.info(`Duplicate webhook delivery: ${deliveryId}`);
      return {
        received: true,
        processed: false,
        event: action,
        resourceId: resource_id,
        error: 'Duplicate delivery',
      };
    }

    try {
      // Find the store
      let store;
      if (storeId) {
        store = await Store.findById(storeId);
      }

      // Route to appropriate handler based on event
      await this.routeEvent(payload, store?.storeUrl || '');

      return {
        received: true,
        processed: true,
        event: action,
        resourceId: resource_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Webhook processing error:`, error);

      return {
        received: true,
        processed: false,
        event: action,
        resourceId: resource_id,
        error: errorMessage,
      };
    }
  }

  /**
   * Route webhook event to appropriate handler
   */
  private async routeEvent(
    payload: WebhookPayload,
    storeUrl: string
  ): Promise<void> {
    const { action, resource, resource_id } = payload;

    // Handle customer events
    if (resource === 'customer') {
      await this.handleCustomerEvent(action as WebhookEvent, resource_id, storeUrl);
      return;
    }

    // Handle product events
    if (resource === 'product') {
      await this.handleProductEvent(action as WebhookEvent, resource_id, storeUrl);
      return;
    }

    // Handle order events
    if (resource === 'order') {
      await this.handleOrderEvent(action as WebhookEvent, resource_id, storeUrl);
      return;
    }

    // Handle coupon events (if needed)
    if (resource === 'coupon') {
      await this.handleCouponEvent(action as WebhookEvent, resource_id, storeUrl);
      return;
    }

    logger.warn(`Unknown webhook resource: ${resource}`);
  }

  /**
   * Handle customer webhook events
   */
  private async handleCustomerEvent(
    action: WebhookEvent,
    customerId: number,
    storeUrl: string
  ): Promise<void> {
    switch (action) {
      case 'customer.created':
        if (this.handlers.onCustomerCreated) {
          const customer = await this.getCustomerFromStore(customerId, storeUrl);
          if (customer) {
            await this.handlers.onCustomerCreated(customer, storeUrl);
          }
        }
        break;

      case 'customer.updated':
        if (this.handlers.onCustomerUpdated) {
          const customer = await this.getCustomerFromStore(customerId, storeUrl);
          if (customer) {
            await this.handlers.onCustomerUpdated(customer, storeUrl);
          }
        }
        break;

      case 'customer.deleted':
        if (this.handlers.onCustomerDeleted) {
          await this.handlers.onCustomerDeleted(customerId, storeUrl);
        }
        break;

      default:
        logger.debug(`Unhandled customer event: ${action}`);
    }
  }

  /**
   * Handle product webhook events
   */
  private async handleProductEvent(
    action: WebhookEvent,
    productId: number,
    storeUrl: string
  ): Promise<void> {
    switch (action) {
      case 'product.created':
        if (this.handlers.onProductCreated) {
          const product = await this.getProductFromStore(productId, storeUrl);
          if (product) {
            await this.handlers.onProductCreated(product, storeUrl);
          }
        }
        break;

      case 'product.updated':
        if (this.handlers.onProductUpdated) {
          const product = await this.getProductFromStore(productId, storeUrl);
          if (product) {
            await this.handlers.onProductUpdated(product, storeUrl);
          }
        }
        break;

      case 'product.deleted':
        if (this.handlers.onProductDeleted) {
          await this.handlers.onProductDeleted(productId, storeUrl);
        }
        break;

      default:
        logger.debug(`Unhandled product event: ${action}`);
    }
  }

  /**
   * Handle order webhook events
   */
  private async handleOrderEvent(
    action: WebhookEvent,
    orderId: number,
    storeUrl: string
  ): Promise<void> {
    switch (action) {
      case 'order.created':
        if (this.handlers.onOrderCreated) {
          const order = await this.getOrderFromStore(orderId, storeUrl);
          if (order) {
            await this.handlers.onOrderCreated(order, storeUrl);
          }
        }
        break;

      case 'order.updated':
        if (this.handlers.onOrderUpdated) {
          const order = await this.getOrderFromStore(orderId, storeUrl);
          if (order) {
            await this.handlers.onOrderUpdated(order, storeUrl);
          }
        }
        break;

      case 'order.deleted':
        if (this.handlers.onOrderDeleted) {
          await this.handlers.onOrderDeleted(orderId, storeUrl);
        }
        break;

      default:
        logger.debug(`Unhandled order event: ${action}`);
    }
  }

  /**
   * Handle coupon webhook events
   */
  private async handleCouponEvent(
    action: WebhookEvent,
    couponId: number,
    storeUrl: string
  ): Promise<void> {
    logger.debug(`Coupon event ${action} for coupon ${couponId} - not implemented`);
  }

  /**
   * Fetch customer data from WooCommerce store
   */
  private async getCustomerFromStore(
    customerId: number,
    storeUrl: string
  ): Promise<WooCustomer | null> {
    try {
      const store = await Store.findByStoreUrl(storeUrl);
      if (!store) {
        logger.warn(`Store not found for URL: ${storeUrl}`);
        return null;
      }

      const client = new WooCommerceClient({
        storeUrl: store.storeUrl,
        consumerKey: store.consumerKey,
        consumerSecret: store.getDecryptedSecret(),
      });

      return await client.getCustomer(customerId);
    } catch (error) {
      if (error instanceof WooCommerceError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch product data from WooCommerce store
   */
  private async getProductFromStore(
    productId: number,
    storeUrl: string
  ): Promise<WooProduct | null> {
    try {
      const store = await Store.findByStoreUrl(storeUrl);
      if (!store) {
        logger.warn(`Store not found for URL: ${storeUrl}`);
        return null;
      }

      const client = new WooCommerceClient({
        storeUrl: store.storeUrl,
        consumerKey: store.consumerKey,
        consumerSecret: store.getDecryptedSecret(),
      });

      return await client.getProduct(productId);
    } catch (error) {
      if (error instanceof WooCommerceError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch order data from WooCommerce store
   */
  private async getOrderFromStore(
    orderId: number,
    storeUrl: string
  ): Promise<WooOrder | null> {
    try {
      const store = await Store.findByStoreUrl(storeUrl);
      if (!store) {
        logger.warn(`Store not found for URL: ${storeUrl}`);
        return null;
      }

      const client = new WooCommerceClient({
        storeUrl: store.storeUrl,
        consumerKey: store.consumerKey,
        consumerSecret: store.getDecryptedSecret(),
      });

      return await client.getOrder(orderId);
    } catch (error) {
      if (error instanceof WooCommerceError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // ============================================
  // ReZ Platform Integration
  // ============================================

  /**
   * Sync customer to ReZ identity service
   */
  async syncCustomerToReZ(
    customer: WooCustomer,
    storeUrl: string
  ): Promise<void> {
    const store = await Store.findByStoreUrl(storeUrl);
    if (!store) {
      throw new Error('Store not found');
    }

    const tokens = getServiceTokens();
    const token = Object.values(tokens)[0] || appConfig.internalServiceToken;

    const payload = {
      externalId: `${store._id}:customer:${customer.id}`,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.billing?.phone,
      addresses: {
        billing: customer.billing,
        shipping: customer.shipping,
      },
      metadata: {
        source: 'woocommerce',
        wooCustomerId: customer.id,
        createdAt: customer.created_at,
        updatedAt: new Date().toISOString(),
      },
    };

    const response = await fetch(
      `${appConfig.rezServices.identityServiceUrl}/api/customers/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token || '',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to sync customer to ReZ: ${response.status}`);
    }

    logger.info(`Synced customer ${customer.id} to ReZ identity service`);
  }

  /**
   * Sync product to ReZ product service
   */
  async syncProductToReZ(
    product: WooProduct,
    storeUrl: string
  ): Promise<void> {
    const store = await Store.findByStoreUrl(storeUrl);
    if (!store) {
      throw new Error('Store not found');
    }

    const tokens = getServiceTokens();
    const token = Object.values(tokens)[0] || appConfig.internalServiceToken;

    const payload = {
      externalId: `${store._id}:product:${product.id}`,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: {
        amount: parseFloat(product.price || '0'),
        currency: store.storeInfo?.currency || 'USD',
      },
      inventory: {
        quantity: product.stock_quantity ?? 0,
        status: product.stock_status,
      },
      images: product.images,
      categories: product.categories,
      attributes: product.attributes,
      metadata: {
        source: 'woocommerce',
        wooProductId: product.id,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
      },
    };

    const response = await fetch(
      `${appConfig.rezServices.productServiceUrl}/api/products/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token || '',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to sync product to ReZ: ${response.status}`);
    }

    logger.info(`Synced product ${product.id} to ReZ product service`);
  }

  /**
   * Sync order to ReZ order service
   */
  async syncOrderToReZ(
    order: WooOrder,
    storeUrl: string
  ): Promise<void> {
    const store = await Store.findByStoreUrl(storeUrl);
    if (!store) {
      throw new Error('Store not found');
    }

    const tokens = getServiceTokens();
    const token = Object.values(tokens)[0] || appConfig.internalServiceToken;

    const payload = {
      externalId: `${store._id}:order:${order.id}`,
      orderNumber: order.number,
      status: order.status,
      customer: {
        externalId: `${store._id}:customer:${order.customer_id}`,
        email: order.billing?.email,
      },
      totals: {
        subtotal: parseFloat(order.subtotal || '0'),
        tax: parseFloat(order.total_tax || '0'),
        shipping: order.shipping_lines?.[0]?.total || '0',
        total: parseFloat(order.total || '0'),
        currency: order.currency,
      },
      items: order.line_items.map((item) => ({
        productId: `${store._id}:product:${item.product_id}`,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price || '0'),
        total: parseFloat(item.total || '0'),
      })),
      shippingAddress: order.shipping,
      billingAddress: order.billing,
      payment: {
        method: order.payment_method,
        methodTitle: order.payment_method_title,
        transactionId: order.transaction_id,
      },
      metadata: {
        source: 'woocommerce',
        wooOrderId: order.id,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
    };

    const response = await fetch(
      `${appConfig.rezServices.orderServiceUrl}/api/orders/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token || '',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to sync order to ReZ: ${response.status}`);
    }

    logger.info(`Synced order ${order.id} to ReZ order service`);
  }
}

// ============================================
// Singleton Export
// ============================================

export const webhookService = new WebhookService();

export default webhookService;
