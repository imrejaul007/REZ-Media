/**
 * Identity Model - Unified customer identity across apps
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IIdentity extends Document {
  phone?: string;
  email?: string;
  whatsapp?: string;
  deviceIds: string[];
  linkedAccounts: {
    app: string;
    userId: string;
    linkedAt: Date;
    confidence: number;
  }[];
  profiles: {
    app: string;
    profileId: string;
    name?: string;
    avatar?: string;
  }[];
  wallets: {
    type: 'cash' | 'coins' | 'points';
    app: string;
    linked: boolean;
  }[];
  mergedInto?: string; // If this identity was merged into another
  mergeHistory: string[]; // IDs of identities merged into this one
  status: 'active' | 'merged' | 'flagged' | 'suspended';
  riskFlags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const IdentitySchema = new Schema<IIdentity>({
  phone: { type: String, sparse: true, index: true },
  email: { type: String, sparse: true, index: true },
  whatsapp: { type: String, sparse: true },
  deviceIds: [{ type: String, index: true }],
  linkedAccounts: [{
    app: { type: String, required: true },
    userId: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now },
    confidence: { type: Number, default: 1.0 },
  }],
  profiles: [{
    app: { type: String, required: true },
    profileId: { type: String, required: true },
    name: String,
    avatar: String,
  }],
  wallets: [{
    type: { type: String, enum: ['cash', 'coins', 'points'] },
    app: String,
    linked: { type: Boolean, default: false },
  }],
  mergedInto: { type: String, index: true },
  mergeHistory: [{ type: String }],
  status: { type: String, enum: ['active', 'merged', 'flagged', 'suspended'], default: 'active' },
  riskFlags: [{ type: String }],
}, { timestamps: true });

// Indexes
IdentitySchema.index({ phone: 1, email: 1 });
IdentitySchema.index({ 'linkedAccounts.app': 1, 'linkedAccounts.userId': 1 });

export const Identity = mongoose.model<IIdentity>('Identity', IdentitySchema);
