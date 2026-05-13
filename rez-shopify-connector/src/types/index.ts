import { Request } from 'express';

// ── Shopify Types ──────────────────────────────────────────────────────────────

export interface ShopifyOAuthToken {
  access_token: string;
  scope: string;
  expires_in: number;
  expires_at?: number;
  refresh_token?: string;
  associated_user_scope?: string[];
  associated_user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    account_owner: boolean;
    locale: string;
    email_verified: boolean;
  };
}

export interface ShopifyStoreInfo {
  id: number;
  name: string;
  email: string;
  domain: string;
  province: string;
  country: string;
  address1: string;
  zip: string;
  city: string;
  phone: string;
  customer_email: string;
  latitude: number;
  longitude: number;
  primary_locale: string;
  currency: string;
  money_format: string;
  money_with_currency_format: string;
  tax shipping: boolean;
  taxes_included: boolean;
  country_code: string;
  country_name: string;
  timezone: string;
  iana_timezone: string;
  shop_owner: string;
  money_in_emails_format: boolean;
  money_with_currency_in_emails_format: boolean;
  keyword: string;
  send_earliest_reports: boolean;
  google_apps_domain: string;
  google_apps_login_enabled: boolean;
  enable_presentment_currencies: boolean;
  fraud_widget_enabled: boolean;
  multi_location_enabled: boolean;
  additional_locales: string[];
  required_files: string[];
  setup_required: boolean;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string;
  status: 'active' | 'archived' | 'draft';
  published_scope: 'global' | 'web';
  tags: string;
  variants: ShopifyProductVariant[];
  images: ShopifyProductImage[];
  options: ShopifyProductOption[];
  metafields?: ShopifyMetafield[];
}

export interface ShopifyProductVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_policy: 'deny' | 'continue';
  compare_at_price: string;
  fulfillment_service: string;
  inventory_management: string;
  option1: string;
  option2: string;
  option3: string;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string;
  weight: number;
  weight_unit: string;
  inventory_item_id: number;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
  image_id: number | null;
}

export interface ShopifyProductImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  width: number;
  height: number;
  alt: string | null;
}

export interface ShopifyProductOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyMetafield {
  id: number;
  namespace: string;
  key: string;
  value: string;
  value_type: 'string' | 'integer' | 'json_string';
  description: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  owner_resource: string;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  created_at: string;
  updated_at: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  currency: string;
  financial_status: 'pending' | 'authorized' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'voided';
  fulfillment_status: 'fulfilled' | 'partial' | 'unfulfilled' | null;
  customer: ShopifyCustomer | null;
  line_items: ShopifyLineItem[];
  shipping_address: ShopifyAddress | null;
  billing_address: ShopifyAddress | null;
  note: string | null;
  tags: string;
  source_name: string;
  payment_details: ShopifyPaymentDetails | null;
}

export interface ShopifyLineItem {
  id: number;
  variant_id: number | null;
  product_id: number | null;
  title: string;
  variant_title: string;
  sku: string;
  vendor: string;
  price: string;
  quantity: number;
  requires_shipping: boolean;
  taxable: boolean;
  discount_allocations: ShopifyDiscountAllocation[];
  origin_location: ShopifyOriginLocation;
  duties: unknown[];
}

export interface ShopifyDiscountAllocation {
  amount: string;
  discount_application_index: number;
  amount_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  };
}

export interface ShopifyOriginLocation {
  id: number;
  country_code: string;
  province_code: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  zip: string;
}

export interface ShopifyPaymentDetails {
  credit_card_bin: string;
  credit_card_company: string;
  credit_card_number: string;
  cvv_status: string;
  avs_status: string;
  created_at: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  state: 'disabled' | 'decline' | 'invited' | 'enabled' | 'fulfilled' | 'declined';
  total_spent: string;
  last_order_id: number | null;
  note: string | null;
  verified_email: boolean;
  multipass_identifier: string | null;
  tax_exempt: boolean;
  tags: string;
  last_order_name: string | null;
  default_address: ShopifyAddress | null;
  addresses: ShopifyAddress[];
  accept_language: string | null;
  currency: string;
}

export interface ShopifyAddress {
  id: number;
  customer_id: number;
  first_name: string;
  last_name: string;
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string | null;
  name: string;
  province_code: string;
  country_code: string;
  country_name: string;
  default: boolean;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

export interface ShopifyLocation {
  id: number;
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  zip: string;
  province: string;
  country: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  country_code: string;
  province_code: string;
}

export interface ShopifyWebhookEvent {
  id: number;
  order_id?: number;
  product_id?: number;
  customer_id?: number;
  variant_id?: number;
  inventory_item_id?: number;
  location_id?: number;
  address_id?: number;
}

// ── Store Document ─────────────────────────────────────────────────────────────

export interface ConnectedStore {
  shopifyDomain: string;
  shopifyStoreId: number;
  accessToken: string;
  scope: string;
  scopeVersion: number;
  isActive: boolean;
  storeInfo?: ShopifyStoreInfo;
  lastSyncAt?: Date;
  syncStatus: SyncStatus;
  webhookIds: {
    ordersCreate?: number;
    ordersUpdated?: number;
    productsCreate?: number;
    productsUpdate?: number;
    productsDelete?: number;
    customersCreate?: number;
    customersUpdate?: number;
    inventoryLevelsUpdate?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncStatus {
  products: {
    lastSyncAt?: Date;
    lastSyncId?: string;
    status: 'idle' | 'syncing' | 'completed' | 'failed';
    error?: string;
    itemsSynced: number;
  };
  orders: {
    lastSyncAt?: Date;
    lastSyncId?: string;
    status: 'idle' | 'syncing' | 'completed' | 'failed';
    error?: string;
    itemsSynced: number;
  };
  customers: {
    lastSyncAt?: Date;
    lastSyncId?: string;
    status: 'idle' | 'syncing' | 'completed' | 'failed';
    error?: string;
    itemsSynced: number;
  };
  inventory: {
    lastSyncAt?: Date;
    lastSyncId?: string;
    status: 'idle' | 'syncing' | 'completed' | 'failed';
    error?: string;
    itemsSynced: number;
  };
}

export type SyncEntity = 'products' | 'orders' | 'customers' | 'inventory';

export interface SyncJob {
  id: string;
  storeId: string;
  entity: SyncEntity;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  itemsProcessed: number;
  cursor?: string;
}

// ── API Request/Response Types ─────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

export interface ShopifyApiError {
  errors: {
    message: string;
    locations?: { line: number; column: number }[];
    path?: string[];
    extensions?: Record<string, unknown>;
  } | string;
  status?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ── Webhook Payload Types ─────────────────────────────────────────────────────

export type WebhookTopic =
  | 'orders/create'
  | 'orders/updated'
  | 'orders/deleted'
  | 'orders/fulfilled'
  | 'orders/partially_fulfilled'
  | 'orders/cancelled'
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'customers/create'
  | 'customers/update'
  | 'customers/delete'
  | 'inventory_levels/update';

export interface WebhookPayload {
  topic: WebhookTopic;
  shop: string;
  payload: unknown;
  timestamp: string;
}

// ── Express Extended Request ──────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  storeId?: string;
  storeDomain?: string;
  isInternal?: boolean;
}

// ── Configuration Types ────────────────────────────────────────────────────────

export interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  scopes: string[];
  redirectUri: string;
}

export interface ServiceEndpoints {
  catalogService: string;
  orderService: string;
  identityService: string;
  inventoryService: string;
}
