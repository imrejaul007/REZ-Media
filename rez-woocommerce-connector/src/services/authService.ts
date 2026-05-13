/**
 * Authentication Service
 *
 * Handles WooCommerce store registration and authentication.
 */

import { Store, IStoreDocument } from '../models/Store';
import { WooCommerceClient } from '../clients/wooClient';
import {
  ConnectStoreRequest,
  ConnectStoreResponse,
  WooCommerceStoreInfo,
} from '../types';
import { WooCommerceError, AuthenticationError } from '../types';
import logger from '../utils/logger';

// ============================================
// Store Connection Service
// ============================================

export class AuthService {
  /**
   * Register a new WooCommerce store
   */
  async connectStore(request: ConnectStoreRequest): Promise<ConnectStoreResponse> {
    const { storeUrl, consumerKey, consumerSecret } = request;

    // Check if store already exists
    const existingStore = await Store.findByStoreUrl(storeUrl);
    if (existingStore) {
      // Update existing store with new credentials
      existingStore.consumerKey = consumerKey;
      existingStore.consumerSecret = consumerSecret;
      existingStore.isActive = true;
      await existingStore.save();

      return {
        success: true,
        store: {
          id: existingStore._id.toString(),
          storeUrl: existingStore.storeUrl,
          storeName: existingStore.storeName,
          isActive: existingStore.isActive,
        },
        message: 'Store credentials updated successfully',
      };
    }

    // Create new WooCommerce client to test connection
    const client = new WooCommerceClient({
      storeUrl,
      consumerKey,
      consumerSecret,
    });

    // Verify connection and get store info
    let storeInfo: WooCommerceStoreInfo;
    try {
      storeInfo = await client.getStoreInfo();
    } catch (error) {
      if (error instanceof WooCommerceError) {
        throw new AuthenticationError(
          `Failed to connect to WooCommerce store: ${error.message}`
        );
      }
      throw new AuthenticationError(
        'Failed to connect to WooCommerce store: Invalid credentials or store URL'
      );
    }

    // Register webhook endpoint
    const webhookUrl = this.getWebhookUrl();
    let webhookId: number | undefined;

    try {
      const webhook = await client.createWebhook({
        name: 'ReZ Platform Connector',
        topic: 'order.created,order.updated,customer.created,customer.updated,product.created,product.updated',
        delivery_url: webhookUrl,
        secret: process.env.WOOCOMMERCE_WEBHOOK_SECRET || undefined,
      });
      webhookId = webhook.id;
      logger.info(`Created webhook ${webhookId} for store ${storeUrl}`);
    } catch (error) {
      logger.warn(`Failed to create webhook for store ${storeUrl}:`, error);
      // Continue without webhook - manual sync will still work
    }

    // Create store record
    const store = new Store({
      storeUrl: storeUrl.toLowerCase(),
      storeName: storeInfo.siteTitle || storeUrl,
      consumerKey,
      consumerSecret,
      storeInfo,
      webhookId,
      isActive: true,
    });

    await store.save();

    logger.info(`Connected WooCommerce store: ${storeUrl}`);

    return {
      success: true,
      store: {
        id: store._id.toString(),
        storeUrl: store.storeUrl,
        storeName: store.storeName,
        isActive: store.isActive,
      },
    };
  }

  /**
   * Disconnect and remove a WooCommerce store
   */
  async disconnectStore(storeId: string): Promise<boolean> {
    const store = await Store.findById(storeId);
    if (!store) {
      throw new AuthenticationError('Store not found');
    }

    // Delete webhook if exists
    if (store.webhookId) {
      try {
        const client = this.createClientFromStore(store);
        await client.deleteWebhook(store.webhookId);
        logger.info(`Deleted webhook ${store.webhookId} for store ${store.storeUrl}`);
      } catch (error) {
        logger.warn(`Failed to delete webhook for store ${store.storeUrl}:`, error);
      }
    }

    // Soft delete - mark as inactive
    store.isActive = false;
    store.webhookId = undefined;
    await store.save();

    logger.info(`Disconnected WooCommerce store: ${store.storeUrl}`);

    return true;
  }

  /**
   * List all connected stores
   */
  async listStores(): Promise<Array<{
    id: string;
    storeUrl: string;
    storeName: string;
    isActive: boolean;
    lastSyncAt?: Date;
    storeInfo?: WooCommerceStoreInfo;
  }>> {
    const stores = await Store.find({}).sort({ createdAt: -1 });

    return stores.map((store) => ({
      id: store._id.toString(),
      storeUrl: store.storeUrl,
      storeName: store.storeName,
      isActive: store.isActive,
      lastSyncAt: store.lastSyncAt,
      storeInfo: store.storeInfo,
    }));
  }

  /**
   * Get store by ID
   */
  async getStore(storeId: string): Promise<IStoreDocument | null> {
    return Store.findById(storeId);
  }

  /**
   * Get store by URL
   */
  async getStoreByUrl(storeUrl: string): Promise<IStoreDocument | null> {
    return Store.findByStoreUrl(storeUrl);
  }

  /**
   * Verify store credentials
   */
  async verifyCredentials(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
  ): Promise<{ valid: boolean; storeInfo?: WooCommerceStoreInfo }> {
    try {
      const client = new WooCommerceClient({
        storeUrl,
        consumerKey,
        consumerSecret,
      });
      const storeInfo = await client.getStoreInfo();
      return { valid: true, storeInfo };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Create WooCommerce client from store record
   */
  createClientFromStore(store: IStoreDocument): WooCommerceClient {
    return new WooCommerceClient({
      storeUrl: store.storeUrl,
      consumerKey: store.consumerKey,
      consumerSecret: store.getDecryptedSecret(),
    });
  }

  /**
   * Get webhook URL for this service
   */
  private getWebhookUrl(): string {
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://woocommerce-connector.rezapp.com';
    return `${baseUrl}/api/woocommerce/webhook`;
  }
}

// ============================================
// Singleton Export
// ============================================

export const authService = new AuthService();

export default authService;
