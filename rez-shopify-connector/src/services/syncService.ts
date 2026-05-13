import { ShopifyAdminClient } from '../clients/adminClient';
import { Store, IStoreDocument } from '../models/Store';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { syncConfig, serviceEndpoints, getInternalToken } from '../config';
import type { SyncEntity, SyncJob, ShopifyProduct, ShopifyOrder, ShopifyCustomer, ShopifyInventoryLevel } from '../types';

// ── Sync Service ────────────────────────────────────────────────────────────────

export class SyncService {
  /**
   * Trigger a full sync for a specific entity type
   */
  static async triggerSync(
    storeId: string,
    entity: SyncEntity
  ): Promise<{ jobId: string; status: string }> {
    const store = await Store.findById(storeId);
    if (!store || !store.isActive) {
      throw new Error('Store not found or inactive');
    }

    const jobId = `sync-${storeId}-${entity}-${Date.now()}`;

    // Update sync status
    await store.updateSyncStatus(entity, { status: 'syncing' });

    // Start sync in background
    setImmediate(() => {
      this.performSync(store, entity, jobId).catch((error) => {
        logger.error(`[SyncService] Sync failed for ${storeId}/${entity}:`, error);
      });
    });

    return { jobId, status: 'syncing' };
  }

  /**
   * Perform the actual sync operation
   */
  private static async performSync(
    store: IStoreDocument,
    entity: SyncEntity,
    jobId: string
  ): Promise<void> {
    const redis = getRedis();
    const lockKey = `sync:lock:${store._id}:${entity}`;

    try {
      // Acquire lock
      const acquired = await redis.set(lockKey, jobId, 'EX', 3600, 'NX');
      if (!acquired) {
        logger.warn(`[SyncService] Could not acquire lock for ${jobId}`);
        return;
      }

      logger.info(`[SyncService] Starting ${entity} sync for ${store.shopifyDomain}`);

      const adminClient = new ShopifyAdminClient(store.shopifyDomain, store.accessToken);
      let itemsSynced = 0;

      switch (entity) {
        case 'products':
          itemsSynced = await this.syncProducts(store, adminClient);
          break;
        case 'orders':
          itemsSynced = await this.syncOrders(store, adminClient);
          break;
        case 'customers':
          itemsSynced = await this.syncCustomers(store, adminClient);
          break;
        case 'inventory':
          itemsSynced = await this.syncInventory(store, adminClient);
          break;
      }

      // Update sync status
      await store.updateSyncStatus(entity, {
        status: 'completed',
        lastSyncAt: new Date(),
        lastSyncId: jobId,
        itemsSynced: itemsSynced,
        error: undefined,
      });

      logger.info(
        `[SyncService] Completed ${entity} sync for ${store.shopifyDomain}: ${itemsSynced} items`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await store.updateSyncStatus(entity, {
        status: 'failed',
        lastSyncAt: new Date(),
        error: errorMessage,
      });

      logger.error(`[SyncService] ${entity} sync failed for ${store.shopifyDomain}:`, error);
    } finally {
      // Release lock
      await redis.del(lockKey);
    }
  }

  // ── Product Sync ──────────────────────────────────────────────────────────────

  private static async syncProducts(
    store: IStoreDocument,
    adminClient: ShopifyAdminClient
  ): Promise<number> {
    let totalSynced = 0;
    let lastSyncId = await this.getLastSyncId(store._id.toString(), 'products');

    const allProducts = await adminClient.getAllProducts(
      lastSyncId ? parseInt(lastSyncId, 10) : undefined
    );

    // Process in batches
    for (let i = 0; i < allProducts.length; i += syncConfig.batchSize) {
      const batch = allProducts.slice(i, i + syncConfig.batchSize);
      const transformedProducts = batch.map((p) => this.transformProductForSync(p, store));

      try {
        await this.sendToService(
          'products',
          'bulk',
          { products: transformedProducts }
        );
        totalSynced += batch.length;

        logger.debug(
          `[SyncService] Synced ${totalSynced}/${allProducts.length} products`
        );
      } catch (error) {
        logger.error(`[SyncService] Failed to sync product batch:`, error);
        throw error;
      }
    }

    return totalSynced;
  }

  private static transformProductForSync(
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
      variants: product.variants.map((v) => ({
        shopifyVariantId: v.id,
        sku: v.sku,
        price: v.price,
        inventoryQuantity: v.inventory_quantity,
        inventoryPolicy: v.inventory_policy,
      })),
      images: product.images.map((img) => ({
        shopifyImageId: img.id,
        src: img.src,
        alt: img.alt,
      })),
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }

  // ── Order Sync ────────────────────────────────────────────────────────────────

  private static async syncOrders(
    store: IStoreDocument,
    adminClient: ShopifyAdminClient
  ): Promise<number> {
    let totalSynced = 0;
    const lastSyncAt = await this.getLastSyncTime(store._id.toString(), 'orders');
    const createdAtMin = lastSyncAt
      ? new Date(lastSyncAt).toISOString()
      : undefined;

    const allOrders = await adminClient.getAllOrders(createdAtMin);

    for (let i = 0; i < allOrders.length; i += syncConfig.batchSize) {
      const batch = allOrders.slice(i, i + syncConfig.batchSize);
      const transformedOrders = batch.map((o) => this.transformOrderForSync(o, store));

      try {
        await this.sendToService(
          'orders',
          'bulk',
          { orders: transformedOrders }
        );
        totalSynced += batch.length;
      } catch (error) {
        logger.error(`[SyncService] Failed to sync order batch:`, error);
        throw error;
      }
    }

    return totalSynced;
  }

  private static transformOrderForSync(
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
      currency: order.currency,
      customer: order.customer
        ? {
            shopifyCustomerId: order.customer.id,
            email: order.customer.email,
            firstName: order.customer.first_name,
            lastName: order.customer.last_name,
          }
        : null,
      lineItems: order.line_items.map((item) => ({
        shopifyVariantId: item.variant_id,
        shopifyProductId: item.product_id,
        title: item.title,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
      })),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }

  // ── Customer Sync ─────────────────────────────────────────────────────────────

  private static async syncCustomers(
    store: IStoreDocument,
    adminClient: ShopifyAdminClient
  ): Promise<number> {
    let totalSynced = 0;
    let lastSyncId = await this.getLastSyncId(store._id.toString(), 'customers');

    const allCustomers = await adminClient.getAllCustomers(
      lastSyncId ? parseInt(lastSyncId, 10) : undefined
    );

    for (let i = 0; i < allCustomers.length; i += syncConfig.batchSize) {
      const batch = allCustomers.slice(i, i + syncConfig.batchSize);
      const transformedCustomers = batch.map((c) =>
        this.transformCustomerForSync(c, store)
      );

      try {
        await this.sendToService(
          'customers',
          'bulk',
          { customers: transformedCustomers }
        );
        totalSynced += batch.length;
      } catch (error) {
        logger.error(`[SyncService] Failed to sync customer batch:`, error);
        throw error;
      }
    }

    return totalSynced;
  }

  private static transformCustomerForSync(
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
      totalSpent: customer.total_spent,
      ordersCount: customer.orders_count,
      verifiedEmail: customer.verified_email,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    };
  }

  // ── Inventory Sync ────────────────────────────────────────────────────────────

  private static async syncInventory(
    store: IStoreDocument,
    adminClient: ShopifyAdminClient
  ): Promise<number> {
    // Get all locations
    const locations = await adminClient.getLocations();

    // Get all inventory items from products
    const products = await adminClient.getAllProducts();
    const inventoryItemIds = [
      ...new Set(
        products
          .flatMap((p) => p.variants)
          .map((v) => v.inventory_item_id)
          .filter(Boolean)
      ),
    ] as number[];

    if (inventoryItemIds.length === 0) {
      return 0;
    }

    // Get inventory levels for all items
    const inventoryLevels: ShopifyInventoryLevel[] = [];
    for (let i = 0; i < inventoryItemIds.length; i += 250) {
      const batch = inventoryItemIds.slice(i, i + 250);
      const levels = await adminClient.getInventoryLevels(batch);
      inventoryLevels.push(...levels);
    }

    // Transform and sync
    const transformedInventory = inventoryLevels.map((level) => ({
      shopifyInventoryItemId: level.inventory_item_id,
      shopifyLocationId: level.location_id,
      available: level.available,
      updatedAt: level.updated_at,
      storeDomain: store.shopifyDomain,
    }));

    await this.sendToService('inventory', 'bulk', {
      inventory: transformedInventory,
    });

    return inventoryLevels.length;
  }

  // ── Service Communication ─────────────────────────────────────────────────────

  private static async sendToService(
    entity: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const endpoints: Record<string, string> = {
      products: serviceEndpoints.catalogService,
      orders: serviceEndpoints.orderService,
      customers: serviceEndpoints.identityService,
      inventory: serviceEndpoints.inventoryService,
    };

    const baseUrl = endpoints[entity];
    if (!baseUrl) {
      throw new Error(`Unknown entity: ${entity}`);
    }

    const response = await fetch(`${baseUrl}/api/${entity}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': getInternalToken(),
        'X-Shopify-Connector': 'true',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service returned ${response.status}: ${errorText}`);
    }
  }

  // ── Sync State Management ────────────────────────────────────────────────────

  private static async getLastSyncId(
    storeId: string,
    entity: SyncEntity
  ): Promise<string | null> {
    const redis = getRedis();
    return redis.get(`sync:lastId:${storeId}:${entity}`);
  }

  private static async getLastSyncTime(
    storeId: string,
    entity: SyncEntity
  ): Promise<Date | null> {
    const redis = getRedis();
    const timestamp = await redis.get(`sync:lastTime:${storeId}:${entity}`);
    return timestamp ? new Date(parseInt(timestamp, 10)) : null;
  }

  private static async setLastSyncId(
    storeId: string,
    entity: SyncEntity,
    lastId: string
  ): Promise<void> {
    const redis = getRedis();
    await redis.set(`sync:lastId:${storeId}:${entity}`, lastId);
  }

  private static async setLastSyncTime(
    storeId: string,
    entity: SyncEntity
  ): Promise<void> {
    const redis = getRedis();
    await redis.set(`sync:lastTime:${storeId}:${entity}`, Date.now().toString());
  }

  // ── Status Queries ────────────────────────────────────────────────────────────

  static async getSyncStatus(storeId: string): Promise<{
    storeId: string;
    storeDomain: string;
    entities: Record<SyncEntity, {
      status: string;
      lastSyncAt?: Date;
      itemsSynced: number;
      error?: string;
    }>;
  } | null> {
    const store = await Store.findById(storeId);
    if (!store) {
      return null;
    }

    return {
      storeId: store._id.toString(),
      storeDomain: store.shopifyDomain,
      entities: {
        products: {
          status: store.syncStatus.products.status,
          lastSyncAt: store.syncStatus.products.lastSyncAt,
          itemsSynced: store.syncStatus.products.itemsSynced,
          error: store.syncStatus.products.error,
        },
        orders: {
          status: store.syncStatus.orders.status,
          lastSyncAt: store.syncStatus.orders.lastSyncAt,
          itemsSynced: store.syncStatus.orders.itemsSynced,
          error: store.syncStatus.orders.error,
        },
        customers: {
          status: store.syncStatus.customers.status,
          lastSyncAt: store.syncStatus.customers.lastSyncAt,
          itemsSynced: store.syncStatus.customers.itemsSynced,
          error: store.syncStatus.customers.error,
        },
        inventory: {
          status: store.syncStatus.inventory.status,
          lastSyncAt: store.syncStatus.inventory.lastSyncAt,
          itemsSynced: store.syncStatus.inventory.itemsSynced,
          error: store.syncStatus.inventory.error,
        },
      },
    };
  }

  /**
   * Trigger full sync for all stores and entities
   */
  static async triggerFullSync(storeId?: string): Promise<string[]> {
    const stores = storeId
      ? [await Store.findById(storeId)].filter(Boolean) as IStoreDocument[]
      : await Store.findActiveStores();

    const jobIds: string[] = [];

    for (const store of stores) {
      const entities: SyncEntity[] = ['products', 'orders', 'customers', 'inventory'];

      for (const entity of entities) {
        const { jobId } = await this.triggerSync(store._id.toString(), entity);
        jobIds.push(jobId);
      }
    }

    return jobIds;
  }
}
