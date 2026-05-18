/**
 * REZ Attribution Server SDK
 *
 * Server-side tracking for Node.js applications.
 * Use this in your backend to send server-side events.
 *
 * @example
 * import { init, track, setUser } from '@rez/server-sdk';
 *
 * init({
 *   AttributionUrl: 'https://api.rez.money/attribution',
 *   IdentityUrl: 'https://identity.rez.money',
 *   metaCAPIUrl: 'https://meta-capi.rez.money',
 * });
 *
 * // Track a purchase
 * track('Purchase', {
 *   orderId: 'order-123',
 *   value: 999,
 *   currency: 'INR',
 *   email: 'user@example.com',
 * });
 */

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServerSDKConfig {
  /** REZ Attribution API URL */
  attributionUrl: string;
  /** REZ Identity Graph URL */
  identityUrl?: string;
  /** Meta CAPI URL */
  metaCAPIUrl?: string;
  /** Merchant ID */
  merchantId?: string;
  /** Store ID */
  storeId?: string;
  /** Debug mode */
  debug?: boolean;
}

export interface ServerEvent {
  eventName: string;
  eventId?: string;
  timestamp?: Date;
  userId?: string;
  sessionId?: string;
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  orderId?: string;
  numItems?: number;
  searchString?: string;
  url?: string;
  userAgent?: string;
  clientIp?: string;
  fbc?: string;
  fbp?: string;
  customData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  externalId?: string;
  clientIp?: string;
  clientUserAgent?: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

let config: ServerSDKConfig | null = null;
let userData: UserData = {};
let defaultSessionId: string = '';

// ─── Utilities ──────────────────────────────────────────────────────────────

function generateEventId(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

function hashString(str: string): string {
  return crypto.createHash('sha256').update(str.toLowerCase().trim()).digest('hex');
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

function log(message: string, data?: unknown): void {
  if (config?.debug) {
    console.log(`[REZ Server SDK] ${message}`, data || '');
  }
}

// ─── SDK Functions ────────────────────────────────────────────────────────

/**
 * Initialize the SDK
 */
export function init(options: ServerSDKConfig): void {
  config = {
    attributionUrl: options.attributionUrl,
    identityUrl: options.identityUrl,
    metaCAPIUrl: options.metaCAPIUrl,
    merchantId: options.merchantId,
    storeId: options.storeId,
    debug: options.debug ?? false,
  };

  defaultSessionId = `sess_${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

  log('SDK initialized', config);
}

/**
 * Set default user data for all events
 */
export function setUser(data: UserData): void {
  userData = { ...userData, ...data };
}

/**
 * Get current user data
 */
export function getUser(): UserData {
  return { ...userData };
}

/**
 * Track a server-side event
 */
export async function track(event: ServerEvent): Promise<void> {
  if (!config) {
    log('SDK not initialized');
    return;
  }

  const eventId = event.eventId || generateEventId();

  // Build payload
  const payload = {
    event: event.eventName,
    eventId,
    timestamp: (event.timestamp || new Date()).toISOString(),
    sessionId: event.sessionId || defaultSessionId,
    userId: event.userId,

    // User data
    email: event.email || userData.email,
    phone: event.phone || userData.phone,
    firstName: event.firstName || userData.firstName,
    lastName: event.lastName || userData.lastName,

    // Event data
    value: event.value,
    currency: event.currency || 'INR',
    contentIds: event.contentIds,
    contents: event.contents,
    orderId: event.orderId,
    numItems: event.numItems,
    searchString: event.searchString,

    // Context
    url: event.url,
    userAgent: event.userAgent || userData.clientUserAgent,
    clientIp: event.clientIp || userData.clientIp,

    // Tracking IDs
    fbc: event.fbc,
    fbp: event.fbp,

    // Config
    merchantId: config.merchantId,
    storeId: config.storeId,

    // Custom data
    customData: event.customData,
    metadata: event.metadata,

    // Source
    source: 'server',
  };

  // Send to Attribution API
  await sendToAttribution(payload);

  // Optionally send to Meta CAPI
  if (config.metaCAPIUrl) {
    await sendToMetaCAPI(payload);
  }

  log('Event tracked', { eventName: event.eventName, eventId });
}

/**
 * Send to REZ Attribution API
 */
async function sendToAttribution(payload: Record<string, unknown>): Promise<void> {
  if (!config?.attributionUrl) return;

  try {
    await fetch(`${config.attributionUrl}/api/track/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    log('Failed to send to attribution', error);
  }
}

/**
 * Send to Meta CAPI
 */
async function sendToMetaCAPI(payload: Record<string, unknown>): Promise<void> {
  if (!config?.metaCAPIUrl) return;

  try {
    // Build CAPI event
    const userData = payload;
    const eventName = payload.event as string;

    // Build user_data for CAPI
    const userDataForCAPI: Record<string, string> = {};

    if (userData.email) {
      userDataForCAPI.em = hashString(userData.email as string);
    }
    if (userData.phone) {
      userDataForCAPI.ph = hashString(normalizePhone(userData.phone as string));
    }
    if (userData.firstName) {
      userDataForCAPI.fn = hashString(userData.firstName as string);
    }
    if (userData.lastName) {
      userDataForCAPI.ln = hashString(userData.lastName as string);
    }
    if (userData.clientIp) {
      userDataForCAPI.client_ip_address = userData.clientIp as string;
    }
    if (userData.clientUserAgent) {
      userDataForCAPI.client_user_agent = userData.clientUserAgent as string;
    }

    // Build custom_data
    const customData: Record<string, unknown> = {};
    if (payload.value) customData.value = payload.value;
    if (payload.currency) customData.currency = payload.currency;
    if (payload.orderId) customData.order_id = payload.orderId;
    if (payload.contentIds) customData.content_ids = payload.contentIds;
    if (payload.contents) customData.contents = payload.contents;

    const capiEvent = {
      event_name: mapToMetaEvent(eventName),
      event_id: payload.eventId,
      event_time: Math.floor(new Date(payload.timestamp as string).getTime() / 1000),
      user_data: userDataForCAPI,
      custom_data: Object.keys(customData).length > 0 ? customData : undefined,
      event_source_url: payload.url,
      action_source: 'website',
    };

    await fetch(`${config.metaCAPIUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capiEvent),
    });
  } catch (error) {
    log('Failed to send to Meta CAPI', error);
  }
}

/**
 * Map to Meta event name
 */
function mapToMetaEvent(eventName: string): string {
  const mapping: Record<string, string> = {
    page_view: 'PageView',
    view_content: 'ViewContent',
    add_to_cart: 'AddToCart',
    initiate_checkout: 'InitiateCheckout',
    add_payment_info: 'AddPaymentInfo',
    purchase: 'Purchase',
    lead: 'Lead',
    complete_registration: 'CompleteRegistration',
  };
  return mapping[eventName.toLowerCase()] || eventName;
}

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Track a purchase (order completed)
 */
export async function trackPurchase(data: {
  orderId: string;
  value: number;
  currency?: string;
  items?: Array<{ id: string; quantity: number; price: number }>;
  email?: string;
  phone?: string;
}): Promise<void> {
  await track({
    eventName: 'Purchase',
    orderId: data.orderId,
    value: data.value,
    currency: data.currency || 'INR',
    contents: data.items?.map(i => ({
      id: i.id,
      quantity: i.quantity,
      item_price: i.price,
    })),
    email: data.email,
    phone: data.phone,
  });
}

/**
 * Track a checkout
 */
export async function trackCheckout(data: {
  value?: number;
  currency?: string;
  items?: Array<{ id: string; quantity: number; price: number }>;
  numItems?: number;
  email?: string;
  phone?: string;
}): Promise<void> {
  await track({
    eventName: 'InitiateCheckout',
    value: data.value,
    currency: data.currency || 'INR',
    contents: data.items?.map(i => ({
      id: i.id,
      quantity: i.quantity,
      item_price: i.price,
    })),
    numItems: data.numItems,
    email: data.email,
    phone: data.phone,
  });
}

/**
 * Track add to cart
 */
export async function trackAddToCart(data: {
  itemId: string;
  itemName?: string;
  price: number;
  quantity: number;
  currency?: string;
  email?: string;
}): Promise<void> {
  await track({
    eventName: 'AddToCart',
    value: data.price * data.quantity,
    currency: data.currency || 'INR',
    contentIds: [data.itemId],
    contents: [{ id: data.itemId, quantity: data.quantity, item_price: data.price }],
    numItems: data.quantity,
    email: data.email,
  });
}

/**
 * Track page view
 */
export async function trackPageView(data: {
  url: string;
  userAgent?: string;
  clientIp?: string;
}): Promise<void> {
  await track({
    eventName: 'PageView',
    url: data.url,
    userAgent: data.userAgent,
    clientIp: data.clientIp,
  });
}

/**
 * Track lead
 */
export async function trackLead(data: {
  email?: string;
  phone?: string;
  source?: string;
}): Promise<void> {
  await track({
    eventName: 'Lead',
    email: data.email,
    phone: data.phone,
    customData: { source: data.source },
  });
}

/**
 * Track registration
 */
export async function trackRegistration(data: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  await track({
    eventName: 'CompleteRegistration',
    email: data.email,
    phone: data.phone,
    firstName: data.firstName,
    lastName: data.lastName,
  });
}

// ─── Export ───────────────────────────────────────────────────────────────

export default {
  init,
  setUser,
  getUser,
  track,
  trackPurchase,
  trackCheckout,
  trackAddToCart,
  trackPageView,
  trackLead,
  trackRegistration,
};
