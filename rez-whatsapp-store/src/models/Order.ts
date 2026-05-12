import mongoose, { Schema, Document, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'failed';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';

export type DeliveryType = 'home_delivery' | 'store_pickup' | 'instant';

export interface IOrderItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface IDeliveryAddress {
  fullName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  instructions?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface IOrder extends Document {
  orderId: string;
  cartId: string;
  userId?: string;
  phoneNumber: string;
  items: IOrderItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  deliveryType: DeliveryType;
  deliveryAddress?: IDeliveryAddress;
  paymentMethod?: string;
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  notes?: string;
  source: 'whatsapp' | 'web' | 'app';
  whatsappMessageId?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderInput {
  cartId: string;
  userId?: string;
  phoneNumber: string;
  items: IOrderItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency?: string;
  deliveryType: DeliveryType;
  deliveryAddress?: IDeliveryAddress;
  notes?: string;
  source?: 'whatsapp' | 'web' | 'app';
}

const orderItemSchema = new Schema<IOrderItem>(
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

const deliveryAddressSchema = new Schema<IDeliveryAddress>(
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

const orderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      default: () => `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`,
    },
    cartId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    phoneNumber: { type: String, required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, default: 0, min: 0 },
    deliveryFee: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'failed'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
      default: 'pending',
      index: true,
    },
    deliveryType: {
      type: String,
      enum: ['home_delivery', 'store_pickup', 'instant'],
      required: true,
    },
    deliveryAddress: { type: deliveryAddressSchema },
    paymentMethod: { type: String },
    paymentId: { type: String, index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    notes: { type: String },
    source: {
      type: String,
      enum: ['whatsapp', 'web', 'app'],
      default: 'whatsapp',
    },
    whatsappMessageId: { type: String },
    estimatedDelivery: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'orders',
  }
);

// Compound indexes
orderSchema.index({ phoneNumber: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });

// Instance methods
orderSchema.methods.updateStatus = function (status: OrderStatus, reason?: string): void {
  const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ['confirmed', 'cancelled', 'failed'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['out_for_delivery', 'cancelled'],
    out_for_delivery: ['delivered', 'cancelled'],
    delivered: ['refunded'],
    cancelled: [],
    refunded: [],
    failed: [],
  };

  if (!statusTransitions[this.status as OrderStatus].includes(status)) {
    throw new Error(`Invalid status transition from ${this.status} to ${status}`);
  }

  this.status = status;

  if (status === 'cancelled') {
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
  }

  if (status === 'delivered') {
    this.deliveredAt = new Date();
  }
};

orderSchema.methods.updatePaymentStatus = function (paymentStatus: PaymentStatus, paymentId?: string): void {
  this.paymentStatus = paymentStatus;
  if (paymentId) {
    this.paymentId = paymentId;
  }
  if (paymentStatus === 'paid' && this.status === 'pending') {
    this.status = 'confirmed';
  }
};

orderSchema.methods.setRazorpayIds = function (orderId: string, paymentId?: string): void {
  this.razorpayOrderId = orderId;
  if (paymentId) {
    this.razorpayPaymentId = paymentId;
  }
};

orderSchema.methods.getFormattedTotal = function (): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: this.currency,
  }).format(this.totalAmount);
};

orderSchema.methods.getItemCount = function (): number {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
};

orderSchema.methods.toSummary = function (): Record<string, unknown> {
  return {
    orderId: this.orderId,
    status: this.status,
    paymentStatus: this.paymentStatus,
    totalAmount: this.totalAmount,
    currency: this.currency,
    itemCount: this.getItemCount(),
    createdAt: this.createdAt,
    estimatedDelivery: this.estimatedDelivery,
  };
};

// Static methods
orderSchema.statics.findByOrderId = function (orderId: string): Promise<IOrder | null> {
  return this.findOne({ orderId });
};

orderSchema.statics.findByPhone = function (phoneNumber: string, limit: number = 10): Promise<IOrder[]> {
  return this.find({ phoneNumber })
    .sort({ createdAt: -1 })
    .limit(limit);
};

orderSchema.statics.findByUser = function (userId: string, limit: number = 10): Promise<IOrder[]> {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

orderSchema.statics.findPendingOrders = function (): Promise<IOrder[]> {
  return this.find({
    status: { $in: ['pending', 'confirmed', 'processing'] },
  }).sort({ createdAt: 1 });
};

export interface IOrderModel extends Model<IOrder> {
  findByOrderId(orderId: string): Promise<IOrder | null>;
  findByPhone(phoneNumber: string, limit?: number): Promise<IOrder[]>;
  findByUser(userId: string, limit?: number): Promise<IOrder[]>;
  findPendingOrders(): Promise<IOrder[]>;
}

export const Order = (mongoose.models.Order as IOrderModel) || mongoose.model<IOrder, IOrderModel>('Order', orderSchema);

export default Order;
