import Redis from 'ioredis';
import { Product, IProduct } from '../models/Product';
import axios from 'axios';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const CACHE_TTL_PRODUCTS = parseInt(process.env.CACHE_TTL_PRODUCTS || '300', 10);
const CACHE_TTL_CATEGORIES = parseInt(process.env.CACHE_TTL_CATEGORIES || '3600', 10);
const CACHE_TTL_SEARCH = parseInt(process.env.CACHE_TTL_SEARCH || '60', 10);

export interface ProductQueryOptions {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  sortBy?: 'name' | 'price' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class CatalogService {
  /**
   * Get product by ID
   */
  async getProductById(productId: string, merchantId: string): Promise<IProduct | null> {
    const cacheKey = `product:${merchantId}:${productId}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const product = await Product.findOne({
      productId,
      merchantId,
      isActive: true,
      isPublished: true,
    });

    if (product) {
      await redis.setex(cacheKey, CACHE_TTL_PRODUCTS, JSON.stringify(product));
    }

    return product;
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string, merchantId: string): Promise<IProduct | null> {
    return Product.findOne({
      sku,
      merchantId,
      isActive: true,
      isPublished: true,
    });
  }

  /**
   * List products with filtering and pagination
   */
  async listProducts(
    merchantId: string,
    options: ProductQueryOptions = {}
  ): Promise<PaginatedResult<IProduct>> {
    const {
      page = 1,
      limit = 20,
      category,
      subcategory,
      brand,
      tags,
      minPrice,
      maxPrice,
      inStock = true,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const query: Record<string, unknown> = {
      merchantId,
      isActive: true,
      isPublished: true,
    };

    if (category) {
      query.category = category;
    }
    if (subcategory) {
      query.subcategory = subcategory;
    }
    if (brand) {
      query.brand = brand;
    }
    if (tags && tags.length > 0) {
      query.tags = { $all: tags };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.basePrice = {};
      if (minPrice !== undefined) {
        (query.basePrice as Record<string, number>).$gte = minPrice;
      }
      if (maxPrice !== undefined) {
        (query.basePrice as Record<string, number>).$lte = maxPrice;
      }
    }
    if (inStock) {
      query.inventory = { $gt: 0 };
    }
    if (featured !== undefined) {
      query.isFeatured = featured;
    }

    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limit),
      Product.countDocuments(query),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Search products by text
   */
  async searchProducts(
    merchantId: string,
    query: string,
    options: ProductQueryOptions = {}
  ): Promise<PaginatedResult<IProduct>> {
    const { page = 1, limit = 20, inStock = true } = options;
    const cacheKey = `search:${merchantId}:${query}:${page}:${limit}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const searchQuery: Record<string, unknown> = {
      merchantId,
      isActive: true,
      isPublished: true,
      $text: { $search: query },
    };

    if (inStock) {
      searchQuery.inventory = { $gt: 0 };
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(searchQuery, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(searchQuery),
    ]);

    const result: PaginatedResult<IProduct> = {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };

    await redis.setex(cacheKey, CACHE_TTL_SEARCH, JSON.stringify(result));

    return result;
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(merchantId: string, limit: number = 10): Promise<IProduct[]> {
    const cacheKey = `featured:${merchantId}:${limit}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const products = await Product.find({
      merchantId,
      isActive: true,
      isPublished: true,
      isFeatured: true,
      inventory: { $gt: 0 },
    })
      .sort({ updatedAt: -1 })
      .limit(limit);

    await redis.setex(cacheKey, CACHE_TTL_PRODUCTS, JSON.stringify(products));

    return products;
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(
    merchantId: string,
    category: string,
    options: ProductQueryOptions = {}
  ): Promise<PaginatedResult<IProduct>> {
    return this.listProducts(merchantId, {
      ...options,
      category,
    });
  }

  /**
   * Get related products
   */
  async getRelatedProducts(
    productId: string,
    merchantId: string,
    limit: number = 5
  ): Promise<IProduct[]> {
    const product = await this.getProductById(productId, merchantId);
    if (!product) {
      return [];
    }

    return Product.find({
      merchantId,
      isActive: true,
      isPublished: true,
      inventory: { $gt: 0 },
      $or: [
        { category: product.category },
        { subcategory: product.subcategory },
        { tags: { $in: product.tags } },
      ],
      productId: { $ne: productId },
    })
      .sort({ isFeatured: -1, updatedAt: -1 })
      .limit(limit);
  }

  /**
   * Get all categories
   */
  async getCategories(merchantId: string): Promise<string[]> {
    const cacheKey = `categories:${merchantId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const categories = await Product.distinct('category', {
      merchantId,
      isActive: true,
      isPublished: true,
    });

    await redis.setex(cacheKey, CACHE_TTL_CATEGORIES, JSON.stringify(categories));

    return categories;
  }

  /**
   * Get subcategories for a category
   */
  async getSubcategories(
    merchantId: string,
    category: string
  ): Promise<string[]> {
    const cacheKey = `subcategories:${merchantId}:${category}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const subcategories = await Product.distinct('subcategory', {
      merchantId,
      category,
      isActive: true,
      isPublished: true,
      subcategory: { $ne: null, $ne: '' },
    });

    await redis.setex(cacheKey, CACHE_TTL_CATEGORIES, JSON.stringify(subcategories));

    return subcategories;
  }

  /**
   * Check stock availability
   */
  async checkStock(
    productId: string,
    variantId: string | undefined,
    quantity: number,
    merchantId: string
  ): Promise<{ available: boolean; currentStock: number; requested: number }> {
    const cacheKey = `stock:${merchantId}:${productId}:${variantId || 'default'}`;
    let currentStock: number;

    const product = await this.getProductById(productId, merchantId);
    if (!product) {
      return { available: false, currentStock: 0, requested: quantity };
    }

    if (variantId) {
      const variant = product.variants.find((v) => v.sku === variantId);
      currentStock = variant?.inventory ?? 0;
    } else {
      currentStock = product.inventory;
    }

    return {
      available: currentStock >= quantity,
      currentStock,
      requested: quantity,
    };
  }

  /**
   * Reserve stock (decrement inventory)
   */
  async reserveStock(
    productId: string,
    variantId: string | undefined,
    quantity: number,
    merchantId: string
  ): Promise<boolean> {
    const product = await Product.findOne({
      productId,
      merchantId,
      isActive: true,
    });

    if (!product) {
      return false;
    }

    if (variantId) {
      const variantIndex = product.variants.findIndex((v) => v.sku === variantId);
      if (variantIndex === -1) {
        return false;
      }
      if (product.variants[variantIndex].inventory < quantity) {
        return false;
      }
      product.variants[variantIndex].inventory -= quantity;
    } else {
      if (product.inventory < quantity) {
        return false;
      }
      product.inventory -= quantity;
    }

    await product.save();

    // Invalidate cache
    const cacheKey = `product:${merchantId}:${productId}`;
    await redis.del(cacheKey);

    return true;
  }

  /**
   * Release reserved stock (increment inventory)
   */
  async releaseStock(
    productId: string,
    variantId: string | undefined,
    quantity: number,
    merchantId: string
  ): Promise<boolean> {
    const product = await Product.findOne({
      productId,
      merchantId,
      isActive: true,
    });

    if (!product) {
      return false;
    }

    if (variantId) {
      const variantIndex = product.variants.findIndex((v) => v.sku === variantId);
      if (variantIndex === -1) {
        return false;
      }
      product.variants[variantIndex].inventory += quantity;
    } else {
      product.inventory += quantity;
    }

    await product.save();

    // Invalidate cache
    const cacheKey = `product:${merchantId}:${productId}`;
    await redis.del(cacheKey);

    return true;
  }

  /**
   * Create product
   */
  async createProduct(data: Partial<IProduct>): Promise<IProduct> {
    const { v4: uuidv4 } = await import('uuid');

    const product = new Product({
      ...data,
      productId: data.productId || uuidv4(),
    });

    await product.save();

    return product;
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    merchantId: string,
    data: Partial<IProduct>
  ): Promise<IProduct | null> {
    const product = await Product.findOneAndUpdate(
      { productId, merchantId },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (product) {
      // Invalidate cache
      const cacheKey = `product:${merchantId}:${productId}`;
      await redis.del(cacheKey);
    }

    return product;
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(productId: string, merchantId: string): Promise<boolean> {
    const result = await Product.updateOne(
      { productId, merchantId },
      { $set: { isActive: false, isPublished: false } }
    );

    if (result.modifiedCount > 0) {
      // Invalidate cache
      const cacheKey = `product:${merchantId}:${productId}`;
      await redis.del(cacheKey);
      return true;
    }

    return false;
  }

  /**
   * Get product recommendations
   */
  async getRecommendations(
    customerId: string,
    merchantId: string,
    limit: number = 10
  ): Promise<IProduct[]> {
    // Try to get recommendations from ML service
    const recommendationServiceUrl = process.env.RECOMMENDATION_SERVICE_URL;

    if (recommendationServiceUrl) {
      try {
        const response = await axios.post(
          `${recommendationServiceUrl}/recommend`,
          {
            customerId,
            merchantId,
            type: 'product',
            limit,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );

        if (response.data?.products) {
          const productIds = response.data.products.map((p: { productId: string }) => p.productId);
          const products = await Product.find({
            productId: { $in: productIds },
            merchantId,
            isActive: true,
            isPublished: true,
            inventory: { $gt: 0 },
          });

          // Preserve order from recommendations
          return productIds.map((id: string) =>
            products.find((p) => p.productId === id)
          ).filter(Boolean);
        }
      } catch (error) {
        console.error('Failed to get recommendations from ML service:', error);
      }
    }

    // Fallback to featured products
    return this.getFeaturedProducts(merchantId, limit);
  }
}

export const catalogService = new CatalogService();
