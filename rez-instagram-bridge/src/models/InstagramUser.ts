import mongoose, { Document, Schema } from 'mongoose';

export interface IInstagramUser extends Document {
  instagramId: string;
  username: string;
  displayName: string;
  fullName: string;
  biography: string;
  profilePictureUrl: string;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  website: string;
  isBusiness: boolean;
  isVerified: boolean;
  email?: string;
  phone?: string;
  linkedRezUserId?: string;
  linkedAt?: Date;
  tags: string[];
  notes: string;
  lastInteractionAt: Date;
  totalMessagesReceived: number;
  totalMessagesSent: number;
  lastMessageId?: string;
  preferences: {
    receiveAutoReplies: boolean;
    receiveHandoffNotifications: boolean;
    preferredLanguage: string;
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const InstagramUserSchema = new Schema<IInstagramUser>(
  {
    instagramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      default: '',
    },
    biography: {
      type: String,
      default: '',
    },
    profilePictureUrl: {
      type: String,
      default: '',
    },
    followersCount: {
      type: Number,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    mediaCount: {
      type: Number,
      default: 0,
    },
    website: {
      type: String,
      default: '',
    },
    isBusiness: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    linkedRezUserId: {
      type: String,
      index: true,
    },
    linkedAt: {
      type: Date,
    },
    tags: [{
      type: String,
      index: true,
    }],
    notes: {
      type: String,
      default: '',
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
    totalMessagesReceived: {
      type: Number,
      default: 0,
    },
    totalMessagesSent: {
      type: Number,
      default: 0,
    },
    lastMessageId: {
      type: String,
    },
    preferences: {
      receiveAutoReplies: {
        type: Boolean,
        default: true,
      },
      receiveHandoffNotifications: {
        type: Boolean,
        default: true,
      },
      preferredLanguage: {
        type: String,
        default: 'en',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
InstagramUserSchema.index({ 'tags': 1 });
InstagramUserSchema.index({ linkedRezUserId: 1 });
InstagramUserSchema.index({ lastInteractionAt: -1 });
InstagramUserSchema.index({ totalMessagesReceived: -1 });

// Virtual for formatted name
InstagramUserSchema.virtual('formattedName').get(function () {
  return this.fullName || this.username;
});

// Static methods
InstagramUserSchema.statics.findByInstagramId = function (instagramId: string) {
  return this.findOne({ instagramId });
};

InstagramUserSchema.statics.findByUsername = function (username: string) {
  return this.findOne({ username: new RegExp(`^${username}$`, 'i') });
};

InstagramUserSchema.statics.findByLinkedRezUserId = function (rezUserId: string) {
  return this.findOne({ linkedRezUserId: rezUserId });
};

export const InstagramUser = mongoose.model<IInstagramUser>('InstagramUser', InstagramUserSchema);
