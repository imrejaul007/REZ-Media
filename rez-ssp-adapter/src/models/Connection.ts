import mongoose, { Schema, Document } from 'mongoose';
import { SSPProvider, IConnection } from '../types/index.js';

export interface IConnectionDocument extends IConnection, Document {}

const ConnectionSchema = new Schema<IConnectionDocument>({
  provider: {
    type: String,
    enum: ['google_adx', 'pubmatic', 'index_exchange'],
    required: true,
    unique: true,
  },
  enabled: { type: Boolean, default: true },
  apiKey: { type: String, required: true },
  apiSecret: { type: String },
  publisherId: { type: String },
  advertiserId: { type: String },
  endpoint: { type: String },
  config: { type: Schema.Types.Mixed },
  lastSyncAt: { type: Date },
  status: { type: String, enum: ['active', 'inactive', 'error'], default: 'inactive' },
  errorMessage: { type: String },
}, { timestamps: true });

export const ConnectionModel = mongoose.model<IConnectionDocument>('Connection', ConnectionSchema);
