import mongoose, { Schema, Document, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ICartItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  totalPrice: number;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ICart extends Document {
  cartId: string;
  userId?: string;
  phoneNumber: string;
  items: ICartItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  status: 'active' | 'converted' | 'expired' | 'abandoned';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CartInput {
  userId?: string;
  phoneNumber: string;
  items?: ICartItem[];
  currency?: string;
  expiresAt?: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: String, required: true },
    variantId: { type: String },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const cartSchema = new Schema<ICart>(
  {
    cartId: {
      type: String,
      required: true,
      unique: true,
      default: () => `CART-${uuidv4()}`,
    },
    userId: { type: String, index: true },
    phoneNumber: { type: String, required: true, index: true },
    items: { type: [cartItemSchema], default: [] },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discountTotal: { type: Number, required: true, default: 0, min: 0 },
    deliveryFee: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      enum: ['active', 'converted', 'expired', 'abandoned'],
      default: 'active',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'carts',
  }
);

// Indexes for efficient queries
cartSchema.index({ phoneNumber: 1, status: 1 });
cartSchema.index({ userId: 1, status: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save hook to recalculate totals
cartSchema.pre('save', function (next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  this.discountTotal = this.items.reduce((sum, item) => sum + (item.discount || 0) * item.quantity, 0);
  this.totalAmount = this.subtotal - this.discountTotal + this.deliveryFee;
  next();
});

// Instance methods
cartSchema.methods.addItem = function (item: Omit<ICartItem, 'totalPrice'>): void {
  const existingIndex = this.items.findIndex(
    (i) => i.productId === item.productId && i.variantId === item.variantId
  );

  if (existingIndex >= 0) {
    this.items[existingIndex].quantity += item.quantity;
  } else {
    this.items.push({
      ...item,
      totalPrice: item.unitPrice * item.quantity - (item.discount || 0) * item.quantity,
    });
  }

  this.markModified('items');
};

cartSchema.methods.updateItemQuantity = function (productId: string, variantId: string | undefined, quantity: number): boolean {
  const index = this.items.findIndex(
    (i) => i.productId === productId && i.variantId === variantId
  );

  if (index === -1) return false;

  if (quantity <= 0) {
    this.items.splice(index, 1);
  } else {
    this.items[index].quantity = quantity;
    this.items[index].totalPrice = this.items[index].unitPrice * quantity - (this.items[index].discount || 0) * quantity;
  }

  this.markModified('items');
  return true;
};

cartSchema.methods.removeItem = function (productId: string, variantId?: string): boolean {
  const initialLength = this.items.length;
  this.items = this.items.filter(
    (i) => !(i.productId === productId && i.variantId === variantId)
  );
  this.markModified('items');
  return this.items.length < initialLength;
};

cartSchema.methods.clear = function (): void {
  this.items = [];
  this.subtotal = 0;
  this.discountTotal = 0;
  this.totalAmount = 0;
  this.markModified('items');
};

cartSchema.methods.getItemCount = function (): number {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
};

cartSchema.methods.applyDeliveryFee = function (fee: number): void {
  this.deliveryFee = fee;
};

cartSchema.methods.convertToOrder = function (): Record<string, unknown> {
  this.status = 'converted';
  return {
    cartId: this.cartId,
    items: this.items,
    subtotal: this.subtotal,
    discountTotal: this.discountTotal,
    deliveryFee: this.deliveryFee,
    totalAmount: this.totalAmount,
    currency: this.currency,
    phoneNumber: this.phoneNumber,
    userId: this.userId,
  };
};

// Static methods
cartSchema.statics.findActiveByPhone = function (phoneNumber: string): Promise<ICart | null> {
  return this.findOne({ phoneNumber, status: 'active' });
};

cartSchema.statics.findActiveByUser = function (userId: string): Promise<ICart | null> {
  return this.findOne({ userId, status: 'active' });
};

cartSchema.statics.createNew = function (input: CartInput, expiresInHours: number = 24): Promise<ICart> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  return this.create({
    phoneNumber: input.phoneNumber,
    userId: input.userId,
    items: input.items || [],
    currency: input.currency || 'INR',
    expiresAt,
  });
};

export interface ICartModel extends Model<ICart> {
  findActiveByPhone(phoneNumber: string): Promise<ICart | null>;
  findActiveByUser(userId: string): Promise<ICart | null>;
  createNew(input: CartInput, expiresInHours?: number): Promise<ICart>;
}

export const Cart = (mongoose.models.Cart as ICartModel) || mongoose.model<ICart, ICartModel>('Cart', cartSchema);

export default Cart;
