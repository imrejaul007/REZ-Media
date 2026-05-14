import mongoose, { Schema, Document } from 'mongoose';

export interface ICreativeDocument extends Document {
  id: string;
  campaignId: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  status: 'active' | 'paused' | 'ended';
}

const CreativeSchema = new Schema<ICreativeDocument>({
  id: { type: String, required: true },
  campaignId: { type: String, required: true, index: true },
  url: { type: String, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  mimeType: { type: String, required: true },
  status: {
    type: String,
    enum: ['active', 'paused', 'ended'],
    default: 'active',
  },
}, { timestamps: true });

export const CreativeModel = mongoose.model<ICreativeDocument>('Creative', CreativeSchema);
