import mongoose, { Document, Schema, Model } from 'mongoose';
import { TemplateStatus, TemplateCategory, TemplateComponent } from '../types';

export interface ITemplateDocument extends Document {
  merchantId: string;
  subaccountSid: string;
  twilioSid: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: TemplateComponent[];
  twilioDetails: {
    friendlyName: string;
    dateCreated: Date;
    dateUpdated?: Date;
  };
  rejection?: {
    reason: string;
    rejectedAt: Date;
  };
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface ITemplateModel extends Model<ITemplateDocument> {
  findByMerchantId(merchantId: string): Promise<ITemplateDocument[]>;
  findApprovedByMerchantId(merchantId: string): Promise<ITemplateDocument[]>;
  findByTwilioSid(twilioSid: string): Promise<ITemplateDocument | null>;
  findByNameAndMerchant(merchantId: string, name: string): Promise<ITemplateDocument | null>;
}

const TemplateSchema = new Schema<ITemplateDocument>(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      required: true,
      maxlength: 10,
    },
    category: {
      type: String,
      enum: Object.values(TemplateCategory),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TemplateStatus),
      default: TemplateStatus.PENDING,
      index: true,
    },
    components: {
      type: [
        {
          type: {
            type: String,
            enum: ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'],
            required: true,
          },
          format: {
            type: String,
            enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'],
          },
          text: {
            type: String,
          },
          mediaUrl: {
            type: String,
          },
          buttons: {
            type: [
              {
                type: {
                  type: String,
                  enum: ['PHONE_NUMBER', 'URL', 'QUICK_REPLY'],
                  required: true,
                },
                text: {
                  type: String,
                  required: true,
                },
                phoneNumber: {
                  type: String,
                },
                url: {
                  type: String,
                },
              },
            ],
          },
          example: {
            header_text: {
              type: [String],
            },
            body_text: {
              type: [[String]],
            },
          },
        },
      ],
      required: true,
      validate: {
        validator: function (components: TemplateComponent[]) {
          return components && components.length > 0;
        },
        message: 'Template must have at least one component',
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
    rejection: {
      reason: {
        type: String,
      },
      rejectedAt: {
        type: Date,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'templates',
  }
);

TemplateSchema.index({ merchantId: 1, status: 1 });
TemplateSchema.index({ merchantId: 1, name: 1 }, { unique: true });
TemplateSchema.index({ subaccountSid: 1, status: 1 });
TemplateSchema.index({ name: 1, language: 1 });

TemplateSchema.statics.findByMerchantId = function (
  merchantId: string
): Promise<ITemplateDocument[]> {
  return this.find({ merchantId }).sort({ createdAt: -1 });
};

TemplateSchema.statics.findApprovedByMerchantId = function (
  merchantId: string
): Promise<ITemplateDocument[]> {
  return this.find({ merchantId, status: TemplateStatus.APPROVED });
};

TemplateSchema.statics.findByTwilioSid = function (
  twilioSid: string
): Promise<ITemplateDocument | null> {
  return this.findOne({ twilioSid });
};

TemplateSchema.statics.findByNameAndMerchant = function (
  merchantId: string,
  name: string
): Promise<ITemplateDocument | null> {
  return this.findOne({ merchantId, name });
};

TemplateSchema.methods.markAsApproved = async function (twilioSid?: string): Promise<void> {
  this.status = TemplateStatus.APPROVED;
  if (twilioSid) {
    this.twilioSid = twilioSid;
  }
  await this.save();
};

TemplateSchema.methods.markAsRejected = async function (reason: string): Promise<void> {
  this.status = TemplateStatus.REJECTED;
  this.rejection = {
    reason,
    rejectedAt: new Date(),
  };
  await this.save();
};

TemplateSchema.methods.markAsFlagged = async function (): Promise<void> {
  this.status = TemplateStatus.FLAGGED;
  await this.save();
};

TemplateSchema.virtual('hasHeader').get(function () {
  return this.components.some((c: TemplateComponent) => c.type === 'HEADER');
});

TemplateSchema.virtual('hasButtons').get(function () {
  return this.components.some((c: TemplateComponent) => c.type === 'BUTTONS');
});

TemplateSchema.set('toJSON', { virtuals: true });
TemplateSchema.set('toObject', { virtuals: true });

const Template: ITemplateModel = mongoose.model<ITemplateDocument, ITemplateModel>(
  'Template',
  TemplateSchema
);

export default Template;
