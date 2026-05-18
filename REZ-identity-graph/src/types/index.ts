/**
 * Identity Resolution Graph Types
 *
 * Core types for identity resolution and customer graph
 */

// ─── Identity Types ────────────────────────────────────────────────────────────────

export interface IdentityNode {
  /** Unique identifier */
  id: string;
  /** Type of identity */
  type: IdentityType;
  /** Value (hashed for PII) */
  value: string;
  /** When this identity was first seen */
  firstSeen: Date;
  /** When this identity was last seen */
  lastSeen: Date;
  /** Confidence score (0-1) */
  confidence: number;
  /** Verification status */
  verified: boolean;
  /** Merchant/tenant ID */
  merchantId?: string;
  /** Store ID */
  storeId?: string;
}

export type IdentityType =
  | 'email'
  | 'phone'
  | 'device_id'
  | 'session_id'
  | 'cookie_id'
  | 'external_id'
  | 'loyalty_id'
  | 'qr_scan_id'
  | 'pos_customer_id'
  | 'whatsapp_id'
  | 'user_agent'
  | 'ip_address';

export interface IdentityEdge {
  /** Edge ID */
  id: string;
  /** Source identity ID */
  sourceId: string;
  /** Target identity ID */
  targetId: string;
  /** How these identities are linked */
  linkType: LinkType;
  /** Confidence in the link (0-1) */
  confidence: number;
  /** When the link was created */
  createdAt: Date;
  /** Context of the link */
  context?: LinkContext;
}

export type LinkType =
  | 'same_session'
  | 'same_device'
  | 'same_ip'
  | 'same_location'
  | 'explicit_login'
  | 'checkout'
  | 'loyalty_program'
  | 'qr_scan'
  | 'pos_purchase'
  | 'manual_merge'
  | 'probabilistic';

export interface LinkContext {
  /** Session ID where link was created */
  sessionId?: string;
  /** Order ID if linked via purchase */
  orderId?: string;
  /** Event type that created the link */
  eventType?: string;
  /** Timestamp of the linking event */
  eventTimestamp?: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─── Customer Profile ──────────────────────────────────────────────────────────────

export interface CustomerProfile {
  /** Primary customer ID (master identity) */
  id: string;
  /** All linked identities */
  identities: IdentityNode[];
  /** Computed attributes */
  attributes: CustomerAttributes;
  /** Source systems where this customer exists */
  sources: CustomerSource[];
  /** Lifetime value */
  lifetime: CustomerLifetime;
  /** Last updated */
  updatedAt: Date;
  /** Created at */
  createdAt: Date;
}

export interface CustomerAttributes {
  /** First name (if known) */
  firstName?: string;
  /** Last name (if known) */
  lastName?: string;
  /** Full name */
  fullName?: string;
  /** Primary email (lowest entropy, most reliable) */
  primaryEmail?: string;
  /** Primary phone (hashed) */
  primaryPhone?: string;
  /** Device fingerprints */
  devices: string[];
  /** Location hints */
  locations: string[];
  /** Preferred language */
  language?: string;
  /** Preferred channel */
  preferredChannel?: 'whatsapp' | 'sms' | 'email' | 'push';
  /** Tags assigned to customer */
  tags: string[];
}

export interface CustomerSource {
  /** Source system */
  system: 'rez_now' | 'shopify' | 'woocommerce' | 'pos' | 'loyalty' | 'qr' | 'manual';
  /** Customer ID in that system */
  externalId: string;
  /** When first synced */
  firstSynced: Date;
  /** When last synced */
  lastSynced: Date;
}

export interface CustomerLifetime {
  /** Total orders across all sources */
  totalOrders: number;
  /** Total spend across all sources */
  totalSpend: number;
  /** Average order value */
  averageOrderValue: number;
  /** First order date */
  firstOrderDate?: Date;
  /** Last order date */
  lastOrderDate?: Date;
  /** Customer tenure in days */
  tenureDays: number;
}

// ─── Identity Resolution ─────────────────────────────────────────────────────────────

export interface ResolutionRequest {
  /** Email to resolve */
  email?: string;
  /** Phone to resolve (will be hashed) */
  phone?: string;
  /** Device ID */
  deviceId?: string;
  /** Session ID */
  sessionId?: string;
  /** External ID (CRM, etc) */
  externalId?: string;
  /** Loyalty ID */
  loyaltyId?: string;
  /** QR scan ID */
  qrScanId?: string;
  /** POS customer ID */
  posCustomerId?: string;
  /** Client IP */
  clientIp?: string;
  /** User agent */
  userAgent?: string;
  /** Device fingerprint */
  fingerprint?: string;
  /** Merchant ID */
  merchantId?: string;
  /** Store ID */
  storeId?: string;
}

export interface ResolutionResult {
  /** Whether a customer was found */
  found: boolean;
  /** Customer ID if found */
  customerId?: string;
  /** All matching identities */
  matchedIdentities: IdentityNode[];
  /** Links found */
  links: IdentityEdge[];
  /** Newly created profile (if first time) */
  created?: boolean;
  /** Confidence score (0-1) */
  confidence: number;
}

// ─── Event Types ─────────────────────────────────────────────────────────────────

export interface IdentityEvent {
  /** Event type */
  type: IdentityEventType;
  /** Session ID */
  sessionId: string;
  /** User ID (if logged in) */
  userId?: string;
  /** Timestamp */
  timestamp: Date;
  /** Identities in this event */
  identities: Partial<Record<IdentityType, string>>;
  /** Context */
  context: {
    merchantId?: string;
    storeId?: string;
    url?: string;
    ip?: string;
    userAgent?: string;
    eventType?: string;
    orderId?: string;
  };
  /** Device fingerprint */
  fingerprint?: string;
}

export type IdentityEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'purchase'
  | 'login'
  | 'signup'
  | 'qr_scan'
  | 'pos_purchase'
  | 'loyalty_signup'
  | 'whatsapp_optin';

// ─── API Types ──────────────────────────────────────────────────────────────────

export interface LinkIdentitiesRequest {
  /** Source identity */
  source: {
    type: IdentityType;
    value: string;
  };
  /** Target identity */
  target: {
    type: IdentityType;
    value: string;
  };
  /** How they're linked */
  linkType: LinkType;
  /** Link confidence (0-1) */
  confidence: number;
  /** Context of the link */
  context?: LinkContext;
  /** Merchant ID */
  merchantId?: string;
}

export interface MergeProfilesRequest {
  /** Primary profile ID (survivor) */
  primaryProfileId: string;
  /** Secondary profile ID (to merge) */
  secondaryProfileId: string;
  /** Reason for merge */
  reason: string;
}
