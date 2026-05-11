import { Router, Request, Response, NextFunction } from 'express';
import {
  getProductPage,
  getStoreProducts,
  updateDisplayInfo,
  checkAvailability,
  upsertProductPage,
  bulkUpdateProducts,
  getProductAnalytics,
} from '../services/productPageService';

const router = Router();

// Validation middleware
const validateProductId = (req: Request, res: Response, next: NextFunction): void => {
  const { productId } = req.params;
  if (!productId) {
    res.status(400).json({ error: 'productId is required' });
    return;
  }
  next();
};

const validateMerchantId = (req: Request, res: Response, next: NextFunction): void => {
  const { merchantId } = req.query;
  if (!merchantId) {
    res.status(400).json({ error: 'merchantId is required' });
    return;
  }
  next();
};

// Get product page
// GET /api/product/:productId
router.get('/:productId', validateProductId, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { bypassCache } = req.query;

    const product = await getProductPage(productId, {
      bypassCache: bypassCache === 'true',
    });

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        productId: product.productId,
        merchantId: product.merchantId,
        displayName: product.displayName,
        displayPrice: product.displayPrice,
        displayImage: product.displayImage,
        available: product.available,
        storeStock: product.storeStock,
        nearestStore: product.nearestStore,
        rating: product.rating,
        reviewCount: product.reviewCount,
        cashback: product.cashback,
        coinBooster: product.coinBooster,
        buyUrl: product.buyUrl,
        addToCartUrl: product.addToCartUrl,
        description: product.description,
        brand: product.brand,
        category: product.category,
        tags: product.tags,
        lastSynced: product.lastSynced,
      },
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
    });
  }
});

// Get store products
// GET /api/product/store/:storeId
router.get('/store/:storeId', validateMerchantId, async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { merchantId, category, availableOnly, limit, offset } = req.query;

    const result = await getStoreProducts(merchantId as string, storeId, {
      category: category as string | undefined,
      availableOnly: availableOnly === 'true',
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching store products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store products',
    });
  }
});

// Update product display info
// PATCH /api/product/:productId
router.patch('/:productId', validateProductId, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const updates = req.body;

    // Validate allowed fields
    const allowedFields = [
      'displayName',
      'displayPrice',
      'displayImage',
      'description',
      'brand',
      'category',
      'tags',
    ];
    const invalidFields = Object.keys(updates).filter(
      (key) => !allowedFields.includes(key)
    );

    if (invalidFields.length > 0) {
      res.status(400).json({
        success: false,
        error: `Invalid fields: ${invalidFields.join(', ')}`,
      });
      return;
    }

    const product = await updateDisplayInfo(productId, updates);

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
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
    });
  }
});

// Check product availability
// GET /api/product/:productId/availability
router.get('/:productId/availability', validateProductId, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { storeId } = req.query;

    const availability = await checkAvailability(productId, storeId as string | undefined);

    res.json({
      success: true,
      data: availability,
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability',
    });
  }
});

// Create or update product
// POST /api/product
router.post('/', async (req: Request, res: Response) => {
  try {
    const productData = req.body;

    // Validate required fields
    const requiredFields = [
      'productId',
      'merchantId',
      'displayName',
      'displayPrice',
      'displayImage',
      'buyUrl',
      'addToCartUrl',
    ];
    const missingFields = requiredFields.filter((field) => !productData[field]);

    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
      return;
    }

    const product = await upsertProductPage(productData);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
    });
  }
});

// Bulk update products
// POST /api/product/bulk
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products)) {
      res.status(400).json({
        success: false,
        error: 'products must be an array',
      });
      return;
    }

    if (products.length === 0) {
      res.status(400).json({
        success: false,
        error: 'products array cannot be empty',
      });
      return;
    }

    const result = await bulkUpdateProducts(products);

    res.json({
      success: true,
      data: {
        updated: result.updated,
        errors: result.errors,
      },
      summary: {
        total: products.length,
        successful: result.updated,
        failed: result.errors.length,
      },
    });
  } catch (error) {
    console.error('Error bulk updating products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update products',
    });
  }
});

// Get product analytics
// GET /api/product/analytics/:merchantId
router.get('/analytics/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate } = req.query;

    const analytics = await getProductAnalytics(
      merchantId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product analytics',
    });
  }
});

export default router;
