import mongoose, { Document, Schema } from 'mongoose';

export enum KYCDocumentType {
  PAN_CARD = 'pan_card',
  GST_CERTIFICATE = 'gst_certificate',
  BANK_ACCOUNT_PROOF = 'bank_account_proof',
  ADDRESS_PROOF = 'address_proof',
  BUSINESS_ADDRESS_PROOF = 'business_address_proof',
  IDENTITY_PROOF = 'identity_proof',
  CANCELLED_CHEQUE = 'cancelled_cheque',
  UPI_QR = 'upi_qr'
}

export enum KYCStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  REVISION_REQUESTED = 'revision_requested'
}

export interface IKYCAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IKYCDocument {
  type: KYCDocumentType;
  fileUrl: string;
  fileName: string;
  uploadedAt: Date;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
}

export interface IKYC extends Document {
  merchantId: mongoose.Types.ObjectId;
  documents: IKYCDocument[];

  // Extracted info from documents
  panNumber?: string;
  aadhaarNumber?: string;

  // Address details
  permanentAddress?: IKYCAddress;

  // Status
  status: KYCStatus;
  rejectionReason?: string;

  // Verification
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const kycAddressSchema = new Schema<IKYCAddress>(
  {
    street: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true }
  },
  { _id: false }
);

const kycDocumentSchema = new Schema<IKYCDocument>(
  {
    type: {
      type: String,
      required: true,
      enum: Object.values(KYCDocumentType)
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectionReason: String
  },
  { _id: false }
);

const kycSchema = new Schema<IKYC>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      unique: true
    },
    documents: {
      type: [kycDocumentSchema],
      default: []
    },

    // Extracted info from documents
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Please provide a valid PAN number']
    },
    aadhaarNumber: {
      type: String,
      trim: true,
      match: [/^\d{12}$/, 'Please provide a valid 12-digit Aadhaar number']
    },

    // Address details
    permanentAddress: kycAddressSchema,

    // Status
    status: {
      type: String,
      enum: Object.values(KYCStatus),
      default: KYCStatus.PENDING
    },
    rejectionReason: String,

    // Verification
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date
  },
  {
    timestamps: true
  }
);

// Indexes
kycSchema.index({ merchantId: 1 }, { unique: true });
kycSchema.index({ status: 1 });
kycSchema.index({ 'documents.type': 1 });
kycSchema.index({ panNumber: 1 }, { sparse: true });

// JSON transformation
kycSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

const KYC = mongoose.model<IKYC>('KYC', kycSchema);

export default KYC;
