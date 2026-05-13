import mongoose, { Document, Schema } from 'mongoose';

// Order Item Interface
export interface IOrderItem {
  productId: string;
  merchantId: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  imageUrl?: string;
  subtotal: number;
  metadata?: Record<string, unknown>;
}

// Shipping Address Interface
export interface IShippingAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
  deliveryInstructions?: string;
}

// Payment Details Interface
export interface IPaymentDetails {
  method: string;
  provider?: string;
  transactionId?: string;
  status: 'pending' | 'captured' | 'failed' | 'refunded' | 'partial_refund';
  amount: number;
  currency: string;
  gatewayResponse?: Record<string, unknown>;
}

// Order Tracking Interface
export interface IOrderTracking {
  status: string;
  timestamp: Date;
  location?: string;
  description?: string;
}

// Order Document Interface
export interface IOrder extends Document {
  orderId: string;
  userId?: string;
  sessionId?: string;
  merchantId: string;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  shippingCost: number;
  total: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  payment: IPaymentDetails;
  tracking: IOrderTracking[];
  couponCode?: string;
  isGuest: boolean;
  guestEmail?: string;
  guestPhone?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  estimatedDelivery?: Date;
}

// Order Item Schema
const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: String, required: true },
    merchantId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    sku: { type: String },
    imageUrl: { type: String },
    subtotal: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

// Shipping Address Schema
const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' },
    landmark: { type: String },
    deliveryInstructions: { type: String },
  },
  { _id: false }
);

// Payment Details Schema
const PaymentDetailsSchema = new Schema<IPaymentDetails>(
  {
    method: { type: String, required: true },
    provider: { type: String },
    transactionId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'captured', 'failed', 'refunded', 'partial_refund'],
      default: 'pending',
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    gatewayResponse: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

// Order Tracking Schema
const OrderTrackingSchema = new Schema<IOrderTracking>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    location: { type: String },
    description: { type: String },
  },
  { _id: false }
);

// Order Schema
const OrderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    sessionId: { type: String, index: true },
    merchantId: { type: String, required: true, index: true },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    billingAddress: { type: ShippingAddressSchema },
    payment: { type: PaymentDetailsSchema, required: true },
    tracking: { type: [OrderTrackingSchema], default: [] },
    couponCode: { type: String },
    isGuest: { type: Boolean, default: false },
    guestEmail: { type: String },
    guestPhone: { type: String },
    metadata: { type: Schema.Types.Mixed },
    estimatedDelivery: { type: Date },
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

// Indexes for order queries
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ merchantId: 1, status: 1 });
OrderSchema.index({ 'payment.transactionId': 1 });

// Pre-save hook to calculate totals
OrderSchema.pre('save', function (next) {
  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.subtotal,
    0
  );
  this.total = this.subtotal + this.tax + this.shippingCost - this.discount;
  next();
});

// Static method to generate order ID
OrderSchema.statics.generateOrderId = function (): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// Static method to find orders by user
OrderSchema.statics.findByUser = async function (
  userId: string,
  options: { limit?: number; skip?: number; status?: string } = {}
): Promise<IOrder[]> {
  const query: Record<string, unknown> = { userId };
  if (options.status) {
    query.status = options.status;
  }
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 20);
};

// Static method to find order by ID
OrderSchema.statics.findByOrderId = async function (
  orderId: string
): Promise<IOrder | null> {
  return this.findOne({ orderId });
};

// Static method to update order status
OrderSchema.statics.updateStatus = async function (
  orderId: string,
  status: IOrder['status'],
  trackingInfo?: Partial<IOrderTracking>
): Promise<IOrder | null> {
  const update: Record<string, unknown> = { status };

  if (trackingInfo) {
    update.$push = {
      tracking: {
        status,
        timestamp: new Date(),
        ...trackingInfo,
      },
    };
  } else {
    update.$push = {
      tracking: {
        status,
        timestamp: new Date(),
      },
    };
  }

  return this.findOneAndUpdate({ orderId }, update, { new: true });
};

// Valid status transitions
export const VALID_STATUS_TRANSITIONS: Record<IOrder['status'], IOrder['status'][]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
