"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const merchantGrowthDashboard_1 = require("../services/merchantGrowthDashboard");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
// CRIT FIX: All growth dashboard routes require merchant authentication
router.use(auth_1.verifyMerchant);
/**
 * GET /api/merchant/growth/dashboard
 *
 * Complete growth dashboard data including:
 * - Campaign overview
 * - Ad performance
 * - Notification statistics
 * - Voucher metrics
 * - Growth score
 *
 * Query params:
 *   - days: number (default: 30) - time period in days
 */
router.get('/dashboard', async (req, res) => {
    const merchantId = req.merchantId;
    if (!merchantId) {
        return res.status(401).json({ error: 'Merchant authentication required' });
    }
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    try {
        const dashboard = await merchantGrowthDashboard_1.merchantGrowthDashboard.getDashboard(merchantId, days);
        res.json({ success: true, dashboard });
    }
    catch (err) {
        logger_1.logger.error('[MerchantGrowth] Dashboard error', { merchantId, error: err.message });
        res.status(500).json({ error: 'Failed to fetch growth dashboard data' });
    }
});
/**
 * GET /api/merchant/growth/campaigns
 *
 * Campaign overview with engagement metrics for the period.
 *
 * Query params:
 *   - days: number (default: 30) - time period in days
 */
router.get('/campaigns', async (req, res) => {
    const merchantId = req.merchantId;
    if (!merchantId) {
        return res.status(401).json({ error: 'Merchant authentication required' });
    }
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        return res.status(400).json({ error: 'Invalid merchantId' });
    }
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    try {
        const campaigns = await merchantGrowthDashboard_1.merchantGrowthDashboard.getCampaignOverview(merchantId, start, end);
        res.json({ success: true, campaigns });
    }
    catch (err) {
        logger_1.logger.error('[MerchantGrowth] Campaigns error', { merchantId, error: err.message });
        res.status(500).json({ error: 'Failed to fetch campaign overview' });
    }
});
/**
 * GET /api/merchant/growth/ads
 *
 * Ad performance metrics including impressions, clicks, CTR, conversions.
 *
 * Query params:
 *   - days: number (default: 30) - time period in days
 */
router.get('/ads', async (req, res) => {
    const merchantId = req.merchantId;
    if (!merchantId) {
        return res.status(401).json({ error: 'Merchant authentication required' });
    }
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        return res.status(400).json({ error: 'Invalid merchantId' });
    }
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    try {
        const ads = await merchantGrowthDashboard_1.merchantGrowthDashboard.getAdPerformance(merchantId, start, end);
        res.json({ success: true, ads });
    }
    catch (err) {
        logger_1.logger.error('[MerchantGrowth] Ads error', { merchantId, error: err.message });
        res.status(500).json({ error: 'Failed to fetch ad performance data' });
    }
});
/**
 * GET /api/merchant/growth/notifications
 *
 * Notification statistics including sent, delivered, opened, clicked.
 *
 * Query params:
 *   - days: number (default: 30) - time period in days
 */
router.get('/notifications', async (req, res) => {
    const merchantId = req.merchantId;
    if (!merchantId) {
        return res.status(401).json({ error: 'Merchant authentication required' });
    }
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        return res.status(400).json({ error: 'Invalid merchantId' });
    }
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    try {
        const notifications = await merchantGrowthDashboard_1.merchantGrowthDashboard.getNotificationStats(merchantId, start, end);
        res.json({ success: true, notifications });
    }
    catch (err) {
        logger_1.logger.error('[MerchantGrowth] Notifications error', { merchantId, error: err.message });
        res.status(500).json({ error: 'Failed to fetch notification statistics' });
    }
});
/**
 * GET /api/merchant/growth/vouchers
 *
 * Voucher metrics including issued, redeemed, revenue impact.
 *
 * Query params:
 *   - days: number (default: 30) - time period in days
 */
router.get('/vouchers', async (req, res) => {
    const merchantId = req.merchantId;
    if (!merchantId) {
        return res.status(401).json({ error: 'Merchant authentication required' });
    }
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        return res.status(400).json({ error: 'Invalid merchantId' });
    }
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    try {
        const vouchers = await merchantGrowthDashboard_1.merchantGrowthDashboard.getVoucherMetrics(merchantId, start, end);
        res.json({ success: true, vouchers });
    }
    catch (err) {
        logger_1.logger.error('[MerchantGrowth] Vouchers error', { merchantId, error: err.message });
        res.status(500).json({ error: 'Failed to fetch voucher metrics' });
    }
});
/**
 * GET /api/merchant/growth/score
 *
 * Combined growth health score (0-100) with breakdown.
 *
 * Query params:
 *   - days: number (default: 30) - time period in days
 */
router.get('/score', async (req, res) => {
    const merchantId = req.merchantId;
    if (!merchantId) {
        return res.status(401).json({ error: 'Merchant authentication required' });
    }
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        return res.status(400).json({ error: 'Invalid merchantId' });
    }
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    try {
        const score = await merchantGrowthDashboard_1.merchantGrowthDashboard.getGrowthScore(merchantId, start, end);
        res.json({ success: true, score });
    }
    catch (err) {
        logger_1.logger.error('[MerchantGrowth] Score error', { merchantId, error: err.message });
        res.status(500).json({ error: 'Failed to calculate growth score' });
    }
});
exports.default = router;
//# sourceMappingURL=merchantGrowth.js.map