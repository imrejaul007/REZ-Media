/**
 * Type Definitions for WooCommerce Connector
 */

// ============================================
// WooCommerce API Types
// ============================================

export interface WooCommerceCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface WooCommerceStoreInfo {
  siteTitle: string;
  siteUrl: string;
  version: string;
  storeLogo: string | null;
  timezone: string;
  currency: string;
  currencyPos: string;
  weightUnit: string;
  dimensionUnit: string;
}

export interface WooCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  created_at: string;
  billing: WooCustomerAddress;
  shipping: WooCustomerAddress;
}

export interface WooCustomerAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  type: 'simple' | 'grouped' | 'external' | 'variable';
  status: 'draft' | 'pending' | 'private' | 'publish';
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  stock_quantity: number | null;
  manage_stock: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  images: WooProductImage[];
  categories: WooProductCategory[];
  tags: WooProductTag[];
  attributes: WooProductAttribute[];
  variations: number[];
  related_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface WooProductImage {
  id: number;
  src: string;
  name: string;
  alt: string;
}

export interface WooProductCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WooProductTag {
  id: number;
  name: string;
  slug: string;
}

export interface WooProductAttribute {
  id: number;
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

export interface WooOrder {
  id: number;
  number: string;
  status: WooOrderStatus;
  currency: string;
  prices_include_tax: boolean;
  total: string;
  subtotal: string;
  total_tax: string;
  customer_id: number;
  billing: WooCustomerAddress;
  shipping: WooCustomerAddress;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  line_items: WooLineItem[];
  shipping_lines: WooShippingLine[];
  fee_lines: WooFeeLine[];
  tax_lines: WooTaxLine[];
  coupon_lines: WooCouponLine[];
  created_at: string;
  updated_at: string;
}

export type WooOrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';

export interface WooLineItem {
  id: number;
  name: string;
  sku: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  price: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
}

export interface WooShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  total: string;
}

export interface WooFeeLine {
  id: number;
  name: string;
  tax_class: string;
  tax_status: string;
  total: string;
}

export interface WooTaxLine {
  id: number;
  rate_code: string;
  rate_id: number;
  label: string;
  compound: boolean;
  tax_total: string;
  shipping_tax_total: string;
}

export interface WooCouponLine {
  id: number;
  code: string;
  discount: string;
  discount_tax: string;
}

// ============================================
// Webhook Types
// ============================================

export interface WooWebhookPayload {
  id: number;
  action: string;
  resource: string;
  resource_id: number;
  timestamp: number;
  data: Record<string, unknown>;
}

// Alias for backward compatibility
export type WebhookPayload = WooWebhookPayload;

export type WebhookEvent =
  | 'coupon.created'
  | 'coupon.updated'
  | 'coupon.deleted'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'order.created'
  | 'order.updated'
  | 'order.deleted'
  | 'order.restored'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'product.restored';

// ============================================
// Internal ReZ Platform Types
// ============================================

export interface ReZCustomer {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  addresses: {
    billing: ReZAddress | null | undefined;
    shipping: ReZAddress | null | undefined;
  };
  metadata: {
    source: 'woocommerce';
    wooCustomerId: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ReZAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ReZProduct {
  externalId: string;
  name: string;
  description: string;
  sku: string;
  price: {
    amount: number;
    currency: string;
  };
  inventory: {
    quantity: number;
    status: 'in_stock' | 'out_of_stock' | 'on_backorder';
  };
  images: { url: string; alt: string }[];
  categories: string[];
  attributes: Record<string, string>;
  metadata: {
    source: 'woocommerce';
    wooProductId: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ReZOrder {
  externalId: string;
  orderNumber: string;
  status: ReZOrderStatus;
  customer: {
    externalId: string;
    email: string;
  };
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
    currency: string;
  };
  items: ReZOrderItem[];
  shippingAddress?: ReZAddress;
  billingAddress?: ReZAddress;
  payment: {
    method: string;
    methodTitle: string;
    transactionId?: string;
  };
  metadata: {
    source: 'woocommerce';
    wooOrderId: number;
    createdAt: string;
    updatedAt: string;
  };
}

export type ReZOrderStatus =
  | 'pending'
  | 'processing'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';

export interface ReZOrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

// ============================================
// Store Model Types
// ============================================

export interface IConnectedStore {
  _id: string;
  storeUrl: string;
  storeName: string;
  consumerKey: string;
  consumerSecret: string; // Encrypted
  storeInfo?: WooCommerceStoreInfo;
  webhookId?: number;
  isActive: boolean;
  lastSyncAt?: Date;
  syncStatus: SyncStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncStatus {
  products: EntitySyncStatus;
  orders: EntitySyncStatus;
  customers: EntitySyncStatus;
}

export interface EntitySyncStatus {
  lastSyncAt?: Date;
  lastSyncId?: number;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  error?: string;
  itemsSynced: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface ConnectStoreRequest {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface ConnectStoreResponse {
  success: boolean;
  store: {
    id: string;
    storeUrl: string;
    storeName: string;
    isActive: boolean;
  };
  message?: string;
}

export interface WebhookResponse {
  received: boolean;
  processed: boolean;
  event?: string;
  resourceId?: number;
  error?: string;
}

export interface SyncStatusResponse {
  storeId: string;
  storeUrl: string;
  isActive: boolean;
  lastSyncAt?: string;
  syncStatus: SyncStatus;
}

export interface ManualSyncRequest {
  storeId: string;
  entityType?: 'products' | 'orders' | 'customers' | 'all';
}

// ============================================
// Pagination Types
// ============================================

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// ============================================
// Error Types
// ============================================

export class WooCommerceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'WooCommerceError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}
