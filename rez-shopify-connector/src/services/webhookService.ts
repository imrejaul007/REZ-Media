import { verifyWebhookSignature } from '../clients/adminClient';
import { Store, IStoreDocument } from '../models/Store';
import { shopifyConfig, logger } from '../config';
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
}

// ── Webhook Service ────────────────────────────────────────────────────────────

export class WebhookService {
  private static readonly processedEvents = new Set<string>();

  /**
   * Process incoming webhook request
   */
  static async processWebhook(
    shopDomain: string,
    topic: WebhookTopic,
    body: string,
    hmac: string
  ): Promise<{ success: boolean; message: string; eventId?: string }> {
    const eventId = `${shopDomain}:${topic}:${Date.now()}`;

    // Verify webhook signature
    const isValid = verifyWebhookSignature(
      body,
      hmac,
      shopifyConfig.webhookSecret
    );

    if (!isValid) {
      logger.warn(`[WebhookService] Invalid webhook signature from ${shopDomain}`);
      return { success: false, message: 'Invalid webhook signature' };
    }

    // Deduplicate events
    if (this.processedEvents.has(eventId)) {
      logger.debug(`[WebhookService] Duplicate event ignored: ${eventId}`);
      return { success: true, message: 'Event already processed', eventId };
    }

    // Find the store
    const store = await Store.findByDomain(shopDomain);
    if (!store || !store.isActive) {
      logger.warn(`[WebhookService] Unknown or inactive store: ${shopDomain}`);
      return { success: false, message: 'Store not found or inactive' };
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      logger.error(`[WebhookService] Failed to parse webhook body:`, error);
      return { success: false, message: 'Invalid JSON payload' };
    }

    // Process the webhook based on topic
    try {
      await this.handleWebhookEvent(store, topic, payload);

      // Mark event as processed
      this.processedEvents.add(eventId);
      if (this.processedEvents.size > 10000) {
        // Cleanup old events periodically
        const firstKey = this.processedEvents.values().next().value;
        this.processedEvents.delete(firstKey);
      }

      logger.info(`[WebhookService] Processed webhook ${topic} for ${shopDomain}`);
      return { success: true, message: 'Webhook processed successfully', eventId };
    } catch (error) {
      logger.error(`[WebhookService] Failed to process webhook:`, error);
      return { success: false, message: 'Failed to process webhook' };
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
      case 'orders/deleted':
        await this.handleOrderDeleted(store, payload as { id: number });
        break;
      case 'products/create':
        await this.handleProductCreated(store, payload as ShopifyProduct);
        break;
      case 'products/update':
        await this.handleProductUpdated(store, payload as ShopifyProduct);
        break;
      case 'products/delete':
        await this.handleProductDeleted(store, payload as { id: number });
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
        logger.debug(`[WebhookService] Unhandled topic: ${topic}`);
    }
  }

  // ── Order Handlers ──────────────────────────────────────────────────────────

  private static async handleOrderCreated(
    store: IStoreDocument,
    order: ShopifyOrder
  ): Promise<void> {
    logger.info(`[WebhookService] New order ${order.id} from ${store.shopifyDomain}`);

    try {
      // Transform and send to order service
      const transformedOrder = this.transformOrder(order, store);
      await this.sendToService(
        store.shopifyDomain,
        'orders',
        'create',
        transformedOrder
      );
    } catch (error) {
      logger.error(`[WebhookService] Failed to sync order ${order.id}:`, error);
      throw error;
    }
  }

  private static async handleOrderUpdated(
    store: IStoreDocument,
    order: ShopifyOrder
  ): Promise<void> {
    logger.info(`[WebhookService] Updated order ${order.id} from ${store.shopifyDomain}`);

    try {
      const transformedOrder = this.transformOrder(order, store);
      await this.sendToService(
        store.shopifyDomain,
        'orders',
        'update',
        transformedOrder
      );
    } catch (error) {
      logger.error(`[WebhookService] Failed to sync order update ${order.id}:`, error);
      throw error;
    }
  }

  private static async handleOrderDeleted(
    store: IStoreDocument,
    data: { id: number }
  ): Promise<void> {
    logger.info(`[WebhookService] Deleted order ${data.id} from ${store.shopifyDomain}`);

    try {
      await this.sendToService(store.shopifyDomain, 'orders', 'delete', {
        shopifyOrderId: data.id,
        storeDomain: store.shopifyDomain,
      });
    } catch (error) {
      logger.error(`[WebhookService] Failed to delete order ${data.id}:`, error);
      throw error;
    }
  }

  // ── Product Handlers ─────────────────────────────────────────────────────────

  private static async handleProductCreated(
    store: IStoreDocument,
    product: ShopifyProduct
  ): Promise<void> {
    logger.info(`[WebhookService] New product ${product.id} from ${store.shopifyDomain}`);

    try {
      const transformedProduct = this.transformProduct(product, store);
      await this.sendToService(
        store.shopifyDomain,
        'products',
        'create',
        transformedProduct
      );
    } catch (error) {
      logger.error(`[WebhookService] Failed to sync product ${product.id}:`, error);
      throw error;
    }
  }

  private static async handleProductUpdated(
    store: IStoreDocument,
    product: ShopifyProduct
  ): Promise<void> {
    logger.info(`[WebhookService] Updated product ${product.id} from ${store.shopifyDomain}`);

    try {
      const transformedProduct = this.transformProduct(product, store);
      await this.sendToService(
        store.shopifyDomain,
        'products',
        'update',
        transformedProduct
      );
    } catch (error) {
      logger.error(`[WebhookService] Failed to sync product update ${product.id}:`, error);
      throw error;
    }
  }

  private static async handleProductDeleted(
    store: IStoreDocument,
    data: { id: number }
  ): Promise<void> {
    logger.info(`[WebhookService] Deleted product ${data.id} from ${store.shopifyDomain}`);

    try {
      await this.sendToService(store.shopifyDomain, 'products', 'delete', {
        shopifyProductId: data.id,
        storeDomain: store.shopifyDomain,
      });
    } catch (error) {
      logger.error(`[WebhookService] Failed to delete product ${data.id}:`, error);
      throw error;
    }
  }

  // ── Customer Handlers ────────────────────────────────────────────────────────

  private static async handleCustomerCreated(
    store: IStoreDocument,
    customer: ShopifyCustomer
  ): Promise<void> {
    logger.info(`[WebhookService] New customer ${customer.id} from ${store.shopifyDomain}`);

    try {
      const transformedCustomer = this.transformCustomer(customer, store);
      await this.sendToService(
        store.shopifyDomain,
        'customers',
        'create',
        transformedCustomer
      );
    } catch (error) {
      logger.error(`[WebhookService] Failed to sync customer ${customer.id}:`, error);
      throw error;
    }
  }

  private static async handleCustomerUpdated(
    store: IStoreDocument,
    customer: ShopifyCustomer
  ): Promise<void> {
    logger.info(`[WebhookService] Updated customer ${customer.id} from ${store.shopifyDomain}`);

    try {
      const transformedCustomer = this.transformCustomer(customer, store);
      await this.sendToService(
        store.shopifyDomain,
        'customers',
        'update',
        transformedCustomer
      );
    } catch (error) {
      logger.error(`[WebhookService] Failed to sync customer update ${customer.id}:`, error);
      throw error;
    }
  }

  // ── Inventory Handler ────────────────────────────────────────────────────────

  private static async handleInventoryUpdate(
    store: IStoreDocument,
    inventoryLevel: ShopifyInventoryLevel
  ): Promise<void> {
    logger.info(
      `[WebhookService] Inventory update for item ${inventoryLevel.inventory_item_id}`
    );

    try {
      await this.sendToService(store.shopifyDomain, 'inventory', 'update', {
        shopifyInventoryItemId: inventoryLevel.inventory_item_id,
        shopifyLocationId: inventoryLevel.location_id,
        available: inventoryLevel.available,
        updatedAt: inventoryLevel.updated_at,
        storeDomain: store.shopifyDomain,
      });
    } catch (error) {
      logger.error(
        `[WebhookService] Failed to sync inventory for ${inventoryLevel.inventory_item_id}:`,
        error
      );
      throw error;
    }
  }

  // ── Data Transformation ───────────────────────────────────────────────────────

  private static transformOrder(
    order: ShopifyOrder,
    store: IStoreDocument
  ): Record<string, unknown> {
    return {
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
        vendor: item.vendor,
        price: item.price,
        quantity: item.quantity,
        requiresShipping: item.requires_shipping,
        taxable: item.taxable,
      })),
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      notes: order.note,
      tags: order.tags.split(',').map((t) => t.trim()).filter(Boolean),
      source: order.source_name,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }

  private static transformProduct(
    product: ShopifyProduct,
    store: IStoreDocument
  ): Record<string, unknown> {
    return {
      shopifyProductId: product.id,
      storeDomain: store.shopifyDomain,
      title: product.title,
      description: product.body_html,
      vendor: product.vendor,
      productType: product.product_type,
      handle: product.handle,
      status: product.status,
      tags: product.tags.split(',').map((t) => t.trim()).filter(Boolean),
      variants: product.variants.map((variant) => ({
        shopifyVariantId: variant.id,
        shopifyProductId: variant.product_id,
        title: variant.title,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compare_at_price,
        inventoryQuantity: variant.inventory_quantity,
        inventoryPolicy: variant.inventory_policy,
        weight: variant.weight,
        weightUnit: variant.weight_unit,
        barcode: variant.barcode,
        requiresShipping: variant.requires_shipping,
        taxable: variant.taxable,
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3,
      })),
      images: product.images.map((image) => ({
        shopifyImageId: image.id,
        src: image.src,
        alt: image.alt,
        width: image.width,
        height: image.height,
        position: image.position,
      })),
      options: product.options,
      publishedAt: product.published_at,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }

  private static transformCustomer(
    customer: ShopifyCustomer,
    store: IStoreDocument
  ): Record<string, unknown> {
    return {
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
      taxExempt: customer.tax_exempt,
      tags: customer.tags.split(',').map((t) => t.trim()).filter(Boolean),
      defaultAddress: customer.default_address,
      addresses: customer.addresses,
      currency: customer.currency,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    };
  }

  // ── Service Integration ───────────────────────────────────────────────────────

  private static async sendToService(
    storeDomain: string,
    entity: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const serviceUrls: Record<string, string> = {
      orders: process.env.REZ_ORDER_SERVICE_URL || 'http://localhost:4003',
      products: process.env.REZ_CATALOG_SERVICE_URL || 'http://localhost:3000',
      customers: process.env.REZ_IDENTITY_SERVICE_URL || 'http://localhost:4001',
      inventory: process.env.REZ_INVENTORY_SERVICE_URL || 'http://localhost:4010',
    };

    const baseUrl = serviceUrls[entity];
    if (!baseUrl) {
      logger.warn(`[WebhookService] Unknown entity: ${entity}`);
      return;
    }

    const endpoint = `${baseUrl}/api/${entity}/${action}`;
    const token = process.env.INTERNAL_SERVICE_TOKEN;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': token || '',
          'X-Shopify-Store': storeDomain,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `[WebhookService] Service ${entity} returned ${response.status}: ${errorText}`
        );
        throw new Error(`Service returned ${response.status}`);
      }

      logger.debug(`[WebhookService] Synced ${entity}/${action} to ${endpoint}`);
    } catch (error) {
      logger.error(`[WebhookService] Failed to sync to ${entity} service:`, error);
      throw error;
    }
  }
}
