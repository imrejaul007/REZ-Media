/**
 * API Routes
 *
 * Express router with all WooCommerce Connector endpoints.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { syncService } from '../services/syncService';
import { webhookService } from '../services/webhookService';
import { rateLimit, webhookRateLimit } from '../middleware/rateLimit';
import { WooCommerceClient } from '../clients/wooClient';
import { AuthenticationError } from '../types';
import logger from '../utils/logger';

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

// ============================================
// Store Connection Routes
// ============================================

/**
 * POST /api/woocommerce/connect
 * Register a new WooCommerce store
 */
router.post(
  '/connect',
  rateLimit({ limit: 10, windowMs: 60000 }), // 10 connects per minute
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const result = await authService.connectStore(validationResult.data);

      logger.info(`Store connected: ${result.store.storeUrl}`);

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/woocommerce/stores/:id
 * Disconnect a WooCommerce store
 */
router.delete(
  '/stores/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await authService.disconnectStore(id);

      logger.info(`Store disconnected: ${id}`);

      res.json({
        success: result,
        message: 'Store disconnected successfully',
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(404).json({
          success: false,
          error: 'Not found',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/woocommerce/stores
 * List all connected stores
 */
router.get(
  '/stores',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stores = await authService.listStores();

      res.json({
        success: true,
        stores,
        count: stores.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/woocommerce/stores/:id
 * Get single store details
 */
router.get(
  '/stores/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const store = await authService.getStore(id);

      if (!store) {
        res.status(404).json({
          success: false,
          error: 'Store not found',
        });
        return;
      }

      res.json({
        success: true,
        store: {
          id: store._id.toString(),
          storeUrl: store.storeUrl,
          storeName: store.storeName,
          isActive: store.isActive,
          storeInfo: store.storeInfo,
          syncStatus: store.syncStatus,
          lastSyncAt: store.lastSyncAt,
          createdAt: store.createdAt,
          updatedAt: store.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Webhook Routes
// ============================================

/**
 * POST /api/woocommerce/webhook
 * WooCommerce webhook receiver
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
      if (signature) {
        const isValid = webhookService.verifySignature(rawBody, signature);
        if (!isValid) {
          logger.warn('Invalid webhook signature');
          res.status(401).json({
            success: false,
            error: 'Invalid signature',
          });
          return;
        }
      }

      // Parse payload
      const payload = WooCommerceClient.parseWebhookPayload(rawBody);

      if (!payload) {
        res.status(400).json({
          success: false,
          error: 'Invalid payload',
        });
        return;
      }

      // Get store ID from headers or find by topic
      const storeId = req.headers['x-wc-webhook-id'] as string;

      // Process webhook
      const result = await webhookService.processWebhook(payload, storeId);

      logger.info(`Webhook processed: ${result.event}`, {
        resourceId: result.resourceId,
        processed: result.processed,
      });

      res.json(result);
    } catch (error) {
      logger.error('Webhook processing error:', error);
      // Always return 200 to WooCommerce to prevent retries
      // unless there's a critical error
      res.json({
        received: true,
        processed: false,
        error: 'Internal processing error',
      });
    }
  }
);

// ============================================
// Sync Routes
// ============================================

/**
 * GET /api/woocommerce/sync/status
 * Get sync status for all stores or specific store
 */
router.get(
  '/sync/status',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { storeId } = req.query;

      if (storeId && typeof storeId === 'string') {
        const status = await syncService.getSyncStatus(storeId);

        if (!status) {
          res.status(404).json({
            success: false,
            error: 'Store not found',
          });
          return;
        }

        res.json({
          success: true,
          ...status,
        });
      } else {
        // Return status for all stores
        const stores = await authService.listStores();
        const statuses = await Promise.all(
          stores.map((store) =>
            syncService.getSyncStatus(store.id)
          )
        );

        res.json({
          success: true,
          stores: statuses.filter(Boolean),
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/woocommerce/sync/status/:storeId
 * Get sync status for specific store
 */
router.get(
  '/sync/status/:storeId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { storeId } = req.params;
      const status = await syncService.getSyncStatus(storeId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Store not found',
        });
        return;
      }

      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/woocommerce/sync/trigger
 * Trigger manual sync
 */
router.post(
  '/sync/trigger',
  rateLimit({ limit: 5, windowMs: 60000 }), // 5 syncs per minute
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const result = await syncService.triggerSync(validationResult.data);

      logger.info('Manual sync triggered', {
        storeId: validationResult.data.storeId,
        entityType: validationResult.data.entityType,
      });

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Store not found') {
          res.status(404).json({
            success: false,
            error: 'Store not found',
          });
          return;
        }
        if (error.message.includes('not active')) {
          res.status(400).json({
            success: false,
            error: 'Store is not active',
          });
          return;
        }
      }
      next(error);
    }
  }
);

// ============================================
// Health Check (No Auth Required)
// ============================================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'woocommerce-connector',
    timestamp: new Date().toISOString(),
  });
});

export default router;
