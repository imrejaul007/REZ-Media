/**
 * Tenant-Aware API Routes
 *
 * Express router with multi-tenant support for WooCommerce Connector.
 * All routes enforce tenant isolation via X-Tenant-Id and X-Brand-Id headers.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WooCommerceClient } from '../clients/wooClient';
import { Store } from '../models/Store';
import { webhookService } from '../services/webhookService';
import { syncService } from '../services/syncService';
import { rateLimit, webhookRateLimit } from '../middleware/rateLimit';
import {
  extractTenantContext,
  requireTenantContext,
  tenantAuditMiddleware,
  TenantContext,
} from '../middleware/tenant';
import { AuthenticationError } from '../types';
import logger from '../utils/logger';
import crypto from 'crypto-js';
import axios from 'axios';

// ============================================
// Validation Schemas
// ============================================

const connectStoreSchema = z.object({
  storeUrl: z.string().url('Invalid store URL'),
  consumerKey: z.string().min(1, 'Consumer key is required'),
  consumerSecret: z.string().min(1, 'Consumer secret is required'),
});

const manualSyncSchema = z.object({
  storeId: z.string().min(1, 'Store ID is required'),
  entityType: z.enum(['products', 'orders', 'customers', 'all']).optional(),
});

// ============================================
// Router Setup
// ============================================

const router = Router();

// Apply tenant middleware to all routes
router.use(extractTenantContext);
router.use(tenantAuditMiddleware);

// ============================================
// Store Connection Routes (Tenant-Scoped)
// ============================================

/**
 * POST /api/woocommerce/connect
 * Register a new WooCommerce store under a tenant
 *
 * Headers:
 * - X-Tenant-Id: (required) Tenant identifier
 * - X-Brand-Id: (required) Brand identifier
 */
router.post(
  '/connect',
  requireTenantContext,
  rateLimit({ limit: 10, windowMs: 60000 }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenant = req.tenant as TenantContext;

    try {
      const validationResult = connectStoreSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: validationResult.error.errors,
        });
        return;
      }

      const { storeUrl, consumerKey, consumerSecret } = validationResult.data;

      // Verify WooCommerce credentials
      const wooClient = new WooCommerceClient(storeUrl, consumerKey, consumerSecret);
      let storeInfo;
      try {
        storeInfo = await wooClient.getStoreInfo();
      } catch (error) {
        res.status(401).json({
          success: false,
          error: 'Invalid WooCommerce credentials',
          message: 'Could not authenticate with WooCommerce store',
        });
        return;
      }

      // Check if store already exists for this tenant
      const existingStore = await Store.findByStoreUrlAndTenant(storeUrl, tenant.tenantId);
      if (existingStore) {
        // Update existing store
        existingStore.consumerKey = consumerKey;
        existingStore.consumerSecret = consumerSecret;
        existingStore.isActive = true;
        existingStore.storeName = storeInfo.name || storeUrl;
        existingStore.storeInfo = {
          siteTitle: storeInfo.name,
          siteUrl: storeInfo.site_url,
          version: storeInfo.version,
          currency: storeInfo.currency,
          timezone: storeInfo.timezone_string,
        };
        await existingStore.save();

        logger.info('[TenantRoutes] Store updated for tenant', {
          storeId: existingStore._id,
          tenantId: tenant.tenantId,
          storeUrl,
        });

        res.status(200).json({
          success: true,
          data: {
            id: existingStore._id.toString(),
            storeUrl: existingStore.storeUrl,
            storeName: existingStore.storeName,
            isActive: existingStore.isActive,
            tenantId: tenant.tenantId,
            brandId: tenant.brandId,
          },
          message: 'Store updated successfully',
        });
        return;
      }

      // Check store URL limit for tenant
      const storeCount = await Store.countDocuments({
        tenantId: tenant.tenantId,
        isActive: true,
      });

      // For now, allow unlimited stores (can add limit enforcement here)
      // const maxStores = getPlanLimit(tenant.plan, 'stores');
      // if (storeCount >= maxStores) {
      //   res.status(402).json({
      //     success: false,
      //     error: 'Store limit reached',
      //     message: `Your plan allows ${maxStores} stores. Upgrade to add more.`,
      //   });
      //   return;
      // }

      // Register webhook
      let webhookId: number | undefined;
      try {
        const webhookResponse = await wooClient.createWebhook({
          topic: 'order.created',
          url: `${process.env.WEBHOOK_BASE_URL || process.env.APP_URL}/api/woocommerce/webhook`,
        });
        webhookId = webhookResponse.id;
      } catch (error) {
        logger.warn('[TenantRoutes] Failed to create webhook', { error });
      }

      // Create new store
      const store = new Store({
        tenantId: tenant.tenantId,
        brandId: tenant.brandId,
        storeUrl: storeUrl.toLowerCase(),
        storeName: storeInfo.name || storeUrl,
        consumerKey,
        consumerSecret,
        isActive: true,
        webhookId,
        storeInfo: {
          siteTitle: storeInfo.name,
          siteUrl: storeInfo.site_url,
          version: storeInfo.version,
          currency: storeInfo.currency,
          timezone: storeInfo.timezone_string,
        },
      });

      await store.save();

      logger.info('[TenantRoutes] Store connected for tenant', {
        storeId: store._id,
        tenantId: tenant.tenantId,
        storeUrl,
      });

      res.status(201).json({
        success: true,
        data: {
          id: store._id.toString(),
          storeUrl: store.storeUrl,
          storeName: store.storeName,
          isActive: store.isActive,
          tenantId: tenant.tenantId,
          brandId: tenant.brandId,
        },
        message: 'Store connected successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/woocommerce/stores/:id
 * Disconnect a WooCommerce store (tenant-scoped)
 *
 * Headers:
 * - X-Tenant-Id: (required)
 * - X-Brand-Id: (required)
 */
router.delete(
  '/stores/:id',
  requireTenantContext,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenant = req.tenant as TenantContext;
    const { id } = req.params;

    try {
      const store = await Store.findByIdAndTenant(id, tenant.tenantId);

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found',
          message: 'Store not found or does not belong to this tenant',
        });
        return;
      }

      // Soft delete - just mark as inactive
      store.isActive = false;
      await store.save();

      logger.info('[TenantRoutes] Store disconnected', {
        storeId: id,
        tenantId: tenant.tenantId,
      });

      res.json({
        success: true,
        message: 'Store disconnected successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/woocommerce/stores
 * List all stores for the current tenant
 *
 * Headers:
 * - X-Tenant-Id: (required)
 * - X-Brand-Id: (required)
 */
router.get(
  '/stores',
  requireTenantContext,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenant = req.tenant as TenantContext;
    const { page = '1', limit = '20', search, status } = req.query as Record<string, string>;

    try {
      const result = await Store.findByTenant(tenant.tenantId, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
      });

      const stores = result.stores.map((store) => ({
        id: store._id.toString(),
        storeUrl: store.storeUrl,
        storeName: store.storeName,
        isActive: store.isActive,
        storeInfo: store.storeInfo,
        syncStatus: store.syncStatus,
        lastSyncAt: store.lastSyncAt,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      }));

      res.json({
        success: true,
        data: {
          stores,
          total: result.total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
        },
        meta: {
          tenantId: tenant.tenantId,
          brandId: tenant.brandId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/woocommerce/stores/:id
 * Get single store details (tenant-scoped)
 *
 * Headers:
 * - X-Tenant-Id: (required)
 * - X-Brand-Id: (required)
 */
router.get(
  '/stores/:id',
  requireTenantContext,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenant = req.tenant as TenantContext;
    const { id } = req.params;

    try {
      const store = await Store.findByIdAndTenant(id, tenant.tenantId);

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
          id: store._id.toString(),
          storeUrl: store.storeUrl,
          storeName: store.storeName,
          isActive: store.isActive,
          storeInfo: store.storeInfo,
          syncStatus: store.syncStatus,
          lastSyncAt: store.lastSyncAt,
          createdAt: store.createdAt,
          updatedAt: store.updatedAt,
          tenantId: store.tenantId,
          brandId: store.brandId,
        },
        meta: {
          tenantId: tenant.tenantId,
          brandId: tenant.brandId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Webhook Routes (Multi-Tenant)
// ============================================

/**
 * POST /api/woocommerce/webhook
 * WooCommerce webhook receiver (multi-tenant)
 *
 * Looks up tenant from store URL in payload.
 */
router.post(
  '/webhook',
  webhookRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get raw body for signature verification
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // Verify signature if provided
      const signature = req.headers['x-wc-webhook-signature'] as string;

      // Parse payload to get store URL
      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        res.status(400).json({
          success: false,
          error: 'Invalid payload',
        });
        return;
      }

      // Get store URL from the WooCommerce site URL (usually in site_url or store URL)
      const storeUrl = extractStoreUrl(payload);
      if (!storeUrl) {
        res.status(400).json({
          success: false,
          error: 'Could not determine store URL from payload',
        });
        return;
      }

      // Find the store
      const store = await Store.findOne({
        storeUrl: storeUrl.toLowerCase(),
        isActive: true,
      });

      if (!store) {
        logger.warn('[TenantRoutes] Webhook for unknown store', { storeUrl });
        res.status(404).json({
          success: false,
          error: 'Store not found',
        });
        return;
      }

      // Verify tenant context exists
      if (!store.tenantId || !store.brandId) {
        logger.error('[TenantRoutes] Store missing tenant context', { storeUrl });
        res.status(500).json({
          success: false,
          error: 'Store not properly configured',
        });
        return;
      }

      // Verify signature if provided
      if (signature) {
        const isValid = verifyWebhookSignature(rawBody, signature, store.consumerSecret);
        if (!isValid) {
          logger.warn('[TenantRoutes] Invalid webhook signature', { storeUrl });
          res.status(401).json({
            success: false,
            error: 'Invalid signature',
          });
          return;
        }
      }

      // Forward to data lake with tenant context
      await forwardToDataLake(store, payload);

      // Get webhook topic from headers
      const topic = req.headers['x-wc-webhook-topic'] as string;

      // Process webhook
      const result = await webhookService.processWebhook(payload, topic);

      logger.info('[TenantRoutes] Webhook processed', {
        storeUrl,
        topic,
        tenantId: store.tenantId,
      });

      res.json({
        success: true,
        received: true,
        tenantId: store.tenantId,
        brandId: store.brandId,
      });
    } catch (error) {
      logger.error('[TenantRoutes] Webhook processing error:', error);
      // Always return 200 to prevent WooCommerce retries
      res.json({
        received: true,
        processed: false,
      });
    }
  }
);

/**
 * Extract store URL from webhook payload
 */
function extractStoreUrl(payload: any): string | null {
  // Try different fields where store URL might be
  return (
    payload?.site_url ||
    payload?.store_url ||
    payload?.storeUrl ||
    payload?.home_url ||
    payload?.siteUrl ||
    null
  );
}

/**
 * Verify WooCommerce webhook signature
 */
function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hash = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')}`;

    return hash === signature;
  } catch {
    return false;
  }
}

/**
 * Forward webhook to data lake with tenant context
 */
async function forwardToDataLake(
  store: InstanceType<typeof Store>,
  payload: any
): Promise<void> {
  const dataLakeUrl = process.env.DATA_LAKE_URL || 'http://localhost:4101';

  const dataLakePayload = {
    source: 'woocommerce',
    connectionId: store._id.toString(),
    tenantId: store.tenantId, // CRITICAL: Tenant isolation
    brandId: store.brandId, // CRITICAL: Brand isolation
    topic: 'webhook.event',
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

    logger.debug('[TenantRoutes] Forwarded to data lake', {
      storeId: store._id,
      tenantId: store.tenantId,
    });
  } catch (error) {
    logger.warn('[TenantRoutes] Failed to forward to data lake', {
      error: (error as Error).message,
    });
  }
}

// ============================================
// Sync Routes (Tenant-Scoped)
// ============================================

/**
 * GET /api/woocommerce/sync/status
 * Get sync status for tenant's stores
 *
 * Headers:
 * - X-Tenant-Id: (required)
 * - X-Brand-Id: (required)
 */
router.get(
  '/sync/status',
  requireTenantContext,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenant = req.tenant as TenantContext;
    const { storeId } = req.query as { storeId?: string };

    try {
      if (storeId) {
        const store = await Store.findByIdAndTenant(storeId, tenant.tenantId);
        if (!store) {
          res.status(404).json({
            success: false,
            error: 'Store not found',
          });
          return;
        }

        const status = await syncService.getSyncStatus(storeId);

        res.json({
          success: true,
          data: status,
          meta: { tenantId: tenant.tenantId },
        });
      } else {
        // Return status for all tenant's stores
        const { stores } = await Store.findByTenant(tenant.tenantId);
        const statuses = await Promise.all(
          stores.map((s) => syncService.getSyncStatus(s._id.toString()))
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
      next(error);
    }
  }
);

/**
 * POST /api/woocommerce/sync/trigger
 * Trigger manual sync for tenant's store
 *
 * Headers:
 * - X-Tenant-Id: (required)
 * - X-Brand-Id: (required)
 */
router.post(
  '/sync/trigger',
  requireTenantContext,
  rateLimit({ limit: 5, windowMs: 60000 }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenant = req.tenant as TenantContext;

    try {
      const validationResult = manualSyncSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: validationResult.error.errors,
        });
        return;
      }

      const { storeId, entityType } = validationResult.data;

      // Verify store belongs to tenant
      const store = await Store.findByIdAndTenant(storeId, tenant.tenantId);
      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found',
        });
        return;
      }

      const result = await syncService.triggerSync({
        storeId,
        entityType: entityType as any,
      });

      logger.info('[TenantRoutes] Manual sync triggered', {
        storeId,
        entityType,
        tenantId: tenant.tenantId,
      });

      res.json({
        success: true,
        data: result,
        meta: { tenantId: tenant.tenantId },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Store not found') {
          res.status(404).json({
            success: false,
            error: 'Store not found',
          });
          return;
        }
      }
      next(error);
    }
  }
);

// ============================================
// Health Check
// ============================================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'woocommerce-connector',
    multiTenant: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
