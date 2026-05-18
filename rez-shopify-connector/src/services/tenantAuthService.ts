import crypto from 'crypto';
import { Store, IStoreDocument } from '../models/Store';
import { serverConfig } from '../config';
import { logger } from '../config';
import axios from 'axios';

// Request from multitenant-core to create tenant + store
export interface CreateTenantAndStoreRequest {
  tenantId: string;
  brandId: string;
  shop: string;
  code: string;
  state: string;
  hmac: string;
}

export interface TenantStoreResponse {
  store: IStoreDocument;
  tenantId: string;
  brandId: string;
}

/**
 * Tenant-aware Authentication Service
 *
 * Handles Shopify OAuth with multi-tenant support.
 * When a new store connects, it either:
 * 1. Creates a new tenant (for standalone use)
 * 2. Registers with an existing tenant (when called from multitenant-core)
 */
export class TenantAuthService {
  /**
   * Generate OAuth URL for store connection
   */
  static generateAuthUrl(shop: string): { url: string; state: string } {
    const state = crypto.randomBytes(16).toString('hex');

    const scopes = [
      'read_orders',
      'write_orders',
      'read_customers',
      'write_customers',
      'read_products',
      'write_products',
      'read_fulfillments',
      'write_fulfillments',
      'read_inventory',
      'write_inventory',
    ].join(',');

    const params = new URLSearchParams({
      client_id: serverConfig.shopifyApiKey,
      scope: scopes,
      redirect_uri: serverConfig.redirectUri,
      state,
    });

    return {
      url: `https://${shop}/admin/oauth/authorize?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle OAuth callback - tenant-aware
   *
   * If tenantId is provided, registers store under that tenant.
   * If tenantId is NOT provided, creates a standalone store (legacy behavior).
   */
  static async handleCallback(
    shop: string,
    code: string,
    state: string,
    hmac: string,
    tenantId?: string,
    brandId?: string
  ): Promise<TenantStoreResponse> {
    // Verify HMAC
    const params = new URLSearchParams({ code, shop, state });
    const message = params.toString();
    const generatedHash = crypto
      .createHmac('sha256', serverConfig.shopifyApiSecret)
      .update(message)
      .digest('hex');

    if (generatedHash !== hmac) {
      throw new Error('Invalid HMAC signature');
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: serverConfig.shopifyApiKey,
        client_secret: serverConfig.shopifyApiSecret,
        code,
      },
      { timeout: 10000 }
    );

    const { access_token, scope } = tokenResponse.data;

    // Get shop info
    const shopResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': access_token,
        },
        timeout: 10000,
      }
    );

    const shopInfo = shopResponse.data.shop;

    // Check if store already exists under this tenant
    let store = tenantId
      ? await Store.findByDomain(shop, tenantId)
      : await Store.findOne({ shopifyDomain: shop.toLowerCase() });

    if (store) {
      // Update existing store
      store.accessToken = access_token;
      store.scope = scope;
      store.isActive = true;

      if (!tenantId) {
        // Legacy: create tenant if not provided
        store.tenantId = `tenant_${crypto.randomBytes(8).toString('hex')}`;
        store.brandId = `brand_${crypto.randomBytes(8).toString('hex')}`;
      }

      await store.save();

      logger.info('[TenantAuth] Store updated', {
        storeId: store._id,
        shopifyDomain: shop,
        tenantId: store.tenantId,
      });

      return {
        store,
        tenantId: store.tenantId,
        brandId: store.brandId,
      };
    }

    // Create new store
    const newStore = new Store({
      tenantId: tenantId || `tenant_${crypto.randomBytes(8).toString('hex')}`,
      brandId: brandId || `brand_${crypto.randomBytes(8).toString('hex')}`,
      shopifyDomain: shop.toLowerCase(),
      shopifyStoreId: shopInfo.id,
      accessToken,
      scope,
      isActive: true,
      storeInfo: {
        id: shopInfo.id,
        name: shopInfo.name,
        email: shopInfo.email,
        domain: shopInfo.domain,
        province: shopInfo.province,
        country: shopInfo.country,
        address1: shopInfo.address1,
        zip: shopInfo.zip,
        city: shopInfo.city,
        phone: shopInfo.phone,
        customer_email: shopInfo.customer_email,
        latitude: shopInfo.latitude,
        longitude: shopInfo.longitude,
        primary_locale: shopInfo.primary_locale,
        currency: shopInfo.currency,
        money_format: shopInfo.money_format,
        shop_owner: shopInfo.shop_owner,
        timezone: shopInfo.timezone,
        country_code: shopInfo.country_code,
        country_name: shopInfo.country_name,
      },
    });

    await newStore.save();

    logger.info('[TenantAuth] New store created', {
      storeId: newStore._id,
      shopifyDomain: shop,
      tenantId: newStore.tenantId,
      brandId: newStore.brandId,
    });

    // Register webhooks
    await this.registerWebhooks(newStore);

    return {
      store: newStore,
      tenantId: newStore.tenantId,
      brandId: newStore.brandId,
    };
  }

  /**
   * Register webhooks for a store
   */
  private static async registerWebhooks(store: IStoreDocument): Promise<void> {
    const webhookTopics = [
      'orders/create',
      'orders/updated',
      'orders/fulfilled',
      'products/create',
      'products/update',
      'products/delete',
      'customers/create',
      'customers/update',
      'inventory_levels/update',
    ];

    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `https://${process.env.HOST}/api/shopify`;

    for (const topic of webhookTopics) {
      try {
        const response = await axios.post(
          `https://${store.shopifyDomain}/admin/api/2024-01/webhooks.json`,
          {
            webhook: {
              topic,
              address: `${webhookBaseUrl}/webhook/${store._id}`,
              format: 'json',
            },
          },
          {
            headers: {
              'X-Shopify-Access-Token': store.accessToken,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const webhookId = response.data.webhook?.id;
        if (webhookId) {
          await store.setWebhookId(topic as any, webhookId);
          logger.info('[TenantAuth] Webhook registered', {
            topic,
            webhookId,
            storeId: store._id,
          });
        }
      } catch (error) {
        logger.warn('[TenantAuth] Failed to register webhook', {
          topic,
          storeId: store._id,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Register a store under an existing tenant (called from multitenant-core)
   */
  static async registerStoreUnderTenant(
    request: CreateTenantAndStoreRequest
  ): Promise<TenantStoreResponse> {
    return this.handleCallback(
      request.shop,
      request.code,
      request.state,
      request.hmac,
      request.tenantId,
      request.brandId
    );
  }
}
