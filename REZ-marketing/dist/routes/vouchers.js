"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const voucherService_1 = require("../services/voucherService");
const notificationService_1 = require("../services/notificationService");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
// Validation schemas
const createVoucherSchema = zod_1.z.object({
    code: zod_1.z.string().min(3).max(20).optional(),
    type: zod_1.z.enum(['percentage', 'fixed', 'bogo', 'free_delivery']),
    value: zod_1.z.number().min(0),
    minOrderValue: zod_1.z.number().min(0).optional().default(0),
    maxDiscount: zod_1.z.number().min(0).optional(),
    maxUses: zod_1.z.number().int().min(0).optional(),
    validFrom: zod_1.z.string().datetime() || zod_1.z.date(),
    validUntil: zod_1.z.string().datetime() || zod_1.z.date(),
    applicableTo: zod_1.z.enum(['all', 'category', 'product', 'store']).optional().default('all'),
    applicableIds: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    createdBy: zod_1.z.string().optional(),
    merchantId: zod_1.z.string().min(1, 'merchantId is required for analytics tracking'),
    // Notification recipient fields (optional - notification sent if sendNotification is true)
    recipientUserId: zod_1.z.string().optional(),
    recipientEmail: zod_1.z.string().email().optional(),
    recipientPhone: zod_1.z.string().optional(),
    sendNotification: zod_1.z.boolean().optional().default(false),
});
const updateVoucherSchema = zod_1.z.object({
    type: zod_1.z.enum(['percentage', 'fixed', 'bogo', 'free_delivery']).optional(),
    value: zod_1.z.number().min(0).optional(),
    minOrderValue: zod_1.z.number().min(0).optional(),
    maxDiscount: zod_1.z.number().min(0).optional(),
    maxUses: zod_1.z.number().int().min(0).optional(),
    validFrom: zod_1.z.string().datetime().optional(),
    validUntil: zod_1.z.string().datetime().optional(),
    applicableTo: zod_1.z.enum(['all', 'category', 'product', 'store']).optional(),
    applicableIds: zod_1.z.array(zod_1.z.string()).optional(),
    status: zod_1.z.enum(['active', 'exhausted', 'expired', 'cancelled']).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
const validateVoucherSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    orderValue: zod_1.z.number().min(0),
    userId: zod_1.z.string().min(1),
});
const redeemVoucherSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    userId: zod_1.z.string().min(1),
    orderId: zod_1.z.string().min(1),
    orderValue: zod_1.z.number().min(0),
    merchantId: zod_1.z.string().min(1, 'merchantId is required for analytics tracking'),
});
const listVouchersSchema = zod_1.z.object({
    status: zod_1.z.enum(['active', 'exhausted', 'expired', 'cancelled']).optional(),
    type: zod_1.z.enum(['percentage', 'fixed', 'bogo', 'free_delivery']).optional(),
    applicableTo: zod_1.z.enum(['all', 'category', 'product', 'store']).optional(),
    applicableIds: zod_1.z.array(zod_1.z.string()).optional(),
    createdBy: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().min(1).optional(),
    limit: zod_1.z.coerce.number().min(1).max(100).optional(),
});
// Apply Zod validation middleware
function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: result.error.issues,
            });
        }
        req.body = result.data;
        next();
    };
}
// ── CRUD Routes ─────────────────────────────────────────────────────────────────
/**
 * POST /vouchers
 * Create a new voucher
 */
router.post('/', validate(createVoucherSchema), async (req, res) => {
    const data = req.body;
    // Convert date strings to Date objects if needed
    if (typeof data.validFrom === 'string') {
        data.validFrom = new Date(data.validFrom);
    }
    if (typeof data.validUntil === 'string') {
        data.validUntil = new Date(data.validUntil);
    }
    const voucher = await voucherService_1.voucherService.create(data);
    // VCH-NOTIF-001: Send SMS/Email notification when voucher is generated
    // Only send if sendNotification is true and recipient info is provided
    if (data.sendNotification && (data.recipientUserId || data.recipientEmail || data.recipientPhone)) {
        (0, notificationService_1.sendVoucherNotification)({
            voucherId: String(voucher._id),
            voucherCode: voucher.code,
            voucherType: voucher.type,
            voucherValue: voucher.value,
            merchantId: data.merchantId || '',
            recipientUserId: data.recipientUserId || '',
            recipientEmail: data.recipientEmail,
            recipientPhone: data.recipientPhone,
            validUntil: String(voucher.validUntil),
        }).catch((err) => logger_1.logger.warn('[Vouchers] Notification trigger failed', { voucherId: String(voucher._id), error: err.message }));
    }
    res.status(201).json({ success: true, voucher });
});
/**
 * GET /vouchers
 * List vouchers with optional filters
 */
router.get('/', async (req, res) => {
    const queryResult = listVouchersSchema.safeParse(req.query);
    if (!queryResult.success) {
        return res.status(400).json({
            error: 'Invalid query parameters',
            details: queryResult.error.issues,
        });
    }
    const filters = {
        status: queryResult.data.status,
        type: queryResult.data.type,
        applicableTo: queryResult.data.applicableTo,
        applicableIds: queryResult.data.applicableIds,
        createdBy: queryResult.data.createdBy,
        page: queryResult.data.page,
        limit: queryResult.data.limit,
    };
    const { vouchers, total } = await voucherService_1.voucherService.list(filters);
    res.json({
        success: true,
        vouchers,
        pagination: {
            total,
            page: filters.page || 1,
            limit: filters.limit || 20,
            pages: Math.ceil(total / (filters.limit || 20)),
        },
    });
});
/**
 * GET /vouchers/:id
 * Get voucher by ID
 */
router.get('/:id', async (req, res) => {
    const voucher = await voucherService_1.voucherService.getById(req.params.id);
    if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
    }
    res.json({ success: true, voucher });
});
/**
 * GET /vouchers/code/:code
 * Get voucher by code
 */
router.get('/code/:code', async (req, res) => {
    const voucher = await voucherService_1.voucherService.getByCode(req.params.code);
    if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found or inactive' });
    }
    res.json({ success: true, voucher });
});
/**
 * PATCH /vouchers/:id
 * Update a voucher
 */
router.patch('/:id', validate(updateVoucherSchema), async (req, res) => {
    const data = req.body;
    // Convert date strings to Date objects if needed
    if (data.validFrom && typeof data.validFrom === 'string') {
        data.validFrom = new Date(data.validFrom);
    }
    if (data.validUntil && typeof data.validUntil === 'string') {
        data.validUntil = new Date(data.validUntil);
    }
    const voucher = await voucherService_1.voucherService.update(req.params.id, data);
    if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
    }
    res.json({ success: true, voucher });
});
/**
 * DELETE /vouchers/:id
 * Deactivate a voucher
 */
router.delete('/:id', async (req, res) => {
    const voucher = await voucherService_1.voucherService.deactivate(req.params.id);
    if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
    }
    res.json({ success: true, voucher });
});
// ── Validation & Redemption Routes ──────────────────────────────────────────
/**
 * POST /vouchers/validate
 * Validate a voucher code for an order
 */
router.post('/validate', validate(validateVoucherSchema), async (req, res) => {
    const { code, orderValue, userId } = req.body;
    const result = await voucherService_1.voucherService.validate(code, orderValue, userId);
    if (!result.valid) {
        return res.json({
            valid: false,
            error: result.error,
            errorCode: result.errorCode,
        });
    }
    res.json({
        valid: true,
        voucher: result.voucher,
        discount: result.discount,
    });
});
/**
 * POST /vouchers/redeem
 * Redeem a voucher for an order
 */
router.post('/redeem', validate(redeemVoucherSchema), async (req, res) => {
    const { code, userId, orderId, orderValue, merchantId } = req.body;
    const result = await voucherService_1.voucherService.redeem(code, userId, orderId, orderValue, merchantId);
    if (!result.valid) {
        return res.status(400).json({
            valid: false,
            error: result.error,
            errorCode: result.errorCode,
        });
    }
    res.json({
        valid: true,
        voucher: result.voucher,
        discount: result.discount,
    });
});
/**
 * GET /vouchers/:id/redemptions
 * Get redemption history for a voucher
 */
router.get('/:id/redemptions', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const { redemptions, total } = await voucherService_1.voucherService.getRedemptions(req.params.id, { page, limit });
    res.json({
        success: true,
        redemptions,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    });
});
/**
 * GET /vouchers/user/:userId
 * Get redemption history for a user
 */
router.get('/user/:userId', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const { redemptions, total } = await voucherService_1.voucherService.getUserRedemptions(req.params.userId, { page, limit });
    res.json({
        success: true,
        redemptions,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    });
});
/**
 * POST /vouchers/cleanup
 * Mark expired vouchers (admin/cron endpoint)
 */
router.post('/cleanup', async (_req, res) => {
    const count = await voucherService_1.voucherService.markExpiredVouchers();
    res.json({ success: true, message: `Marked ${count} vouchers as expired` });
});
exports.default = router;
//# sourceMappingURL=vouchers.js.map