import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { catalogService, ProductQueryOptions } from '../services/catalogService';
import { authenticateCustomer, authenticateInternalService } from '../middleware/auth';

const router = Router();

// Validation schemas
const productQuerySchema = z.object({
  page: z.string().optional().transform(Number).pipe(z.number().positive().optional()),
  limit: z.string().optional().transform(Number).pipe(z.number().positive().max(100).optional()),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  tags: z.string().optional().transform((s) => s?.split(',').filter(Boolean)),
  minPrice: z.string().optional().transform(Number).pipe(z.number().min(0).optional()),
  maxPrice: z.string().optional().transform(Number).pipe(z.number().min(0).optional()),
  inStock: z.string().optional().transform((s) => s !== 'false'),
  featured: z.string().optional().transform((s) => s === 'true'),
  sortBy: z.enum(['name', 'price', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  shortDescription: z.string().max(200).optional(),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  brand: z.string().optional(),
  images: z.array(z.object({
    url: z.string().url(),
    width: z.number().optional(),
    height: z.number().optional(),
    alt: z.string().optional(),
  })).optional(),
  variants: z.array(z.object({
    name: z.string(),
    sku: z.string(),
    price: z.number().min(0),
    compareAtPrice: z.number().min(0).optional(),
    inventory: z.number().min(0).default(0),
    attributes: z.record(z.string()).optional(),
  })).optional(),
  basePrice: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  currency: z.string().default('INR'),
  inventory: z.number().min(0).default(0),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  weight: z.number().optional(),
  dimensions: z.object({
    length: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  isFeatured: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

const updateProductSchema = createProductSchema.partial();

/**
 * GET /api/catalog/products
 * List products with filtering and pagination
 */
router.get(
  '/products',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queryResult = productQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const options: ProductQueryOptions = {
        page: queryResult.data.page,
        limit: queryResult.data.limit,
        category: queryResult.data.category,
        subcategory: queryResult.data.subcategory,
        brand: queryResult.data.brand,
        tags: queryResult.data.tags,
        minPrice: queryResult.data.minPrice,
        maxPrice: queryResult.data.maxPrice,
        inStock: queryResult.data.inStock,
        featured: queryResult.data.featured,
        sortBy: queryResult.data.sortBy,
        sortOrder: queryResult.data.sortOrder,
      };

      const result = await catalogService.listProducts(req.merchantId!, options);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/catalog/products/featured
 * Get featured products
 */
router.get(
  '/products/featured',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const products = await catalogService.getFeaturedProducts(req.merchantId!, limit);

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/catalog/products/search
 * Search products by text
 */
router.get(
  '/products/search',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters',
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await catalogService.searchProducts(
        req.merchantId!,
        query,
        { page, limit }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/catalog/products/:productId
 * Get product by ID
 */
router.get(
  '/products/:productId',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await catalogService.getProductById(
        req.params.productId,
        req.merchantId!
      );

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Product not found',
        });
        return;
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/catalog/products/:productId/related
 * Get related products
 */
router.get(
  '/products/:productId/related',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const products = await catalogService.getRelatedProducts(
        req.params.productId,
        req.merchantId!,
        limit
      );

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/catalog/products/:productId/recommendations
 * Get product recommendations
 */
router.get(
  '/products/:productId/recommendations',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const products = await catalogService.getRecommendations(
        req.customerId!,
        req.merchantId!,
        limit
      );

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/catalog/categories
 * Get all categories
 */
router.get(
  '/categories',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await catalogService.getCategories(req.merchantId!);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/catalog/categories/:category/subcategories
 * Get subcategories for a category
 */
router.get(
  '/categories/:category/subcategories',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subcategories = await catalogService.getSubcategories(
        req.merchantId!,
        req.params.category
      );

      res.json({
        success: true,
        data: subcategories,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/catalog/categories/:category/products
 * Get products by category
 */
router.get(
  '/categories/:category/products',
  authenticateCustomer,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const queryResult = productQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const result = await catalogService.getProductsByCategory(
        req.merchantId!,
        req.params.category,
        {
          page: queryResult.data.page,
          limit: queryResult.data.limit,
          sortBy: queryResult.data.sortBy,
          sortOrder: queryResult.data.sortOrder,
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/catalog/products (Internal service only)
 * Create a new product
 */
router.post(
  '/products',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = createProductSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const product = await catalogService.createProduct({
        ...bodyResult.data,
        merchantId: req.merchantId || 'default',
        isActive: true,
        isPublished: bodyResult.data.isFeatured || false,
      });

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/catalog/products/:productId (Internal service only)
 * Update a product
 */
router.put(
  '/products/:productId',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bodyResult = updateProductSchema.safeParse(req.body);

      if (!bodyResult.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const product = await catalogService.updateProduct(
        req.params.productId,
        req.merchantId || 'default',
        bodyResult.data
      );

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Product not found',
        });
        return;
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/catalog/products/:productId (Internal service only)
 * Delete a product (soft delete)
 */
router.delete(
  '/products/:productId',
  authenticateInternalService,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const success = await catalogService.deleteProduct(
        req.params.productId,
        req.merchantId || 'default'
      );

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Product not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
