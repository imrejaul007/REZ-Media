import { Router, Request, Response } from 'express';
import { TenantAuthService } from '../services/tenantAuthService';
import { TenantWebhookService } from '../services/tenantWebhookService';
import { StoreService } from '../services/storeService';
import { SyncService } from '../services/syncService';
import { verifyInternal } from '../middleware/auth';
import { rateLimit, storeRateLimit } from '../middleware/rateLimit';
import {
  extractTenantContext,
  requireTenantContext,
  tenantAuditMiddleware,
  TenantContext,
} from '../middleware/tenantMiddleware';
import { logger } from '../config';
import type { WebhookTopic, SyncEntity } from '../types';

const router = Router();

// ── Apply tenant middleware to all routes ─────────────────────────────────────

router.use(extractTenantContext);
router.use(tenantAuditMiddleware);

// ── Health Check ─────────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-shopify-connector',
    multiTenant: true,
    timestamp: new Date().toISOString(),
  });
});

// ── OAuth Routes (Tenant-Aware) ──────────────────────────────────────────────

/**
 * POST /api/shopify/connect
 * Initiate OAuth flow for a Shopify store
 *
 * Headers:
 * - X-Tenant-Id: (optional) Existing tenant to add store to
 * - X-Brand-Id: (optional) Brand ID for the tenant
 *
 * If tenant headers are provided, the store will be registered under that tenant.
 * If not provided, a new tenant will be created.
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
    const { url, state } = TenantAuthService.generateAuthUrl(normalizedShop);

    logger.info('[TenantRoutes] OAuth initiated', {
      shop: normalizedShop,
      tenantId: req.tenant?.tenantId,
      hasTenantContext: !!req.tenant,
    });

    res.json({
      success: true,
      data: {
        authUrl: url,
        state,
        shop: normalizedShop,
        tenantId: req.tenant?.tenantId || 'new',
      },
    });
  } catch (error) {
    logger.error('[TenantRoutes] OAuth initiation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate OAuth flow',
    });
  }
});

/**
 * GET /api/shopify/callback
 * OAuth callback handler (tenant-aware)
 *
 * If X-Tenant-Id and X-Brand-Id headers are provided, the store will be
 * registered under that existing tenant.
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

  // Get tenant context from session or headers
  const tenantId = (req.headers['x-tenant-id'] as string) || req.session?.['tenantId'];
  const brandId = (req.headers['x-brand-id'] as string) || req.session?.['brandId'];

  try {
    const result = await TenantAuthService.handleCallback(
      shop,
      code,
      state,
      hmac,
      tenantId,
      brandId
    );

    logger.info('[TenantRoutes] OAuth callback successful', {
      shop,
      tenantId: result.tenantId,
      brandId: result.brandId,
    });

    // Store tenant info in session for future requests
    req.session = req.session || {};
    (req.session as any).tenantId = result.tenantId;
    (req.session as any).brandId = result.brandId;

    // Redirect to success page
    const successRedirect = process.env.OAUTH_SUCCESS_URL || '/';
    res.redirect(`${successRedirect}?status=success&shop=${result.store.shopifyDomain}&tenant=${result.tenantId}`);
  } catch (error) {
    logger.error('[TenantRoutes] OAuth callback failed:', error);

    const errorRedirect = process.env.OAUTH_ERROR_URL || '/';
    res.redirect(`${errorRedirect}?status=error&shop=${shop}`);
  }
});

// ── Webhook Routes (Multi-Tenant) ───────────────────────────────────────────

/**
 * POST /api/shopify/webhook
 * Receive Shopify webhooks
 *
 * This endpoint handles webhooks for ALL stores.
 * The tenant context is derived from the store lookup.
 */
router.post(
  '/webhook/:storeId?',
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
    const rawBody = (req as unknown as { rawBody?: string }).rawBody || JSON.stringify(req.body);

    const result = await TenantWebhookService.processWebhook(
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
        tenantId: result.tenantId,
      });
    } else {
      res.status(result.message === 'Invalid webhook signature' ? 401 : 400).json({
        success: false,
        error: result.message,
      });
    }
  }
);

// ── Store Routes (Tenant-Scoped) ──────────────────────────────────────────────

/**
 * GET /api/shopify/stores
 * List all stores for the current tenant
 *
 * CRITICAL: Requires X-Tenant-Id and X-Brand-Id headers
 */
router.get(
  '/stores',
  requireTenantContext,
  rateLimit({ max: 100, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    const tenant = req.tenant as TenantContext;

    const {
      page = '1',
      limit = '20',
      search,
      status = 'all',
    } = req.query as Record<string, string>;

    try {
      const result = await StoreService.listStoresForTenant(tenant.tenantId, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
        status: status as 'active' | 'inactive' | 'all',
      });

      res.json({
        success: true,
        data: result,
        meta: {
          tenantId: tenant.tenantId,
          brandId: tenant.brandId,
        },
      });
    } catch (error) {
      logger.error('[TenantRoutes] Failed to list stores:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list stores',
      });
    }
  }
);

/**
 * GET /api/shopify/stores/:id
 * Get a specific store (tenant-scoped)
 *
 * CRITICAL: Tenant must own this store
 */
router.get(
  '/stores/:id',
  requireTenantContext,
  async (req: Request, res: Response) => {
    const tenant = req.tenant as TenantContext;
    const { id } = req.params;

    try {
      const store = await StoreService.getStoreByIdForTenant(id, tenant.tenantId);

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
            tenantId: store.tenantId,
            brandId: store.brandId,
          },
          stats,
          webhooks,
        },
        meta: {
          tenantId: tenant.tenantId,
          brandId: tenant.brandId,
        },
      });
    } catch (error) {
      logger.error(`[TenantRoutes] Failed to get store ${id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get store',
      });
    }
  }
);

/**
 * DELETE /api/shopify/stores/:id
 * Disconnect a store (tenant-scoped)
 */
router.delete(
  '/stores/:id',
  requireTenantContext,
  async (req: Request, res: Response) => {
    const tenant = req.tenant as TenantContext;
    const { id } = req.params;

    try {
      const store = await StoreService.getStoreByIdForTenant(id, tenant.tenantId);

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found',
        });
        return;
      }

      await StoreService.disconnectStore(id);

      logger.info('[TenantRoutes] Store disconnected', {
        storeId: id,
        tenantId: tenant.tenantId,
      });

      res.json({
        success: true,
        message: 'Store disconnected successfully',
      });
    } catch (error) {
      logger.error(`[TenantRoutes] Failed to disconnect store ${id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect store',
      });
    }
  }
);

// ── Sync Routes (Tenant-Scoped) ────────────────────────────────────────────────

/**
 * GET /api/shopify/sync/status
 * Get sync status for tenant's stores
 */
router.get(
  '/sync/status',
  requireTenantContext,
  storeRateLimit(),
  async (req: Request, res: Response) => {
    const tenant = req.tenant as TenantContext;
    const { storeId } = req.query as { storeId?: string };

    try {
      if (storeId) {
        // Verify store belongs to tenant
        const store = await StoreService.getStoreByIdForTenant(storeId, tenant.tenantId);
        if (!store) {
          res.status(404).json({
            success: false,
            error: 'Store not found',
          });
          return;
        }

        const status = await SyncService.getSyncStatus(storeId);

        res.json({
          success: true,
          data: status,
          meta: { tenantId: tenant.tenantId },
        });
      } else {
        // Get all stores for tenant and their sync status
        const { stores } = await StoreService.listStoresForTenant(tenant.tenantId);
        const statuses = await Promise.all(
          stores.map((s) => SyncService.getSyncStatus(s._id.toString()))
        );

        res.json({
          success: true,
          data: {
            stores: statuses.filter(Boolean),
          },
          meta: {
            tenantId: tenant.tenantId,
            count: statuses.length,
          },
        });
      }
    } catch (error) {
      logger.error('[TenantRoutes] Failed to get sync status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status',
      });
    }
  }
);

/**
 * POST /api/shopify/sync/trigger
 * Trigger a sync for tenant's store(s)
 */
router.post(
  '/sync/trigger',
  requireTenantContext,
  rateLimit({ max: 20, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    const tenant = req.tenant as TenantContext;

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
        // Trigger full sync for tenant's stores
        const { stores } = await StoreService.listStoresForTenant(tenant.tenantId, { activeOnly: true });
        const jobIds = await SyncService.triggerFullSync(storeId);

        res.json({
          success: true,
          data: {
            jobIds,
            message: `Full sync triggered for ${jobIds.length} stores`,
          },
          meta: { tenantId: tenant.tenantId },
        });
      } else if (storeId && entity) {
        // Verify store belongs to tenant
        const store = await StoreService.getStoreByIdForTenant(storeId, tenant.tenantId);
        if (!store) {
          res.status(404).json({
            success: false,
            error: 'Store not found',
          });
          return;
        }

        const result = await SyncService.triggerSync(storeId, entity);

        res.json({
          success: true,
          data: {
            jobId: result.jobId,
            status: result.status,
            storeId,
            entity,
          },
          meta: { tenantId: tenant.tenantId },
        });
      } else if (entity) {
        // Trigger sync for all tenant's stores
        const { stores } = await StoreService.listStoresForTenant(tenant.tenantId, { activeOnly: true });
        const jobs = await Promise.all(
          stores.map((s) => SyncService.triggerSync(s._id.toString(), entity))
        );

        res.json({
          success: true,
          data: {
            jobs: jobs.map((j, i) => ({
              ...j,
              storeId: stores[i]._id.toString(),
            })),
            message: `${jobs.length} sync jobs triggered for ${entity}`,
          },
          meta: { tenantId: tenant.tenantId },
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Must specify either storeId and entity, or fullSync: true',
        });
      }
    } catch (error) {
      logger.error('[TenantRoutes] Failed to trigger sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger sync',
      });
    }
  }
);

// ── Error Handler ─────────────────────────────────────────────────────────────

router.use((err: Error, _req: Request, res: Response, _next: unknown) => {
  logger.error('[TenantRoutes] Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

export default router;
