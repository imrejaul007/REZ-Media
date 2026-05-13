import mongoose, { Document, Schema } from 'mongoose';

// Address Interface
export interface IAddress {
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  latitude?: number;
  longitude?: number;
  landmark?: string;
  deliveryInstructions?: string;
}

// Address Document Interface
export interface IAddressDoc extends Document {
  userId: string;
  addresses: IAddress[];
  createdAt: Date;
  updatedAt: Date;
}

// Address Schema
const AddressItemSchema = new Schema<IAddress>(
  {
    label: { type: String, required: true },
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
    latitude: { type: Number },
    longitude: { type: Number },
    landmark: { type: String },
    deliveryInstructions: { type: String },
  },
  { _id: true }
);

// Address Document Schema
const AddressSchema = new Schema<IAddressDoc>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    addresses: { type: [AddressItemSchema], default: [] },
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

// Pre-save hook to ensure only one default address
AddressSchema.pre('save', function (next) {
  const defaultAddresses = this.addresses.filter((a) => a.isDefault);
  if (defaultAddresses.length > 1) {
    // Keep only the first default address
    let foundFirst = false;
    this.addresses = this.addresses.map((addr) => {
      if (addr.isDefault && !foundFirst) {
        foundFirst = true;
        return addr;
      }
      return { ...addr.toObject(), isDefault: false };
    });
  }
  next();
});

// Static method to find address document by user
AddressSchema.statics.findByUser = async function (
  userId: string
): Promise<IAddressDoc | null> {
  return this.findOne({ userId });
};

// Static method to add address
AddressSchema.statics.addAddress = async function (
  userId: string,
  address: IAddress
): Promise<IAddressDoc> {
  let doc = await this.findOne({ userId });

  if (!doc) {
    doc = new this({ userId, addresses: [] });
  }

  // If this is the first address, make it default
  if (doc.addresses.length === 0) {
    address.isDefault = true;
  }

  // If new address is default, unset others
  if (address.isDefault) {
    doc.addresses = doc.addresses.map((addr) => ({
      ...addr.toObject(),
      isDefault: false,
    }));
  }

  doc.addresses.push(address);
  await doc.save();

  return doc;
};

// Static method to update address
AddressSchema.statics.updateAddress = async function (
  userId: string,
  addressId: string,
  updates: Partial<IAddress>
): Promise<IAddressDoc | null> {
  const doc = await this.findOne({ userId });
  if (!doc) return null;

  const addressIndex = doc.addresses.findIndex(
    (a) => a._id?.toString() === addressId
  );
  if (addressIndex === -1) return null;

  // Handle default address logic
  if (updates.isDefault) {
    doc.addresses = doc.addresses.map((addr, idx) => ({
      ...addr.toObject(),
      isDefault: idx === addressIndex,
    }));
  }

  doc.addresses[addressIndex] = {
    ...doc.addresses[addressIndex].toObject(),
    ...updates,
  };

  await doc.save();
  return doc;
};

// Static method to delete address
AddressSchema.statics.deleteAddress = async function (
  userId: string,
  addressId: string
): Promise<boolean> {
  const doc = await this.findOne({ userId });
  if (!doc) return false;

  const initialLength = doc.addresses.length;
  doc.addresses = doc.addresses.filter(
    (a) => a._id?.toString() !== addressId
  );

  if (doc.addresses.length === initialLength) return false;

  // If deleted address was default and there are remaining addresses,
  // make the first one default
  if (
    doc.addresses.length > 0 &&
    !doc.addresses.some((a) => a.isDefault)
  ) {
    doc.addresses[0].isDefault = true;
  }

  await doc.save();
  return true;
}

// Static method to set default address
AddressSchema.statics.setDefaultAddress = async function (
  userId: string,
  addressId: string
): Promise<IAddressDoc | null> {
  const doc = await this.findOne({ userId });
  if (!doc) return null;

  doc.addresses = doc.addresses.map((addr) => ({
    ...addr.toObject(),
    isDefault: addr._id?.toString() === addressId,
  }));

  await doc.save();
  return doc;
}

// Address validation utility
export const validateAddress = (address: Partial<IAddress>): string[] => {
  const errors: string[] = [];

  if (!address.recipientName?.trim()) {
    errors.push('Recipient name is required');
  }
  if (!address.phone?.trim()) {
    errors.push('Phone number is required');
  } else if (!/^\+?[6-9]\d{9}$/.test(address.phone.replace(/\s/g, ''))) {
    errors.push('Invalid phone number format');
  }
  if (!address.addressLine1?.trim()) {
    errors.push('Address line 1 is required');
  }
  if (!address.city?.trim()) {
    errors.push('City is required');
  }
  if (!address.state?.trim()) {
    errors.push('State is required');
  }
  if (!address.postalCode?.trim()) {
    errors.push('Postal code is required');
  } else if (!/^[1-9]\d{5}$/.test(address.postalCode)) {
    errors.push('Invalid postal code format');
  }

  return errors;
};

export const Address = mongoose.model<IAddressDoc>('Address', AddressSchema);
