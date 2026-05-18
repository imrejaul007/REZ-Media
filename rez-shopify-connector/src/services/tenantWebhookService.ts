import { verifyWebhookSignature } from '../clients/adminClient';
import { Store, IStoreDocument } from '../models/Store';
import { shopifyConfig, logger } from '../config';
import { codIntelligence } from './codIntelligence';
import axios from 'axios';
import type {
  WebhookTopic,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyCustomer,
  ShopifyInventoryLevel,
} from '../types';

// ── Event Types ────────────────────────────────────────────────────────────────

interface WebhookEvent {
  topic: WebhookTopic;
  shopDomain: string;
  payload: unknown;
  timestamp: string;
  storeId: string;
  tenantId: string;
  brandId: string;
}

// ── Tenant-Aware Webhook Service ───────────────────────────────────────────────

export class TenantWebhookService {
  private static readonly processedEvents = new Map<string, number>();

  /**
   * Process incoming webhook with tenant isolation
   *
   * CRITICAL: This method enforces tenant isolation by:
   * 1. Looking up the store by domain AND ensuring tenant context exists
   * 2. Forwarding events to data lake WITH tenant context
   */
  static async processWebhook(
    shopDomain: string,
    topic: WebhookTopic,
    body: string,
    hmac: string
  ): Promise<{ success: boolean; message: string; eventId?: string; tenantId?: string }> {
    const eventId = `${shopDomain}:${topic}:${Date.now()}`;

    // Get raw body for signature verification
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, hmac, shopifyConfig.webhookSecret);

    if (!isValid) {
      logger.warn(`[TenantWebhook] Invalid webhook signature from ${shopDomain}`);
      return { success: false, message: 'Invalid webhook signature' };
    }

    // Deduplicate events
    const existingTimestamp = this.processedEvents.get(eventId);
    if (existingTimestamp && Date.now() - existingTimestamp < 60000) {
      logger.debug(`[TenantWebhook] Duplicate event ignored: ${eventId}`);
      return { success: true, message: 'Event already processed', eventId };
    }

    // Find the store
    // For webhooks, we look up by domain first, then verify tenant exists
    const store = await Store.findOne({ shopifyDomain: shopDomain.toLowerCase() });

    if (!store) {
      logger.warn(`[TenantWebhook] Unknown store: ${shopDomain}`);
      return { success: false, message: 'Store not found' };
    }

    if (!store.isActive) {
      logger.warn(`[TenantWebhook] Inactive store: ${shopDomain}`);
      return { success: false, message: 'Store is inactive' };
    }

    // CRITICAL: Verify tenant context exists
    if (!store.tenantId || !store.brandId) {
      logger.error(`[TenantWebhook] Store missing tenant context: ${shopDomain}`);
      return { success: false, message: 'Store missing tenant context' };
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (error) {
      logger.error(`[TenantWebhook] Failed to parse webhook body:`, error);
      return { success: false, message: 'Invalid JSON payload' };
    }

    // Process the webhook
    try {
      await this.handleWebhookEvent(store, topic, payload);

      // Forward to data lake with tenant context
      await this.forwardToDataLake(store, topic, payload, eventId);

      // Mark event as processed
      this.processedEvents.set(eventId, Date.now());

      // Cleanup old events periodically
      if (this.processedEvents.size > 10000) {
        const now = Date.now();
        for (const [key, timestamp] of this.processedEvents.entries()) {
          if (now - timestamp > 60000) {
            this.processedEvents.delete(key);
          }
        }
      }

      logger.info(`[TenantWebhook] Processed ${topic} for ${shopDomain}`, {
        tenantId: store.tenantId,
        brandId: store.brandId,
      });

      return {
        success: true,
        message: 'Webhook processed successfully',
        eventId,
        tenantId: store.tenantId,
      };
    } catch (error) {
      logger.error(`[TenantWebhook] Failed to process webhook:`, error);
      return { success: false, message: 'Failed to process webhook' };
    }
  }

  /**
   * Forward event to data lake with tenant context
   *
   * This is CRITICAL for the data flywheel - every event
   * must include tenant context for proper isolation and ML training
   */
  private static async forwardToDataLake(
    store: IStoreDocument,
    topic: WebhookTopic,
    payload: unknown,
    eventId: string
  ): Promise<void> {
    const dataLakeUrl = process.env.DATA_LAKE_URL || 'http://localhost:4101';

    const dataLakePayload = {
      source: 'shopify',
      connectionId: store._id.toString(),
      tenantId: store.tenantId, // CRITICAL: Tenant isolation
      brandId: store.brandId, // CRITICAL: Brand isolation
      topic,
      payload,
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(`${dataLakeUrl}/api/events/ingest`, dataLakePayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
        },
        timeout: 5000,
      });

      logger.debug('[TenantWebhook] Forwarded to data lake', {
        eventId,
        tenantId: store.tenantId,
        topic,
      });
    } catch (error) {
      // Don't fail the webhook if data lake is unavailable
      // The webhook should still succeed
      logger.warn('[TenantWebhook] Failed to forward to data lake', {
        eventId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle webhook based on topic
   */
  private static async handleWebhookEvent(
    store: IStoreDocument,
    topic: WebhookTopic,
    payload: unknown
  ): Promise<void> {
    switch (topic) {
      case 'orders/create':
        await this.handleOrderCreated(store, payload as ShopifyOrder);
        break;
      case 'orders/updated':
        await this.handleOrderUpdated(store, payload as ShopifyOrder);
        break;
      case 'orders/fulfilled':
        await this.handleOrderFulfilled(store, payload as ShopifyOrder);
        break;
      case 'products/create':
        await this.handleProductCreated(store, payload as ShopifyProduct);
        break;
      case 'products/update':
        await this.handleProductUpdated(store, payload as ShopifyProduct);
        break;
      case 'customers/create':
        await this.handleCustomerCreated(store, payload as ShopifyCustomer);
        break;
      case 'customers/update':
        await this.handleCustomerUpdated(store, payload as ShopifyCustomer);
        break;
      case 'inventory_levels/update':
        await this.handleInventoryUpdate(store, payload as ShopifyInventoryLevel);
        break;
      default:
        logger.debug(`[TenantWebhook] Unhandled topic: ${topic}`);
    }
  }

  // ── Order Handlers with Tenant Context ───────────────────────────────────────

  private static async handleOrderCreated(
    store: IStoreDocument,
    order: ShopifyOrder
  ): Promise<void> {
    logger.info(`[TenantWebhook] New order ${order.id} from ${store.shopifyDomain}`, {
      tenantId: store.tenantId,
      brandId: store.brandId,
    });

    // Transform with tenant context
    const transformedOrder = this.transformOrder(order, store);

    // Send to order service with tenant context
    await this.sendToService(
      'orders',
      'create',
      transformedOrder,
      store
    );

    // Process for COD Intelligence
    const codResult = await codIntelligence.processShopifyOrder(
      order,
      store.shopifyDomain
    );

    if (codResult?.data) {
      logger.info(`[TenantWebhook] COD risk for order ${order.id}: ${codResult.data.decision}`);
    }
  }

  private static async handleOrderUpdated(
    store: IStoreDocument,
    order: ShopifyOrder
  ): Promise<void> {
    logger.info(`[TenantWebhook] Updated order ${order.id} from ${store.shopifyDomain}`, {
      tenantId: store.tenantId,
    });

    const transformedOrder = this.transformOrder(order, store);
    await this.sendToService('orders', 'update', transformedOrder, store);
  }

  private static async handleOrderFulfilled(
    store: IStoreDocument,
    order: ShopifyOrder
  ): Promise<void> {
    logger.info(`[TenantWebhook] Fulfilled order ${order.id} from ${store.shopifyDomain}`, {
      tenantId: store.tenantId,
    });

    await this.sendToService('orders', 'fulfill', { shopifyOrderId: order.id }, store);
  }

  // ── Product Handlers with Tenant Context ──────────────────────────────────────

  private static async handleProductCreated(
    store: IStoreDocument,
    product: ShopifyProduct
  ): Promise<void> {
    logger.info(`[TenantWebhook] New product ${product.id} from ${store.shopifyDomain}`, {
      tenantId: store.tenantId,
    });

    const transformedProduct = this.transformProduct(product, store);
    await this.sendToService('products', 'create', transformedProduct, store);
  }

  private static async handleProductUpdated(
    store: IStoreDocument,
    product: ShopifyProduct
  ): Promise<void> {
    logger.info(`[TenantWebhook] Updated product ${product.id} from ${store.shopifyDomain}`, {
      tenantId: store.tenantId,
    });

    const transformedProduct = this.transformProduct(product, store);
    await this.sendToService('products', 'update', transformedProduct, store);
  }

  // ── Customer Handlers with Tenant Context ─────────────────────────────────────

  private static async handleCustomerCreated(
    store: IStoreDocument,
    customer: ShopifyCustomer
  ): Promise<void> {
    logger.info(`[TenantWebhook] New customer ${customer.id} from ${store.shopifyDomain}`, {
      tenantId: store.tenantId,
    });

    const transformedCustomer = this.transformCustomer(customer, store);
    await this.sendToService('customers', 'create', transformedCustomer, store);
  }

  private static async handleCustomerUpdated(
    store: IStoreDocument,
    customer: ShopifyCustomer
  ): Promise<void> {
    logger.info(`[TenantWebhook] Updated customer ${customer.id} from ${store.shopifyDomain}`, {
      tenantId: store.tenantId,
    });

    const transformedCustomer = this.transformCustomer(customer, store);
    await this.sendToService('customers', 'update', transformedCustomer, store);
  }

  // ── Inventory Handler with Tenant Context ─────────────────────────────────────

  private static async handleInventoryUpdate(
    store: IStoreDocument,
    inventoryLevel: ShopifyInventoryLevel
  ): Promise<void> {
    logger.info(
      `[TenantWebhook] Inventory update for item ${inventoryLevel.inventory_item_id}`,
      { tenantId: store.tenantId }
    );

    await this.sendToService('inventory', 'update', {
      shopifyInventoryItemId: inventoryLevel.inventory_item_id,
      shopifyLocationId: inventoryLevel.location_id,
      available: inventoryLevel.available,
      updatedAt: inventoryLevel.updated_at,
    }, store);
  }

  // ── Data Transformation with Tenant Context ────────────────────────────────────

  private static transformOrder(
    order: ShopifyOrder,
    store: IStoreDocument
  ): Record<string, unknown> {
    return {
      // Tenant context (REQUIRED)
      tenantId: store.tenantId,
      brandId: store.brandId,

      // Shopify data
      shopifyOrderId: order.id,
      shopifyOrderNumber: order.order_number,
      storeDomain: store.shopifyDomain,

      status: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      totalPrice: order.total_price,
      subtotalPrice: order.subtotal_price,
      totalTax: order.total_tax,
      totalDiscounts: order.total_discounts,
      currency: order.currency,

      customer: order.customer
        ? {
            shopifyCustomerId: order.customer.id,
            email: order.customer.email,
            firstName: order.customer.first_name,
            lastName: order.customer.last_name,
            phone: order.customer.phone,
          }
        : null,

      lineItems: order.line_items.map((item) => ({
        shopifyVariantId: item.variant_id,
        shopifyProductId: item.product_id,
        title: item.title,
        variantTitle: item.variant_title,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
      })),

      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      notes: order.note,
      tags: order.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }

  private static transformProduct(
    product: ShopifyProduct,
    store: IStoreDocument
  ): Record<string, unknown> {
    return {
      // Tenant context (REQUIRED)
      tenantId: store.tenantId,
      brandId: store.brandId,

      // Shopify data
      shopifyProductId: product.id,
      storeDomain: store.shopifyDomain,

      title: product.title,
      description: product.body_html,
      vendor: product.vendor,
      productType: product.product_type,
      handle: product.handle,
      status: product.status,
      tags: product.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],

      variants: product.variants.map((variant) => ({
        shopifyVariantId: variant.id,
        sku: variant.sku,
        price: variant.price,
        inventoryQuantity: variant.inventory_quantity,
      })),

      images: product.images.map((image) => ({
        shopifyImageId: image.id,
        src: image.src,
        alt: image.alt,
      })),

      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }

  private static transformCustomer(
    customer: ShopifyCustomer,
    store: IStoreDocument
  ): Record<string, unknown> {
    return {
      // Tenant context (REQUIRED)
      tenantId: store.tenantId,
      brandId: store.brandId,

      // Shopify data
      shopifyCustomerId: customer.id,
      storeDomain: store.shopifyDomain,

      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      acceptsMarketing: customer.accepts_marketing,
      state: customer.state,
      totalSpent: customer.total_spent,
      ordersCount: customer.orders_count,
      verifiedEmail: customer.verified_email,
      tags: customer.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],

      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    };
  }

  // ── Service Integration with Tenant Context ──────────────────────────────────

  private static async sendToService(
    entity: string,
    action: string,
    data: Record<string, unknown>,
    store: IStoreDocument
  ): Promise<void> {
    const serviceUrls: Record<string, string> = {
      orders: process.env.REZ_ORDER_SERVICE_URL || 'http://localhost:4006',
      products: process.env.REZ_CATALOG_SERVICE_URL || 'http://localhost:4007',
      customers: process.env.REZ_PROFILE_SERVICE_URL || 'http://localhost:4013',
      inventory: process.env.REZ_CATALOG_SERVICE_URL || 'http://localhost:4007',
    };

    const baseUrl = serviceUrls[entity];
    if (!baseUrl) {
      logger.warn(`[TenantWebhook] Unknown entity: ${entity}`);
      return;
    }

    // Add tenant headers for all service calls
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
      'X-Tenant-Id': store.tenantId, // CRITICAL: Tenant isolation
      'X-Brand-Id': store.brandId, // CRITICAL: Brand isolation
    };

    try {
      const response = await fetch(`${baseUrl}/api/${entity}/${action}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[TenantWebhook] Service ${entity} returned ${response.status}: ${errorText}`);
      }

      logger.debug(`[TenantWebhook] Sent ${entity}/${action} to service`, {
        tenantId: store.tenantId,
        entity,
        action,
      });
    } catch (error) {
      logger.error(`[TenantWebhook] Failed to send to ${entity} service:`, error);
      // Don't throw - webhook should still succeed
    }
  }
}
