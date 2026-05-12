import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import winston from 'winston';
import { configManager } from '../config';
import { cartHandler } from '../handlers/cartHandler';
import { catalogService } from '../services/catalogService';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Validation schemas
const addToCartSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive().default(1),
});

const updateCartSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().min(0),
});

const removeFromCartSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
});

const phoneSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number'),
});

// Middleware for async error handling
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validate request body
const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.errors,
      });
    }
    req.body = result.data;
    next();
  };
};

// Validate query params
const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.errors,
      });
    }
    req.query = result.data;
    next();
  };
};

export function createCartRoutes(): Router {
  const router = Router();

  /**
   * GET /api/cart
   * Get current cart for a phone number
   */
  router.get(
    '/',
    validateQuery(phoneSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { phoneNumber } = req.query as { phoneNumber: string };
      const userId = req.headers['x-user-id'] as string | undefined;

      const result = await cartHandler.getCart(phoneNumber, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    })
  );

  /**
   * GET /api/cart/summary
   * Get cart summary for a phone number
   */
  router.get(
    '/summary',
    validateQuery(phoneSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { phoneNumber } = req.query as { phoneNumber: string };
      const userId = req.headers['x-user-id'] as string | undefined;

      const result = await cartHandler.getCartSummary(phoneNumber, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    })
  );

  /**
   * POST /api/cart/items
   * Add item to cart
   */
  router.post(
    '/items',
    validateBody(z.object({
      phoneNumber: z.string().regex(/^\+?[1-9]\d{6,14}$/),
      productId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().positive().default(1),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const { phoneNumber, productId, variantId, quantity } = req.body;
      const userId = req.headers['x-user-id'] as string | undefined;

      // Validate product exists
      const product = variantId
        ? await catalogService.getProductWithVariant(productId, variantId)
        : await catalogService.getProduct(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      const result = await cartHandler.addItem({
        phoneNumber,
        userId,
        productId,
        variantId,
        quantity,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info('Item added to cart via API', {
        phoneNumber,
        productId,
        quantity,
      });

      res.status(201).json(result);
    })
  );

  /**
   * PATCH /api/cart/items
   * Update item quantity in cart
   */
  router.patch(
    '/items',
    validateBody(z.object({
      phoneNumber: z.string().regex(/^\+?[1-9]\d{6,14}$/),
      productId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().min(0),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const { phoneNumber, productId, variantId, quantity } = req.body;
      const userId = req.headers['x-user-id'] as string | undefined;

      const result = await cartHandler.updateQuantity({
        phoneNumber,
        userId,
        productId,
        variantId,
        quantity,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info('Cart item updated via API', {
        phoneNumber,
        productId,
        quantity,
      });

      res.json(result);
    })
  );

  /**
   * DELETE /api/cart/items
   * Remove item from cart
   */
  router.delete(
    '/items',
    validateBody(removeFromCartSchema.extend({
      phoneNumber: z.string().regex(/^\+?[1-9]\d{6,14}$/),
    })),
    asyncHandler(async (req: Request, res: Response) => {
      const { phoneNumber, productId, variantId } = req.body;
      const userId = req.headers['x-user-id'] as string | undefined;

      const result = await cartHandler.removeItem({
        phoneNumber,
        userId,
        productId,
        variantId,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info('Item removed from cart via API', {
        phoneNumber,
        productId,
      });

      res.json(result);
    })
  );

  /**
   * DELETE /api/cart
   * Clear entire cart
   */
  router.delete(
    '/',
    validateBody(phoneSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { phoneNumber } = req.body;
      const userId = req.headers['x-user-id'] as string | undefined;

      const result = await cartHandler.clearCart(phoneNumber, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      logger.info('Cart cleared via API', { phoneNumber });

      res.json(result);
    })
  );

  /**
   * POST /api/cart/validate
   * Validate cart for checkout
   */
  router.post(
    '/validate',
    validateBody(phoneSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { phoneNumber } = req.body;
      const userId = req.headers['x-user-id'] as string | undefined;

      const result = await cartHandler.validateCartForCheckout(phoneNumber, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    })
  );

  /**
   * GET /api/cart/display
   * Get formatted cart display message
   */
  router.get(
    '/display',
    validateQuery(phoneSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { phoneNumber } = req.query as { phoneNumber: string };
      const userId = req.headers['x-user-id'] as string | undefined;

      const result = await cartHandler.getCart(phoneNumber, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        display: result.display,
        summary: result.cart,
      });
    })
  );

  return router;
}

export default createCartRoutes;
