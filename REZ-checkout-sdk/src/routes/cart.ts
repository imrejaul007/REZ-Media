import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as cartService from '../services/cartService';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Zod schemas for validation
const AddItemSchema = z.object({
  productId: z.string().min(1),
  merchantId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  sku: z.string().optional(),
  imageUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateItemSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  price: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ApplyDiscountSchema = z.object({
  discountAmount: z.number().min(0),
  couponCode: z.string().optional(),
});

/**
 * GET /cart
 * Get current cart
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await cartService.getCart(req.userId, req.sessionId);

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
      cart: result.cart,
      itemCount: result.cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /cart/count
 * Get cart item count
 */
router.get('/count', optionalAuth, async (req: Request, res: Response) => {
  try {
    const count = await cartService.getCartItemCount(req.userId, req.sessionId);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Get cart count error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /cart/items
 * Add item to cart
 */
router.post('/items', optionalAuth, async (req: Request, res: Response) => {
  try {
    const validation = AddItemSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const result = await cartService.addItem(
      req.userId,
      req.sessionId!,
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

    res.status(201).json({
      success: true,
      cart: result.cart,
      itemCount: result.cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
    });
  } catch (error) {
    console.error('Add item error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * PUT /cart/items/:productId
 * Update item in cart
 */
router.put('/items/:productId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const validation = UpdateItemSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const result = await cartService.updateItem(
      req.userId,
      req.sessionId!,
      req.params.productId,
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
      cart: result.cart,
      itemCount: result.cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /cart/items/:productId
 * Remove item from cart
 */
router.delete('/items/:productId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await cartService.removeItem(
      req.userId,
      req.sessionId!,
      req.params.productId
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
      cart: result.cart,
      itemCount: result.cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
    });
  } catch (error) {
    console.error('Remove item error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /cart
 * Clear cart
 */
router.delete('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await cartService.clearCart(req.userId, req.sessionId);

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
      message: 'Cart cleared',
      cart: result.cart,
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /cart/quick-buy
 * Quick buy - single item checkout
 */
router.post('/quick-buy', optionalAuth, async (req: Request, res: Response) => {
  try {
    const validation = AddItemSchema.extend({
      merchantId: z.string().min(1),
    }).safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const result = await cartService.quickBuy(
      req.userId,
      req.sessionId!,
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

    res.status(201).json({
      success: true,
      cart: result.cart,
      checkoutUrl: `/checkout?sessionId=${req.sessionId}`,
    });
  } catch (error) {
    console.error('Quick buy error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /cart/discount
 * Apply discount/coupon
 */
router.post('/discount', optionalAuth, async (req: Request, res: Response) => {
  try {
    const validation = ApplyDiscountSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: validation.error.errors,
      });
      return;
    }

    const result = await cartService.applyDiscount(
      req.userId,
      req.sessionId!,
      validation.data.discountAmount,
      validation.data.couponCode
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
      cart: result.cart,
      discountApplied: validation.data.discountAmount,
    });
  } catch (error) {
    console.error('Apply discount error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /cart/merge
 * Merge guest cart to user cart
 */
router.post('/merge', async (req: Request, res: Response) => {
  try {
    const { guestSessionId, userId } = req.body;

    if (!guestSessionId || !userId) {
      res.status(400).json({
        success: false,
        error: 'guestSessionId and userId are required',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    const result = await cartService.mergeGuestCart(guestSessionId, userId);

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
      cart: result.cart,
      message: 'Cart merged successfully',
    });
  } catch (error) {
    console.error('Merge cart error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
