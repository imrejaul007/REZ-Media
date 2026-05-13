import mongoose, { Schema, Document } from 'mongoose';
import type {
  ConnectedStore,
  SyncStatus,
  ShopifyStoreInfo,
  WebhookTopic,
} from '../types';

export interface IStoreDocument extends Omit<ConnectedStore, 'webhookIds'>, Document {
  _id: mongoose.Types.ObjectId;
  webhookIds: Map<string, number>;
}

const WebhookIdsSchema = new Schema(
  {
    ordersCreate: Number,
    ordersUpdated: Number,
    productsCreate: Number,
    productsUpdate: Number,
    productsDelete: Number,
    customersCreate: Number,
    customersUpdate: Number,
    inventoryLevelsUpdate: Number,
  },
  { _id: false }
);

const SyncStatusSchema = new Schema(
  {
    products: {
      lastSyncAt: Date,
      lastSyncId: String,
      status: { type: String, enum: ['idle', 'syncing', 'completed', 'failed'], default: 'idle' },
      error: String,
      itemsSynced: { type: Number, default: 0 },
    },
    orders: {
      lastSyncAt: Date,
      lastSyncId: String,
      status: { type: String, enum: ['idle', 'syncing', 'completed', 'failed'], default: 'idle' },
      error: String,
      itemsSynced: { type: Number, default: 0 },
    },
    customers: {
      lastSyncAt: Date,
      lastSyncId: String,
      status: { type: String, enum: ['idle', 'syncing', 'completed', 'failed'], default: 'idle' },
      error: String,
      itemsSynced: { type: Number, default: 0 },
    },
    inventory: {
      lastSyncAt: Date,
      lastSyncId: String,
      status: { type: String, enum: ['idle', 'syncing', 'completed', 'failed'], default: 'idle' },
      error: String,
      itemsSynced: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const StoreInfoSchema = new Schema(
  {
    id: Number,
    name: String,
    email: String,
    domain: String,
    province: String,
    country: String,
    address1: String,
    zip: String,
    city: String,
    phone: String,
    customer_email: String,
    latitude: Number,
    longitude: Number,
    primary_locale: String,
    currency: String,
    money_format: String,
    shop_owner: String,
    timezone: String,
    country_code: String,
    country_name: String,
  },
  { _id: false }
);

const StoreSchema = new Schema<IStoreDocument>(
  {
    shopifyDomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    shopifyStoreId: {
      type: Number,
      required: true,
      unique: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    scope: {
      type: String,
      required: true,
    },
    scopeVersion: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    storeInfo: StoreInfoSchema,
    lastSyncAt: Date,
    syncStatus: {
      type: SyncStatusSchema,
      default: () => ({
        products: { status: 'idle', itemsSynced: 0 },
        orders: { status: 'idle', itemsSynced: 0 },
        customers: { status: 'idle', itemsSynced: 0 },
        inventory: { status: 'idle', itemsSynced: 0 },
      }),
    },
    webhookIds: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
    collection: 'shopify_stores',
  }
);

// Indexes for efficient queries
StoreSchema.index({ isActive: 1, shopifyDomain: 1 });
StoreSchema.index({ 'syncStatus.products.status': 1 });
StoreSchema.index({ 'syncStatus.orders.status': 1 });
StoreSchema.index({ updatedAt: 1 });

// Instance methods

StoreSchema.methods.getWebhookId = function (topic: WebhookTopic): number | undefined {
  const mapping: Record<WebhookTopic, string> = {
    'orders/create': 'ordersCreate',
    'orders/updated': 'ordersUpdated',
    'products/create': 'productsCreate',
    'products/update': 'productsUpdate',
    'products/delete': 'productsDelete',
    'customers/create': 'customersCreate',
    'customers/update': 'customersUpdate',
    'inventory_levels/update': 'inventoryLevelsUpdate',
    'orders/fulfilled': 'ordersUpdated',
    'orders/partially_fulfilled': 'ordersUpdated',
    'orders/cancelled': 'ordersUpdated',
    'orders/deleted': 'ordersUpdated',
    'customers/delete': 'customersUpdate',
  };

  const key = mapping[topic];
  if (!key) return undefined;
  return this.webhookIds.get(key);
};

StoreSchema.methods.updateSyncStatus = async function (
  entity: keyof SyncStatus,
  update: Partial<SyncStatus[keyof SyncStatus]>
): Promise<void> {
  const fieldPath = `syncStatus.${entity}`;
  const updateObj: Record<string, unknown> = {};

  if (update.status) updateObj[`${fieldPath}.status`] = update.status;
  if (update.lastSyncAt) updateObj[`${fieldPath}.lastSyncAt`] = update.lastSyncAt;
  if (update.lastSyncId) updateObj[`${fieldPath}.lastSyncId`] = update.lastSyncId;
  if (update.error !== undefined) updateObj[`${fieldPath}.error`] = update.error;
  if (update.itemsSynced !== undefined) {
    updateObj[`${fieldPath}.itemsSynced`] = update.itemsSynced;
  }

  await this.updateOne({ $set: updateObj });
};

StoreSchema.methods.setWebhookId = async function (
  topic: WebhookTopic,
  webhookId: number
): Promise<void> {
  const mapping: Record<WebhookTopic, string> = {
    'orders/create': 'ordersCreate',
    'orders/updated': 'ordersUpdated',
    'products/create': 'productsCreate',
    'products/update': 'productsUpdate',
    'products/delete': 'productsDelete',
    'customers/create': 'customersCreate',
    'customers/update': 'customersUpdate',
    'inventory_levels/update': 'inventoryLevelsUpdate',
    'orders/fulfilled': 'ordersUpdated',
    'orders/partially_fulfilled': 'ordersUpdated',
    'orders/cancelled': 'ordersUpdated',
    'orders/deleted': 'ordersUpdated',
    'customers/delete': 'customersUpdate',
  };

  const key = mapping[topic];
  if (key) {
    await this.updateOne({
      $set: { [`webhookIds.${key}`]: webhookId },
    });
    this.webhookIds.set(key, webhookId);
  }
};

// Static methods

StoreSchema.statics.findByDomain = function (
  domain: string
): Promise<IStoreDocument | null> {
  return this.findOne({ shopifyDomain: domain.toLowerCase() });
};

StoreSchema.statics.findByStoreId = function (
  shopifyStoreId: number
): Promise<IStoreDocument | null> {
  return this.findOne({ shopifyStoreId });
};

StoreSchema.statics.findActiveStores = function (): Promise<IStoreDocument[]> {
  return this.find({ isActive: true }).exec();
};

StoreSchema.statics.findStoresForSync = async function (
  entity: keyof SyncStatus
): Promise<IStoreDocument[]> {
  return this.find({
    isActive: true,
    [`syncStatus.${entity}.status`]: { $ne: 'syncing' },
  }).exec();
};

// Pre-save hook for domain normalization
StoreSchema.pre('save', function (next) {
  if (this.isModified('shopifyDomain')) {
    this.shopifyDomain = this.shopifyDomain.toLowerCase().trim();
  }
  next();
});

// Transform for JSON serialization
StoreSchema.set('toJSON', {
  transform: (_doc: Document, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret.__v;
    delete ret.accessToken; // Never expose access tokens
    return ret;
  },
});

export const Store = mongoose.model<IStoreDocument>('Store', StoreSchema);
export type { IStoreDocument };
