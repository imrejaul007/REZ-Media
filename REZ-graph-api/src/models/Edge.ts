import mongoose, { Schema, Document } from 'mongoose';

export type EdgeType =
  | 'ordered'
  | 'browsed'
  | 'liked'
  | 'visited'
  | 'linked_to'
  | 'similar_to';

export interface IEdge extends Document {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  weight: number;
  properties: Record<string, unknown>;
  sourceNode?: unknown;
  targetNode?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const EdgeSchema = new Schema<IEdge>(
  {
    edgeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sourceNodeId: {
      type: String,
      required: true,
      index: true,
    },
    targetNodeId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['ordered', 'browsed', 'liked', 'visited', 'linked_to', 'similar_to'],
      index: true,
    },
    weight: {
      type: Number,
      default: 1,
      min: 0,
      max: 1,
    },
    properties: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
EdgeSchema.index({ sourceNodeId: 1, type: 1 });
EdgeSchema.index({ targetNodeId: 1, type: 1 });
EdgeSchema.index({ sourceNodeId: 1, targetNodeId: 1 }, { unique: true });
EdgeSchema.index({ type: 1, weight: -1 });

// Text index for searching edges by properties
EdgeSchema.index({ properties: 'text' });

export const Edge = mongoose.model<IEdge>('Edge', EdgeSchema);
