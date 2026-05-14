"use strict";
/**
 * Lead Intelligence Service - Routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const middleware_1 = require("../middleware");
const LeadIntelligenceService_1 = require("../services/LeadIntelligenceService");
const router = (0, express_1.Router)();
// ============================================================================
// Lead Score Routes
// ============================================================================
/**
 * GET /api/v1/leads/:userId/score
 * Get lead score for a specific user
 */
router.get('/leads/:userId/score', [
    (0, express_validator_1.param)('userId').notEmpty().withMessage('User ID is required'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const leadScore = await LeadIntelligenceService_1.leadIntelligenceService.getLeadScore(userId);
    res.json({
        success: true,
        data: leadScore,
    });
}));
/**
 * GET /api/v1/leads/hot
 * Get all hot leads
 */
router.get('/leads/hot', [
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }).toInt(),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const leads = await LeadIntelligenceService_1.leadIntelligenceService.detectHotLeads({ limit, offset });
    res.json({
        success: true,
        data: {
            leads,
            total: leads.length,
            page: Math.floor(offset / limit) + 1,
            pageSize: limit,
        },
    });
}));
/**
 * GET /api/v1/leads/warm
 * Get all warm leads
 */
router.get('/leads/warm', [
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }).toInt(),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const leads = await LeadIntelligenceService_1.leadIntelligenceService.detectWarmLeads({ limit, offset });
    res.json({
        success: true,
        data: {
            leads,
            total: leads.length,
            page: Math.floor(offset / limit) + 1,
            pageSize: limit,
        },
    });
}));
/**
 * GET /api/v1/leads/cold
 * Get all cold leads
 */
router.get('/leads/cold', [
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }).toInt(),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const leads = await LeadIntelligenceService_1.leadIntelligenceService.detectColdLeads({ limit, offset });
    res.json({
        success: true,
        data: {
            leads,
            total: leads.length,
            page: Math.floor(offset / limit) + 1,
            pageSize: limit,
        },
    });
}));
// ============================================================================
// Abandoned Cart Routes
// ============================================================================
/**
 * POST /api/v1/carts
 * Track an abandoned cart
 */
router.post('/carts', [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('cartId').notEmpty().withMessage('Cart ID is required'),
    (0, express_validator_1.body)('items').isArray({ min: 1 }).withMessage('Items array is required'),
    (0, express_validator_1.body)('items.*.productId').notEmpty().withMessage('Product ID is required'),
    (0, express_validator_1.body)('items.*.price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    (0, express_validator_1.body)('totalValue').isFloat({ min: 0 }).withMessage('Total value must be a positive number'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId, cartId, items, totalValue } = req.body;
    const abandonedCart = await LeadIntelligenceService_1.leadIntelligenceService.trackAbandonedCart(userId, cartId, items, totalValue);
    res.status(201).json({
        success: true,
        data: abandonedCart,
    });
}));
/**
 * GET /api/v1/carts/user/:userId
 * Get abandoned carts for a user
 */
router.get('/carts/user/:userId', [
    (0, express_validator_1.param)('userId').notEmpty().withMessage('User ID is required'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const carts = await LeadIntelligenceService_1.leadIntelligenceService.getAbandonedCarts(userId);
    res.json({
        success: true,
        data: carts,
    });
}));
/**
 * POST /api/v1/carts/:cartId/recovered
 * Mark a cart as recovered
 */
router.post('/carts/:cartId/recovered', [
    (0, express_validator_1.param)('cartId').notEmpty().withMessage('Cart ID is required'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { cartId } = req.params;
    await LeadIntelligenceService_1.leadIntelligenceService.markCartRecovered(cartId);
    res.json({
        success: true,
        message: 'Cart marked as recovered',
    });
}));
// ============================================================================
// Abandoned Search Routes
// ============================================================================
/**
 * POST /api/v1/searches
 * Track an abandoned search
 */
router.post('/searches', [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('query').notEmpty().withMessage('Search query is required'),
    (0, express_validator_1.body)('resultsShown').isArray().withMessage('Results shown must be an array'),
    (0, express_validator_1.body)('notClicked').isArray().withMessage('Not clicked must be an array'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId, query, resultsShown, notClicked, intentDetected, urgencyLevel } = req.body;
    const abandonedSearch = await LeadIntelligenceService_1.leadIntelligenceService.trackAbandonedSearch(userId, query, resultsShown, notClicked, intentDetected || '', urgencyLevel || 'low');
    res.status(201).json({
        success: true,
        data: abandonedSearch,
    });
}));
/**
 * GET /api/v1/searches/user/:userId
 * Get abandoned searches for a user
 */
router.get('/searches/user/:userId', [
    (0, express_validator_1.param)('userId').notEmpty().withMessage('User ID is required'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const searches = await LeadIntelligenceService_1.leadIntelligenceService.getAbandonedSearches(userId);
    res.json({
        success: true,
        data: searches,
    });
}));
// ============================================================================
// Channel Routes
// ============================================================================
/**
 * GET /api/v1/channels/:userId/recommend
 * Get recommended channel for a user
 */
router.get('/channels/:userId/recommend', [
    (0, express_validator_1.param)('userId').notEmpty().withMessage('User ID is required'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const channel = await LeadIntelligenceService_1.leadIntelligenceService.getRecommendedChannel(userId);
    res.json({
        success: true,
        data: { channel },
    });
}));
/**
 * GET /api/v1/channels/:userId/scores
 * Get channel scores for a user
 */
router.get('/channels/:userId/scores', [
    (0, express_validator_1.param)('userId').notEmpty().withMessage('User ID is required'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const scores = await LeadIntelligenceService_1.leadIntelligenceService.getChannelScores(userId);
    res.json({
        success: true,
        data: scores,
    });
}));
// ============================================================================
// Re-Engagement Routes
// ============================================================================
/**
 * POST /api/v1/re-engage/:userId
 * Trigger re-engagement for a user
 */
router.post('/re-engage/:userId', [
    (0, express_validator_1.param)('userId').notEmpty().withMessage('User ID is required'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId } = req.params;
    const result = await LeadIntelligenceService_1.leadIntelligenceService.triggerReEngagement(userId);
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * POST /api/v1/re-engage/batch/hot
 * Process all hot leads for re-engagement
 */
router.post('/re-engage/batch/hot', (0, middleware_1.asyncHandler)(async (req, res) => {
    const result = await LeadIntelligenceService_1.leadIntelligenceService.processHotLeadsBatch();
    res.json({
        success: true,
        data: result,
    });
}));
/**
 * POST /api/v1/re-engage/batch/carts
 * Process abandoned carts for recovery
 */
router.post('/re-engage/batch/carts', (0, middleware_1.asyncHandler)(async (req, res) => {
    const result = await LeadIntelligenceService_1.leadIntelligenceService.processAbandonedCartsBatch();
    res.json({
        success: true,
        data: result,
    });
}));
// ============================================================================
// Activity Tracking Routes
// ============================================================================
/**
 * POST /api/v1/activity
 * Track user activity
 */
router.post('/activity', [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('activityType').isIn(['search', 'view', 'cart']).withMessage('Invalid activity type'),
    middleware_1.validationErrorHandler,
], (0, middleware_1.asyncHandler)(async (req, res) => {
    const { userId, activityType, ...data } = req.body;
    await LeadIntelligenceService_1.leadIntelligenceService.trackUserActivity(userId, activityType, data);
    res.status(201).json({
        success: true,
        message: 'Activity tracked',
    });
}));
exports.default = router;
//# sourceMappingURL=index.js.map