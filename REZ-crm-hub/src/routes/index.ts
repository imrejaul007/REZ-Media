import { Router, Request, Response } from 'express';
import { authService } from '../services/authService.js';
import { contactService } from '../services/contactService.js';
import { dealService } from '../services/dealService.js';
import { syncService } from '../services/syncService.js';
import { internalAuthMiddleware } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/errorHandler.js';
import {
  validateBody,
  validateQuery,
} from '../middleware/validation.js';
import { z } from 'zod';
import { CRMProvider } from '../types/index.js';

const router = Router();

// All routes require internal auth
router.use(internalAuthMiddleware);

// ============================================
// Health Check
// ============================================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'REZ CRM Hub',
    version: '1.0.0',
  });
});

// ============================================
// HubSpot OAuth Routes
// ============================================

/**
 * Initiate HubSpot OAuth flow
 * GET /api/crm/hubspot/connect
 */
router.get('/crm/hubspot/connect', (req: Request, res: Response) => {
  const state = req.query.state as string | undefined;
  const authUrl = authService.getHubSpotAuthUrl(state);

  res.json({
    success: true,
    data: {
      authorizationUrl: authUrl,
    },
    message: 'Redirect user to authorization URL',
  });
});

/**
 * HubSpot OAuth callback
 * GET /api/crm/hubspot/callback
 */
router.get(
  '/crm/hubspot/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, error } = req.query;

    if (error) {
      throw ApiError.badRequest(`HubSpot OAuth error: ${error}`);
    }

    if (!code || typeof code !== 'string') {
      throw ApiError.badRequest('Missing authorization code');
    }

    const result = await authService.handleHubSpotCallback(code);

    if (!result.success) {
      throw ApiError.internal(result.message);
    }

    // Redirect to success page or return JSON
    if (req.accepts('html')) {
      res.redirect('/success?provider=hubspot');
    } else {
      res.json({
        success: true,
        data: {
          provider: result.provider,
          accountInfo: result.accountInfo,
        },
        message: result.message,
      });
    }
  })
);

// ============================================
// Zoho OAuth Routes
// ============================================

/**
 * Initiate Zoho OAuth flow
 * GET /api/crm/zoho/connect
 */
router.get('/crm/zoho/connect', (req: Request, res: Response) => {
  const state = req.query.state as string | undefined;
  const authUrl = authService.getZohoAuthUrl(state);

  res.json({
    success: true,
    data: {
      authorizationUrl: authUrl,
    },
    message: 'Redirect user to authorization URL',
  });
});

/**
 * Zoho OAuth callback
 * GET /api/crm/zoho/callback
 */
router.get(
  '/crm/zoho/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, error } = req.query;

    if (error) {
      throw ApiError.badRequest(`Zoho OAuth error: ${error}`);
    }

    if (!code || typeof code !== 'string') {
      throw ApiError.badRequest('Missing authorization code');
    }

    const result = await authService.handleZohoCallback(code);

    if (!result.success) {
      throw ApiError.internal(result.message);
    }

    // Redirect to success page or return JSON
    if (req.accepts('html')) {
      res.redirect('/success?provider=zoho');
    } else {
      res.json({
        success: true,
        data: {
          provider: result.provider,
          accountInfo: result.accountInfo,
        },
        message: result.message,
      });
    }
  })
);

// ============================================
// Connection Status Routes
// ============================================

/**
 * Get connection status for all providers
 * GET /api/connections
 */
router.get(
  '/connections',
  asyncHandler(async (_req: Request, res: Response) => {
    const statuses = await authService.getAllConnectionStatuses();

    res.json({
      success: true,
      data: statuses,
    });
  })
);

/**
 * Get connection status for a specific provider
 * GET /api/connections/:provider
 */
router.get(
  '/connections/:provider',
  asyncHandler(async (req: Request, res: Response) => {
    const { provider } = req.params;

    if (!Object.values(CRMProvider).includes(provider as CRMProvider)) {
      throw ApiError.badRequest('Invalid provider');
    }

    const status = await authService.getConnectionStatus(provider as CRMProvider);

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * Disconnect a provider
 * DELETE /api/connections/:provider
 */
router.delete(
  '/connections/:provider',
  asyncHandler(async (req: Request, res: Response) => {
    const { provider } = req.params;

    if (!Object.values(CRMProvider).includes(provider as CRMProvider)) {
      throw ApiError.badRequest('Invalid provider');
    }

    const result = await authService.disconnect(provider as CRMProvider);

    res.json({
      success: result.success,
      message: result.message,
    });
  })
);

// ============================================
// Contact Routes
// ============================================

const ContactQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  provider: z.enum(['hubspot', 'zoho']).optional(),
  syncStatus: z.string().optional(),
  search: z.string().optional(),
  linkedRezUserId: z.string().optional(),
});

/**
 * List all contacts
 * GET /api/contacts
 */
router.get(
  '/contacts',
  validateQuery(ContactQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = ContactQuerySchema.parse(req.query);

    const params = {
      page: parsed.page,
      limit: parsed.limit,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
      provider: parsed.provider as CRMProvider | undefined,
      syncStatus: parsed.syncStatus,
      search: parsed.search,
      linkedRezUserId: parsed.linkedRezUserId,
    };

    const result = await contactService.getContacts(params);

    res.json({
      success: true,
      data: result.contacts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  })
);

/**
 * Get a single contact
 * GET /api/contacts/:id
 */
router.get(
  '/contacts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const contact = await contactService.getContactById(req.params.id);

    if (!contact) {
      throw ApiError.notFound('Contact not found');
    }

    res.json({
      success: true,
      data: contact,
    });
  })
);

/**
 * Force sync a contact
 * POST /api/contacts/:id/sync
 */
router.post(
  '/contacts/:id/sync',
  asyncHandler(async (req: Request, res: Response) => {
    const { provider = 'hubspot' } = req.body;
    const { id } = req.params;

    if (!Object.values(CRMProvider).includes(provider as CRMProvider)) {
      throw ApiError.badRequest('Invalid provider');
    }

    const result = await contactService.forceSyncContact(id, provider as CRMProvider);

    if (!result.success) {
      throw ApiError.internal(result.error || 'Sync failed');
    }

    res.json({
      success: true,
      data: {
        success: result.success,
        externalId: result.externalId || null,
      },
      message: 'Contact synced successfully',
    });
  })
);

/**
 * Link contact to ReZ user
 * POST /api/contacts/link
 */
router.post(
  '/contacts/link',
  validateBody(z.object({
    contactId: z.string(),
    rezUserId: z.string(),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { contactId, rezUserId } = req.body;

    const contact = await contactService.linkToRezUser(contactId, rezUserId);

    if (!contact) {
      throw ApiError.notFound('Contact not found');
    }

    res.json({
      success: true,
      data: contact,
      message: 'Contact linked to ReZ user',
    });
  })
);

/**
 * Unlink contact from ReZ user
 * POST /api/contacts/:id/unlink
 */
router.post(
  '/contacts/:id/unlink',
  asyncHandler(async (req: Request, res: Response) => {
    const contact = await contactService.unlinkFromRezUser(req.params.id);

    if (!contact) {
      throw ApiError.notFound('Contact not found');
    }

    res.json({
      success: true,
      data: contact,
      message: 'Contact unlinked from ReZ user',
    });
  })
);

// ============================================
// Deal Routes
// ============================================

const DealQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  provider: z.enum(['hubspot', 'zoho']).optional(),
  stage: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});

/**
 * List all deals
 * GET /api/deals
 */
router.get(
  '/deals',
  validateQuery(DealQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = DealQuerySchema.parse(req.query);

    const params = {
      page: parsed.page,
      limit: parsed.limit,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
      provider: parsed.provider as CRMProvider | undefined,
      stage: parsed.stage,
      minAmount: parsed.minAmount,
      maxAmount: parsed.maxAmount,
    };

    const result = await dealService.getDeals(params);

    res.json({
      success: true,
      data: result.deals,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  })
);

/**
 * Get a single deal
 * GET /api/deals/:id
 */
router.get(
  '/deals/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const deal = await dealService.getDealById(req.params.id);

    if (!deal) {
      throw ApiError.notFound('Deal not found');
    }

    res.json({
      success: true,
      data: deal,
    });
  })
);

/**
 * Create a new deal
 * POST /api/deals
 */
router.post(
  '/deals',
  validateBody(z.object({
    title: z.string().min(1),
    amount: z.number().positive().optional(),
    currency: z.string().default('USD'),
    stage: z.string().optional(),
    probability: z.number().min(0).max(100).optional(),
    closeDate: z.string().datetime().optional(),
    contactId: z.string().optional(),
    companyName: z.string().optional(),
    description: z.string().optional(),
    provider: z.enum(['hubspot', 'zoho']).default('hubspot'),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const dealData = req.body;
    const result = await dealService.createInCRM(
      {
        ...dealData,
        provider: dealData.provider as CRMProvider,
      },
      dealData.provider as CRMProvider
    );

    if (!result.success) {
      throw ApiError.internal(result.error || 'Failed to create deal');
    }

    res.status(201).json({
      success: true,
      data: result.deal,
      message: 'Deal created successfully',
    });
  })
);

/**
 * Update deal stage
 * PATCH /api/deals/:id/stage
 */
router.patch(
  '/deals/:id/stage',
  asyncHandler(async (req: Request, res: Response) => {
    const { stage } = req.body;

    if (!stage || typeof stage !== 'string') {
      throw ApiError.badRequest('Stage is required');
    }

    const deal = await dealService.updateStage(req.params.id, stage);

    if (!deal) {
      throw ApiError.notFound('Deal not found');
    }

    res.json({
      success: true,
      data: deal,
      message: 'Deal stage updated',
    });
  })
);

/**
 * Get deals by contact
 * GET /api/deals/contact/:contactId
 */
router.get(
  '/deals/contact/:contactId',
  asyncHandler(async (req: Request, res: Response) => {
    const { contactId } = req.params;
    const { provider } = req.query;

    const deals = await dealService.getDealsByContact(
      contactId,
      provider as CRMProvider | undefined
    );

    res.json({
      success: true,
      data: deals,
    });
  })
);

/**
 * Get deal statistics
 * GET /api/deals/stats
 */
router.get(
  '/deals/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { provider } = req.query;
    const stats = await dealService.getDealStats(provider as CRMProvider | undefined);

    res.json({
      success: true,
      data: stats,
    });
  })
);

// ============================================
// Sync Routes
// ============================================

/**
 * Get sync status
 * GET /api/sync/status
 */
router.get(
  '/sync/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const status = await syncService.getSyncStatus();

    res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * Trigger sync
 * POST /api/sync/trigger
 */
router.post(
  '/sync/trigger',
  validateBody(z.object({
    provider: z.enum(['hubspot', 'zoho']).optional(),
    entityType: z.enum(['contact', 'deal']).optional(),
    force: z.boolean().default(false),
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const triggerData = req.body;
    const result = await syncService.triggerSync({
      provider: triggerData.provider as CRMProvider | undefined,
      entityType: triggerData.entityType,
      force: triggerData.force,
    });

    if (!result.success) {
      res.status(202).json({
        success: result.success,
        data: result.results,
        message: result.message,
      });
      return;
    }

    res.json({
      success: true,
      data: result.results,
      message: result.message,
    });
  })
);

/**
 * Get sync history
 * GET /api/sync/history
 */
router.get(
  '/sync/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { provider, limit } = req.query;
    const history = await syncService.getSyncHistory(
      provider as CRMProvider | undefined,
      limit ? parseInt(limit as string, 10) : 20
    );

    res.json({
      success: true,
      data: history,
    });
  })
);

export default router;
