/**
 * Meta Conversions API Types
 *
 * Types for Meta CAPI integration
 */

// ─── User Data Types ──────────────────────────────────────────────────────────────

/** User data for sending to Meta (hashed) */
export interface HashedUserData {
  /** Hashed email (SHA-256) */
  em?: string;
  /** Hashed phone (SHA-256) */
  ph?: string;
  /** Hashed first name */
  fn?: string;
  /** Hashed last name */
  ln?: string;
  /** Date of birth (YYYYMMDD) */
  dob?: string;
  /** City */
  ct?: string;
  /** State */
  st?: string;
  /** Zip/Postal code */
  zp?: string;
  /** Country (2-letter ISO) */
  country?: string;
  /** External ID (e.g., CRM ID) */
  external_id?: string;
  /** Client IP address (for server-side) */
  client_ip_address?: string;
  /** Client user agent (for server-side) */
  client_user_agent?: string;
  /** Facebook click ID (fbc) */
  fbc?: string;
  /** Facebook browser ID (fbp) */
  fbp?: string;
}

/** User data for input (plaintext - will be hashed) */
export interface UserData {
  /** Email (plaintext - will be hashed) */
  email?: string;
  /** Phone (plaintext - will be hashed and normalized) */
  phone?: string;
  /** First name (plaintext - will be hashed) */
  firstName?: string;
  /** Last name (plaintext - will be hashed) */
  lastName?: string;
  /** Date of birth (YYYYMMDD) */
  dob?: string;
  /** City */
  city?: string;
  /** State */
  state?: string;
  /** Zip/Postal code */
  zip?: string;
  /** Country (2-letter ISO) */
  country?: string;
  /** External ID (e.g., CRM ID) */
  external_id?: string;
  /** Client IP address (for server-side) */
  client_ip_address?: string;
  /** Client user agent (for server-side) */
  client_user_agent?: string;
  /** Facebook click ID (fbc) */
  fbc?: string;
  /** Facebook browser ID (fbp) */
  fbp?: string;
}

// ─── Event Types ─────────────────────────────────────────────────────────────────

export interface CAPIEvent {
  /** Event name (e.g., 'Purchase', 'AddToCart') */
  event_name: string;
  /** ISO 8601 timestamp */
  event_time: number;
  /** Optional event ID for deduplication */
  event_id?: string;
  /** User data */
  user_data: UserData;
  /** Custom data */
  custom_data?: CustomData;
  /** Event source URL */
  event_source_url?: string;
  /** Action source (where the event happened) */
  action_source: ActionSource;
  /** Data processing options */
  data_processing_options?: string[];
  /** Data processing country */
  data_processing_options_country?: number;
  /** Data processing state */
  data_processing_options_state?: number;
}

export interface CustomData {
  /** Order ID or cart ID */
  order_id?: string;
  /** Transaction/order total value */
  value?: number;
  /** Currency (ISO 4217, e.g., 'INR', 'USD') */
  currency?: string;
  /** Number of items */
  num_items?: number;
  /** Search string */
  search_string?: string;
  /** Content IDs */
  content_ids?: string[];
  /** Content type (e.g., 'product', 'product_group') */
  content_type?: string;
  /** Array of contents */
  contents?: Content[];
  /** Status (e.g., 'completed', 'failed') */
  status?: string;
}

export interface Content {
  id: string;
  quantity: number;
  item_price?: number;
}

// ─── Action Source ────────────────────────────────────────────────────────────────

export type ActionSource =
  | 'website'
  | 'app'
  | 'phone_call'
  | 'chat'
  | 'email'
  | 'physical_store'
  | 'system_generated'
  | 'other';

// ─── API Request/Response ────────────────────────────────────────────────────────

export interface CAPIBatchRequest {
  /** Array of events to send */
  data: CAPIEvent[];
  /** Test event code for testing */
  test_event_code?: string;
}

export interface CAPIBatchResponse {
  /** Whether the request was successful */
  success: boolean;
  /** Events received */
  events_received?: number;
  /** Messages from API */
  messages?: Array<{
    message: string;
    code?: number;
    type?: 'error' | 'warning';
    event_ids?: string[];
  }>;
  /** Batch limit info */
  batch_limit?: number;
  /** Daily limit info */
  daily_limit?: number;
}

// ─── Meta Standard Events ──────────────────────────────────────────────────────────

export const MetaStandardEvents = {
  // Page/Content
  PAGE_VIEW: 'PageView',
  VIEW_CONTENT: 'ViewContent',
  SEARCH: 'Search',

  // Ecommerce
  ADD_TO_CART: 'AddToCart',
  ADD_TO_WISHLIST: 'AddToWishlist',
  INITIATE_CHECKOUT: 'InitiateCheckout',
  ADD_PAYMENT_INFO: 'AddPaymentInfo',
  PURCHASE: 'Purchase',

  // Lead/Registration
  LEAD: 'Lead',
  COMPLETE_REGISTRATION: 'CompleteRegistration',

  // Custom
  CONTACT: 'Contact',
  CUSTOMIZE_PRODUCT: 'CustomizeProduct',
  DONATE: 'Donate',
  FIND_LOCATION: 'FindLocation',
  SCHEDULE: 'Schedule',
  START_TRIAL: 'StartTrial',
  SUBMIT_APPLICATION: 'SubmitApplication',
  SUBSCRIBE: 'Subscribe',

  // App
  APP_OPEN: 'app_open',
  APP_INSTALL: 'app_install',
  APP_UPDATE: 'app_update',
} as const;

export type MetaStandardEvent = typeof MetaStandardEvents[keyof typeof MetaStandardEvents];

// ─── Shopify to Meta Event Mapping ──────────────────────────────────────────────

export const ShopifyToMetaEvents: Record<string, string> = {
  'checkout_started': 'InitiateCheckout',
  'checkout_completed': 'Purchase',
  'add_to_cart': 'AddToCart',
  'remove_from_cart': 'RemoveFromCart',
  'viewed_product': 'ViewContent',
  'search': 'Search',
  'contact': 'Contact',
  'newsletter_subscribed': 'Lead',
  'account_created': 'CompleteRegistration',
};

// ─── Configuration Types ────────────────────────────────────────────────────────

export interface MerchantCAPIConfig {
  merchantId: string;
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  enabled: boolean;
}

export interface CAPIServiceConfig {
  accessToken: string;
  pixelId: string;
  testMode: boolean;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimit: {
    requestsPerSecond: number;
    dailyLimit: number;
  };
}
