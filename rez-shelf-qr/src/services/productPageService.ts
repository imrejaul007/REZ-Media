import { ProductPage, IProductPage } from '../models/ProductPage';

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600', 10);

interface ProductPageData {
  productId: string;
  merchantId: string;
  displayName: string;
  displayPrice: number;
  displayImage: string;
  available: boolean;
  storeStock?: number;
  nearestStore?: string;
  rating: number;
  reviewCount: number;
  cashback?: number;
  coinBooster?: number;
  buyUrl: string;
  addToCartUrl: string;
  description?: string;
  brand?: string;
  category?: string;
  tags?: string[];
}

/**
 * Get product page data with caching
 */
export async function getProductPage(
  productId: string,
  options?: { bypassCache?: boolean }
): Promise<IProductPage | null> {
  const cacheExpiry = new Date(Date.now() + CACHE_TTL * 1000);

  let product = await ProductPage.findOne({ productId });

  if (!product) {
    return null;
  }

  // Check if cache is expired
  if (!options?.bypassCache && product.cacheExpiry && product.cacheExpiry < new Date()) {
    // Cache expired, mark for refresh
    product = await ProductPage.findOneAndUpdate(
      { productId },
      { cacheExpiry },
      { new: true }
    ) as IProductPage | null;
  }

  return product;
}

/**
 * Get all products for a store with availability
 */
export async function getStoreProducts(
  merchantId: string,
  storeId: string,
  options?: {
    category?: string;
    availableOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ products: IProductPage[]; total: number }> {
  const query: Record<string, unknown> = { merchantId };

  if (options?.category) {
    query.category = options.category;
  }

  if (options?.availableOnly) {
    query.available = true;
  }

  const [products, total] = await Promise.all([
    ProductPage.find(query)
      .sort({ displayName: 1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 50),
    ProductPage.countDocuments(query),
  ]);

  return { products, total };
}

/**
 * Update product display information
 */
export async function updateDisplayInfo(
  productId: string,
  updates: Partial<{
    displayName: string;
    displayPrice: number;
    displayImage: string;
    description: string;
    brand: string;
    category: string;
    tags: string[];
  }>
): Promise<IProductPage | null> {
  const updateData = {
    ...updates,
    lastSynced: new Date(),
    cacheExpiry: new Date(Date.now() + CACHE_TTL * 1000),
  };

  const product = await ProductPage.findOneAndUpdate(
    { productId },
    updateData,
    { new: true }
  );

  return product;
}

/**
 * Check and update product availability
 */
export async function checkAvailability(
  productId: string,
  storeId?: string
): Promise<{ available: boolean; storeStock?: number; nearestStore?: string }> {
  const product = await ProductPage.findOne({ productId });

  if (!product) {
    return { available: false };
  }

  if (storeId) {
    // Check specific store availability
    // In a real implementation, this would query inventory service
    const storeAvailability = await queryInventoryService(productId, storeId);

    if (storeAvailability) {
      await ProductPage.updateOne(
        { productId },
        {
          available: storeAvailability.inStock,
          storeStock: storeAvailability.stock,
          nearestStore: storeId,
          lastSynced: new Date(),
        }
      );

      return {
        available: storeAvailability.inStock,
        storeStock: storeAvailability.stock,
        nearestStore: storeId,
      };
    }
  }

  return {
    available: product.available,
    storeStock: product.storeStock,
    nearestStore: product.nearestStore,
  };
}

/**
 * Create or update product page
 */
export async function upsertProductPage(data: ProductPageData): Promise<IProductPage> {
  const cacheExpiry = new Date(Date.now() + CACHE_TTL * 1000);

  const product = await ProductPage.findOneAndUpdate(
    { productId: data.productId },
    {
      ...data,
      lastSynced: new Date(),
      cacheExpiry,
    },
    { upsert: true, new: true }
  );

  return product;
}

/**
 * Bulk update product pages
 */
export async function bulkUpdateProducts(
  products: ProductPageData[]
): Promise<{ updated: number; errors: Array<{ productId: string; error: string }> }> {
  const errors: Array<{ productId: string; error: string }> = [];
  let updated = 0;

  for (const productData of products) {
    try {
      await upsertProductPage(productData);
      updated++;
    } catch (error) {
      errors.push({
        productId: productData.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { updated, errors };
}

/**
 * Delete expired cache entries
 */
export async function cleanExpiredCache(): Promise<number> {
  const result = await ProductPage.updateMany(
    { cacheExpiry: { $lt: new Date() } },
    {
      $set: {
        cacheExpiry: new Date(Date.now() + CACHE_TTL * 1000),
      },
    }
  );

  return result.modifiedCount;
}

/**
 * Query external inventory service (mock implementation)
 */
async function queryInventoryService(
  productId: string,
  storeId: string
): Promise<{ inStock: boolean; stock: number } | null> {
  // In production, this would call an external inventory API
  // For now, return mock data
  try {
    // Simulated inventory check
    const mockStock = Math.floor(Math.random() * 100);

    return {
      inStock: mockStock > 0,
      stock: mockStock,
    };
  } catch (error) {
    console.error(`Error querying inventory for ${productId} at ${storeId}:`, error);
    return null;
  }
}

/**
 * Get product analytics summary
 */
export async function getProductAnalytics(
  merchantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalProducts: number;
  availableProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  averageRating: number;
}> {
  const matchStage: Record<string, unknown> = { merchantId };

  const result = await ProductPage.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        availableProducts: {
          $sum: { $cond: ['$available', 1, 0] },
        },
        lowStockProducts: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$storeStock', 1] }, { $lte: ['$storeStock', 10] }] },
              1,
              0,
            ],
          },
        },
        outOfStockProducts: {
          $sum: {
            $cond: [{ $eq: ['$storeStock', 0] }, 1, 0],
          },
        },
        averageRating: { $avg: '$rating' },
      },
    },
    {
      $project: {
        _id: 0,
        totalProducts: 1,
        availableProducts: 1,
        lowStockProducts: 1,
        outOfStockProducts: 1,
        averageRating: { $round: ['$averageRating', 2] },
      },
    },
  ]);

  if (result.length === 0) {
    return {
      totalProducts: 0,
      availableProducts: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      averageRating: 0,
    };
  }

  return result[0];
}
