/**
 * Connected Store Model
 *
 * MongoDB model for storing WooCommerce store connections.
 */

import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto-js';
import { IConnectedStore, SyncStatus, EntitySyncStatus } from '../types';
import appConfig from '../config';

// ============================================
// Schemas
// ============================================

const entitySyncStatusSchema = new Schema<EntitySyncStatus>(
  {
    lastSyncAt: { type: Date },
    lastSyncId: { type: Number },
    status: {
      type: String,
      enum: ['idle', 'syncing', 'completed', 'error'],
      default: 'idle',
    },
    error: { type: String },
    itemsSynced: { type: Number, default: 0 },
  },
  { _id: false }
);

const syncStatusSchema = new Schema<SyncStatus>(
  {
    products: { type: entitySyncStatusSchema, default: () => ({}) },
    orders: { type: entitySyncStatusSchema, default: () => ({}) },
    customers: { type: entitySyncStatusSchema, default: () => ({}) },
  },
  { _id: false }
);

// ============================================
// Store Schema
// ============================================

// Instance methods interface
export interface IStoreMethods {
  getDecryptedSecret(): string;
  updateSyncStatus(entityType: 'products' | 'orders' | 'customers', status: Partial<EntitySyncStatus>): Promise<void>;
  markSyncStarted(entityType: 'products' | 'orders' | 'customers'): Promise<void>;
  markSyncCompleted(entityType: 'products' | 'orders' | 'customers', itemsSynced: number): Promise<void>;
  markSyncError(entityType: 'products' | 'orders' | 'customers', error: string): Promise<void>;
}

// Static methods interface
export interface IStoreModel extends mongoose.Model<IStoreDocument, {}, IStoreMethods> {
  findByStoreUrl(storeUrl: string): Promise<IStoreDocument | null>;
  findAllActive(): Promise<IStoreDocument[]>;
  existsByStoreUrl(storeUrl: string): Promise<boolean>;
  deleteStore(storeId: string): Promise<boolean>;
}

export interface IStoreDocument extends Omit<IConnectedStore, '_id'>, Document, IStoreMethods {}

const storeSchema = new Schema<IStoreDocument>(
  {
    storeUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    storeName: {
      type: String,
      required: true,
      trim: true,
    },
    consumerKey: {
      type: String,
      required: true,
      unique: true,
    },
    consumerSecret: {
      type: String,
      required: true,
    },
    storeInfo: {
      siteTitle: String,
      siteUrl: String,
      version: String,
      storeLogo: String,
      timezone: String,
      currency: String,
      currencyPos: String,
      weightUnit: String,
      dimensionUnit: String,
    },
    webhookId: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSyncAt: {
      type: Date,
    },
    syncStatus: {
      type: syncStatusSchema,
      default: () => ({
        products: { status: 'idle', itemsSynced: 0 },
        orders: { status: 'idle', itemsSynced: 0 },
        customers: { status: 'idle', itemsSynced: 0 },
      }),
    },
  },
  {
    timestamps: true,
    collection: 'connected_stores',
  }
);

// ============================================
// Indexes
// ============================================

storeSchema.index({ storeUrl: 1 });
storeSchema.index({ consumerKey: 1 });
storeSchema.index({ isActive: 1 });
storeSchema.index({ lastSyncAt: 1 });

// ============================================
// Pre-save Hook - Encrypt consumer secret
// ============================================

storeSchema.pre('save', function (next) {
  // Encrypt consumer secret before saving
  if (this.isModified('consumerSecret')) {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me';
    this.consumerSecret = crypto.AES.encrypt(this.consumerSecret, encryptionKey).toString();
  }
  next();
});

// ============================================
// Instance Methods
// ============================================

/**
 * Get decrypted consumer secret
 */
storeSchema.methods.getDecryptedSecret = function (): string {
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me';
  const bytes = crypto.AES.decrypt(this.consumerSecret, encryptionKey);
  return bytes.toString(crypto.enc.Utf8);
};

/**
 * Update sync status for a specific entity type
 */
storeSchema.methods.updateSyncStatus = async function (
  entityType: 'products' | 'orders' | 'customers',
  status: Partial<EntitySyncStatus>
): Promise<void> {
  (this.syncStatus as any)[entityType] = {
    ...(this.syncStatus as any)[entityType],
    ...status,
  };
  this.lastSyncAt = new Date();
  await this.save();
};

/**
 * Mark sync as started
 */
storeSchema.methods.markSyncStarted = async function (
  entityType: 'products' | 'orders' | 'customers'
): Promise<void> {
  await this.updateSyncStatus(entityType, {
    status: 'syncing',
    lastSyncAt: new Date(),
  });
};

/**
 * Mark sync as completed
 */
storeSchema.methods.markSyncCompleted = async function (
  entityType: 'products' | 'orders' | 'customers',
  itemsSynced: number
): Promise<void> {
  await this.updateSyncStatus(entityType, {
    status: 'completed',
    itemsSynced,
    lastSyncAt: new Date(),
  });
};

/**
 * Mark sync as failed
 */
storeSchema.methods.markSyncError = async function (
  entityType: 'products' | 'orders' | 'customers',
  error: string
): Promise<void> {
  await this.updateSyncStatus(entityType, {
    status: 'error',
    error,
    lastSyncAt: new Date(),
  });
};

// ============================================
// Static Methods
// ============================================

/**
 * Find store by URL
 */
storeSchema.statics.findByStoreUrl = function (storeUrl: string) {
  return this.findOne({ storeUrl: storeUrl.toLowerCase() });
};

/**
 * Find all active stores
 */
storeSchema.statics.findAllActive = function () {
  return this.find({ isActive: true });
};

/**
 * Check if store with URL exists
 */
storeSchema.statics.existsByStoreUrl = async function (storeUrl: string): Promise<boolean> {
  const count = await this.countDocuments({ storeUrl: storeUrl.toLowerCase() });
  return count > 0;
};

/**
 * Delete store and related data
 */
storeSchema.statics.deleteStore = async function (storeId: string): Promise<boolean> {
  const result = await this.findByIdAndDelete(storeId);
  return !!result;
};

// ============================================
// Model Export
// ============================================

export const Store = mongoose.model<IStoreDocument, IStoreModel>('Store', storeSchema);

export default Store;
