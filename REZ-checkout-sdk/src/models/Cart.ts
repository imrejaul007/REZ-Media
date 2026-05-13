import mongoose, { Document, Schema } from 'mongoose';

// Cart Item Interface
export interface ICartItem {
  productId: string;
  merchantId: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

// Cart Document Interface
export interface ICart extends Document {
  userId?: string;
  sessionId: string;
  merchantId?: string;
  items: ICartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  isGuest: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Cart Item Schema
const CartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: String, required: true },
    merchantId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    sku: { type: String },
    imageUrl: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

// Cart Schema
const CartSchema = new Schema<ICart>(
  {
    userId: { type: String, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    merchantId: { type: String, index: true },
    items: { type: [CartItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    isGuest: { type: Boolean, default: false },
    expiresAt: { type: Date, index: true },
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

// Indexes for cart queries
CartSchema.index({ userId: 1, merchantId: 1 });
CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Calculate totals before saving
CartSchema.pre('save', function (next) {
  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  this.total = this.subtotal + this.tax - this.discount;
  next();
});

// Static method to find or create cart
CartSchema.statics.findOrCreateBySession = async function (
  sessionId: string,
  userId?: string
): Promise<ICart> {
  let cart = await this.findOne({ sessionId });

  if (!cart) {
    cart = new this({
      sessionId,
      userId,
      items: [],
      isGuest: !userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
    await cart.save();
  }

  return cart;
};

// Static method to find cart by user
CartSchema.statics.findByUser = async function (
  userId: string,
  merchantId?: string
): Promise<ICart | null> {
  const query: Record<string, string> = { userId };
  if (merchantId) {
    query.merchantId = merchantId;
  }
  return this.findOne(query);
};

export const Cart = mongoose.model<ICart>('Cart', CartSchema);
