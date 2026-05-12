import winston from 'winston';
import { configManager } from '../config';
import { catalogService, CatalogFilter, PaginationOptions } from '../services/catalogService';
import { productCards } from '../messages/productCards';
import { quickReplies } from '../messages/quickReplies';

const logger = winston.createLogger({
  level: configManager.get().logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface ProductSearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
}

export interface ProductListParams extends ProductSearchParams {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export class ProductHandler {
  private static instance: ProductHandler;

  private constructor() {}

  static getInstance(): ProductHandler {
    if (!ProductHandler.instance) {
      ProductHandler.instance = new ProductHandler();
    }
    return ProductHandler.instance;
  }

  async listProducts(params: ProductListParams = {}): Promise<{
    success: boolean;
    products?: unknown[];
    total?: number;
    page?: number;
    totalPages?: number;
    message?: string;
    error?: string;
  }> {
    try {
      const filter: CatalogFilter = {
        category: params.category,
        tags: params.tags,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        inStock: params.inStock,
        featured: params.featured,
        search: params.query,
      };

      const pagination: PaginationOptions = {
        page: params.page || 1,
        limit: params.limit || 10,
        sortBy: params.sortBy || 'name',
        sortOrder: params.sortOrder || 'asc',
      };

      const result = await catalogService.getProducts(filter, pagination);

      return {
        success: true,
        products: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      };
    } catch (error) {
      logger.error('Error listing products', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list products',
      };
    }
  }

  async getProduct(productId: string): Promise<{
    success: boolean;
    product?: unknown;
    error?: string;
  }> {
    try {
      const product = await catalogService.getProduct(productId);

      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      return { success: true, product };
    } catch (error) {
      logger.error('Error getting product', { error, productId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get product',
      };
    }
  }

  async getFeaturedProducts(limit: number = 5): Promise<{
    success: boolean;
    products?: unknown[];
    error?: string;
  }> {
    try {
      const products = await catalogService.getFeaturedProducts(limit);
      return { success: true, products };
    } catch (error) {
      logger.error('Error getting featured products', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get featured products',
      };
    }
  }

  async searchProducts(query: string, page: number = 1, limit: number = 10): Promise<{
    success: boolean;
    products?: unknown[];
    total?: number;
    page?: number;
    totalPages?: number;
    error?: string;
  }> {
    try {
      const result = await catalogService.searchProducts(query, { page, limit });
      return {
        success: true,
        products: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      };
    } catch (error) {
      logger.error('Error searching products', { error, query });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search products',
      };
    }
  }

  async getCategories(): Promise<{
    success: boolean;
    categories?: string[];
    error?: string;
  }> {
    try {
      const categories = await catalogService.getCategories();
      return { success: true, categories };
    } catch (error) {
      logger.error('Error getting categories', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get categories',
      };
    }
  }

  async getProductsByCategory(category: string, page: number = 1, limit: number = 10): Promise<{
    success: boolean;
    products?: unknown[];
    total?: number;
    page?: number;
    totalPages?: number;
    error?: string;
  }> {
    try {
      const result = await catalogService.getProductsByCategory(category, { page, limit });
      return {
        success: true,
        products: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      };
    } catch (error) {
      logger.error('Error getting products by category', { error, category });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get products',
      };
    }
  }

  async checkStock(productId: string, variantId?: string, quantity: number = 1): Promise<{
    success: boolean;
    available?: boolean;
    stock?: number;
    error?: string;
  }> {
    try {
      const available = await catalogService.checkStock(productId, variantId, quantity);
      const product = await catalogService.getProduct(productId);

      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      let stock: number;
      if (variantId && product.variants) {
        const variant = product.variants.find((v) => v.variantId === variantId);
        stock = variant?.stock || 0;
      } else {
        stock = product.stock;
      }

      return { success: true, available, stock };
    } catch (error) {
      logger.error('Error checking stock', { error, productId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check stock',
      };
    }
  }

  formatProductListForWhatsApp(products: unknown[], page: number = 1): string {
    const productList = (products as ReturnType<typeof catalogService.getProduct>[]);
    if (productList.length === 0) {
      return 'No products found.';
    }

    let message = `📦 Products (Page ${page}):\n\n`;

    productList.forEach((product, index) => {
      const productData = product as {
        productId: string;
        name: string;
        basePrice: number;
        stock: number;
        thumbnail?: string;
      };

      const price = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: configManager.get().store.currency,
        maximumFractionDigits: 0,
      }).format(productData.basePrice);

      const emoji = productData.stock > 0 ? '✅' : '❌';
      message += `${(page - 1) * 10 + index + 1}. ${productData.name}\n`;
      message += `   💰 ${price} ${emoji}\n\n`;
    });

    return message;
  }

  formatProductDetailForWhatsApp(product: unknown): {
    type: 'text' | 'interactive';
    content: string;
    interactive?: Record<string, unknown>;
  } {
    const p = product as {
      productId: string;
      name: string;
      description?: string;
      basePrice: number;
      compareAtPrice?: number;
      images?: string[];
      thumbnail?: string;
      stock: number;
      variants?: Array<{
        variantId: string;
        name: string;
        price: number;
        stock: number;
      }>;
      tags?: string[];
    };

    const card = productCards.formatProductCard(p);

    const interactive = {
      type: 'button' as const,
      body: { text: card },
      action: {
        buttons: [
          { type: 'reply' as const, reply: { id: `add_${p.productId}_1`, title: 'Add 1' } },
          { type: 'reply' as const, reply: { id: `add_${p.productId}_2`, title: 'Add 2' } },
          { type: 'reply' as const, reply: { id: `view_cart`, title: 'View Cart' } },
        ],
      },
    };

    return {
      type: 'interactive',
      content: card,
      interactive: {
        header: { type: 'image' as const, mediaUrl: p.thumbnail || p.images?.[0] },
        ...interactive,
      },
    };
  }

  getProductListQuickReplies(): {
    buttons: Array<{ id: string; title: string }>;
    list?: {
      header: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    };
  } {
    const categories = quickReplies.getCategoryButtons();
    const productActions = quickReplies.getProductActionButtons();

    return {
      buttons: productActions,
      list: {
        header: 'Browse Categories',
        rows: categories.map((cat, idx) => ({
          id: `category_${cat.toLowerCase().replace(/\s+/g, '_')}`,
          title: cat,
          description: `Browse ${cat}`,
        })),
      },
    };
  }
}

export const productHandler = ProductHandler.getInstance();
export default productHandler;
