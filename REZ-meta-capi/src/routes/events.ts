/**
 * Meta CAPI Events Routes
 *
 * Receives events from:
 * - Browser SDK
 * - Server SDK
 * - Shopify webhooks
 * - Other services
 *
 * Forwards to Meta Conversions API
 */

import { Router, Request, Response, NextFunction } from 'express';
import metaCAPI, { buildCAPIEvent } from '../services/metaCAPI.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ─── Event Ingestion ────────────────────────────────────────────────────────────

/**
 * POST /api/events
 * Receive and forward events to Meta CAPI
 *
 * Body:
 * {
 *   eventName: string,
 *   eventId?: string,
 *   email?: string,
 *   phone?: string,
 *   firstName?: string,
 *   lastName?: string,
 *   value?: number,
 *   currency?: string,
 *   contentIds?: string[],
 *   contents?: { id, quantity, item_price }[],
 *   orderId?: string,
 *   url?: string,
 *   userAgent?: string,
 *   ip?: string,
 *   fbc?: string,
 *   fbp?: string
 * }
 */
router.post('/api/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      eventName,
      eventId,
      email,
      phone,
      firstName,
      lastName,
      value,
      currency,
      contentIds,
      contents,
      orderId,
      numItems,
      searchString,
      url,
      userAgent,
      ip,
      fbc,
      fbp,
      testEvent,
    } = req.body;

    // Validate required fields
    if (!eventName) {
      return res.status(400).json({
        success: false,
        error: 'eventName is required',
      });
    }

    logger.info('[Meta CAPI] Event received', {
      eventName,
      eventId,
      hasEmail: !!email,
      hasPhone: !!phone,
    });

    // Build CAPI event
    const event = buildCAPIEvent({
      eventName,
      eventId,
      email,
      phone,
      firstName,
      lastName,
      clientIp: ip || req.ip,
      clientUserAgent: userAgent || req.headers['user-agent'],
      fbc,
      fbp,
      url,
      value,
      currency,
      contentIds,
      contents,
      orderId,
      numItems,
      searchString,
    });

    // Send to Meta CAPI
    const result = await metaCAPI.sendEvent(event);

    if (result.success) {
      res.json({
        success: true,
        eventsReceived: result.events_received,
        message: 'Event sent to Meta',
      });
    } else {
      // Still return 200 to not block the caller
      res.json({
        success: false,
        error: 'Failed to send to Meta',
        messages: result.messages,
      });
    }
  } catch (error) {
    logger.error('[Meta CAPI] Error processing event', { error });
    next(error);
  }
});

/**
 * POST /api/events/batch
 * Receive batch of events
 *
 * Body:
 * {
 *   events: [
 *     { eventName, ...other fields }
 *   ]
 * }
 */
router.post('/api/events/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'events array is required',
      });
    }

    logger.info('[Meta CAPI] Batch received', { count: events.length });

    // Build CAPI events
    const capiEvents = events.map((e) =>
      buildCAPIEvent({
        eventName: e.eventName,
        eventId: e.eventId,
        email: e.email,
        phone: e.phone,
        firstName: e.firstName,
        lastName: e.lastName,
        clientIp: e.ip || req.ip,
        clientUserAgent: e.userAgent || req.headers['user-agent'],
        fbc: e.fbc,
        fbp: e.fbp,
        url: e.url,
        value: e.value,
        currency: e.currency,
        contentIds: e.contentIds,
        contents: e.contents,
        orderId: e.orderId,
        numItems: e.numItems,
        searchString: e.searchString,
      })
    );

    // Send batch to Meta CAPI
    const result = await metaCAPI.sendEvents(capiEvents);

    res.json({
      success: result.success,
      eventsReceived: result.events_received,
      messages: result.messages,
    });
  } catch (error) {
    logger.error('[Meta CAPI] Error processing batch', { error });
    next(error);
  }
});

// ─── Shopify Integration ────────────────────────────────────────────────────────────

/**
 * POST /api/shopify/events
 * Receive events from Shopify webhook
 *
 * Handles:
 * - orders/create
 * - orders/updated
 * - checkout_completed
 */
router.post('/api/shopify/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event } = req.body;

    // Extract Shopify event type from headers
    const shopifyEvent = req.headers['x-shopify-topic'] as string;

    logger.info('[Meta CAPI] Shopify event received', { shopifyEvent, event });

    // Map Shopify event to Meta event
    const metaEventName = mapShopifyToMeta(shopifyEvent, event);

    if (!metaEventName) {
      return res.json({ success: true, message: 'Event not mapped' });
    }

    // Extract customer data
    const customer = event.customer || {};
    const email = customer.email;
    const phone = customer.phone;

    // Extract order data
    const totalPrice = parseFloat(event.total_price || '0');
    const currency = event.currency || 'INR';
    const orderId = event.id?.toString();
    const lineItems = event.line_items || [];

    // Build contents array
    const contents = lineItems.map((item: any) => ({
      id: item.product_id?.toString() || item.sku,
      quantity: item.quantity,
      item_price: parseFloat(item.price),
    }));

    const contentIds = contents.map((c: any) => c.id);

    // Build and send event
    const eventData = buildCAPIEvent({
      eventName: metaEventName,
      eventId: `shopify_${orderId}_${Date.now()}`,
      email,
      phone,
      firstName: customer.first_name,
      lastName: customer.last_name,
      clientIp: req.ip,
      clientUserAgent: req.headers['user-agent'],
      url: event.order_status_url,
      value: totalPrice,
      currency,
      contentIds,
      contents,
      orderId,
      numItems: lineItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
      actionSource: 'other',
    });

    const result = await metaCAPI.sendEvent(eventData);

    res.json({
      success: result.success,
      eventsReceived: result.events_received,
    });
  } catch (error) {
    logger.error('[Meta CAPI] Shopify event error', { error });
    next(error);
  }
});

/**
 * Map Shopify event type to Meta event
 */
function mapShopifyToMeta(shopifyEvent: string, event: any): string | null {
  const eventMap: Record<string, string> = {
    'orders/create': 'Purchase',
    'orders/updated': 'Purchase',
    'checkouts/create': 'InitiateCheckout',
    'checkouts/update': 'InitiateCheckout',
    'carts/create': 'AddToCart',
    'carts/update': 'AddToCart',
    'products/create': 'ViewContent',
    'products/update': 'ViewContent',
    'customers/create': 'CompleteRegistration',
    'customers/update': 'Lead',
  };

  return eventMap[shopifyEvent] || null;
}

// ─── Browser SDK Events ──────────────────────────────────────────────────────────

/**
 * POST /api/sdk/events
 * Receive events from REZ Attribution SDK
 *
 * Body: Same as /api/events but from SDK
 */
router.post('/api/sdk/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event, pixelId, userData, customData } = req.body;

    if (!event || !pixelId) {
      return res.status(400).json({
        success: false,
        error: 'event and pixelId are required',
      });
    }

    logger.info('[Meta CAPI] SDK event received', {
      event: event.eventName,
      pixelId,
    });

    // Build CAPI event from SDK format
    const eventData = buildCAPIEvent({
      eventName: event.eventName,
      eventId: event.eventId,
      email: userData?.email,
      phone: userData?.phone,
      firstName: userData?.firstName,
      lastName: userData?.lastName,
      clientIp: event.clientIp || req.ip,
      clientUserAgent: event.clientUserAgent || req.headers['user-agent'],
      fbc: userData?.fbc,
      fbp: userData?.fbp,
      url: event.url,
      value: customData?.value,
      currency: customData?.currency,
      contentIds: customData?.contentIds,
      contents: customData?.contents,
      orderId: customData?.orderId,
      numItems: customData?.numItems,
      searchString: customData?.searchString,
    });

    // Send to Meta CAPI
    const result = await metaCAPI.sendEvent(eventData);

    res.json({
      success: result.success,
      eventsReceived: result.events_received,
    });
  } catch (error) {
    logger.error('[Meta CAPI] SDK event error', { error });
    next(error);
  }
});

// ─── Test Endpoint ────────────────────────────────────────────────────────────────

/**
 * POST /api/test/event
 * Send a test event to Meta CAPI (development only)
 */
router.post('/api/test/event', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Test endpoint not available in production',
    });
  }

  const testEvent = buildCAPIEvent({
    eventName: 'TestEvent',
    eventId: `test_${Date.now()}`,
    email: 'test@example.com',
    phone: '+919876543210',
    firstName: 'Test',
    lastName: 'User',
    value: 99.99,
    currency: 'INR',
    actionSource: 'website',
  });

  const result = await metaCAPI.sendEvent(testEvent);

  res.json({
    success: result.success,
    eventsReceived: result.events_received,
    messages: result.messages,
  });
});

export default router;
