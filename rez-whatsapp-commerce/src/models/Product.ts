import mongoose, { Schema, Document } from 'mongoose';

export interface IProductVariant {
  name: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  inventory: number;
  attributes?: Record<string, string>;
}

export interface IProductImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  productId: string;
  name: string;
  description: string;
  shortDescription?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  brand?: string;
  images: IProductImage[];
  variants: IProductVariant[];
  basePrice: number;
  compareAtPrice?: number;
  currency: string;
  inventory: number;
  sku?: string;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  isActive: boolean;
  isFeatured: boolean;
  isPublished: boolean;
  metadata: Record<string, unknown>;
  whatsappCatalogId?: string;
  merchantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    inventory: { type: Number, required: true, min: 0, default: 0 },
    attributes: { type: Map, of: String },
  },
  { _id: false }
);

const ProductImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    width: Number,
    height: Number,
    alt: String,
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    shortDescription: {
      type: String,
      maxlength: 200,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    subcategory: {
      type: String,
      index: true,
    },
    tags: [{
      type: String,
      index: true,
    }],
    brand: String,
    images: [ProductImageSchema],
    variants: [ProductVariantSchema],
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    inventory: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sku: {
      type: String,
      index: true,
    },
    barcode: String,
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    whatsappCatalogId: {
      type: String,
      index: true,
    },
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for common queries
ProductSchema.index({ merchantId: 1, category: 1, isActive: 1 });
ProductSchema.index({ merchantId: 1, isFeatured: 1, isActive: 1 });
ProductSchema.index({ merchantId: 1, tags: 1 });
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Virtual for checking if product is on sale
ProductSchema.virtual('isOnSale').get(function () {
  return (
    this.compareAtPrice !== undefined &&
    this.compareAtPrice > 0 &&
    this.compareAtPrice > this.basePrice
  );
});

// Virtual for calculating discount percentage
ProductSchema.virtual('discountPercentage').get(function () {
  if (this.compareAtPrice && this.compareAtPrice > this.basePrice) {
    return Math.round(
      ((this.compareAtPrice - this.basePrice) / this.compareAtPrice) * 100
    );
  }
  return 0;
});

// Ensure virtuals are included in JSON
ProductSchema.set('toJSON', { virtuals: true });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
