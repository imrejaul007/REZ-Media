import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { voucherService, CreateVoucherDTO, UpdateVoucherDTO, VoucherFilters } from '../services/voucherService';
import { sendVoucherNotification } from '../services/notificationService';
import { logger } from '../config/logger';

const router = Router();

// Validation schemas
const createVoucherSchema = z.object({
  code: z.string().min(3).max(20).optional(),
  type: z.enum(['percentage', 'fixed', 'bogo', 'free_delivery']),
  value: z.number().min(0),
  minOrderValue: z.number().min(0).optional().default(0),
  maxDiscount: z.number().min(0).optional(),
  maxUses: z.number().int().min(0).optional(),
  validFrom: z.string().datetime() || z.date(),
  validUntil: z.string().datetime() || z.date(),
  applicableTo: z.enum(['all', 'category', 'product', 'store']).optional().default('all'),
  applicableIds: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdBy: z.string().optional(),
  merchantId: z.string().min(1, 'merchantId is required for analytics tracking'),
  // Notification recipient fields (optional - notification sent if sendNotification is true)
  recipientUserId: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  sendNotification: z.boolean().optional().default(false),
});

const updateVoucherSchema = z.object({
  type: z.enum(['percentage', 'fixed', 'bogo', 'free_delivery']).optional(),
  value: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  maxUses: z.number().int().min(0).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  applicableTo: z.enum(['all', 'category', 'product', 'store']).optional(),
  applicableIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'exhausted', 'expired', 'cancelled']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const validateVoucherSchema = z.object({
  code: z.string().min(1),
  orderValue: z.number().min(0),
  userId: z.string().min(1),
});

const redeemVoucherSchema = z.object({
  code: z.string().min(1),
  userId: z.string().min(1),
  orderId: z.string().min(1),
  orderValue: z.number().min(0),
  merchantId: z.string().min(1, 'merchantId is required for analytics tracking'),
});

const listVouchersSchema = z.object({
  status: z.enum(['active', 'exhausted', 'expired', 'cancelled']).optional(),
  type: z.enum(['percentage', 'fixed', 'bogo', 'free_delivery']).optional(),
  applicableTo: z.enum(['all', 'category', 'product', 'store']).optional(),
  applicableIds: z.array(z.string()).optional(),
  createdBy: z.string().optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

// Apply Zod validation middleware
function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: Function) => {
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
router.post('/', validate(createVoucherSchema), async (req: Request, res: Response) => {
  const data: CreateVoucherDTO = req.body;

  // Convert date strings to Date objects if needed
  if (typeof data.validFrom === 'string') {
    data.validFrom = new Date(data.validFrom);
  }
  if (typeof data.validUntil === 'string') {
    data.validUntil = new Date(data.validUntil);
  }

  const voucher = await voucherService.create(data);

  // VCH-NOTIF-001: Send SMS/Email notification when voucher is generated
  // Only send if sendNotification is true and recipient info is provided
  if (data.sendNotification && (data.recipientUserId || data.recipientEmail || data.recipientPhone)) {
    sendVoucherNotification({
      voucherId: String(voucher._id),
      voucherCode: voucher.code,
      voucherType: voucher.type,
      voucherValue: voucher.value,
      merchantId: data.merchantId || '',
      recipientUserId: data.recipientUserId || '',
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      validUntil: String(voucher.validUntil),
    }).catch((err) => logger.warn('[Vouchers] Notification trigger failed', { voucherId: String(voucher._id), error: err.message }));
  }

  res.status(201).json({ success: true, voucher });
});

/**
 * GET /vouchers
 * List vouchers with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  const queryResult = listVouchersSchema.safeParse(req.query);

  if (!queryResult.success) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      details: queryResult.error.issues,
    });
  }

  const filters: VoucherFilters = {
    status: queryResult.data.status,
    type: queryResult.data.type,
    applicableTo: queryResult.data.applicableTo,
    applicableIds: queryResult.data.applicableIds,
    createdBy: queryResult.data.createdBy,
    page: queryResult.data.page,
    limit: queryResult.data.limit,
  };

  const { vouchers, total } = await voucherService.list(filters);

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
router.get('/:id', async (req: Request, res: Response) => {
  const voucher = await voucherService.getById(req.params.id);

  if (!voucher) {
    return res.status(404).json({ error: 'Voucher not found' });
  }

  res.json({ success: true, voucher });
});

/**
 * GET /vouchers/code/:code
 * Get voucher by code
 */
router.get('/code/:code', async (req: Request, res: Response) => {
  const voucher = await voucherService.getByCode(req.params.code);

  if (!voucher) {
    return res.status(404).json({ error: 'Voucher not found or inactive' });
  }

  res.json({ success: true, voucher });
});

/**
 * PATCH /vouchers/:id
 * Update a voucher
 */
router.patch('/:id', validate(updateVoucherSchema), async (req: Request, res: Response) => {
  const data: UpdateVoucherDTO = req.body;

  // Convert date strings to Date objects if needed
  if (data.validFrom && typeof data.validFrom === 'string') {
    data.validFrom = new Date(data.validFrom);
  }
  if (data.validUntil && typeof data.validUntil === 'string') {
    data.validUntil = new Date(data.validUntil);
  }

  const voucher = await voucherService.update(req.params.id, data);

  if (!voucher) {
    return res.status(404).json({ error: 'Voucher not found' });
  }

  res.json({ success: true, voucher });
});

/**
 * DELETE /vouchers/:id
 * Deactivate a voucher
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const voucher = await voucherService.deactivate(req.params.id);

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
router.post('/validate', validate(validateVoucherSchema), async (req: Request, res: Response) => {
  const { code, orderValue, userId } = req.body;

  const result = await voucherService.validate(code, orderValue, userId);

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
router.post('/redeem', validate(redeemVoucherSchema), async (req: Request, res: Response) => {
  const { code, userId, orderId, orderValue, merchantId } = req.body;

  const result = await voucherService.redeem(code, userId, orderId, orderValue, merchantId);

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
router.get('/:id/redemptions', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

  const { redemptions, total } = await voucherService.getRedemptions(req.params.id, { page, limit });

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
router.get('/user/:userId', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

  const { redemptions, total } = await voucherService.getUserRedemptions(req.params.userId, { page, limit });

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
router.post('/cleanup', async (_req: Request, res: Response) => {
  const count = await voucherService.markExpiredVouchers();
  res.json({ success: true, message: `Marked ${count} vouchers as expired` });
});

export default router;
