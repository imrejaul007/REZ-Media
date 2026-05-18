/**
 * REZ Attribution SDK - Browser Pixel
 *
 * Client-side tracking SDK for capturing browser events and sending to:
 * - REZ Attribution Platform
 * - Meta Conversions API (via server)
 * - Google Enhanced Conversions (via server)
 * - TikTok Events API (via server)
 *
 * @example
 * // Initialize
 * import { init, track, setUser } from '@rez/attribution-sdk';
 *
 * init({
 *   pixelId: 'YOUR_PIXEL_ID',
 *   AttributionUrl: 'https://api.rez.money/attribution',
 *   debug: true
 * });
 *
 * // Track events
 * track('PageView', { page: '/home' });
 * track('AddToCart', { item: 'Pizza', value: 299 });
 * track('Purchase', { value: 999, currency: 'INR' });
 *
 * // Set user data for CAPI
 * setUser({ email: 'user@example.com', phone: '+919876543210' });
 */

// ─── Types ────────────────────────────────────────────────────────────────────────

export interface SDKConfig {
  /** Your pixel/SDK identifier */
  pixelId: string;
  /** REZ Attribution API endpoint */
  attributionUrl: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Event deduplication window in ms (default: 5000) */
  deduplicationWindow?: number;
  /** Enable automatic page view tracking */
  autoPageView?: boolean;
  /** Shopify store slug for multi-tenant */
  storeSlug?: string;
  /** Merchant ID */
  merchantId?: string;
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
}

export interface EventData {
  eventName: string;
  eventId?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentType?: string;
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  orderId?: string;
  searchString?: string;
  numItems?: number;
  customData?: Record<string, unknown>;
}

export interface TrackOptions {
  /** Send to third-party pixels (Meta, Google, TikTok) */
  thirdParty?: boolean;
  /** Event deduplication ID */
  eventId?: string;
  /** Override user data for this event */
  userData?: UserData;
  /** Custom timestamp */
  timestamp?: Date;
}

// ─── Standard Events ───────────────────────────────────────────────────────────────

export const StandardEvents = {
  // Page events
  PAGE_VIEW: 'PageView',
  VIEW_CONTENT: 'ViewContent',

  // Ecommerce events (Meta/Google standard)
  SEARCH: 'Search',
  VIEW_CONTENT: 'ViewContent',
  ADD_TO_CART: 'AddToCart',
  ADD_TO_WISHLIST: 'AddToWishlist',
  INITIATE_CHECKOUT: 'InitiateCheckout',
  ADD_PAYMENT_INFO: 'AddPaymentInfo',
  PURCHASE: 'Purchase',

  // Lead events
  LEAD: 'Lead',
  COMPLETE_REGISTRATION: 'CompleteRegistration',

  // Custom events
  CONTACT: 'Contact',
  CUSTOMIZE_PRODUCT: 'CustomizeProduct',
  DONATE: 'Donate',
  FIND_LOCATION: 'FindLocation',
  SCHEDULE: 'Schedule',
  START_TRIAL: 'StartTrial',
  SUBMIT_APPLICATION: 'SubmitApplication',
  SUBSCRIBE: 'Subscribe',

  // App events
  APP_OPEN: 'app_open',
  APP_INSTALL: 'app_install',
  APP_UPDATE: 'app_update',
} as const;

// ─── State ─────────────────────────────────────────────────────────────────────

let config: SDKConfig | null = null;
let userData: UserData = {};
let sessionId: string = '';
let eventQueue: Array<{ event: EventData; options: TrackOptions }> = [];
let isProcessing = false;
let fbPixelLoaded = false;
let gtagLoaded = false;

// ─── Utility Functions ─────────────────────────────────────────────────────────

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionId(): string {
  return `sess_${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function hashEmail(email: string): string {
  return hashString(email.toLowerCase().trim());
}

function hashPhone(phone: string): string {
  // Remove all non-numeric characters except +
  const clean = phone.replace(/[^0-9+]/g, '');
  return hashString(clean);
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    navigator.deviceMemory || 'unknown',
  ];
  return components.join('|');
}

async function getIpAddress(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return null;
  }
}

function getUserAgent(): string {
  return navigator.userAgent;
}

function getReferrer(): string {
  return document.referrer;
}

function getCurrentUrl(): string {
  return window.location.href;
}

function getutmParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const urlParams = new URLSearchParams(window.location.search);

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  for (const key of utmKeys) {
    const value = urlParams.get(key);
    if (value) params[key] = value;
  }

  return params;
}

function isFirstVisit(): boolean {
  return !getCookie('_rez_attrib_session');
}

function isSessionStart(): boolean {
  const lastSession = getCookie('_rez_attrib_session_time');
  if (!lastSession) return true;

  const sessionLength = 30 * 60 * 1000; // 30 minutes
  return Date.now() - parseInt(lastSession) > sessionLength;
}

function log(message: string, data?: unknown): void {
  if (config?.debug) {
    console.log(`[REZ Attribution SDK] ${message}`, data || '');
  }
}

function generateUniqueEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ─── Core SDK Functions ────────────────────────────────────────────────────────

/**
 * Initialize the REZ Attribution SDK
 */
export function init(options: SDKConfig): void {
  config = {
    pixelId: options.pixelId,
    attributionUrl: options.attributionUrl,
    debug: options.debug ?? false,
    deduplicationWindow: options.deduplicationWindow ?? 5000,
    autoPageView: options.autoPageView ?? true,
    storeSlug: options.storeSlug,
    merchantId: options.merchantId,
  };

  // Initialize session
  if (!getCookie('_rez_attrib_session') || isSessionStart()) {
    sessionId = generateSessionId();
    setCookie('_rez_attrib_session', sessionId, 365);
    setCookie('_rez_attrib_session_time', Date.now().toString(), 365);
  } else {
    sessionId = getCookie('_rez_attrib_session') || generateSessionId();
  }

  // Track first visit
  if (isFirstVisit()) {
    trackInternal('first_visit', {}, { thirdParty: false });
    setCookie('_rez_attrib_visited', '1', 365);
  }

  // Auto page view
  if (config.autoPageView) {
    window.addEventListener('load', () => {
      trackInternal(StandardEvents.PAGE_VIEW, {
        url: getCurrentUrl(),
        referrer: getReferrer(),
        utm: getutmParams(),
      });
    });
  }

  // Load Meta Pixel if configured
  loadMetaPixel();

  // Load Google Tag if configured
  loadGoogleTag();

  log('SDK initialized', config);
}

/**
 * Set user data for CAPI matching
 */
export function setUser(data: UserData): void {
  userData = { ...userData, ...data };
  log('User data set', userData);
}

/**
 * Get current user data
 */
export function getUser(): UserData {
  return { ...userData };
}

/**
 * Get current session ID
 */
export function getSessionId(): string {
  return sessionId;
}

/**
 * Track an event
 */
export function track(eventName: string, data?: Record<string, unknown>, options?: TrackOptions): void {
  const eventData: EventData = {
    eventName,
    eventId: options?.eventId || generateEventId(),
    ...data,
  };

  trackInternal(eventData, options);
}

/**
 * Internal track function
 */
async function trackInternal(event: EventData | string, data?: Record<string, unknown>, options?: TrackOptions): Promise<void> {
  if (!config) {
    log('SDK not initialized');
    return;
  }

  const eventData: EventData = typeof event === 'string'
    ? { eventName: event, eventId: generateUniqueEventId() }
    : event;

  const eventId = eventData.eventId || generateUniqueEventId();

  // Check deduplication
  const lastEventKey = `last_event_${eventData.eventName}_${eventId}`;
  if (config.deduplicationWindow) {
    const lastEvent = getCookie(lastEventKey);
    if (lastEvent) {
      log('Event deduplicated', { eventName: eventData.eventName, eventId });
      return;
    }
    setCookie(lastEventKey, '1', Math.ceil(config.deduplicationWindow / 1000 / 24 / 60 / 60));
  }

  // Build event payload
  const payload: Record<string, unknown> = {
    event: eventData.eventName,
    eventId,
    timestamp: (options?.timestamp || new Date()).toISOString(),

    // Context
    url: getCurrentUrl(),
    referrer: getReferrer(),
    userAgent: getUserAgent(),
    sessionId,

    // UTM
    utm: getutmParams(),

    // Device
    fingerprint: await getFingerprint(),

    // Pixel ID
    pixelId: config.pixelId,

    // Multi-tenant
    storeSlug: config.storeSlug,
    merchantId: config.merchantId,

    // User data (for CAPI)
    userData: {
      ...userData,
      ...options?.userData,
    },

    // Event data
    ...eventData,
  };

  // Add custom data
  if (data) {
    payload.customData = data;
  }

  // Send to REZ Attribution
  sendToAttribution(payload);

  // Send to third-party pixels (if enabled)
  if (options?.thirdParty !== false) {
    sendToThirdParty(eventData);
  }

  log('Event tracked', payload);
}

/**
 * Send event to REZ Attribution Platform
 */
async function sendToAttribution(payload: Record<string, unknown>): Promise<void> {
  if (!config) return;

  try {
    await fetch(`${config.attributionUrl}/api/track/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    log('Failed to send to attribution', error);
    // Queue for retry
    queueEvent(payload);
  }
}

/**
 * Queue event for retry
 */
function queueEvent(payload: Record<string, unknown>): void {
  eventQueue.push(payload as { event: EventData; options: TrackOptions });

  // Process queue in background
  if (!isProcessing) {
    processQueue();
  }
}

/**
 * Process queued events
 */
async function processQueue(): Promise<void> {
  if (isProcessing || eventQueue.length === 0) return;

  isProcessing = true;

  while (eventQueue.length > 0) {
    const item = eventQueue.shift();
    if (!item) continue;

    try {
      await fetch(`${config?.attributionUrl}/api/track/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        keepalive: true,
      });
    } catch {
      // Re-queue
      eventQueue.unshift(item);
      break;
    }
  }

  isProcessing = false;
}

/**
 * Send to third-party pixels (Meta, Google, TikTok)
 */
function sendToThirdParty(event: EventData): void {
  // Send to Meta Pixel
  if (typeof window !== 'undefined' && (window as any).fbq) {
    const metaEvent = mapToMetaEvent(event.eventName);
    if (metaEvent) {
      (window as any).fbq('track', metaEvent, {
        content_name: event.contentType,
        content_category: event.contentType,
        content_ids: event.contentIds,
        contents: event.contents,
        value: event.value,
        currency: event.currency || 'INR',
        order_id: event.orderId,
      });
    }
  }

  // Send to Google Analytics 4
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', event.eventName, {
      currency: event.currency || 'INR',
      value: event.value,
      transaction_id: event.orderId,
      items: event.contents?.map(c => ({
        item_id: c.id,
        quantity: c.quantity,
        price: c.item_price,
      })),
    });
  }

  // Send to TikTok Pixel
  if (typeof window !== 'undefined' && (window as any).ttq) {
    const tiktokEvent = mapToTikTokEvent(event.eventName);
    if (tiktokEvent) {
      (window as any).ttq.track(tiktokEvent, {
        content_type: event.contentType,
        content_id: event.contentIds?.[0],
        quantity: event.numItems,
        price: event.value,
        currency: event.currency || 'INR',
      });
    }
  }
}

/**
 * Map event name to Meta Pixel event
 */
function mapToMetaEvent(eventName: string): string | null {
  const mapping: Record<string, string> = {
    [StandardEvents.PAGE_VIEW]: 'PageView',
    [StandardEvents.VIEW_CONTENT]: 'ViewContent',
    [StandardEvents.SEARCH]: 'Search',
    [StandardEvents.ADD_TO_CART]: 'AddToCart',
    [StandardEvents.ADD_TO_WISHLIST]: 'AddToWishlist',
    [StandardEvents.INITIATE_CHECKOUT]: 'InitiateCheckout',
    [StandardEvents.ADD_PAYMENT_INFO]: 'AddPaymentInfo',
    [StandardEvents.PURCHASE]: 'Purchase',
    [StandardEvents.LEAD]: 'Lead',
    [StandardEvents.COMPLETE_REGISTRATION]: 'CompleteRegistration',
  };
  return mapping[eventName] || eventName;
}

/**
 * Map event name to TikTok event
 */
function mapToTikTokEvent(eventName: string): string | null {
  const mapping: Record<string, string> = {
    [StandardEvents.PAGE_VIEW]: 'PageView',
    [StandardEvents.VIEW_CONTENT]: 'ViewContent',
    [StandardEvents.ADD_TO_CART]: 'AddToCart',
    [StandardEvents.INITIATE_CHECKOUT]: 'InitiateCheckout',
    [StandardEvents.PURCHASE]: 'PlaceAnOrder',
    [StandardEvents.LEAD]: 'SubmitForm',
  };
  return mapping[eventName] || eventName;
}

/**
 * Load Meta Pixel
 */
function loadMetaPixel(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).fbq) return;

  const pixelId = config?.pixelId;
  if (!pixelId) return;

  // Create script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';

  // Add pixel initialization
  script.onload = () => {
    (window as any).fbq = (window as any).fbq || function() {
      if ((window as any).fbq.callMethod) {
        (window as any).fbq.callMethod.apply((window as any).fbq, arguments);
      } else {
        (window as any).fbq.push = (window as any).fbq.push || function() {
          return (window as any).fbq.push.apply((window as any).fbq, arguments);
        };
      }
    };

    (window as any).fbq.push = (window as any).fbq.push || (window as any).fbq;
    (window as any).fbq.loaded = true;
    (window as any).fbq.version = '2.0';
    (window as any).fbq.queue = [];

    // Initialize pixel
    (window as any).fbq('init', pixelId);
    (window as any).fbq('track', 'PageView');

    fbPixelLoaded = true;
    log('Meta Pixel loaded', { pixelId });
  };

  document.head.appendChild(script);

  // Also add noscript pixel
  const noscript = document.createElement('noscript');
  noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
  document.head.appendChild(noscript);
}

/**
 * Load Google Tag
 */
function loadGoogleTag(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).gtag) return;

  // Create gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + (config?.pixelId || '');
  document.head.appendChild(script);

  // Initialize gtag
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).gtag = function() {
    (window as any).dataLayer.push(arguments);
  };
  (window as any).gtag('js', new Date());
  (window as any).gtag('config', config?.pixelId || '');

  gtagLoaded = true;
  log('Google Tag loaded');
}

// ─── E-commerce Helper Functions ────────────────────────────────────────────────

/**
 * Track product view
 */
export function trackProductView(product: {
  id: string;
  name: string;
  category?: string;
  price?: number;
  currency?: string;
}): void {
  track(StandardEvents.VIEW_CONTENT, {
    contentIds: [product.id],
    contentType: 'product',
    contents: [{ id: product.id, quantity: 1, item_price: product.price }],
    value: product.price,
    currency: product.currency || 'INR',
    customData: {
      product_name: product.name,
      product_category: product.category,
    },
  });
}

/**
 * Track add to cart
 */
export function trackAddToCart(item: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  currency?: string;
}): void {
  track(StandardEvents.ADD_TO_CART, {
    contentIds: [item.id],
    contentType: 'product',
    contents: [{ id: item.id, quantity: item.quantity, item_price: item.price }],
    value: item.price * item.quantity,
    currency: item.currency || 'INR',
    numItems: item.quantity,
    customData: {
      product_name: item.name,
    },
  });
}

/**
 * Track checkout started
 */
export function trackCheckoutStarted(cart: {
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
  total: number;
  currency?: string;
}): void {
  track(StandardEvents.INITIATE_CHECKOUT, {
    contentIds: cart.items.map(i => i.id),
    contentType: 'product',
    contents: cart.items.map(i => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
    value: cart.total,
    currency: cart.currency || 'INR',
    numItems: cart.items.reduce((sum, i) => sum + i.quantity, 0),
  });
}

/**
 * Track purchase
 */
export function trackPurchase(order: {
  id: string;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
  total: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  currency?: string;
}): void {
  track(StandardEvents.PURCHASE, {
    orderId: order.id,
    contentIds: order.items.map(i => i.id),
    contentType: 'product',
    contents: order.items.map(i => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
    value: order.total,
    currency: order.currency || 'INR',
    numItems: order.items.reduce((sum, i) => sum + i.quantity, 0),
    customData: {
      tax: order.tax,
      shipping: order.shipping,
      discount: order.discount,
    },
  });
}

/**
 * Track search
 */
export function trackSearch(searchString: string): void {
  track(StandardEvents.SEARCH, {
    searchString,
  });
}

// ─── Export ─────────────────────────────────────────────────────────────────────

export default {
  init,
  track,
  setUser,
  getUser,
  getSessionId,

  // E-commerce helpers
  trackProductView,
  trackAddToCart,
  trackCheckoutStarted,
  trackPurchase,
  trackSearch,

  // Standard events
  StandardEvents,
};

export {
  init,
  track,
  setUser,
  getUser,
  getSessionId,
  StandardEvents,
  trackProductView,
  trackAddToCart,
  trackCheckoutStarted,
  trackPurchase,
  trackSearch,
};
