import { Store, IStoreDocument } from '../models/Store';
import { AuthService } from './authService';
import { ShopifyAdminClient } from '../clients/adminClient';
import { logger } from '../config';
import type { ShopifyStoreInfo } from '../types';

// ── Store Service ────────────────────────────────────────────────────────────────

export class StoreService {
  /**
   * Get all connected stores
   */
  static async getAllStores(options?: {
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    stores: IStoreDocument[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const { activeOnly = false, page = 1, limit = 20 } = options || {};

    const query = activeOnly ? { isActive: true } : {};

    const skip = (page - 1) * limit;

    const [stores, total] = await Promise.all([
      Store.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Store.countDocuments(query),
    ]);

    return {
      stores,
      total,
      page,
      limit,
      hasMore: skip + stores.length < total,
    };
  }

  /**
   * Get a single store by ID
   */
  static async getStoreById(storeId: string): Promise<IStoreDocument | null> {
    return Store.findById(storeId);
  }

  /**
   * Get a single store by domain
   */
  static async getStoreByDomain(domain: string): Promise<IStoreDocument | null> {
    return Store.findByDomain(domain);
  }

  /**
   * Get a single store by Shopify store ID
   */
  static async getStoreByShopifyId(shopifyStoreId: number): Promise<IStoreDocument | null> {
    return Store.findByStoreId(shopifyStoreId);
  }

  /**
   * Disconnect and deactivate a store
   */
  static async disconnectStore(storeId: string): Promise<void> {
    const store = await Store.findById(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    // Deactivate via auth service
    await AuthService.deactivateStore(store.shopifyDomain);

    logger.info(`[StoreService] Disconnected store ${store.shopifyDomain}`);
  }

  /**
   * Update store settings
   */
  static async updateStoreSettings(
    storeId: string,
    settings: {
      isActive?: boolean;
      syncPreferences?: {
        syncProducts?: boolean;
        syncOrders?: boolean;
        syncCustomers?: boolean;
        syncInventory?: boolean;
        syncIntervalHours?: number;
      };
    }
  ): Promise<IStoreDocument | null> {
    const store = await Store.findById(storeId);
    if (!store) {
      return null;
    }

    if (settings.isActive !== undefined) {
      store.isActive = settings.isActive;
    }

    await store.save();
    logger.info(`[StoreService] Updated settings for store ${store.shopifyDomain}`);

    return store;
  }

  /**
   * Refresh store info from Shopify
   */
  static async refreshStoreInfo(storeId: string): Promise<IStoreDocument | null> {
    const store = await Store.findById(storeId);
    if (!store) {
      return null;
    }

    try {
      const adminClient = new ShopifyAdminClient(store.shopifyDomain, store.accessToken);
      const storeInfo = await adminClient.getStoreInfo();

      store.storeInfo = storeInfo as unknown as IStoreDocument['storeInfo'];
      await store.save();

      logger.info(`[StoreService] Refreshed info for store ${store.shopifyDomain}`);
      return store;
    } catch (error) {
      logger.error(`[StoreService] Failed to refresh store info:`, error);
      throw error;
    }
  }

  /**
   * Verify store access token is still valid
   */
  static async verifyStoreAccess(storeId: string): Promise<{
    isValid: boolean;
    lastVerified?: Date;
    error?: string;
  }> {
    const store = await Store.findById(storeId);
    if (!store) {
      return { isValid: false, error: 'Store not found' };
    }

    try {
      const isValid = await AuthService.verifyAccessToken(store.shopifyDomain);

      if (isValid) {
        await store.updateOne({ $set: { lastVerifiedAt: new Date() } });
      }

      return { isValid };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Get store statistics
   */
  static async getStoreStats(storeId: string): Promise<{
    storeDomain: string;
    connectedSince: Date;
    totalSyncs: number;
    totalItemsSynced: {
      products: number;
      orders: number;
      customers: number;
      inventory: number;
    };
    lastSync: Date | null;
    webhooksRegistered: number;
    isActive: boolean;
  } | null> {
    const store = await Store.findById(storeId);
    if (!store) {
      return null;
    }

    const totalItemsSynced =
      store.syncStatus.products.itemsSynced +
      store.syncStatus.orders.itemsSynced +
      store.syncStatus.customers.itemsSynced +
      store.syncStatus.inventory.itemsSynced;

    const lastSyncDates = [
      store.syncStatus.products.lastSyncAt,
      store.syncStatus.orders.lastSyncAt,
      store.syncStatus.customers.lastSyncAt,
      store.syncStatus.inventory.lastSyncAt,
    ].filter(Boolean) as Date[];

    const lastSync = lastSyncDates.length > 0
      ? new Date(Math.max(...lastSyncDates.map((d) => d.getTime())))
      : null;

    return {
      storeDomain: store.shopifyDomain,
      connectedSince: store.createdAt,
      totalSyncs: totalItemsSynced,
      totalItemsSynced: {
        products: store.syncStatus.products.itemsSynced,
        orders: store.syncStatus.orders.itemsSynced,
        customers: store.syncStatus.customers.itemsSynced,
        inventory: store.syncStatus.inventory.itemsSynced,
      },
      lastSync,
      webhooksRegistered: store.webhookIds.size,
      isActive: store.isActive,
    };
  }

  /**
   * List stores with pagination
   */
  static async listStores(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive' | 'all';
    sortBy?: 'createdAt' | 'updatedAt' | 'shopifyDomain';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    stores: Array<{
      id: string;
      shopifyDomain: string;
      storeName: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      stats: {
        productsSynced: number;
        ordersSynced: number;
        customersSynced: number;
        lastSync: Date | null;
      };
    }>;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      status = 'all',
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = params;

    const query: Record<string, unknown> = {};

    // Filter by status
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    // Search by domain
    if (search) {
      query.shopifyDomain = { $regex: search, $options: 'i' };
    }

    // Build sort
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const skip = (page - 1) * limit;

    const [stores, total] = await Promise.all([
      Store.find(query).sort(sort).skip(skip).limit(limit).exec(),
      Store.countDocuments(query),
    ]);

    const formattedStores = stores.map((store) => {
      const lastSyncDates = [
        store.syncStatus.products.lastSyncAt,
        store.syncStatus.orders.lastSyncAt,
        store.syncStatus.customers.lastSyncAt,
      ].filter(Boolean) as Date[];

      const lastSync = lastSyncDates.length > 0
        ? new Date(Math.max(...lastSyncDates.map((d) => d.getTime())))
        : null;

      return {
        id: store._id.toString(),
        shopifyDomain: store.shopifyDomain,
        storeName: store.storeInfo?.name || store.shopifyDomain,
        isActive: store.isActive,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
        stats: {
          productsSynced: store.syncStatus.products.itemsSynced,
          ordersSynced: store.syncStatus.orders.itemsSynced,
          customersSynced: store.syncStatus.customers.itemsSynced,
          lastSync,
        },
      };
    });

    return {
      stores: formattedStores,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get webhook summary for a store
   */
  static async getWebhookSummary(storeId: string): Promise<{
    totalWebhooks: number;
    webhooks: Array<{
      topic: string;
      webhookId: number | undefined;
      status: 'active' | 'unknown';
    }>;
  } | null> {
    const store = await Store.findById(storeId);
    if (!store) {
      return null;
    }

    const webhookTopics = [
      'ordersCreate',
      'ordersUpdated',
      'productsCreate',
      'productsUpdate',
      'productsDelete',
      'customersCreate',
      'customersUpdate',
      'inventoryLevelsUpdate',
    ];

    const webhooks = webhookTopics.map((topic) => ({
      topic: topic.replace(/([A-Z])/g, '_$1').toLowerCase(),
      webhookId: store.webhookIds.get(topic),
      status: store.webhookIds.has(topic) ? 'active' as const : 'unknown' as const,
    }));

    return {
      totalWebhooks: store.webhookIds.size,
      webhooks,
    };
  }
}
