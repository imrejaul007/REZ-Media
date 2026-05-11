import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IShelfQR extends Document {
  merchantId: string;
  storeId: string;
  qrType: 'product' | 'shelf' | 'checkout' | 'loyalty';
  targetId: string; // Product ID or Shelf ID
  qrCode: string; // Base64 or URL of the generated QR code
  shortUrl: string;
  scans: number;
  lastScanned: Date | null;
  isActive: boolean;
  metadata?: {
    shelfName?: string;
    shelfLocation?: string;
    productName?: string;
    category?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ShelfQRSchema = new Schema<IShelfQR>(
  {
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    storeId: {
      type: String,
      required: true,
      index: true,
    },
    qrType: {
      type: String,
      enum: ['product', 'shelf', 'checkout', 'loyalty'],
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    qrCode: {
      type: String,
      required: true,
    },
    shortUrl: {
      type: String,
      required: true,
      unique: true,
    },
    scans: {
      type: Number,
      default: 0,
    },
    lastScanned: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    metadata: {
      shelfName: { type: String },
      shelfLocation: { type: String },
      productName: { type: String },
      category: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
ShelfQRSchema.index({ merchantId: 1, storeId: 1 });
ShelfQRSchema.index({ merchantId: 1, qrType: 1 });
ShelfQRSchema.index({ targetId: 1, qrType: 1 });
ShelfQRSchema.index({ shortUrl: 1 }, { unique: true });

export const ShelfQR: Model<IShelfQR> = mongoose.model<IShelfQR>('ShelfQR', ShelfQRSchema);
