import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { cartService } from '../services/cartService';
import { authenticateCustomer } from '../middleware/auth';

const router = Router();

// Validation schemas
const addItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().default(1),
});

const updateItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(0),
});

const removeItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
});

const applyDiscountSchema = z.object({
  code: z.string().min(1),
});

const updateDeliveryFeeSchema = z.object({
  deliveryFee: z.number().min(0),
});

/**
 * GET /api/cart
 * Get current cart
 */
router.get(
  '/',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cart = await cartService.getCart(req.customerId!, req.merchantId!);

      if (!cart) {
        res.json({
          success: true,
          data: {
            cartId: null,
            items: [],
            subtotal: 0,
            tax: 0,
            discount: 0,
            deliveryFee: 0,
            total: 0,
            itemCount: 0,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          cartId: cart.cartId,
          items: cart.items,
          subtotal: cart.subtotal,
          tax: cart.tax,
          discount: cart.discount,
          discountCode: cart.discountCode,
          deliveryFee: cart.deliveryFee,
          total: cart.total,
          currency: cart.currency,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/cart/summary
 * Get cart summary
 */
router.get(
  '/summary',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await cartService.getCartSummary(
        req.customerId!,
        req.merchantId!
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cart/items
 * Add item to cart
 */
router.post(
  '/items',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = addItemSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const cart = await cartService.addItem(
        req.customerId!,
        req.customerPhone!,
        req.merchantId!,
        bodyResult.data
      );

      res.status(201).json({
        success: true,
        message: 'Item added to cart',
        data: {
          cartId: cart.cartId,
          items: cart.items,
          subtotal: cart.subtotal,
          total: cart.total,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }
        if (error.message.includes('Insufficient stock')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }
      next(error);
    }
  }
);

/**
 * PUT /api/cart/items
 * Update item quantity in cart
 */
router.put(
  '/items',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = updateItemSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const cart = await cartService.updateItem(
        req.customerId!,
        req.merchantId!,
        bodyResult.data
      );

      res.json({
        success: true,
        message: bodyResult.data.quantity === 0
          ? 'Item removed from cart'
          : 'Cart item updated',
        data: {
          cartId: cart.cartId,
          items: cart.items,
          subtotal: cart.subtotal,
          total: cart.total,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }
        if (error.message.includes('Insufficient stock')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/cart/items
 * Remove item from cart
 */
router.delete(
  '/items',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = removeItemSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const cart = await cartService.removeItem(
        req.customerId!,
        req.merchantId!,
        bodyResult.data
      );

      res.json({
        success: true,
        message: 'Item removed from cart',
        data: {
          cartId: cart.cartId,
          items: cart.items,
          subtotal: cart.subtotal,
          total: cart.total,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/cart
 * Clear cart
 */
router.delete(
  '/',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const success = await cartService.clearCart(req.customerId!, req.merchantId!);

      res.json({
        success,
        message: success ? 'Cart cleared' : 'Cart not found',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/cart/discount
 * Apply discount to cart
 */
router.post(
  '/discount',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = applyDiscountSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const cart = await cartService.applyDiscount(
        req.customerId!,
        req.merchantId!,
        bodyResult.data
      );

      res.json({
        success: true,
        message: 'Discount applied',
        data: {
          discountCode: cart.discountCode,
          discount: cart.discount,
          subtotal: cart.subtotal,
          total: cart.total,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            error: error.message,
          });
          return;
        }
        if (error.message.includes('Invalid discount')) {
          res.status(400).json({
            success: false,
            error: error.message,
          });
          return;
        }
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/cart/discount
 * Remove discount from cart
 */
router.delete(
  '/discount',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cart = await cartService.removeDiscount(req.customerId!, req.merchantId!);

      res.json({
        success: true,
        message: 'Discount removed',
        data: {
          discountCode: null,
          discount: 0,
          subtotal: cart.subtotal,
          total: cart.total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/cart/delivery-fee
 * Update delivery fee
 */
router.put(
  '/delivery-fee',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = updateDeliveryFeeSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const cart = await cartService.updateDeliveryFee(
        req.customerId!,
        req.merchantId!,
        bodyResult.data.deliveryFee
      );

      res.json({
        success: true,
        message: 'Delivery fee updated',
        data: {
          deliveryFee: cart.deliveryFee,
          total: cart.total,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/cart/validate
 * Validate cart for checkout
 */
router.post(
  '/validate',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validation = await cartService.validateForCheckout(
        req.customerId!,
        req.merchantId!
      );

      if (validation.valid) {
        res.json({
          success: true,
          data: {
            valid: true,
            message: 'Cart is valid for checkout',
          },
        });
      } else {
        res.status(400).json({
          success: false,
          data: {
            valid: false,
            errors: validation.errors,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
