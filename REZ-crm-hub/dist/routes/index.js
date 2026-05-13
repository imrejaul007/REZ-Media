"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_js_1 = require("../services/authService.js");
const contactService_js_1 = require("../services/contactService.js");
const dealService_js_1 = require("../services/dealService.js");
const syncService_js_1 = require("../services/syncService.js");
const auth_js_1 = require("../middleware/auth.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const validation_js_1 = require("../middleware/validation.js");
const zod_1 = require("zod");
const index_js_1 = require("../types/index.js");
const router = (0, express_1.Router)();
// All routes require internal auth
router.use(auth_js_1.internalAuthMiddleware);
// ============================================
// Health Check
// ============================================
router.get('/health', (_req, res) => {
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
router.get('/crm/hubspot/connect', (req, res) => {
    const state = req.query.state;
    const authUrl = authService_js_1.authService.getHubSpotAuthUrl(state);
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
router.get('/crm/hubspot/callback', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { code, error } = req.query;
    if (error) {
        throw errorHandler_js_1.ApiError.badRequest(`HubSpot OAuth error: ${error}`);
    }
    if (!code || typeof code !== 'string') {
        throw errorHandler_js_1.ApiError.badRequest('Missing authorization code');
    }
    const result = await authService_js_1.authService.handleHubSpotCallback(code);
    if (!result.success) {
        throw errorHandler_js_1.ApiError.internal(result.message);
    }
    // Redirect to success page or return JSON
    if (req.accepts('html')) {
        res.redirect('/success?provider=hubspot');
    }
    else {
        res.json({
            success: true,
            data: {
                provider: result.provider,
                accountInfo: result.accountInfo,
            },
            message: result.message,
        });
    }
}));
// ============================================
// Zoho OAuth Routes
// ============================================
/**
 * Initiate Zoho OAuth flow
 * GET /api/crm/zoho/connect
 */
router.get('/crm/zoho/connect', (req, res) => {
    const state = req.query.state;
    const authUrl = authService_js_1.authService.getZohoAuthUrl(state);
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
router.get('/crm/zoho/callback', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { code, error } = req.query;
    if (error) {
        throw errorHandler_js_1.ApiError.badRequest(`Zoho OAuth error: ${error}`);
    }
    if (!code || typeof code !== 'string') {
        throw errorHandler_js_1.ApiError.badRequest('Missing authorization code');
    }
    const result = await authService_js_1.authService.handleZohoCallback(code);
    if (!result.success) {
        throw errorHandler_js_1.ApiError.internal(result.message);
    }
    // Redirect to success page or return JSON
    if (req.accepts('html')) {
        res.redirect('/success?provider=zoho');
    }
    else {
        res.json({
            success: true,
            data: {
                provider: result.provider,
                accountInfo: result.accountInfo,
            },
            message: result.message,
        });
    }
}));
// ============================================
// Connection Status Routes
// ============================================
/**
 * Get connection status for all providers
 * GET /api/connections
 */
router.get('/connections', (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    const statuses = await authService_js_1.authService.getAllConnectionStatuses();
    res.json({
        success: true,
        data: statuses,
    });
}));
/**
 * Get connection status for a specific provider
 * GET /api/connections/:provider
 */
router.get('/connections/:provider', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { provider } = req.params;
    if (!Object.values(index_js_1.CRMProvider).includes(provider)) {
        throw errorHandler_js_1.ApiError.badRequest('Invalid provider');
    }
    const status = await authService_js_1.authService.getConnectionStatus(provider);
    res.json({
        success: true,
        data: status,
    });
}));
/**
 * Disconnect a provider
 * DELETE /api/connections/:provider
 */
router.delete('/connections/:provider', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { provider } = req.params;
    if (!Object.values(index_js_1.CRMProvider).includes(provider)) {
        throw errorHandler_js_1.ApiError.badRequest('Invalid provider');
    }
    const result = await authService_js_1.authService.disconnect(provider);
    res.json({
        success: result.success,
        message: result.message,
    });
}));
// ============================================
// Contact Routes
// ============================================
const ContactQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.string().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    provider: zod_1.z.enum(['hubspot', 'zoho']).optional(),
    syncStatus: zod_1.z.string().optional(),
    search: zod_1.z.string().optional(),
    linkedRezUserId: zod_1.z.string().optional(),
});
/**
 * List all contacts
 * GET /api/contacts
 */
router.get('/contacts', (0, validation_js_1.validateQuery)(ContactQuerySchema), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const parsed = ContactQuerySchema.parse(req.query);
    const params = {
        page: parsed.page,
        limit: parsed.limit,
        sortBy: parsed.sortBy,
        sortOrder: parsed.sortOrder,
        provider: parsed.provider,
        syncStatus: parsed.syncStatus,
        search: parsed.search,
        linkedRezUserId: parsed.linkedRezUserId,
    };
    const result = await contactService_js_1.contactService.getContacts(params);
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
}));
/**
 * Get a single contact
 * GET /api/contacts/:id
 */
router.get('/contacts/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const contact = await contactService_js_1.contactService.getContactById(req.params.id);
    if (!contact) {
        throw errorHandler_js_1.ApiError.notFound('Contact not found');
    }
    res.json({
        success: true,
        data: contact,
    });
}));
/**
 * Force sync a contact
 * POST /api/contacts/:id/sync
 */
router.post('/contacts/:id/sync', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { provider = 'hubspot' } = req.body;
    const { id } = req.params;
    if (!Object.values(index_js_1.CRMProvider).includes(provider)) {
        throw errorHandler_js_1.ApiError.badRequest('Invalid provider');
    }
    const result = await contactService_js_1.contactService.forceSyncContact(id, provider);
    if (!result.success) {
        throw errorHandler_js_1.ApiError.internal(result.error || 'Sync failed');
    }
    res.json({
        success: true,
        data: {
            success: result.success,
            externalId: result.externalId || null,
        },
        message: 'Contact synced successfully',
    });
}));
/**
 * Link contact to ReZ user
 * POST /api/contacts/link
 */
router.post('/contacts/link', (0, validation_js_1.validateBody)(zod_1.z.object({
    contactId: zod_1.z.string(),
    rezUserId: zod_1.z.string(),
})), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { contactId, rezUserId } = req.body;
    const contact = await contactService_js_1.contactService.linkToRezUser(contactId, rezUserId);
    if (!contact) {
        throw errorHandler_js_1.ApiError.notFound('Contact not found');
    }
    res.json({
        success: true,
        data: contact,
        message: 'Contact linked to ReZ user',
    });
}));
/**
 * Unlink contact from ReZ user
 * POST /api/contacts/:id/unlink
 */
router.post('/contacts/:id/unlink', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const contact = await contactService_js_1.contactService.unlinkFromRezUser(req.params.id);
    if (!contact) {
        throw errorHandler_js_1.ApiError.notFound('Contact not found');
    }
    res.json({
        success: true,
        data: contact,
        message: 'Contact unlinked from ReZ user',
    });
}));
// ============================================
// Deal Routes
// ============================================
const DealQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.string().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    provider: zod_1.z.enum(['hubspot', 'zoho']).optional(),
    stage: zod_1.z.string().optional(),
    minAmount: zod_1.z.coerce.number().optional(),
    maxAmount: zod_1.z.coerce.number().optional(),
});
/**
 * List all deals
 * GET /api/deals
 */
router.get('/deals', (0, validation_js_1.validateQuery)(DealQuerySchema), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const parsed = DealQuerySchema.parse(req.query);
    const params = {
        page: parsed.page,
        limit: parsed.limit,
        sortBy: parsed.sortBy,
        sortOrder: parsed.sortOrder,
        provider: parsed.provider,
        stage: parsed.stage,
        minAmount: parsed.minAmount,
        maxAmount: parsed.maxAmount,
    };
    const result = await dealService_js_1.dealService.getDeals(params);
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
}));
/**
 * Get a single deal
 * GET /api/deals/:id
 */
router.get('/deals/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const deal = await dealService_js_1.dealService.getDealById(req.params.id);
    if (!deal) {
        throw errorHandler_js_1.ApiError.notFound('Deal not found');
    }
    res.json({
        success: true,
        data: deal,
    });
}));
/**
 * Create a new deal
 * POST /api/deals
 */
router.post('/deals', (0, validation_js_1.validateBody)(zod_1.z.object({
    title: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive().optional(),
    currency: zod_1.z.string().default('USD'),
    stage: zod_1.z.string().optional(),
    probability: zod_1.z.number().min(0).max(100).optional(),
    closeDate: zod_1.z.string().datetime().optional(),
    contactId: zod_1.z.string().optional(),
    companyName: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    provider: zod_1.z.enum(['hubspot', 'zoho']).default('hubspot'),
})), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const dealData = req.body;
    const result = await dealService_js_1.dealService.createInCRM({
        ...dealData,
        provider: dealData.provider,
    }, dealData.provider);
    if (!result.success) {
        throw errorHandler_js_1.ApiError.internal(result.error || 'Failed to create deal');
    }
    res.status(201).json({
        success: true,
        data: result.deal,
        message: 'Deal created successfully',
    });
}));
/**
 * Update deal stage
 * PATCH /api/deals/:id/stage
 */
router.patch('/deals/:id/stage', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { stage } = req.body;
    if (!stage || typeof stage !== 'string') {
        throw errorHandler_js_1.ApiError.badRequest('Stage is required');
    }
    const deal = await dealService_js_1.dealService.updateStage(req.params.id, stage);
    if (!deal) {
        throw errorHandler_js_1.ApiError.notFound('Deal not found');
    }
    res.json({
        success: true,
        data: deal,
        message: 'Deal stage updated',
    });
}));
/**
 * Get deals by contact
 * GET /api/deals/contact/:contactId
 */
router.get('/deals/contact/:contactId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { contactId } = req.params;
    const { provider } = req.query;
    const deals = await dealService_js_1.dealService.getDealsByContact(contactId, provider);
    res.json({
        success: true,
        data: deals,
    });
}));
/**
 * Get deal statistics
 * GET /api/deals/stats
 */
router.get('/deals/stats', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { provider } = req.query;
    const stats = await dealService_js_1.dealService.getDealStats(provider);
    res.json({
        success: true,
        data: stats,
    });
}));
// ============================================
// Sync Routes
// ============================================
/**
 * Get sync status
 * GET /api/sync/status
 */
router.get('/sync/status', (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    const status = await syncService_js_1.syncService.getSyncStatus();
    res.json({
        success: true,
        data: status,
    });
}));
/**
 * Trigger sync
 * POST /api/sync/trigger
 */
router.post('/sync/trigger', (0, validation_js_1.validateBody)(zod_1.z.object({
    provider: zod_1.z.enum(['hubspot', 'zoho']).optional(),
    entityType: zod_1.z.enum(['contact', 'deal']).optional(),
    force: zod_1.z.boolean().default(false),
})), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const triggerData = req.body;
    const result = await syncService_js_1.syncService.triggerSync({
        provider: triggerData.provider,
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
}));
/**
 * Get sync history
 * GET /api/sync/history
 */
router.get('/sync/history', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { provider, limit } = req.query;
    const history = await syncService_js_1.syncService.getSyncHistory(provider, limit ? parseInt(limit, 10) : 20);
    res.json({
        success: true,
        data: history,
    });
}));
exports.default = router;
//# sourceMappingURL=index.js.map