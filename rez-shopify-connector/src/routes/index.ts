import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { WebhookService } from '../services/webhookService';
import { SyncService } from '../services/syncService';
import { StoreService } from '../services/storeService';
import { verifyInternal, optionalAuth } from '../middleware/auth';
import { rateLimit, storeRateLimit } from '../middleware/rateLimit';
import { logger } from '../config';
import type { WebhookTopic, SyncEntity, AuthenticatedRequest } from '../types';

const router = Router();

// ── Health Check ────────────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-shopify-connector',
    timestamp: new Date().toISOString(),
  });
});

// ── OAuth Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/shopify/connect
 * Initiate OAuth flow for a Shopify store
 */
router.post('/connect', rateLimit({ max: 10, windowMs: 60000 }), async (req: Request, res: Response) => {
  const { shop } = req.body as { shop?: string };

  if (!shop) {
    res.status(400).json({
      success: false,
      error: 'Missing required field: shop',
    });
    return;
  }

  // Validate shop domain format
  const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
  const normalizedShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');

  if (!shopPattern.test(normalizedShop) && !normalizedShop.includes('.myshopify.com')) {
    res.status(400).json({
      success: false,
      error: 'Invalid Shopify store domain format. Expected: store.myshopify.com',
    });
    return;
  }

  try {
    const { url, state } = AuthService.generateAuthUrl(normalizedShop);

    logger.info(`[Routes] OAuth initiated for ${normalizedShop}`);

    res.json({
      success: true,
      data: {
        authUrl: url,
        state,
        shop: normalizedShop,
      },
    });
  } catch (error) {
    logger.error('[Routes] OAuth initiation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate OAuth flow',
    });
  }
});

/**
 * GET /api/shopify/callback
 * OAuth callback handler
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, hmac, shop, state } = req.query as Record<string, string>;

  if (!code || !hmac || !shop || !state) {
    res.status(400).json({
      success: false,
      error: 'Missing required query parameters: code, hmac, shop, state',
    });
    return;
  }

  try {
    const store = await AuthService.handleCallback(shop, code, state, hmac);

    logger.info(`[Routes] OAuth callback successful for ${shop}`);

    // Redirect to success page (configurable)
    const successRedirect = process.env.OAUTH_SUCCESS_URL || '/';
    res.redirect(`${successRedirect}?status=success&shop=${store.shopifyDomain}`);
  } catch (error) {
    logger.error(`[Routes] OAuth callback failed for ${shop}:`, error);

    const errorRedirect = process.env.OAUTH_ERROR_URL || '/';
    res.redirect(`${errorRedirect}?status=error&shop=${shop}`);
  }
});

// ── Webhook Routes ─────────────────────────────────────────────────────────────

/**
 * POST /api/shopify/webhook
 * Receive Shopify webhooks
 */
router.post(
  '/webhook',
  rateLimit({ max: 1000, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    const shop = req.headers['x-shopify-shop'] as string;
    const topic = req.headers['x-shopify-topic'] as string;
    const hmac = req.headers['x-shopify-hmac-sha256'] as string;

    if (!shop || !topic || !hmac) {
      res.status(400).json({
        success: false,
        error: 'Missing required headers: x-shopify-shop, x-shopify-topic, x-shopify-hmac-sha256',
      });
      return;
    }

    // Get raw body for signature verification
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ||
      JSON.stringify(req.body);

    const result = await WebhookService.processWebhook(
      shop,
      topic as WebhookTopic,
      rawBody,
      hmac
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        eventId: result.eventId,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
      });
    }
  }
);

// ── Store Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/shopify/stores
 * List all connected stores
 */
router.get(
  '/stores',
  verifyInternal,
  rateLimit({ max: 100, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    const {
      page = '1',
      limit = '20',
      search,
      status = 'all',
    } = req.query as Record<string, string>;

    try {
      const result = await StoreService.listStores({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
        status: status as 'active' | 'inactive' | 'all',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('[Routes] Failed to list stores:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list stores',
      });
    }
  }
);

/**
 * GET /api/shopify/stores/:id
 * Get a specific store by ID
 */
router.get(
  '/stores/:id',
  verifyInternal,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const store = await StoreService.getStoreById(id);

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found',
        });
        return;
      }

      const stats = await StoreService.getStoreStats(id);
      const webhooks = await StoreService.getWebhookSummary(id);

      res.json({
        success: true,
        data: {
          store: {
            id: store._id.toString(),
            shopifyDomain: store.shopifyDomain,
            storeName: store.storeInfo?.name,
            isActive: store.isActive,
            createdAt: store.createdAt,
            updatedAt: store.updatedAt,
            storeInfo: store.storeInfo,
          },
          stats,
          webhooks,
        },
      });
    } catch (error) {
      logger.error(`[Routes] Failed to get store ${id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get store',
      });
    }
  }
);

/**
 * DELETE /api/shopify/stores/:id
 * Disconnect a store
 */
router.delete(
  '/stores/:id',
  verifyInternal,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const store = await StoreService.getStoreById(id);

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found',
        });
        return;
      }

      await StoreService.disconnectStore(id);

      logger.info(`[Routes] Store disconnected: ${id}`);

      res.json({
        success: true,
        message: 'Store disconnected successfully',
      });
    } catch (error) {
      logger.error(`[Routes] Failed to disconnect store ${id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect store',
      });
    }
  }
);

/**
 * POST /api/shopify/stores/:id/refresh
 * Refresh store info from Shopify
 */
router.post(
  '/stores/:id/refresh',
  verifyInternal,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const store = await StoreService.refreshStoreInfo(id);

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          store: {
            id: store._id.toString(),
            shopifyDomain: store.shopifyDomain,
            storeInfo: store.storeInfo,
          },
        },
      });
    } catch (error) {
      logger.error(`[Routes] Failed to refresh store ${id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh store info',
      });
    }
  }
);

// ── Sync Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/shopify/sync/status
 * Get sync status for a store or all stores
 */
router.get(
  '/sync/status',
  verifyInternal,
  storeRateLimit(),
  async (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };

    try {
      if (storeId) {
        const status = await SyncService.getSyncStatus(storeId);

        if (!status) {
          res.status(404).json({
            success: false,
            error: 'Store not found',
          });
          return;
        }

        res.json({
          success: true,
          data: status,
        });
      } else {
        // Get all stores and their sync status
        const stores = await StoreService.getAllStores({ activeOnly: true });
        const statuses = await Promise.all(
          stores.stores.map((s) => SyncService.getSyncStatus(s._id.toString()))
        );

        res.json({
          success: true,
          data: {
            stores: statuses.filter(Boolean),
          },
        });
      }
    } catch (error) {
      logger.error('[Routes] Failed to get sync status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status',
      });
    }
  }
);

/**
 * POST /api/shopify/sync/trigger
 * Trigger a sync for one or all entities
 */
router.post(
  '/sync/trigger',
  verifyInternal,
  rateLimit({ max: 20, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    const {
      storeId,
      entity,
      fullSync = false,
    } = req.body as {
      storeId?: string;
      entity?: SyncEntity;
      fullSync?: boolean;
    };

    try {
      if (fullSync) {
        // Trigger full sync for all stores
        const jobIds = await SyncService.triggerFullSync(storeId);

        res.json({
          success: true,
          data: {
            jobIds,
            message: `Full sync triggered for ${jobIds.length} jobs`,
          },
        });
      } else if (storeId && entity) {
        // Trigger sync for specific store and entity
        const result = await SyncService.triggerSync(storeId, entity);

        res.json({
          success: true,
          data: {
            jobId: result.jobId,
            status: result.status,
            storeId,
            entity,
          },
        });
      } else if (entity) {
        // Trigger sync for all stores for specific entity
        const stores = await StoreService.getAllStores({ activeOnly: true });
        const jobs = await Promise.all(
          stores.stores.map((s) => SyncService.triggerSync(s._id.toString(), entity))
        );

        res.json({
          success: true,
          data: {
            jobs: jobs.map((j, i) => ({
              ...j,
              storeId: stores.stores[i]._id.toString(),
            })),
            message: `${jobs.length} sync jobs triggered for ${entity}`,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Must specify either storeId and entity, or fullSync: true',
        });
        return;
      }
    } catch (error) {
      logger.error('[Routes] Failed to trigger sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger sync',
      });
    }
  }
);

// ── Verify Routes ─────────────────────────────────────────────────────────────

/**
 * POST /api/shopify/verify
 * Verify a store's access token
 */
router.post(
  '/verify',
  verifyInternal,
  async (req: Request, res: Response) => {
    const { storeId, shop } = req.body as { storeId?: string; shop?: string };

    let store = null;

    if (storeId) {
      store = await StoreService.getStoreById(storeId);
    } else if (shop) {
      store = await StoreService.getStoreByDomain(shop);
    }

    if (!store) {
      res.status(404).json({
        success: false,
        error: 'Store not found',
      });
      return;
    }

    try {
      const result = await StoreService.verifyStoreAccess(store._id.toString());

      res.json({
        success: true,
        data: {
          storeId: store._id.toString(),
          shopifyDomain: store.shopifyDomain,
          isValid: result.isValid,
          lastVerified: result.lastVerified,
          error: result.error,
        },
      });
    } catch (error) {
      logger.error('[Routes] Failed to verify store:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify store access',
      });
    }
  }
);

// ── Error Handler ─────────────────────────────────────────────────────────────

router.use((err: Error, _req: Request, res: Response, _next: unknown) => {
  logger.error('[Routes] Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

export default router;
