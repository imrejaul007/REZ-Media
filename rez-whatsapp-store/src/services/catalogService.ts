import { z } from 'zod';
import winston from 'winston';
import { configManager } from '../config';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Product schema
const productVariantSchema = z.object({
  variantId: z.string(),
  name: z.string(),
  sku: z.string(),
  price: z.number().min(0),
  compareAtPrice: z.number().optional(),
  stock: z.number().int().min(0).default(0),
  attributes: z.record(z.string()).optional(),
});

const productSchema = z.object({
  productId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sku: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  basePrice: z.number().min(0),
  compareAtPrice: z.number().optional(),
  images: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
  stock: z.number().int().min(0).default(0),
  variants: z.array(productVariantSchema).optional(),
  tags: z.array(z.string()).optional(),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type ProductVariant = z.infer<typeof productVariantSchema>;
export type Product = z.infer<typeof productSchema>;

export interface CatalogFilter {
  category?: string;
  subcategory?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// In-memory product catalog (replace with actual database in production)
const productCatalog: Map<string, Product> = new Map();
const categories: Set<string> = new Set();
const tagsIndex: Map<string, Set<string>> = new Map();

// Initialize with sample products
const sampleProducts: Product[] = [
  {
    productId: 'PROD-001',
    name: 'Organic Honey',
    description: 'Pure organic honey from local farms. Rich in antioxidants and natural sweetness.',
    sku: 'HON-ORG-500',
    category: 'Food & Beverages',
    subcategory: 'Honey & Sweeteners',
    basePrice: 299,
    compareAtPrice: 349,
    images: ['https://example.com/images/honey-1.jpg'],
    thumbnail: 'https://example.com/thumbs/honey-1.jpg',
    stock: 50,
    tags: ['organic', 'natural', 'bestseller'],
    isAvailable: true,
    isFeatured: true,
  },
  {
    productId: 'PROD-002',
    name: 'Handmade Soap Set',
    description: 'Set of 3 handmade natural soaps with essential oils. Perfect for sensitive skin.',
    sku: 'SOAP-HM-3PK',
    category: 'Personal Care',
    subcategory: 'Bath & Body',
    basePrice: 199,
    images: ['https://example.com/images/soap-1.jpg'],
    thumbnail: 'https://example.com/thumbs/soap-1.jpg',
    stock: 30,
    tags: ['handmade', 'natural', 'gift'],
    isAvailable: true,
    isFeatured: false,
  },
  {
    productId: 'PROD-003',
    name: 'Bamboo Toothbrush Pack',
    description: 'Pack of 4 biodegradable bamboo toothbrushes. Eco-friendly choice.',
    sku: 'BTH-BAM-4PK',
    category: 'Personal Care',
    subcategory: 'Oral Care',
    basePrice: 149,
    images: ['https://example.com/images/brush-1.jpg'],
    thumbnail: 'https://example.com/thumbs/brush-1.jpg',
    stock: 100,
    tags: ['eco-friendly', 'sustainable'],
    isAvailable: true,
    isFeatured: true,
  },
  {
    productId: 'PROD-004',
    name: 'Herbal Tea Collection',
    description: 'Assorted pack of 5 herbal teas. Chamomile, peppermint, green tea, and more.',
    sku: 'TEA-HRB-5PK',
    category: 'Food & Beverages',
    subcategory: 'Tea',
    basePrice: 399,
    compareAtPrice: 449,
    images: ['https://example.com/images/tea-1.jpg'],
    thumbnail: 'https://example.com/thumbs/tea-1.jpg',
    stock: 25,
    tags: ['herbal', 'natural', 'wellness'],
    isAvailable: true,
    isFeatured: false,
  },
  {
    productId: 'PROD-005',
    name: 'Cotton Tote Bag',
    description: 'Organic cotton tote bag. Perfect for shopping and daily use.',
    sku: 'BAG-COT-ORG',
    category: 'Lifestyle',
    subcategory: 'Bags',
    basePrice: 179,
    images: ['https://example.com/images/bag-1.jpg'],
    thumbnail: 'https://example.com/thumbs/bag-1.jpg',
    stock: 75,
    variants: [
      { variantId: 'NAT', name: 'Natural', sku: 'BAG-COT-NAT', price: 179, stock: 40 },
      { variantId: 'BLK', name: 'Black', sku: 'BAG-COT-BLK', price: 199, stock: 35 },
    ],
    tags: ['eco-friendly', 'sustainable', 'organic'],
    isAvailable: true,
    isFeatured: true,
  },
];

// Initialize catalog
sampleProducts.forEach((product) => {
  productCatalog.set(product.productId, product);
  categories.add(product.category);
  if (product.subcategory) categories.add(product.subcategory);
  if (product.tags) {
    product.tags.forEach((tag) => {
      if (!tagsIndex.has(tag)) tagsIndex.set(tag, new Set());
      tagsIndex.get(tag)?.add(product.productId);
    });
  }
});

export class CatalogService {
  private static instance: CatalogService;

  private constructor() {}

  static getInstance(): CatalogService {
    if (!CatalogService.instance) {
      CatalogService.instance = new CatalogService();
    }
    return CatalogService.instance;
  }

  async getProduct(productId: string): Promise<Product | null> {
    return productCatalog.get(productId) || null;
  }

  async getProductBySku(sku: string): Promise<Product | null> {
    for (const product of productCatalog.values()) {
      if (product.sku === sku) return product;
    }
    return null;
  }

  async getProducts(
    filter: CatalogFilter = {},
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<PaginatedResult<Product>> {
    let results = Array.from(productCatalog.values());

    // Apply filters
    if (filter.category) {
      results = results.filter((p) => p.category === filter.category);
    }
    if (filter.subcategory) {
      results = results.filter((p) => p.subcategory === filter.subcategory);
    }
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((p) =>
        filter.tags!.every((tag) => p.tags?.includes(tag))
      );
    }
    if (filter.minPrice !== undefined) {
      results = results.filter((p) => p.basePrice >= filter.minPrice!);
    }
    if (filter.maxPrice !== undefined) {
      results = results.filter((p) => p.basePrice <= filter.maxPrice!);
    }
    if (filter.inStock !== undefined) {
      results = filter.inStock
        ? results.filter((p) => p.stock > 0)
        : results.filter((p) => p.stock === 0);
    }
    if (filter.featured !== undefined) {
      results = results.filter((p) => p.isFeatured === filter.featured);
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower) ||
          p.sku.toLowerCase().includes(searchLower) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply filters to show only available products
    results = results.filter((p) => p.isAvailable);

    // Sort
    const sortBy = pagination.sortBy || 'name';
    const sortOrder = pagination.sortOrder || 'asc';
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.basePrice - b.basePrice;
          break;
        case 'createdAt':
          comparison = (a.metadata?.createdAt as number || 0) - ((b.metadata?.createdAt as number) || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const total = results.length;
    const totalPages = Math.ceil(total / pagination.limit);
    const startIndex = (pagination.page - 1) * pagination.limit;
    const items = results.slice(startIndex, startIndex + pagination.limit);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPrevPage: pagination.page > 1,
    };
  }

  async getFeaturedProducts(limit: number = 5): Promise<Product[]> {
    const featured = Array.from(productCatalog.values()).filter(
      (p) => p.isFeatured && p.isAvailable && p.stock > 0
    );
    return featured.slice(0, limit);
  }

  async getProductsByCategory(
    category: string,
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<PaginatedResult<Product>> {
    return this.getProducts({ category }, pagination);
  }

  async getProductsByTags(
    tags: string[],
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<PaginatedResult<Product>> {
    return this.getProducts({ tags }, pagination);
  }

  async searchProducts(
    query: string,
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<PaginatedResult<Product>> {
    return this.getProducts({ search: query }, pagination);
  }

  async getCategories(): Promise<string[]> {
    return Array.from(categories).sort();
  }

  async getTags(): Promise<string[]> {
    return Array.from(tagsIndex.keys()).sort();
  }

  async checkStock(productId: string, variantId?: string, quantity: number = 1): Promise<boolean> {
    const product = productCatalog.get(productId);
    if (!product) return false;

    if (variantId && product.variants) {
      const variant = product.variants.find((v) => v.variantId === variantId);
      return variant ? variant.stock >= quantity : false;
    }

    return product.stock >= quantity;
  }

  async reserveStock(productId: string, variantId: string | undefined, quantity: number): Promise<boolean> {
    const product = productCatalog.get(productId);
    if (!product) return false;

    if (variantId && product.variants) {
      const variantIndex = product.variants.findIndex((v) => v.variantId === variantId);
      if (variantIndex === -1) return false;
      if (product.variants[variantIndex].stock < quantity) return false;
      product.variants[variantIndex].stock -= quantity;
    } else {
      if (product.stock < quantity) return false;
      product.stock -= quantity;
    }

    return true;
  }

  async releaseStock(productId: string, variantId: string | undefined, quantity: number): Promise<boolean> {
    const product = productCatalog.get(productId);
    if (!product) return false;

    if (variantId && product.variants) {
      const variant = product.variants.find((v) => v.variantId === variantId);
      if (variant) {
        variant.stock += quantity;
      }
    } else {
      product.stock += quantity;
    }

    return true;
  }

  async addProduct(productData: Omit<Product, 'productId'>): Promise<Product> {
    const productId = `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const product: Product = {
      ...productData,
      productId,
    };

    productCatalog.set(productId, product);
    categories.add(product.category);
    if (product.subcategory) categories.add(product.subcategory);
    if (product.tags) {
      product.tags.forEach((tag) => {
        if (!tagsIndex.has(tag)) tagsIndex.set(tag, new Set());
        tagsIndex.get(tag)?.add(product.productId);
      });
    }

    logger.info('Product added', { productId, name: product.name });
    return product;
  }

  async updateProduct(
    productId: string,
    updates: Partial<Product>
  ): Promise<Product | null> {
    const product = productCatalog.get(productId);
    if (!product) return null;

    const updatedProduct = { ...product, ...updates, productId };
    productCatalog.set(productId, updatedProduct);

    logger.info('Product updated', { productId });
    return updatedProduct;
  }

  async deleteProduct(productId: string): Promise<boolean> {
    const deleted = productCatalog.delete(productId);
    if (deleted) {
      logger.info('Product deleted', { productId });
    }
    return deleted;
  }

  async getProductWithVariant(productId: string, variantId: string): Promise<{ product: Product; variant: ProductVariant } | null> {
    const product = productCatalog.get(productId);
    if (!product || !product.variants) return null;

    const variant = product.variants.find((v) => v.variantId === variantId);
    if (!variant) return null;

    return { product, variant };
  }

  getProductPrice(product: Product, variantId?: string): number {
    if (variantId && product.variants) {
      const variant = product.variants.find((v) => v.variantId === variantId);
      return variant?.price || product.basePrice;
    }
    return product.basePrice;
  }

  getProductCompareAtPrice(product: Product, variantId?: string): number | undefined {
    if (variantId && product.variants) {
      const variant = product.variants.find((v) => v.variantId === variantId);
      return variant?.compareAtPrice;
    }
    return product.compareAtPrice;
  }
}

export const catalogService = CatalogService.getInstance();
export default catalogService;
