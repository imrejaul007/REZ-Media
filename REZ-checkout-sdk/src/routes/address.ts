import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as addressService from '../services/addressService';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Zod schemas for validation
const AddressSchema = z.object({
  label: z.string().optional(),
  recipientName: z.string().min(1, 'Recipient name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().optional(),
  isDefault: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  landmark: z.string().optional(),
  deliveryInstructions: z.string().optional(),
});

const AddressUpdateSchema = AddressSchema.partial();

/**
 * GET /addresses
 * Get all saved addresses
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await addressService.getAddresses(req.userId!);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      addresses: result.addresses || [],
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /addresses/default
 * Get default address
 */
router.get('/default', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await addressService.getDefaultAddress(req.userId!);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      address: result.address,
    });
  } catch (error) {
    console.error('Get default address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /addresses/:id
 * Get a specific address
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await addressService.getAddress(req.userId!, req.params.id);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      address: result.address,
    });
  } catch (error) {
    console.error('Get address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /addresses
 * Add a new address
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const validation = AddressSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const result = await addressService.addAddress(req.userId!, validation.data);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
        validationErrors: result.validationErrors,
      });
      return;
    }

    res.status(201).json({
      success: true,
      address: result.address,
      message: 'Address added successfully',
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * PUT /addresses/:id
 * Update an address
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const validation = AddressUpdateSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const result = await addressService.updateAddress(
      req.userId!,
      req.params.id,
      validation.data
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      address: result.address,
      message: 'Address updated successfully',
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /addresses/:id
 * Delete an address
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await addressService.deleteAddress(req.userId!, req.params.id);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /addresses/:id/default
 * Set address as default
 */
router.post('/:id/default', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await addressService.setDefaultAddress(req.userId!, req.params.id);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.json({
      success: true,
      address: result.address,
      message: 'Default address updated',
    });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /addresses/validate
 * Validate address format
 */
router.post('/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const validation = AddressSchema.partial().safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const errors = addressService.validateAddressFormat(validation.data);

    res.json({
      success: errors.length === 0,
      valid: errors.length === 0,
      errors,
    });
  } catch (error) {
    console.error('Validate address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /addresses/normalize
 * Normalize address
 */
router.post('/normalize', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await addressService.normalizeAddress(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      normalized: result.normalized,
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error('Normalize address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /addresses/validate/pincode/:pinCode
 * Validate PIN code
 */
router.get('/validate/pincode/:pinCode', async (req: Request, res: Response) => {
  try {
    const result = await addressService.validatePinCode(req.params.pinCode);

    res.json({
      success: true,
      valid: result.valid,
      location: result.location,
    });
  } catch (error) {
    console.error('Validate PIN code error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
