import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProductPage extends Document {
  productId: string;
  merchantId: string;

  // Display info
  displayName: string;
  displayPrice: number;
  displayImage: string;

  // Availability
  available: boolean;
  storeStock?: number;
  nearestStore?: string;

  // Social proof
  rating: number;
  reviewCount: number;

  // Offers
  cashback?: number;
  coinBooster?: number;

  // Actions
  buyUrl: string;
  addToCartUrl: string;

  // Additional metadata
  description?: string;
  brand?: string;
  category?: string;
  tags?: string[];

  // Cache management
  lastSynced?: Date;
  cacheExpiry?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ProductPageSchema = new Schema<IProductPage>(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    merchantId: {
      type: String,
      required: true,
      index: true,
    },

    // Display info
    displayName: {
      type: String,
      required: true,
    },
    displayPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    displayImage: {
      type: String,
      required: true,
    },

    // Availability
    available: {
      type: Boolean,
      default: true,
    },
    storeStock: {
      type: Number,
      min: 0,
    },
    nearestStore: {
      type: String,
    },

    // Social proof
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Offers
    cashback: {
      type: Number,
      min: 0,
    },
    coinBooster: {
      type: Number,
      min: 0,
    },

    // Actions
    buyUrl: {
      type: String,
      required: true,
    },
    addToCartUrl: {
      type: String,
      required: true,
    },

    // Additional metadata
    description: {
      type: String,
    },
    brand: {
      type: String,
    },
    category: {
      type: String,
    },
    tags: [{
      type: String,
    }],

    // Cache management
    lastSynced: {
      type: Date,
    },
    cacheExpiry: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProductPageSchema.index({ merchantId: 1, category: 1 });
ProductPageSchema.index({ merchantId: 1, available: 1 });
ProductPageSchema.index({ cacheExpiry: 1 });

export const ProductPage: Model<IProductPage> = mongoose.model<IProductPage>('ProductPage', ProductPageSchema);
