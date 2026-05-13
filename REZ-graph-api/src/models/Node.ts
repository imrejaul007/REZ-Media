import mongoose, { Schema, Document } from 'mongoose';

export type NodeType =
  | 'consumer'
  | 'merchant'
  | 'product'
  | 'category'
  | 'location'
  | 'device'
  | 'app';

export interface INode extends Document {
  nodeId: string;
  type: NodeType;
  externalId: string;
  properties: Record<string, unknown>;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

const NodeSchema = new Schema<INode>(
  {
    nodeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['consumer', 'merchant', 'product', 'category', 'location', 'device', 'app'],
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      index: true,
    },
    properties: {
      type: Schema.Types.Mixed,
      default: {},
    },
    labels: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
NodeSchema.index({ type: 1, externalId: 1 });
NodeSchema.index({ type: 1, labels: 1 });
NodeSchema.index({ labels: 1, type: 1 });

export const Node = mongoose.model<INode>('Node', NodeSchema);
