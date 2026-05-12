import mongoose, { Document, Schema, Model } from 'mongoose';
import { PhoneNumberStatus, PhoneNumberType } from '../types';

export interface IPhoneNumberDocument extends Document {
  merchantId: string;
  subaccountSid: string;
  twilioSid: string;
  phoneNumber: string;
  countryCode: string;
  type: PhoneNumberType;
  status: PhoneNumberStatus;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  sandboxConfig?: {
    enabled: boolean;
    addedAt: Date;
  };
  credentials?: {
    messagingServiceSid?: string;
  };
  twilioDetails: {
    friendlyName: string;
    dateCreated: Date;
    dateUpdated?: Date;
  };
  provisioning: {
    requestedAt: Date;
    activatedAt?: Date;
    failedAt?: Date;
    failureReason?: string;
  };
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface IPhoneNumberModel extends Model<IPhoneNumberDocument> {
  findByMerchantId(merchantId: string): Promise<IPhoneNumberDocument[]>;
  findActiveByMerchantId(merchantId: string): Promise<IPhoneNumberDocument[]>;
  findByTwilioSid(twilioSid: string): Promise<IPhoneNumberDocument | null>;
  findByPhoneNumber(phoneNumber: string): Promise<IPhoneNumberDocument | null>;
  findBySubaccountSid(subaccountSid: string): Promise<IPhoneNumberDocument[]>;
}

const PhoneNumberSchema = new Schema<IPhoneNumberDocument>(
  {
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    subaccountSid: {
      type: String,
      required: true,
      index: true,
    },
    twilioSid: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    countryCode: {
      type: String,
      required: true,
      maxlength: 3,
    },
    type: {
      type: String,
      enum: Object.values(PhoneNumberType),
      default: PhoneNumberType.LOCAL,
    },
    status: {
      type: String,
      enum: Object.values(PhoneNumberStatus),
      default: PhoneNumberStatus.PENDING,
      index: true,
    },
    capabilities: {
      voice: {
        type: Boolean,
        default: false,
      },
      sms: {
        type: Boolean,
        default: true,
      },
      mms: {
        type: Boolean,
        default: false,
      },
    },
    sandboxConfig: {
      enabled: {
        type: Boolean,
        default: false,
      },
      addedAt: {
        type: Date,
      },
    },
    credentials: {
      messagingServiceSid: {
        type: String,
      },
    },
    twilioDetails: {
      friendlyName: {
        type: String,
        required: true,
      },
      dateCreated: {
        type: Date,
        required: true,
      },
      dateUpdated: {
        type: Date,
      },
    },
    provisioning: {
      requestedAt: {
        type: Date,
        default: Date.now,
      },
      activatedAt: {
        type: Date,
      },
      failedAt: {
        type: Date,
      },
      failureReason: {
        type: String,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'phone_numbers',
  }
);

PhoneNumberSchema.index({ merchantId: 1, status: 1 });
PhoneNumberSchema.index({ subaccountSid: 1, status: 1 });

PhoneNumberSchema.statics.findByMerchantId = function (
  merchantId: string
): Promise<IPhoneNumberDocument[]> {
  return this.find({ merchantId }).sort({ createdAt: -1 });
};

PhoneNumberSchema.statics.findActiveByMerchantId = function (
  merchantId: string
): Promise<IPhoneNumberDocument[]> {
  return this.find({ merchantId, status: PhoneNumberStatus.ACTIVE });
};

PhoneNumberSchema.statics.findByTwilioSid = function (
  twilioSid: string
): Promise<IPhoneNumberDocument | null> {
  return this.findOne({ twilioSid });
};

PhoneNumberSchema.statics.findByPhoneNumber = function (
  phoneNumber: string
): Promise<IPhoneNumberDocument | null> {
  return this.findOne({ phoneNumber });
};

PhoneNumberSchema.statics.findBySubaccountSid = function (
  subaccountSid: string
): Promise<IPhoneNumberDocument[]> {
  return this.find({ subaccountSid }).sort({ createdAt: -1 });
};

PhoneNumberSchema.methods.markAsActive = async function (): Promise<void> {
  this.status = PhoneNumberStatus.ACTIVE;
  this.provisioning.activatedAt = new Date();
  await this.save();
};

PhoneNumberSchema.methods.markAsFailed = async function (reason: string): Promise<void> {
  this.status = PhoneNumberStatus.FAILED;
  this.provisioning.failedAt = new Date();
  this.provisioning.failureReason = reason;
  await this.save();
};

PhoneNumberSchema.methods.markAsReleased = async function (): Promise<void> {
  this.status = PhoneNumberStatus.RELEASED;
  await this.save();
};

const PhoneNumber: IPhoneNumberModel = mongoose.model<IPhoneNumberDocument, IPhoneNumberModel>(
  'PhoneNumber',
  PhoneNumberSchema
);

export default PhoneNumber;
