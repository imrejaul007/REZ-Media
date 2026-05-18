/**
 * Identity Resolution Routes
 *
 * API endpoints for:
 * - Identity resolution
 * - Profile management
 * - Identity linking
 */

import { Router, Request, Response, NextFunction } from 'express';
import { identityResolver } from '../services/identityResolver.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ─── Resolution Routes ─────────────────────────────────────────────────────────

/**
 * POST /api/resolve
 * Resolve identities to a customer profile
 *
 * Body:
 * {
 *   email?: string,
 *   phone?: string,
 *   deviceId?: string,
 *   sessionId?: string,
 *   externalId?: string,
 *   loyaltyId?: string,
 *   qrScanId?: string,
 *   posCustomerId?: string,
 *   clientIp?: string,
 *   userAgent?: string,
 *   fingerprint?: string,
 *   merchantId?: string
 * }
 */
router.post('/api/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await identityResolver.resolve(req.body);

    logger.info('[Identity] Resolution result', {
      found: result.found,
      customerId: result.customerId,
      created: result.created,
      matchedCount: result.matchedIdentities.length,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[Identity] Resolution error', { error });
    next(error);
  }
});

/**
 * POST /api/link
 * Link two identities
 *
 * Body:
 * {
 *   source: { type: 'email' | 'phone' | ..., value: string },
 *   target: { type: 'email' | 'phone' | ..., value: string },
 *   linkType: 'same_session' | 'same_device' | 'explicit_login' | ...,
 *   confidence?: number,
 *   context?: { sessionId?: string, orderId?: string }
 * }
 */
router.post('/api/link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { source, target, linkType, confidence, context } = req.body;

    if (!source?.type || !source?.value || !target?.type || !target?.value) {
      return res.status(400).json({
        success: false,
        error: 'Source and target identities required',
      });
    }

    // Create or find identities
    const sourceIdentity = await identityResolver.resolve({
      [source.type]: source.value,
    });

    const targetIdentity = await identityResolver.resolve({
      [target.type]: target.value,
    });

    if (!sourceIdentity.customerId || !targetIdentity.customerId) {
      return res.status(400).json({
        success: false,
        error: 'Could not resolve identities',
      });
    }

    // Link them
    await identityResolver.linkIdentities(
      sourceIdentity.matchedIdentities[0]?.id,
      targetIdentity.matchedIdentities[0]?.id,
      linkType || 'manual',
      confidence || 1,
      context
    );

    res.json({
      success: true,
      message: 'Identities linked',
    });
  } catch (error) {
    logger.error('[Identity] Link error', { error });
    next(error);
  }
});

// ─── Profile Routes ────────────────────────────────────────────────────────────

/**
 * GET /api/profiles/:id
 * Get customer profile
 */
router.get('/api/profiles/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await identityResolver.getProfile(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error('[Identity] Get profile error', { error });
    next(error);
  }
});

/**
 * PATCH /api/profiles/:id
 * Update profile attributes
 *
 * Body:
 * {
 *   firstName?: string,
 *   lastName?: string,
 *   tags?: string[],
 *   preferredChannel?: 'whatsapp' | 'sms' | 'email' | 'push'
 * }
 */
router.patch('/api/profiles/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, tags, preferredChannel } = req.body;

    await identityResolver.updateProfile(req.params.id, {
      firstName,
      lastName,
      tags,
      preferredChannel,
    });

    res.json({
      success: true,
      message: 'Profile updated',
    });
  } catch (error) {
    logger.error('[Identity] Update profile error', { error });
    next(error);
  }
});

/**
 * POST /api/profiles/merge
 * Merge two profiles
 *
 * Body:
 * {
 *   primaryId: string,
 *   secondaryId: string
 * }
 */
router.post('/api/profiles/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { primaryId, secondaryId } = req.body;

    if (!primaryId || !secondaryId) {
      return res.status(400).json({
        success: false,
        error: 'primaryId and secondaryId required',
      });
    }

    await identityResolver.mergeProfiles(primaryId, secondaryId);

    res.json({
      success: true,
      message: 'Profiles merged',
    });
  } catch (error) {
    logger.error('[Identity] Merge profiles error', { error });
    next(error);
  }
});

// ─── Event Routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/events/identity
 * Process identity event (from SDK or webhooks)
 *
 * Body:
 * {
 *   type: 'page_view' | 'product_view' | 'purchase' | ...,
 *   sessionId: string,
 *   userId?: string,
 *   identities: {
 *     email?: string,
 *     phone?: string,
 *     deviceId?: string,
 *     ...
 *   },
 *   context: {
 *     merchantId?: string,
 *     storeId?: string,
 *     url?: string,
 *     ip?: string,
 *     userAgent?: string
 *   }
 * }
 */
router.post('/api/events/identity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identities, context } = req.body;

    // Resolve identities
    const result = await identityResolver.resolve({
      ...identities,
      merchantId: context?.merchantId,
      storeId: context?.storeId,
      clientIp: context?.ip,
      userAgent: context?.userAgent,
    });

    res.json({
      success: true,
      data: {
        customerId: result.customerId,
        confidence: result.confidence,
        isNew: result.created,
      },
    });
  } catch (error) {
    logger.error('[Identity] Event error', { error });
    next(error);
  }
});

// ─── Shopify Integration ─────────────────────────────────────────────────────────

/**
 * POST /api/shopify/customers
 * Process Shopify customer event
 */
router.post('/api/shopify/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = req.body;
    const eventType = req.headers['x-shopify-topic'] as string;

    logger.info('[Identity] Shopify customer event', { eventType, customerId: customer.id });

    // Resolve Shopify customer
    const result = await identityResolver.resolve({
      email: customer.email,
      phone: customer.phone
        ? customer.phone.replace(/[^0-9]/g, '')
        : undefined,
      externalId: customer.id?.toString(),
      firstName: customer.first_name,
      lastName: customer.last_name,
      merchantId: req.body.merchant_id,
    });

    // Update profile with Shopify data
    if (result.customerId) {
      await identityResolver.updateProfile(result.customerId, {
        firstName: customer.first_name,
        lastName: customer.last_name,
        primaryEmail: customer.email,
      });
    }

    res.json({
      success: true,
      data: {
        customerId: result.customerId,
        created: result.created,
      },
    });
  } catch (error) {
    logger.error('[Identity] Shopify customer error', { error });
    next(error);
  }
});

/**
 * POST /api/shopify/orders
 * Process Shopify order event
 */
router.post('/api/shopify/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = req.body;
    const eventType = req.headers['x-shopify-topic'] as string;

    logger.info('[Identity] Shopify order event', { eventType, orderId: order.id });

    // Get customer from order
    const customer = order.customer || {};

    // Resolve customer identity
    const result = await identityResolver.resolve({
      email: customer.email,
      phone: customer.phone
        ? customer.phone.replace(/[^0-9]/g, '')
        : undefined,
      externalId: customer.id?.toString(),
      merchantId: req.body.merchant_id,
    });

    // If purchase, this creates a strong link
    if (eventType === 'orders/create' && result.customerId) {
      // Link payment method if available
      if (order.payment_details?.credit_card_number) {
        // In production, you'd use a payment token, not actual card number
        logger.debug('[Identity] Purchase event - strong identity link created');
      }
    }

    res.json({
      success: true,
      data: {
        customerId: result.customerId,
        created: result.created,
      },
    });
  } catch (error) {
    logger.error('[Identity] Shopify order error', { error });
    next(error);
  }
});

export default router;
