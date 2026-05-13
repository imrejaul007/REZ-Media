import crypto from 'crypto';
import axios from 'axios';
import { Store, IStoreDocument } from '../models/Store';
import { ShopifyAdminClient } from '../clients/adminClient';
import { shopifyConfig, logger } from '../config';
import { webhookConfig } from '../config';
import type { ShopifyOAuthToken, WebhookTopic } from '../types';

// ── OAuth State Management ─────────────────────────────────────────────────────

interface OAuthState {
  shop: string;
  redirectUri: string;
  scope: string;
  createdAt: number;
}

const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes

// In-memory state management (in production, use Redis)
const oauthStates = new Map<string, OAuthState>();

function generateState(): { state: string; oauthState: OAuthState } {
  const state = crypto.randomBytes(16).toString('hex');
  const oauthState: OAuthState = {
    shop: '',
    redirectUri: shopifyConfig.redirectUri,
    scope: shopifyConfig.scopes.join(','),
    createdAt: Date.now(),
  };
  return { state, oauthState };
}

function validateState(state: string, shop: string): boolean {
  const oauthState = oauthStates.get(state);
  if (!oauthState) {
    return false;
  }

  // Check if state is expired
  const age = Date.now() - oauthState.createdAt;
  if (age > OAUTH_STATE_TTL_SECONDS * 1000) {
    oauthStates.delete(state);
    return false;
  }

  // Verify shop matches
  if (oauthState.shop.toLowerCase() !== shop.toLowerCase()) {
    return false;
  }

  return true;
}

// ── Auth Service ────────────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Generate the OAuth authorization URL for a Shopify store
   */
  static generateAuthUrl(shop: string): { url: string; state: string } {
    // Normalize shop domain
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Generate state for CSRF protection
    const { state, oauthState } = generateState();
    oauthState.shop = normalizedShop;
    oauthStates.set(state, oauthState);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: shopifyConfig.apiKey,
      scope: shopifyConfig.scopes.join(','),
      redirect_uri: shopifyConfig.redirectUri,
      state,
    });

    const authUrl = `https://${normalizedShop}/admin/oauth/authorize?${params}`;

    logger.info(`[AuthService] Generated auth URL for ${normalizedShop}`);

    return { url: authUrl, state };
  }

  /**
   * Exchange the authorization code for an access token
   */
  static async exchangeCodeForToken(
    shop: string,
    code: string
  ): Promise<ShopifyOAuthToken> {
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const response = await axios.post<ShopifyOAuthToken>(
      `https://${normalizedShop}/admin/oauth/access_token`,
      {
        client_id: shopifyConfig.apiKey,
        client_secret: shopifyConfig.apiSecret,
        code,
      }
    );

    const tokenData = response.data;

    logger.info(`[AuthService] Successfully obtained access token for ${normalizedShop}`);

    return tokenData;
  }

  /**
   * Handle OAuth callback and create/update store record
   */
  static async handleCallback(
    shop: string,
    code: string,
    state: string,
    hmac: string
  ): Promise<IStoreDocument> {
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Verify HMAC signature
    const params = { shop: normalizedShop, code, state };
    const isValidHmac = ShopifyAdminClient.verifyHmac(
      params,
      hmac,
      shopifyConfig.apiSecret
    );

    if (!isValidHmac) {
      logger.error(`[AuthService] Invalid HMAC signature for ${normalizedShop}`);
      throw new Error('Invalid HMAC signature');
    }

    // Verify state for CSRF protection
    if (!validateState(state, normalizedShop)) {
      logger.error(`[AuthService] Invalid OAuth state for ${normalizedShop}`);
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }

    // Clear used state
    oauthStates.delete(state);

    // Exchange code for access token
    const tokenData = await this.exchangeCodeForToken(normalizedShop, code);

    // Get store info
    const adminClient = new ShopifyAdminClient(normalizedShop, tokenData.access_token);
    const storeInfo = await adminClient.getStoreInfo();

    // Create or update store record
    let store = await Store.findByDomain(normalizedShop);

    if (store) {
      // Update existing store
      store.accessToken = tokenData.access_token;
      store.scope = tokenData.scope;
      store.scopeVersion = store.scopeVersion + 1;
      store.storeInfo = storeInfo as unknown as IStoreDocument['storeInfo'];
      store.isActive = true;
      await store.save();

      logger.info(`[AuthService] Updated existing store ${normalizedShop}`);
    } else {
      // Create new store record
      store = await Store.create({
        shopifyDomain: normalizedShop,
        shopifyStoreId: storeInfo.id,
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        scopeVersion: 1,
        isActive: true,
        storeInfo: storeInfo as unknown as IStoreDocument['storeInfo'],
        syncStatus: {
          products: { status: 'idle', itemsSynced: 0 },
          orders: { status: 'idle', itemsSynced: 0 },
          customers: { status: 'idle', itemsSynced: 0 },
          inventory: { status: 'idle', itemsSynced: 0 },
        },
      });

      logger.info(`[AuthService] Created new store ${normalizedShop}`);
    }

    // Register webhooks
    await this.registerWebhooks(store, normalizedShop, tokenData.access_token);

    return store;
  }

  /**
   * Register webhooks for the store
   */
  private static async registerWebhooks(
    store: IStoreDocument,
    shop: string,
    accessToken: string
  ): Promise<void> {
    const adminClient = new ShopifyAdminClient(shop, accessToken);
    const webhookAddress = `${process.env.WEBHOOK_BASE_URL || 'http://localhost:4050'}/api/shopify/webhook`;

    // Get existing webhooks to avoid duplicates
    const existingWebhooks = await adminClient.getWebhooks();
    const existingTopics = new Set(existingWebhooks.map((w) => w.topic));

    for (const topic of webhookConfig.topics) {
      if (existingTopics.has(topic)) {
        logger.debug(`[AuthService] Webhook for ${topic} already exists`);
        continue;
      }

      try {
        const webhook = await adminClient.registerWebhook(topic, webhookAddress);
        await store.setWebhookId(topic as WebhookTopic, webhook.id);
        logger.info(`[AuthService] Registered webhook for ${topic}: ${webhook.id}`);
      } catch (error) {
        logger.error(`[AuthService] Failed to register webhook for ${topic}:`, error);
      }
    }

    await store.save();
  }

  /**
   * Revoke store access and deactivate
   */
  static async deactivateStore(shop: string): Promise<void> {
    const store = await Store.findByDomain(shop);
    if (!store) {
      throw new Error('Store not found');
    }

    // Unregister all webhooks
    const adminClient = new ShopifyAdminClient(shop, store.accessToken);

    for (const [topic, webhookId] of store.webhookIds.entries()) {
      try {
        await adminClient.deleteWebhook(webhookId);
        logger.info(`[AuthService] Deleted webhook ${webhookId} for ${topic}`);
      } catch (error) {
        logger.warn(`[AuthService] Failed to delete webhook ${webhookId}:`, error);
      }
    }

    // Deactivate store
    store.isActive = false;
    store.webhookIds = new Map();
    await store.save();

    logger.info(`[AuthService] Deactivated store ${shop}`);
  }

  /**
   * Verify access token is still valid
   */
  static async verifyAccessToken(shop: string): Promise<boolean> {
    const store = await Store.findByDomain(shop);
    if (!store || !store.isActive) {
      return false;
    }

    const adminClient = new ShopifyAdminClient(shop, store.accessToken);
    return adminClient.verifyAccessToken();
  }

  /**
   * Get authorization URL for offline access (offline token)
   */
  static generateOfflineAuthUrl(shop: string): string {
    const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const { state, oauthState } = generateState();
    oauthState.shop = normalizedShop;
    oauthStates.set(state, oauthState);

    const params = new URLSearchParams({
      client_id: shopifyConfig.apiKey,
      scope: shopifyConfig.scopes.join(','),
      redirect_uri: shopifyConfig.redirectUri,
      state,
    });

    return `https://${normalizedShop}/admin/oauth/authorize?${params}`;
  }
}
