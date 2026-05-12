import mongoose, { Document, Schema, Model } from 'mongoose';
import { MerchantStatus, SubaccountStatus } from '../types';

export interface IMredmWhamMerchantDocument extends Document {
  merchantId: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  industry: string;
  useCase: string;
  status: MerchantStatus;
  subaccountSid: string;
  subaccountFriendlyName: string;
  subaccountStatus: SubaccountStatus;
  webhookUrl?: string;
  twilioAccountSid: string;
  credentials: {
    apiKeySid: string;
    apiKeySecret: string;
  };
  provisioning: {
    sandboxCompleted: boolean;
    phoneNumbersProvisioned: number;
    templatesApproved: number;
    provisionedAt?: Date;
  };
  limits: {
    maxPhoneNumbers: number;
    maxTemplates: number;
  };
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface IMerchantWhatsAppModel extends Model<IMredmWhamMerchantDocument> {
  findByMerchantId(merchantId: string): Promise<IMredmWhamMerchantDocument | null>;
  findActiveByMerchantId(merchantId: string): Promise<IMredmWhamMerchantDocument | null>;
}

const MerchantWhatsAppSchema = new Schema<IMredmWhamMerchantDocument>(
  {
    merchantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    businessEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    businessPhone: {
      type: String,
      required: true,
      trim: true,
    },
    industry: {
      type: String,
      required: true,
      trim: true,
    },
    useCase: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(MerchantStatus),
      default: MerchantStatus.PENDING,
      index: true,
    },
    subaccountSid: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true,
    },
    subaccountFriendlyName: {
      type: String,
      required: true,
      trim: true,
    },
    subaccountStatus: {
      type: String,
      enum: Object.values(SubaccountStatus),
      default: SubaccountStatus.ACTIVE,
    },
    webhookUrl: {
      type: String,
      trim: true,
    },
    twilioAccountSid: {
      type: String,
      required: true,
    },
    credentials: {
      apiKeySid: {
        type: String,
        required: true,
      },
      apiKeySecret: {
        type: String,
        required: true,
      },
    },
    provisioning: {
      sandboxCompleted: {
        type: Boolean,
        default: false,
      },
      phoneNumbersProvisioned: {
        type: Number,
        default: 0,
        min: 0,
      },
      templatesApproved: {
        type: Number,
        default: 0,
        min: 0,
      },
      provisionedAt: {
        type: Date,
      },
    },
    limits: {
      maxPhoneNumbers: {
        type: Number,
        default: 10,
        min: 1,
      },
      maxTemplates: {
        type: Number,
        default: 50,
        min: 1,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'merchant_whatsapp',
  }
);

MerchantWhatsAppSchema.index({ businessEmail: 1 });
MerchantWhatsAppSchema.index({ status: 1, createdAt: -1 });

MerchantWhatsAppSchema.statics.findByMerchantId = function (
  merchantId: string
): Promise<IMredmWhamMerchantDocument | null> {
  return this.findOne({ merchantId });
};

MerchantWhatsAppSchema.statics.findActiveByMerchantId = function (
  merchantId: string
): Promise<IMredmWhamMerchantDocument | null> {
  return this.findOne({ merchantId, status: MerchantStatus.ACTIVE });
};

MerchantWhatsAppSchema.methods.toPublicJSON = function (): Record<string, unknown> {
  const obj = this.toObject();
  delete obj.credentials;
  delete obj.__v;
  return obj;
};

MerchantWhatsAppSchema.methods.canProvisionPhoneNumber = function (): boolean {
  return (
    this.status === MerchantStatus.ACTIVE &&
    this.provisioning.phoneNumbersProvisioned < this.limits.maxPhoneNumbers
  );
};

MerchantWhatsAppSchema.methods.canProvisionTemplate = function (): boolean {
  return (
    this.status === MerchantStatus.ACTIVE &&
    this.provisioning.templatesApproved < this.limits.maxTemplates
  );
};

const MerchantWhatsApp: IMerchantWhatsAppModel = mongoose.model<
  IMredmWhamMerchantDocument,
  IMerchantWhatsAppModel
>('MerchantWhatsApp', MerchantWhatsAppSchema);

export default MerchantWhatsApp;
