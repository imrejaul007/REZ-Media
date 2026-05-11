/**
 * Rendez Routes — Social and Contextual Offers API
 *
 * Endpoints:
 * - CRUD operations for rendez offers
 * - Contextual offer discovery
 * - Dynamic offer generation
 * - Booking flow
 * - Social sharing
 * - Templates
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import {
  rendezService,
  CreateRendezOfferDTO,
  UpdateRendezOfferDTO,
  RendezOfferFilters,
  ContextQuery,
  BookingDTO,
  ShareDTO,
} from '../services/rendezService';
import { sendRendezNotification } from '../services/notificationService';
import { logger } from '../config/logger';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────────

const createOfferSchema = z.object({
  merchantId: z.string().min(1, 'merchantId is required'),
  name: z.string().min(1).max(200),
  category: z.enum(['couple', 'group', 'context']),
  type: z.enum(['percentage', 'fixed', 'bogo', 'bundle', 'experience']),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  benefits: z.object({
    discount: z.object({
      type: z.enum(['percentage', 'fixed']),
      value: z.number().min(0),
      maxDiscount: z.number().min(0).optional(),
    }).optional(),
    bundle: z.object({
      items: z.array(z.string()).min(1),
      packagePrice: z.number().min(0),
    }).optional(),
    experience: z.object({
      type: z.enum(['priority_booking', 'exclusive_access', 'complimentary', 'upgrade']),
      description: z.string(),
    }).optional(),
    bogo: z.object({
      buyQuantity: z.number().min(1),
      getQuantity: z.number().min(1),
      getItem: z.string(),
    }).optional(),
  }),
  imageUrls: z.array(z.string().url()).optional(),
  videoUrl: z.string().url().optional(),
  ctaText: z.string().max(50).optional(),
  ctaUrl: z.string().url().optional(),
  originalPrice: z.number().min(0).optional(),
  offerPrice: z.number().min(0).optional(),
  minPartySize: z.number().int().min(1).optional().default(1),
  maxPartySize: z.number().int().min(1).optional(),
  contextTrigger: z.object({
    dayOfWeek: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
    timeOfDay: z.array(z.enum(['morning', 'afternoon', 'evening', 'night'])).optional(),
    occasion: z.array(z.object({
      type: z.enum(['valentines', 'anniversary', 'birthday', 'weekend', 'holiday', 'new_year', 'christmas', 'diwali', 'summer', 'monsoon', 'custom']),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      customName: z.string().optional(),
    })).optional(),
    minPartySize: z.number().min(1).optional(),
    maxPartySize: z.number().min(1).optional(),
  }).optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  templateId: z.string().optional(),
  templateName: z.string().optional(),
  targetAudience: z.object({
    segments: z.array(z.string()).optional(),
    locations: z.object({
      city: z.string().optional(),
      areas: z.array(z.string()).optional(),
      pincodes: z.array(z.string()).optional(),
    }).optional(),
    interests: z.array(z.string()).optional(),
  }).optional(),
  bookingSlots: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    capacity: z.number().min(1).optional(),
  })).optional(),
  shareable: z.boolean().optional().default(true),
  shareUrl: z.string().url().optional(),
  shareMessage: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  createdBy: z.string().optional(),
  // Notification settings
  sendNotification: z.boolean().optional().default(false),
  recipientUserId: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
});

const updateOfferSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
  benefits: z.object({
    discount: z.object({
      type: z.enum(['percentage', 'fixed']),
      value: z.number().min(0),
      maxDiscount: z.number().min(0).optional(),
    }).optional(),
    bundle: z.object({
      items: z.array(z.string()).min(1),
      packagePrice: z.number().min(0),
    }).optional(),
    experience: z.object({
      type: z.enum(['priority_booking', 'exclusive_access', 'complimentary', 'upgrade']),
      description: z.string(),
    }).optional(),
    bogo: z.object({
      buyQuantity: z.number().min(1),
      getQuantity: z.number().min(1),
      getItem: z.string(),
    }).optional(),
  }).optional(),
  imageUrls: z.array(z.string().url()).optional(),
  videoUrl: z.string().url().optional(),
  ctaText: z.string().max(50).optional(),
  ctaUrl: z.string().url().optional(),
  originalPrice: z.number().min(0).optional(),
  offerPrice: z.number().min(0).optional(),
  minPartySize: z.number().int().min(1).optional(),
  maxPartySize: z.number().int().min(1).optional(),
  contextTrigger: z.object({
    dayOfWeek: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
    timeOfDay: z.array(z.enum(['morning', 'afternoon', 'evening', 'night'])).optional(),
    occasion: z.array(z.object({
      type: z.enum(['valentines', 'anniversary', 'birthday', 'weekend', 'holiday', 'new_year', 'christmas', 'diwali', 'summer', 'monsoon', 'custom']),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      customName: z.string().optional(),
    })).optional(),
    minPartySize: z.number().min(1).optional(),
    maxPartySize: z.number().min(1).optional(),
  }).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  status: z.enum(['active', 'scheduled', 'expired', 'cancelled', 'paused']).optional(),
  bookingSlots: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    capacity: z.number().min(1).optional(),
  })).optional(),
  shareable: z.boolean().optional(),
  shareUrl: z.string().url().optional(),
  shareMessage: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const contextQuerySchema = z.object({
  userId: z.string().optional(),
  dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  occasion: z.enum(['valentines', 'anniversary', 'birthday', 'weekend', 'holiday', 'new_year', 'christmas', 'diwali', 'summer', 'monsoon']).optional(),
  city: z.string().optional(),
  area: z.string().optional(),
  partySize: z.coerce.number().int().min(1).optional(),
  interests: z.string().optional().transform((val) => val ? val.split(',').map(s => s.trim()) : undefined),
  merchantId: z.string().optional(),
});

const bookingSchema = z.object({
  offerId: z.string().min(1),
  userId: z.string().min(1),
  partySize: z.number().int().min(1),
  bookingDate: z.string().datetime(),
  bookingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().email().optional(),
  specialRequests: z.string().max(500).optional(),
  paymentMethod: z.string().optional(),
});

const shareSchema = z.object({
  offerId: z.string().min(1),
  userId: z.string().min(1),
  platform: z.enum(['whatsapp', 'facebook', 'twitter', 'instagram', 'copy_link']),
  recipientCount: z.number().int().min(1).optional().default(1),
});

// ── Validation Middleware ───────────────────────────────────────────────────────

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

function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: Function) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.issues,
      });
    }
    req.query = result.data as typeof req.query;
    next();
  };
}

// ── CRUD Routes ────────────────────────────────────────────────────────────────

/**
 * POST /rendez/offers
 * Create a new rendez offer
 */
router.post('/offers', validate(createOfferSchema), async (req: Request, res: Response) => {
  const data = req.body as CreateRendezOfferDTO & {
    sendNotification?: boolean;
    recipientUserId?: string;
    recipientEmail?: string;
    recipientPhone?: string;
  };

  const offer = await rendezService.create(data);

  // Send notification if requested
  if (data.sendNotification && (data.recipientUserId || data.recipientEmail || data.recipientPhone)) {
    sendRendezNotification({
      offerId: String(offer._id),
      offerTitle: offer.title,
      offerCategory: offer.category,
      merchantId: data.merchantId,
      recipientUserId: data.recipientUserId || '',
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      validUntil: String(offer.validUntil),
    }).catch((err) => logger.warn('[Rendez] Notification trigger failed', { offerId: String(offer._id), error: err.message }));
  }

  logger.info('[Rendez] Created offer', { offerId: offer._id, merchantId: data.merchantId });

  res.status(201).json({ success: true, offer });
});

/**
 * GET /rendez/offers
 * List rendez offers with filters
 */
router.get('/offers', async (req: Request, res: Response) => {
  const filters: RendezOfferFilters = {
    merchantId: req.query.merchantId as string,
    category: req.query.category as 'couple' | 'group' | 'context',
    type: req.query.type as 'percentage' | 'fixed' | 'bogo' | 'bundle' | 'experience',
    status: req.query.status as string,
    tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    occasion: req.query.occasion as 'valentines' | 'anniversary' | 'birthday' | 'weekend' | 'holiday' | 'new_year' | 'christmas' | 'diwali' | 'summer' | 'monsoon',
    dayOfWeek: req.query.dayOfWeek as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
    validNow: req.query.validNow === 'true',
    page: parseInt(req.query.page as string) || 1,
    limit: Math.min(100, parseInt(req.query.limit as string) || 20),
  };

  const { offers, total } = await rendezService.list(filters);

  res.json({
    success: true,
    offers,
    pagination: {
      total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      pages: Math.ceil(total / (filters.limit || 20)),
    },
  });
});

/**
 * GET /rendez/offers/:id
 * Get offer by ID
 */
router.get('/offers/:id', async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid offer ID' });
  }

  const offer = await rendezService.getById(req.params.id);

  if (!offer) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  res.json({ success: true, offer });
});

/**
 * PATCH /rendez/offers/:id
 * Update an offer
 */
router.patch('/offers/:id', validate(updateOfferSchema), async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid offer ID' });
  }

  const data = req.body as UpdateRendezOfferDTO;

  const offer = await rendezService.update(req.params.id, data);

  if (!offer) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  logger.info('[Rendez] Updated offer', { offerId: req.params.id });

  res.json({ success: true, offer });
});

/**
 * DELETE /rendez/offers/:id
 * Delete an offer
 */
router.delete('/offers/:id', async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid offer ID' });
  }

  const deleted = await rendezService.delete(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  logger.info('[Rendez] Deleted offer', { offerId: req.params.id });

  res.json({ success: true });
});

// ── Contextual Offers Routes ──────────────────────────────────────────────────

/**
 * GET /rendez/contextual
 * Get contextual offers based on time, occasion, and user context
 */
router.get('/contextual', validateQuery(contextQuerySchema), async (req: Request, res: Response) => {
  const context = req.query as unknown as ContextQuery;

  const offers = await rendezService.getContextualOffers(context);

  res.json({
    success: true,
    offers,
    context: {
      dayOfWeek: context.dayOfWeek,
      timeOfDay: context.timeOfDay,
      occasion: context.occasion,
      partySize: context.partySize,
    },
  });
});

/**
 * GET /rendez/couple
 * Get couple-specific offers
 */
router.get('/couple', async (req: Request, res: Response) => {
  const context: ContextQuery = {
    partySize: 2,
    merchantId: req.query.merchantId as string,
    city: req.query.city as string,
  };

  const offers = await rendezService.getCoupleOffers(context);

  res.json({ success: true, offers, category: 'couple' });
});

/**
 * GET /rendez/group
 * Get group/social offers
 */
router.get('/group', async (req: Request, res: Response) => {
  const context: ContextQuery = {
    partySize: parseInt(req.query.partySize as string) || 4,
    merchantId: req.query.merchantId as string,
    city: req.query.city as string,
  };

  const offers = await rendezService.getGroupOffers(context);

  res.json({ success: true, offers, category: 'group' });
});

/**
 * GET /rendez/generate
 * Generate dynamic offers based on context
 */
router.get('/generate', validateQuery(contextQuerySchema), async (req: Request, res: Response) => {
  const context = req.query as unknown as ContextQuery;

  const offers = await rendezService.generateDynamicOffers(context);

  res.json({
    success: true,
    offers,
    generated: true,
    context: {
      dayOfWeek: context.dayOfWeek,
      timeOfDay: context.timeOfDay,
      occasion: context.occasion,
      partySize: context.partySize,
    },
  });
});

// ── Booking Routes ─────────────────────────────────────────────────────────────

/**
 * POST /rendez/book
 * Book a rendez offer
 */
router.post('/book', validate(bookingSchema), async (req: Request, res: Response) => {
  const booking = req.body as BookingDTO;

  const result = await rendezService.bookOffer(booking);

  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  logger.info('[Rendez] Booking created', { bookingId: result.bookingId, offerId: booking.offerId });

  res.status(201).json({
    success: true,
    bookingId: result.bookingId,
    message: 'Booking confirmed',
  });
});

/**
 * POST /rendez/share
 * Share an offer
 */
router.post('/share', validate(shareSchema), async (req: Request, res: Response) => {
  const share = req.body as ShareDTO;

  const result = await rendezService.shareOffer(share);

  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  logger.info('[Rendez] Offer shared', { offerId: share.offerId, platform: share.platform });

  res.json({
    success: true,
    shareUrl: result.shareUrl,
    message: 'Share link generated',
  });
});

/**
 * POST /rendez/redeem
 * Redeem an offer (mark as used)
 */
router.post('/redeem', async (req: Request, res: Response) => {
  const { offerId, orderId, revenue } = req.body;

  if (!offerId || !orderId || revenue === undefined) {
    return res.status(400).json({ error: 'offerId, orderId, and revenue are required' });
  }

  const success = await rendezService.redeemOffer(offerId, orderId, revenue);

  if (!success) {
    return res.status(404).json({ error: 'Offer not found' });
  }

  logger.info('[Rendez] Offer redeemed', { offerId, orderId, revenue });

  res.json({ success: true });
});

// ── Templates Routes ──────────────────────────────────────────────────────────

/**
 * GET /rendez/templates
 * Get available offer templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  const category = req.query.category as 'couple' | 'group' | 'context' | undefined;

  const templates = rendezService.getTemplates(category);

  res.json({ success: true, templates, category: category || 'all' });
});

/**
 * POST /rendez/templates/:name/instantiate
 * Create an offer from a template
 */
router.post('/templates/:name/instantiate', async (req: Request, res: Response) => {
  const { name } = req.params;
  const { merchantId, validFrom, validUntil, ...customizations } = req.body;

  if (!merchantId) {
    return res.status(400).json({ error: 'merchantId is required' });
  }

  // Find the template
  const templates = rendezService.getTemplates();
  const template = templates.find(
    (t) => t.name.toLowerCase().replace(/\s+/g, '-') === name.toLowerCase() ||
           t.name.toLowerCase() === name.toLowerCase(),
  );

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  // Create offer from template
  const offerData: CreateRendezOfferDTO = {
    merchantId,
    name: `${template.name} - ${new Date().toISOString().split('T')[0]}`,
    category: template.category,
    type: template.type,
    title: customizations.title || template.title,
    description: customizations.description || template.description,
    benefits: template.benefits,
    imageUrls: template.imageUrls,
    ctaText: template.ctaText,
    ctaUrl: template.ctaUrl,
    originalPrice: customizations.originalPrice || template.benefits.bundle?.packagePrice,
    validFrom: validFrom ? new Date(validFrom) : new Date(),
    validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    templateId: name,
    templateName: template.name,
    shareMessage: template.description,
    ...customizations,
  };

  const offer = await rendezService.create(offerData);

  logger.info('[Rendez] Created offer from template', { templateName: template.name, offerId: offer._id });

  res.status(201).json({ success: true, offer, templateName: template.name });
});

// ── Stats Routes ──────────────────────────────────────────────────────────────

/**
 * GET /rendez/stats/:merchantId
 * Get statistics for a merchant's rendez offers
 */
router.get('/stats/:merchantId', async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  if (!mongoose.isValidObjectId(merchantId)) {
    return res.status(400).json({ error: 'Invalid merchantId' });
  }

  const stats = await rendezService.getStats(merchantId);

  res.json({ success: true, stats });
});

/**
 * POST /rendez/cleanup
 * Mark expired offers (admin/cron endpoint)
 */
router.post('/cleanup', async (_req: Request, res: Response) => {
  const count = await rendezService.markExpiredOffers();
  res.json({ success: true, message: `Marked ${count} offers as expired` });
});

// ── Export ─────────────────────────────────────────────────────────────────────

export default router;
