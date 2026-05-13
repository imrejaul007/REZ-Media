import { Address, IAddress, IAddressDoc, validateAddress } from '../models/Address';

// Address input interface
export interface AddressInput {
  label?: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
  latitude?: number;
  longitude?: number;
  landmark?: string;
  deliveryInstructions?: string;
}

// Address response interface
export interface AddressResponse {
  success: boolean;
  address?: IAddress;
  addresses?: IAddress[];
  error?: string;
  code?: string;
  validationErrors?: string[];
}

// India state list for validation
const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep', 'Puducherry',
];

/**
 * Get all addresses for a user
 */
export const getAddresses = async (userId: string): Promise<AddressResponse> => {
  try {
    const addressDoc = await Address.findByUser(userId);
    if (!addressDoc) {
      return { success: true, addresses: [] };
    }
    return { success: true, addresses: addressDoc.addresses };
  } catch (error) {
    console.error('Error getting addresses:', error);
    return {
      success: false,
      error: 'Failed to get addresses',
      code: 'ADDRESS_GET_FAILED',
    };
  }
};

/**
 * Get a specific address
 */
export const getAddress = async (
  userId: string,
  addressId: string
): Promise<AddressResponse> => {
  try {
    const addressDoc = await Address.findByUser(userId);
    if (!addressDoc) {
      return {
        success: false,
        error: 'Address not found',
        code: 'ADDRESS_NOT_FOUND',
      };
    }

    const address = addressDoc.addresses.find(
      (a) => a._id?.toString() === addressId
    );

    if (!address) {
      return {
        success: false,
        error: 'Address not found',
        code: 'ADDRESS_NOT_FOUND',
      };
    }

    return { success: true, address };
  } catch (error) {
    console.error('Error getting address:', error);
    return {
      success: false,
      error: 'Failed to get address',
      code: 'ADDRESS_GET_FAILED',
    };
  }
};

/**
 * Add a new address
 */
export const addAddress = async (
  userId: string,
  input: AddressInput
): Promise<AddressResponse> => {
  try {
    // Validate address
    const validationErrors = validateAddress(input);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: 'Address validation failed',
        code: 'VALIDATION_FAILED',
        validationErrors,
      };
    }

    // Validate state
    if (input.state && !INDIA_STATES.includes(input.state)) {
      return {
        success: false,
        error: 'Invalid state',
        code: 'INVALID_STATE',
        validationErrors: ['Invalid Indian state'],
      };
    }

    const address: IAddress = {
      label: input.label || 'Home',
      recipientName: input.recipientName,
      phone: input.phone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country || 'India',
      isDefault: input.isDefault || false,
      latitude: input.latitude,
      longitude: input.longitude,
      landmark: input.landmark,
      deliveryInstructions: input.deliveryInstructions,
    };

    const addressDoc = await Address.addAddress(userId, address);

    // Find the newly added address
    const addedAddress = addressDoc.addresses[addressDoc.addresses.length - 1];

    return { success: true, address: addedAddress };
  } catch (error) {
    console.error('Error adding address:', error);
    return {
      success: false,
      error: 'Failed to add address',
      code: 'ADDRESS_ADD_FAILED',
    };
  }
};

/**
 * Update an existing address
 */
export const updateAddress = async (
  userId: string,
  addressId: string,
  updates: Partial<AddressInput>
): Promise<AddressResponse> => {
  try {
    // Validate if address exists
    const existing = await getAddress(userId, addressId);
    if (!existing.success || !existing.address) {
      return existing;
    }

    // Validate state if being updated
    if (updates.state && !INDIA_STATES.includes(updates.state)) {
      return {
        success: false,
        error: 'Invalid state',
        code: 'INVALID_STATE',
      };
    }

    const addressDoc = await Address.updateAddress(userId, addressId, updates as Partial<IAddress>);

    if (!addressDoc) {
      return {
        success: false,
        error: 'Address not found',
        code: 'ADDRESS_NOT_FOUND',
      };
    }

    const updatedAddress = addressDoc.addresses.find(
      (a) => a._id?.toString() === addressId
    );

    return { success: true, address: updatedAddress };
  } catch (error) {
    console.error('Error updating address:', error);
    return {
      success: false,
      error: 'Failed to update address',
      code: 'ADDRESS_UPDATE_FAILED',
    };
  }
};

/**
 * Delete an address
 */
export const deleteAddress = async (
  userId: string,
  addressId: string
): Promise<AddressResponse> => {
  try {
    const success = await Address.deleteAddress(userId, addressId);

    if (!success) {
      return {
        success: false,
        error: 'Address not found',
        code: 'ADDRESS_NOT_FOUND',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting address:', error);
    return {
      success: false,
      error: 'Failed to delete address',
      code: 'ADDRESS_DELETE_FAILED',
    };
  }
};

/**
 * Set default address
 */
export const setDefaultAddress = async (
  userId: string,
  addressId: string
): Promise<AddressResponse> => {
  try {
    const addressDoc = await Address.setDefaultAddress(userId, addressId);

    if (!addressDoc) {
      return {
        success: false,
        error: 'Address not found',
        code: 'ADDRESS_NOT_FOUND',
      };
    }

    const updatedAddress = addressDoc.addresses.find(
      (a) => a._id?.toString() === addressId
    );

    return { success: true, address: updatedAddress };
  } catch (error) {
    console.error('Error setting default address:', error);
    return {
      success: false,
      error: 'Failed to set default address',
      code: 'ADDRESS_SET_DEFAULT_FAILED',
    };
  }
};

/**
 * Get default address
 */
export const getDefaultAddress = async (userId: string): Promise<AddressResponse> => {
  try {
    const addressDoc = await Address.findByUser(userId);
    if (!addressDoc || addressDoc.addresses.length === 0) {
      return { success: true, addresses: [] };
    }

    const defaultAddress = addressDoc.addresses.find((a) => a.isDefault);
    return { success: true, address: defaultAddress || addressDoc.addresses[0] };
  } catch (error) {
    console.error('Error getting default address:', error);
    return {
      success: false,
      error: 'Failed to get default address',
      code: 'ADDRESS_GET_DEFAULT_FAILED',
    };
  }
};

/**
 * Validate address format
 */
export const validateAddressFormat = (address: Partial<AddressInput>): string[] => {
  return validateAddress(address);
};

/**
 * Parse and normalize Indian address
 * This would integrate with address verification APIs in production
 */
export const normalizeAddress = async (
  address: Partial<AddressInput>
): Promise<{
  success: boolean;
  normalized?: Partial<AddressInput>;
  suggestions?: Partial<AddressInput>[];
  error?: string;
}> => {
  try {
    // Basic normalization
    const normalized: Partial<AddressInput> = {
      ...address,
      recipientName: address.recipientName?.trim().toUpperCase(),
      addressLine1: address.addressLine1?.trim(),
      city: address.city?.trim().toUpperCase(),
      state: address.state?.trim().toUpperCase(),
      postalCode: address.postalCode?.replace(/\s/g, ''),
    };

    // Validate postal code format
    if (normalized.postalCode && !/^[1-9]\d{5}$/.test(normalized.postalCode)) {
      return {
        success: false,
        error: 'Invalid postal code format',
      };
    }

    // In production, this would:
    // 1. Validate address exists using India Post API
    // 2. Suggest corrections
    // 3. Add geocoding data

    return { success: true, normalized };
  } catch (error) {
    console.error('Error normalizing address:', error);
    return {
      success: false,
      error: 'Failed to normalize address',
    };
  }
};

/**
 * Get address suggestions based on partial input
 */
export const getAddressSuggestions = async (
  partial: { postalCode?: string; city?: string; state?: string }
): Promise<{
  success: boolean;
  suggestions?: Array<{ postalCode: string; city: string; state: string }>;
}> => {
  try {
    // In production, this would use India Post PIN code API
    // For now, return empty array
    return { success: true, suggestions: [] };
  } catch (error) {
    console.error('Error getting address suggestions:', error);
    return { success: false };
  }
};

/**
 * Validate PIN code
 */
export const validatePinCode = async (pinCode: string): Promise<{
  valid: boolean;
  location?: {
    city: string;
    state: string;
    district: string;
  };
}> => {
  try {
    // Basic format check
    if (!/^[1-9]\d{5}$/.test(pinCode)) {
      return { valid: false };
    }

    // In production, this would validate against India Post database
    // For now, return basic validation
    return {
      valid: true,
      location: {
        city: 'Unknown',
        state: 'Unknown',
        district: 'Unknown',
      },
    };
  } catch {
    return { valid: false };
  }
};
