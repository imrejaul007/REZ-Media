import mongoose, { Schema, Model } from 'mongoose';
import { CRMProvider, OAuthTokens } from '../types/index.js';

export interface ICRMConnection {
  provider: CRMProvider;
  isConnected: boolean;
  tokens?: OAuthTokens;
  accountInfo?: Record<string, unknown>;
  lastSyncAt?: Date;
  syncEnabled: boolean;
}

export interface ICRMConnectionMethods {
  setTokens(tokens: OAuthTokens): void;
  clearTokens(): void;
  isTokenExpired(): boolean;
  updateLastSync(): void;
}

export type ICRMConnectionDocument = mongoose.HydratedDocument<ICRMConnection, ICRMConnectionMethods>;

interface ICRMConnectionModel extends Model<ICRMConnection, object, ICRMConnectionMethods> {
  findByProvider(provider: CRMProvider): Promise<ICRMConnectionDocument | null>;
  findAllConnected(): Promise<ICRMConnectionDocument[]>;
}

const OAuthTokensSchema = new Schema({
  accessToken: { type: String, required: true },
  refreshToken: { type: String },
  expiresAt: { type: Number, required: true },
  tokenType: { type: String, default: 'Bearer' },
  scope: { type: String },
}, { _id: false });

const CRMConnectionSchema = new Schema<ICRMConnection, ICRMConnectionModel, ICRMConnectionMethods>(
  {
    provider: {
      type: String,
      enum: Object.values(CRMProvider),
      required: true,
      unique: true,
    },
    isConnected: {
      type: Boolean,
      default: false,
    },
    tokens: OAuthTokensSchema,
    accountInfo: {
      type: Schema.Types.Mixed,
    },
    lastSyncAt: {
      type: Date,
    },
    syncEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'crm_connections',
  }
);

// Instance methods
CRMConnectionSchema.methods.setTokens = function (tokens: OAuthTokens): void {
  this.tokens = tokens;
  this.isConnected = true;
};

CRMConnectionSchema.methods.clearTokens = function (): void {
  this.tokens = undefined;
  this.isConnected = false;
};

CRMConnectionSchema.methods.isTokenExpired = function (): boolean {
  if (!this.tokens) return true;
  return Date.now() >= (this.tokens.expiresAt - 5 * 60 * 1000);
};

CRMConnectionSchema.methods.updateLastSync = function (): void {
  this.lastSyncAt = new Date();
};

// Static methods
CRMConnectionSchema.statics.findByProvider = function (
  provider: CRMProvider
): Promise<ICRMConnectionDocument | null> {
  return this.findOne({ provider }) as Promise<ICRMConnectionDocument | null>;
};

CRMConnectionSchema.statics.findAllConnected = function (): Promise<ICRMConnectionDocument[]> {
  return this.find({ isConnected: true, syncEnabled: true }) as Promise<ICRMConnectionDocument[]>;
};

export const CRMConnection = mongoose.model<ICRMConnection, ICRMConnectionModel>(
  'CRMConnection',
  CRMConnectionSchema
);

export default CRMConnection;
