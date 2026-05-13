/**
 * Sync Service
 *
 * Handles bidirectional synchronization between WooCommerce and ReZ platform.
 */

import Redis from 'ioredis';
import { Store, IStoreDocument } from '../models/Store';
import { WooCommerceClient } from '../clients/wooClient';
import {
  WooCustomer,
  WooProduct,
  WooOrder,
  ReZCustomer,
  ReZProduct,
  ReZOrder,
  SyncStatusResponse,
  ManualSyncRequest,
  PaginationParams,
} from '../types';
import { appConfig, REDIS_KEYS, CACHE_TTL } from '../config';
import logger from '../utils/logger';
import { getServiceTokens } from '../config';

// ============================================
// Sync Service Class
// ============================================

export class SyncService {
  private redis: Redis | null = null;
  private syncLocks: Map<string, NodeJS.Timeout> = new Map();

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
      logger.info('Redis connected for sync service');
    } catch (error) {
      logger.warn('Redis not available, continuing without cache');
      this.redis = null;
    }
  }

  /**
   * Acquire lock for sync operation
   */
  private async acquireLock(storeId: string, entityType: string): Promise<boolean> {
    if (!this.redis) return true; // Skip lock if Redis unavailable

    const lockKey = `sync:${storeId}:${entityType}`;
    const result = await this.redis!.set(lockKey, '1', 'EX', 300, 'NX');

    return result === 'OK';
  }

  /**
   * Release lock for sync operation
   */
  private async releaseLock(storeId: string, entityType: string): Promise<void> {
    if (!this.redis) return;

    const lockKey = `sync:${storeId}:${entityType}`;
    await this.redis.del(lockKey);
  }

  /**
   * Get sync status for a store
   */
  async getSyncStatus(storeId: string): Promise<SyncStatusResponse | null> {
    const store = await Store.findById(storeId);
    if (!store) {
      return null;
    }

    return {
      storeId: store._id.toString(),
      storeUrl: store.storeUrl,
      isActive: store.isActive,
      lastSyncAt: store.lastSyncAt?.toISOString(),
      syncStatus: store.syncStatus,
    };
  }

  /**
   * Trigger manual sync for a store
   */
  async triggerSync(request: ManualSyncRequest): Promise<{
    success: boolean;
    message: string;
    tasks: string[];
  }> {
    const { storeId, entityType = 'all' } = request;

    const store = await Store.findById(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    if (!store.isActive) {
      throw new Error('Store is not active');
    }

    const tasks: string[] = [];
    const types: Array<'products' | 'orders' | 'customers'> =
      entityType === 'all'
        ? ['products', 'orders', 'customers']
        : [entityType as 'products' | 'orders' | 'customers'];

    for (const type of types) {
      const lockAcquired = await this.acquireLock(storeId, type);
      if (!lockAcquired) {
        logger.warn(`Sync already in progress for ${storeId}:${type}`);
        tasks.push(`${type}: skipped (sync in progress)`);
        continue;
      }

      // Start sync in background
      this.runSync(store, type).catch((error) => {
        logger.error(`Sync failed for ${storeId}:${type}:`, error);
      });

      tasks.push(`${type}: started`);
    }

    return {
      success: true,
      message: 'Sync tasks initiated',
      tasks,
    };
  }

  /**
   * Run sync for a specific entity type
   */
  private async runSync(
    store: IStoreDocument,
    entityType: 'products' | 'orders' | 'customers'
  ): Promise<void> {
    const storeId = store._id.toString();
    logger.info(`Starting ${entityType} sync for store ${store.storeUrl}`);

    try {
      // Mark sync as started
      await store.markSyncStarted(entityType);

      let itemsSynced = 0;

      switch (entityType) {
        case 'products':
          itemsSynced = await this.syncProducts(store);
          break;
        case 'orders':
          itemsSynced = await this.syncOrders(store);
          break;
        case 'customers':
          itemsSynced = await this.syncCustomers(store);
          break;
      }

      // Mark sync as completed
      await store.markSyncCompleted(entityType, itemsSynced);
      logger.info(`Completed ${entityType} sync for ${store.storeUrl}: ${itemsSynced} items`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await store.markSyncError(entityType, errorMessage);
      logger.error(`Sync error for ${store.storeUrl}:${entityType}:`, error);
    } finally {
      await this.releaseLock(storeId, entityType);
    }
  }

  /**
   * Sync products from WooCommerce to ReZ
   */
  private async syncProducts(store: IStoreDocument): Promise<number> {
    const client = new WooCommerceClient({
      storeUrl: store.storeUrl,
      consumerKey: store.consumerKey,
      consumerSecret: store.getDecryptedSecret(),
    });

    let page = 1;
    const perPage = 100;
    let totalSynced = 0;

    while (true) {
      const params: PaginationParams = { page, per_page: perPage };
      const response = await client.getProducts(params);

      if (response.data.length === 0) break;

      for (const wooProduct of response.data) {
        try {
          await this.syncProductToReZ(wooProduct, store);
          totalSynced++;
        } catch (error) {
          logger.warn(`Failed to sync product ${wooProduct.id}:`, error);
        }
      }

      if (page >= response.pagination.total_pages) break;
      page++;
    }

    return totalSynced;
  }

  /**
   * Sync single product to ReZ platform
   */
  private async syncProductToReZ(
    wooProduct: WooProduct,
    store: IStoreDocument
  ): Promise<void> {
    const reZProduct: ReZProduct = {
      externalId: `${store._id}:product:${wooProduct.id}`,
      name: wooProduct.name,
      description: wooProduct.description,
      sku: wooProduct.sku,
      price: {
        amount: parseFloat(wooProduct.price || '0'),
        currency: store.storeInfo?.currency || 'USD',
      },
      inventory: {
        quantity: wooProduct.stock_quantity ?? 0,
        status: this.mapStockStatus(wooProduct.stock_status),
      },
      images: wooProduct.images.map((img) => ({
        url: img.src,
        alt: img.alt || img.name,
      })),
      categories: wooProduct.categories.map((cat) => cat.name),
      attributes: this.mapAttributes(wooProduct.attributes),
      metadata: {
        source: 'woocommerce',
        wooProductId: wooProduct.id,
        createdAt: wooProduct.created_at,
        updatedAt: wooProduct.updated_at,
      },
    };

    await this.sendToReZService(
      appConfig.rezServices.productServiceUrl,
      '/api/products/sync',
      reZProduct
    );
  }

  /**
   * Sync orders from WooCommerce to ReZ
   */
  private async syncOrders(store: IStoreDocument): Promise<number> {
    const client = new WooCommerceClient({
      storeUrl: store.storeUrl,
      consumerKey: store.consumerKey,
      consumerSecret: store.getDecryptedSecret(),
    });

    let page = 1;
    const perPage = 100;
    let totalSynced = 0;

    while (true) {
      const params: PaginationParams & { status?: string } = {
        page,
        per_page: perPage,
        status: 'processing,completed',
      };
      const response = await client.getOrders(params);

      if (response.data.length === 0) break;

      for (const wooOrder of response.data) {
        try {
          await this.syncOrderToReZ(wooOrder, store);
          totalSynced++;
        } catch (error) {
          logger.warn(`Failed to sync order ${wooOrder.id}:`, error);
        }
      }

      if (page >= response.pagination.total_pages) break;
      page++;
    }

    return totalSynced;
  }

  /**
   * Sync single order to ReZ platform
   */
  private async syncOrderToReZ(
    wooOrder: WooOrder,
    store: IStoreDocument
  ): Promise<void> {
    const reZOrder: ReZOrder = {
      externalId: `${store._id}:order:${wooOrder.id}`,
      orderNumber: wooOrder.number,
      status: this.mapOrderStatus(wooOrder.status),
      customer: {
        externalId: `${store._id}:customer:${wooOrder.customer_id}`,
        email: wooOrder.billing.email || '',
      },
      totals: {
        subtotal: parseFloat(wooOrder.subtotal || '0'),
        tax: parseFloat(wooOrder.total_tax || '0'),
        shipping: this.getShippingTotal(wooOrder),
        discount: 0,
        total: parseFloat(wooOrder.total || '0'),
        currency: wooOrder.currency,
      },
      items: wooOrder.line_items.map((item) => ({
        productId: `${store._id}:product:${item.product_id}`,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price || '0'),
        total: parseFloat(item.total || '0'),
      })),
      shippingAddress: this.mapAddress(wooOrder.shipping),
      billingAddress: this.mapAddress(wooOrder.billing),
      payment: {
        method: wooOrder.payment_method,
        methodTitle: wooOrder.payment_method_title,
        transactionId: wooOrder.transaction_id,
      },
      metadata: {
        source: 'woocommerce',
        wooOrderId: wooOrder.id,
        createdAt: wooOrder.created_at,
        updatedAt: wooOrder.updated_at,
      },
    };

    await this.sendToReZService(
      appConfig.rezServices.orderServiceUrl,
      '/api/orders/sync',
      reZOrder
    );
  }

  /**
   * Sync customers from WooCommerce to ReZ
   */
  private async syncCustomers(store: IStoreDocument): Promise<number> {
    const client = new WooCommerceClient({
      storeUrl: store.storeUrl,
      consumerKey: store.consumerKey,
      consumerSecret: store.getDecryptedSecret(),
    });

    let page = 1;
    const perPage = 100;
    let totalSynced = 0;

    while (true) {
      const params: PaginationParams = { page, per_page: perPage };
      const response = await client.getCustomers(params);

      if (response.data.length === 0) break;

      for (const wooCustomer of response.data) {
        try {
          await this.syncCustomerToReZ(wooCustomer, store);
          totalSynced++;
        } catch (error) {
          logger.warn(`Failed to sync customer ${wooCustomer.id}:`, error);
        }
      }

      if (page >= response.pagination.total_pages) break;
      page++;
    }

    return totalSynced;
  }

  /**
   * Sync single customer to ReZ platform
   */
  private async syncCustomerToReZ(
    wooCustomer: WooCustomer,
    store: IStoreDocument
  ): Promise<void> {
    const reZCustomer: ReZCustomer = {
      externalId: `${store._id}:customer:${wooCustomer.id}`,
      email: wooCustomer.email,
      firstName: wooCustomer.first_name,
      lastName: wooCustomer.last_name,
      phone: wooCustomer.billing.phone,
      addresses: {
        billing: this.mapAddress(wooCustomer.billing),
        shipping: this.mapAddress(wooCustomer.shipping),
      },
      metadata: {
        source: 'woocommerce',
        wooCustomerId: wooCustomer.id,
        createdAt: wooCustomer.created_at,
        updatedAt: new Date().toISOString(),
      },
    };

    await this.sendToReZService(
      appConfig.rezServices.identityServiceUrl,
      '/api/customers/sync',
      reZCustomer
    );
  }

  /**
   * Send data to ReZ internal service
   */
  private async sendToReZService(
    serviceUrl: string,
    endpoint: string,
    data: unknown
  ): Promise<void> {
    const tokens = getServiceTokens();
    const token = Object.values(tokens)[0] || appConfig.internalServiceToken;

    const response = await fetch(`${serviceUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': token || '',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ReZ service returned ${response.status}: ${errorText}`);
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapStockStatus(
    wooStatus: WooProduct['stock_status']
  ): 'in_stock' | 'out_of_stock' | 'on_backorder' {
    switch (wooStatus) {
      case 'instock':
        return 'in_stock';
      case 'outofstock':
        return 'out_of_stock';
      case 'onbackorder':
        return 'on_backorder';
      default:
        return 'out_of_stock';
    }
  }

  private mapOrderStatus(wooStatus: WooOrder['status']): ReZOrder['status'] {
    const statusMap: Record<string, ReZOrder['status']> = {
      pending: 'pending',
      processing: 'processing',
      'on-hold': 'on_hold',
      completed: 'completed',
      cancelled: 'cancelled',
      refunded: 'refunded',
      failed: 'failed',
    };
    return statusMap[wooStatus] || 'pending';
  }

  private mapAddress(wooAddress: WooCustomer['billing']): ReZAddress | undefined {
    if (!wooAddress || !wooAddress.address_1) return undefined;
    return {
      line1: wooAddress.address_1,
      line2: wooAddress.address_2 || undefined,
      city: wooAddress.city,
      state: wooAddress.state,
      postalCode: wooAddress.postcode,
      country: wooAddress.country,
    };
  }

  private mapAttributes(
    attributes: WooProduct['attributes']
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const attr of attributes) {
      if (attr.visible && attr.options.length > 0) {
        result[attr.name] = attr.options.join(', ');
      }
    }
    return result;
  }

  private getShippingTotal(wooOrder: WooOrder): number {
    if (!wooOrder.shipping_lines || wooOrder.shipping_lines.length === 0) {
      return 0;
    }
    return wooOrder.shipping_lines.reduce((total, line) => {
      return total + parseFloat(line.total || '0');
    }, 0);
  }
}

// ============================================
// Re-export types for helper
// ============================================

interface ReZAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// ============================================
// Singleton Export
// ============================================

export const syncService = new SyncService();

export default syncService;
