import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  image?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantName?: string;
  metadata?: Record<string, unknown>;
}

export interface ICart extends Document {
  _id: mongoose.Types.ObjectId;
  cartId: string;
  customerId: string;
  customerPhone: string;
  merchantId: string;
  items: ICartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  discountCode?: string;
  deliveryFee: number;
  total: number;
  currency: string;
  isActive: boolean;
  checkedOutAt?: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    productId: {
      type: String,
      required: true,
      index: true,
    },
    variantId: String,
    name: {
      type: String,
      required: true,
    },
    sku: String,
    image: String,
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    variantName: String,
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const CartSchema = new Schema<ICart>(
  {
    cartId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    customerPhone: {
      type: String,
      required: true,
      index: true,
    },
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    items: [CartItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountCode: String,
    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    checkedOutAt: Date,
    expiresAt: Date,
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
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

// Compound indexes
CartSchema.index({ customerId: 1, merchantId: 1, isActive: 1 });
CartSchema.index({ customerPhone: 1, merchantId: 1 });
CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save hook to recalculate totals
CartSchema.pre('save', function (next) {
  // Recalculate subtotal
  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  // Recalculate total
  this.total = this.subtotal + this.tax + this.deliveryFee - this.discount;

  // Ensure total is never negative
  if (this.total < 0) {
    this.total = 0;
  }

  next();
});

// Method to add item to cart
CartSchema.methods.addItem = function (item: Partial<ICartItem>): void {
  const existingItemIndex = this.items.findIndex(
    (i) =>
      i.productId === item.productId &&
      i.variantId === (item.variantId || i.variantId)
  );

  if (existingItemIndex >= 0) {
    // Update existing item
    const existingItem = this.items[existingItemIndex];
    existingItem.quantity += item.quantity || 1;
    existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
  } else {
    // Add new item
    const newItem: ICartItem = {
      productId: item.productId!,
      variantId: item.variantId,
      name: item.name!,
      sku: item.sku,
      image: item.image,
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice!,
      totalPrice: (item.quantity || 1) * item.unitPrice!,
      variantName: item.variantName,
      metadata: item.metadata,
    };
    this.items.push(newItem);
  }
};

// Method to update item quantity
CartSchema.methods.updateItemQuantity = function (
  productId: string,
  variantId: string | undefined,
  quantity: number
): boolean {
  const itemIndex = this.items.findIndex(
    (i) =>
      i.productId === productId &&
      i.variantId === (variantId || i.variantId)
  );

  if (itemIndex < 0) {
    return false;
  }

  if (quantity <= 0) {
    this.items.splice(itemIndex, 1);
  } else {
    this.items[itemIndex].quantity = quantity;
    this.items[itemIndex].totalPrice =
      quantity * this.items[itemIndex].unitPrice;
  }

  return true;
};

// Method to remove item from cart
CartSchema.methods.removeItem = function (
  productId: string,
  variantId?: string
): boolean {
  const initialLength = this.items.length;
  this.items = this.items.filter(
    (i) =>
      !(
        i.productId === productId &&
        (variantId === undefined || i.variantId === variantId)
      )
  );
  return this.items.length < initialLength;
};

// Method to clear cart
CartSchema.methods.clear = function (): void {
  this.items = [];
  this.subtotal = 0;
  this.tax = 0;
  this.discount = 0;
  this.discountCode = undefined;
  this.deliveryFee = 0;
  this.total = 0;
};

// Method to apply discount
CartSchema.methods.applyDiscount = function (
  code: string,
  amount: number
): void {
  this.discountCode = code;
  this.discount = Math.min(amount, this.subtotal);
};

// Static method to find or create cart
CartSchema.statics.findOrCreate = async function (
  customerId: string,
  customerPhone: string,
  merchantId: string
): Promise<ICart> {
  let cart = await this.findOne({
    customerId,
    merchantId,
    isActive: true,
  });

  if (!cart) {
    const { v4: uuidv4 } = await import('uuid');
    cart = await this.create({
      cartId: uuidv4(),
      customerId,
      customerPhone,
      merchantId,
      items: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      deliveryFee: 0,
      total: 0,
      currency: 'INR',
      isActive: true,
      metadata: {},
    });
  }

  return cart;
};

export const Cart = mongoose.model<ICart>('Cart', CartSchema);
