import mongoose, { Schema, Document } from 'mongoose';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'FAILED';

export type PaymentStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethod = 'RAZORPAY' | 'WALLET' | 'COD' | 'UPI';

export interface IOrderItem {
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

export interface IShippingAddress {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface IRazorpayDetails {
  orderId?: string;
  paymentId?: string;
  refundId?: string;
  amount: number;
  currency: string;
  status?: string;
  method?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface IWalletPaymentDetails {
  transactionId?: string;
  amount: number;
  currency: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  walletBalanceBefore?: number;
  walletBalanceAfter?: number;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerPhone: string;
  merchantId: string;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  discountCode?: string;
  deliveryFee: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentDetails?: IRazorpayDetails | IWalletPaymentDetails;
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  notes?: string;
  source: 'WHATSAPP' | 'WEB' | 'APP';
  whatsappMessageId?: string;
  metadata: Record<string, unknown>;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  refundAmount?: number;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Valid order status transitions
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'FAILED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
  FAILED: [],
};

// Valid payment status transitions
const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['AWAITING_PAYMENT', 'FAILED'],
  AWAITING_PAYMENT: ['PAID', 'FAILED'],
  PAID: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  FAILED: ['PENDING', 'AWAITING_PAYMENT'],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ['REFUNDED'],
};

const OrderItemSchema = new Schema<IOrderItem>(
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

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
    isDefault: Boolean,
  },
  { _id: false }
);

const RazorpayDetailsSchema = new Schema<IRazorpayDetails>(
  {
    orderId: String,
    paymentId: String,
    refundId: String,
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    status: String,
    method: String,
    receipt: String,
    notes: { type: Map, of: String },
  },
  { _id: false }
);

const WalletPaymentDetailsSchema = new Schema<IWalletPaymentDetails>(
  {
    transactionId: String,
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    walletBalanceBefore: Number,
    walletBalanceAfter: Number,
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderNumber: {
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
    items: [OrderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
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
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: 'PENDING',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    paymentDetails: {
      type: Schema.Types.Mixed,
    },
    shippingAddress: {
      type: ShippingAddressSchema,
      required: true,
    },
    billingAddress: ShippingAddressSchema,
    notes: String,
    source: {
      type: String,
      enum: ['WHATSAPP', 'WEB', 'APP'],
      default: 'WHATSAPP',
    },
    whatsappMessageId: String,
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    deliveredAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    refundAmount: Number,
    refundReason: String,
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
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ merchantId: 1, status: 1 });
OrderSchema.index({ merchantId: 1, createdAt: -1 });
OrderSchema.index({ 'paymentDetails.orderId': 1 });
OrderSchema.index({ 'paymentDetails.paymentId': 1 });
OrderSchema.index({ createdAt: -1 });

// Method to check if order status transition is valid
OrderSchema.methods.canTransitionTo = function (
  newStatus: OrderStatus
): boolean {
  return ORDER_STATUS_TRANSITIONS[this.status]?.includes(newStatus) ?? false;
};

// Method to check if payment status transition is valid
OrderSchema.methods.canPaymentTransitionTo = function (
  newStatus: PaymentStatus
): boolean {
  return PAYMENT_STATUS_TRANSITIONS[this.paymentStatus]?.includes(newStatus) ?? false;
};

// Method to transition order status
OrderSchema.methods.transitionStatus = function (
  newStatus: OrderStatus
): boolean {
  if (!this.canTransitionTo(newStatus)) {
    return false;
  }

  const previousStatus = this.status;
  this.status = newStatus;

  // Set timestamps for specific statuses
  if (newStatus === 'DELIVERED') {
    this.deliveredAt = new Date();
  } else if (newStatus === 'CANCELLED') {
    this.cancelledAt = new Date();
  }

  return true;
};

// Static method to generate order number
OrderSchema.statics.generateOrderNumber = async function (
  merchantId: string
): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const prefix = `WA${year}${month}${day}`;

  // Find the highest order number for today
  const lastOrder = await this.findOne({
    orderNumber: { $regex: `^${prefix}` },
    merchantId,
  }).sort({ orderNumber: -1 });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(
      lastOrder.orderNumber.replace(prefix, ''),
      10
    );
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

// Static method to find order by payment order ID
OrderSchema.statics.findByRazorpayOrderId = function (
  razorpayOrderId: string
): Promise<IOrder | null> {
  return this.findOne({
    'paymentDetails.orderId': razorpayOrderId,
  });
};

export { Order, OrderSchema, ORDER_STATUS_TRANSITIONS, PAYMENT_STATUS_TRANSITIONS };
export type { IOrder, IOrderItem, IShippingAddress, IRazorpayDetails, IWalletPaymentDetails };
