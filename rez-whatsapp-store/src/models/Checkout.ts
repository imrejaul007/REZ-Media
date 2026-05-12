import mongoose, { Schema, Document, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IDeliveryAddress } from './Order';

export type CheckoutStatus = 'initiated' | 'address_pending' | 'delivery_pending' | 'payment_pending' | 'completed' | 'failed' | 'expired' | 'cancelled';

export type CheckoutStep = 'cart_review' | 'address' | 'delivery' | 'payment' | 'confirmation';

export interface ICheckoutItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  imageUrl?: string;
}

export interface ICheckout extends Document {
  checkoutId: string;
  cartId: string;
  userId?: string;
  phoneNumber: string;
  step: CheckoutStep;
  status: CheckoutStatus;
  items: ICheckoutItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  deliveryType?: 'home_delivery' | 'store_pickup' | 'instant';
  deliveryAddress?: IDeliveryAddress;
  paymentMethod?: string;
  selectedCoupon?: string;
  couponDiscount: number;
  notes?: string;
  expiresAt: Date;
  completedAt?: Date;
  source: 'whatsapp' | 'web' | 'app';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckoutInput {
  cartId: string;
  userId?: string;
  phoneNumber: string;
  items: ICheckoutItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency?: string;
  source?: 'whatsapp' | 'web' | 'app';
}

const checkoutItemSchema = new Schema<ICheckoutItem>(
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
  },
  { _id: false }
);

const deliveryAddressSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
    instructions: { type: String },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  },
  { _id: false }
);

const checkoutSchema = new Schema<ICheckout>(
  {
    checkoutId: {
      type: String,
      required: true,
      unique: true,
      default: () => `CO-${uuidv4().substring(0, 12).toUpperCase()}`,
    },
    cartId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    phoneNumber: { type: String, required: true, index: true },
    step: {
      type: String,
      enum: ['cart_review', 'address', 'delivery', 'payment', 'confirmation'],
      default: 'cart_review',
    },
    status: {
      type: String,
      enum: ['initiated', 'address_pending', 'delivery_pending', 'payment_pending', 'completed', 'failed', 'expired', 'cancelled'],
      default: 'initiated',
      index: true,
    },
    items: { type: [checkoutItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, default: 0, min: 0 },
    deliveryFee: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    deliveryType: {
      type: String,
      enum: ['home_delivery', 'store_pickup', 'instant'],
    },
    deliveryAddress: { type: deliveryAddressSchema },
    paymentMethod: { type: String },
    selectedCoupon: { type: String },
    couponDiscount: { type: Number, default: 0, min: 0 },
    notes: { type: String },
    expiresAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    source: {
      type: String,
      enum: ['whatsapp', 'web', 'app'],
      default: 'whatsapp',
    },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'checkouts',
  }
);

// Indexes
checkoutSchema.index({ phoneNumber: 1, status: 1 });
checkoutSchema.index({ userId: 1, status: 1 });
checkoutSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Valid checkout step transitions
const stepTransitions: Record<CheckoutStep, CheckoutStep[]> = {
  cart_review: ['address'],
  address: ['delivery', 'payment', 'cart_review'],
  delivery: ['payment', 'address', 'cart_review'],
  payment: ['confirmation', 'delivery', 'cart_review'],
  confirmation: [],
};

const statusTransitions: Record<CheckoutStatus, CheckoutStatus[]> = {
  initiated: ['address_pending', 'payment_pending', 'cancelled', 'expired'],
  address_pending: ['delivery_pending', 'initiated', 'cancelled', 'expired'],
  delivery_pending: ['payment_pending', 'address_pending', 'cancelled', 'expired'],
  payment_pending: ['completed', 'failed', 'delivery_pending', 'cancelled', 'expired'],
  completed: [],
  failed: [],
  expired: [],
  cancelled: [],
};

// Instance methods
checkoutSchema.methods.nextStep = function (): CheckoutStep | null {
  const possibleNextSteps = stepTransitions[this.step as CheckoutStep];
  if (possibleNextSteps.length === 0) return null;

  const stepOrder: CheckoutStep[] = ['cart_review', 'address', 'delivery', 'payment', 'confirmation'];
  const currentIndex = stepOrder.indexOf(this.step as CheckoutStep);

  for (let i = currentIndex + 1; i < stepOrder.length; i++) {
    if (possibleNextSteps.includes(stepOrder[i])) {
      return stepOrder[i];
    }
  }

  return null;
};

checkoutSchema.methods.goToStep = function (step: CheckoutStep): boolean {
  const allowed = stepTransitions[this.step as CheckoutStep];
  if (!allowed.includes(step)) {
    return false;
  }
  this.step = step;
  this.updateStatusFromStep();
  return true;
};

checkoutSchema.methods.updateStatusFromStep = function (): void {
  switch (this.step) {
    case 'cart_review':
      this.status = 'initiated';
      break;
    case 'address':
      this.status = 'address_pending';
      break;
    case 'delivery':
      this.status = 'delivery_pending';
      break;
    case 'payment':
      this.status = 'payment_pending';
      break;
    case 'confirmation':
      this.status = 'completed';
      this.completedAt = new Date();
      break;
  }
};

checkoutSchema.methods.setDeliveryAddress = function (address: IDeliveryAddress): void {
  this.deliveryAddress = address;
  if (this.step === 'address') {
    this.step = 'delivery';
    this.status = 'delivery_pending';
  }
};

checkoutSchema.methods.setDeliveryType = function (type: 'home_delivery' | 'store_pickup' | 'instant'): void {
  this.deliveryType = type;

  if (type === 'store_pickup') {
    this.deliveryFee = 0;
  }

  if (this.step === 'delivery') {
    this.step = 'payment';
    this.status = 'payment_pending';
    this.recalculateTotal();
  }
};

checkoutSchema.methods.setPaymentMethod = function (method: string): void {
  this.paymentMethod = method;
};

checkoutSchema.methods.applyCoupon = function (code: string, discount: number): void {
  this.selectedCoupon = code;
  this.couponDiscount = discount;
  this.recalculateTotal();
};

checkoutSchema.methods.removeCoupon = function (): void {
  this.selectedCoupon = undefined;
  this.couponDiscount = 0;
  this.recalculateTotal();
};

checkoutSchema.methods.recalculateTotal = function (): void {
  const itemTotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const subtotal = itemTotal - this.discountTotal;

  let deliveryFee = this.deliveryFee;
  if (this.deliveryType === 'store_pickup') {
    deliveryFee = 0;
  }

  this.subtotal = subtotal;
  this.totalAmount = subtotal + deliveryFee - this.couponDiscount;
};

checkoutSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt;
};

checkoutSchema.methods.expire = function (): void {
  this.status = 'expired';
};

checkoutSchema.methods.cancel = function (): void {
  this.status = 'cancelled';
};

checkoutSchema.methods.getProgress = function (): number {
  const steps: CheckoutStep[] = ['cart_review', 'address', 'delivery', 'payment', 'confirmation'];
  const currentIndex = steps.indexOf(this.step as CheckoutStep);
  return Math.round(((currentIndex + 1) / steps.length) * 100);
};

checkoutSchema.methods.getSummary = function (): Record<string, unknown> {
  return {
    checkoutId: this.checkoutId,
    step: this.step,
    status: this.status,
    progress: this.getProgress(),
    items: this.items,
    subtotal: this.subtotal,
    discountTotal: this.discountTotal,
    deliveryFee: this.deliveryFee,
    couponDiscount: this.couponDiscount,
    totalAmount: this.totalAmount,
    currency: this.currency,
    deliveryType: this.deliveryType,
    hasDeliveryAddress: !!this.deliveryAddress,
    paymentMethod: this.paymentMethod,
  };
};

// Static methods
checkoutSchema.statics.findActiveByCart = function (cartId: string): Promise<ICheckout | null> {
  return this.findOne({ cartId, status: { $in: ['initiated', 'address_pending', 'delivery_pending', 'payment_pending'] } });
};

checkoutSchema.statics.findActiveByPhone = function (phoneNumber: string): Promise<ICheckout | null> {
  return this.findOne({
    phoneNumber,
    status: { $in: ['initiated', 'address_pending', 'delivery_pending', 'payment_pending'] },
  });
};

checkoutSchema.statics.createFromCart = function (cartData: CheckoutInput, expiresInMinutes: number = 30): Promise<ICheckout> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

  return this.create({
    ...cartData,
    currency: cartData.currency || 'INR',
    expiresAt,
  });
};

export interface ICheckoutModel extends Model<ICheckout> {
  findActiveByCart(cartId: string): Promise<ICheckout | null>;
  findActiveByPhone(phoneNumber: string): Promise<ICheckout | null>;
  createFromCart(cartData: CheckoutInput, expiresInMinutes?: number): Promise<ICheckout>;
}

export const Checkout = (mongoose.models.Checkout as ICheckoutModel) || mongoose.model<ICheckout, ICheckoutModel>('Checkout', checkoutSchema);

export default Checkout;
