import mongoose, { Document, Schema } from 'mongoose';

export enum MerchantStatus {
  PENDING = 'pending',
  EMAIL_VERIFIED = 'email_verified',
  KYC_SUBMITTED = 'kyc_submitted',
  KYC_VERIFIED = 'kyc_verified',
  BUSINESS_SUBMITTED = 'business_submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended'
}

export interface IBusinessAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IBankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName: string;
}

export interface IMerchant extends Document {
  // Step 1: Basic Info
  email: string;
  password: string;
  phone: string;
  fullName: string;

  // Step 2: Business Info
  businessName?: string;
  businessType?: 'proprietorship' | 'partnership' | 'llp' | 'private_limited' | 'public_limited';
  gstin?: string;
  businessAddress?: IBusinessAddress;

  // Step 3: Bank Details
  bankDetails?: IBankDetails;

  // Status & Verification
  status: MerchantStatus;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

  // Admin Review
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const businessAddressSchema = new Schema<IBusinessAddress>(
  {
    street: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true }
  },
  { _id: false }
);

const bankDetailsSchema = new Schema<IBankDetails>(
  {
    accountHolderName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    branchName: { type: String, trim: true }
  },
  { _id: false }
);

const merchantSchema = new Schema<IMerchant>(
  {
    // Step 1: Basic Info
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian phone number']
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    // Step 2: Business Info
    businessName: {
      type: String,
      trim: true,
      maxlength: 200
    },
    businessType: {
      type: String,
      enum: ['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited']
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please provide a valid GSTIN']
    },
    businessAddress: businessAddressSchema,

    // Step 3: Bank Details
    bankDetails: bankDetailsSchema,

    // Status & Verification
    status: {
      type: String,
      enum: Object.values(MerchantStatus),
      default: MerchantStatus.PENDING
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    emailVerificationExpires: {
      type: Date,
      select: false
    },

    // Admin Review
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    rejectionReason: String
  },
  {
    timestamps: true
  }
);

// Indexes
merchantSchema.index({ email: 1 });
merchantSchema.index({ phone: 1 });
merchantSchema.index({ status: 1 });
merchantSchema.index({ gstin: 1 }, { sparse: true });
merchantSchema.index({ 'businessAddress.state': 1 });
merchantSchema.index({ createdAt: -1 });

// Password comparison method
merchantSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  const merchant = this as IMerchant;
  return bcryptjs.compare(candidatePassword, merchant.password);
};

// JSON transformation
merchantSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.emailVerificationToken;
    delete ret.emailVerificationExpires;
    delete ret.__v;
    return ret;
  }
});

// Import bcryptjs here to avoid circular dependency issues
import bcryptjs from 'bcryptjs';

const Merchant = mongoose.model<IMerchant>('Merchant', merchantSchema);

export default Merchant;
