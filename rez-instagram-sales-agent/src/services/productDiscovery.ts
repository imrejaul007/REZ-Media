import { logger } from '../config/logger';
import { detectProductCategory, ProductCategory } from '../config/knowledge';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  subcategory?: string;
  tags: string[];
  variants?: ProductVariant[];
  inStock: boolean;
  stockCount?: number;
  rating?: number;
  reviewCount?: number;
  features: string[];
  specs?: Record<string, string>;
  shippingInfo?: {
    weight?: number;
    dimensions?: string;
    freeShipping: boolean;
  };
  affiliateLink?: string;
  relatedProducts?: string[];
}

export interface ProductVariant {
  id: string;
  type: 'size' | 'color' | 'style';
  value: string;
  priceModifier?: number;
  inStock: boolean;
}

export interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  tags?: string[];
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
}

export interface DiscoveryContext {
  userQuery: string;
  detectedCategory?: ProductCategory;
  extractedFilters: {
    budget?: { min: number; max: number };
    preferences?: string[];
    occasion?: string;
    style?: string;
  };
}

export class ProductDiscoveryService {
  // Mock product catalog - in production, this would be an API call
  private products: Map<string, Product> = new Map([
    ['prod_001', {
      id: 'prod_001',
      name: 'Classic Denim Jacket',
      description: 'Timeless denim jacket with a modern fit. Perfect for layering.',
      price: 89.99,
      currency: 'USD',
      images: ['https://example.com/denim-jacket-1.jpg'],
      category: 'fashion',
      subcategory: 'outerwear',
      tags: ['denim', 'jacket', 'casual', 'classic'],
      inStock: true,
      stockCount: 45,
      rating: 4.5,
      reviewCount: 128,
      features: ['100% cotton', 'Machine washable', 'Button closure', 'Two chest pockets'],
      variants: [
        { id: 'v1', type: 'size', value: 'S', inStock: true },
        { id: 'v2', type: 'size', value: 'M', inStock: true },
        { id: 'v3', type: 'size', value: 'L', inStock: true },
        { id: 'v4', type: 'size', value: 'XL', inStock: true },
        { id: 'v5', type: 'color', value: 'Vintage Blue', inStock: true },
        { id: 'v6', type: 'color', value: 'Black', inStock: true }
      ],
      shippingInfo: { freeShipping: true },
      relatedProducts: ['prod_002', 'prod_003']
    }],
    ['prod_002', {
      id: 'prod_002',
      name: 'Silk Blend Blouse',
      description: 'Elegant silk blend blouse for work or weekend.',
      price: 65.00,
      currency: 'USD',
      images: ['https://example.com/blouse-1.jpg'],
      category: 'fashion',
      subcategory: 'tops',
      tags: ['blouse', 'silk', 'elegant', 'office'],
      inStock: true,
      rating: 4.8,
      reviewCount: 89,
      features: ['Silk blend fabric', 'Relaxed fit', 'V-neckline'],
      shippingInfo: { freeShipping: true },
      relatedProducts: ['prod_001', 'prod_004']
    }],
    ['prod_003', {
      id: 'prod_003',
      name: 'Wireless Earbuds Pro',
      description: 'Premium sound quality with active noise cancellation.',
      price: 149.99,
      currency: 'USD',
      images: ['https://example.com/earbuds-1.jpg'],
      category: 'electronics',
      subcategory: 'audio',
      tags: ['earbuds', 'wireless', 'bluetooth', 'audio'],
      inStock: true,
      rating: 4.7,
      reviewCount: 342,
      features: ['ANC', '30hr battery', 'IPX5 waterproof', 'USB-C charging'],
      shippingInfo: { freeShipping: false, weight: 0.5 },
      relatedProducts: ['prod_005']
    }],
    ['prod_004', {
      id: 'prod_004',
      name: 'Minimalist Watch',
      description: 'Clean design watch with leather strap.',
      price: 120.00,
      currency: 'USD',
      images: ['https://example.com/watch-1.jpg'],
      category: 'fashion',
      subcategory: 'accessories',
      tags: ['watch', 'minimalist', 'leather', 'classic'],
      inStock: true,
      rating: 4.9,
      reviewCount: 156,
      features: ['Japanese movement', 'Genuine leather', 'Water resistant'],
      variants: [
        { id: 'v1', type: 'color', value: 'Brown', inStock: true },
        { id: 'v2', type: 'color', value: 'Black', inStock: true }
      ],
      shippingInfo: { freeShipping: true },
      relatedProducts: ['prod_002']
    }]
  ]);

  analyzeQuery(query: string): DiscoveryContext {
    const context: DiscoveryContext = {
      userQuery: query,
      extractedFilters: {}
    };

    // Detect category
    context.detectedCategory = detectProductCategory(query);

    // Extract budget hints
    const budgetMatch = query.match(/\$?\d+\s*-\s*\$?\d+|\$?\d+\s*(budget|under|below|above|over)/i);
    if (budgetMatch) {
      const numbers = query.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        context.extractedFilters.budget = {
          min: Math.min(parseInt(numbers[0]), parseInt(numbers[1])),
          max: Math.max(parseInt(numbers[0]), parseInt(numbers[1]))
        };
      }
    }

    // Extract style preferences
    const styleKeywords = ['casual', 'formal', 'elegant', 'sporty', 'boho', 'minimalist', 'vintage', 'modern'];
    const foundStyles = styleKeywords.filter(s => query.toLowerCase().includes(s));
    if (foundStyles.length > 0) {
      context.extractedFilters.style = foundStyles;
    }

    // Extract occasion hints
    const occasionKeywords = ['work', 'party', 'wedding', 'beach', 'office', 'date', 'everyday', 'gym'];
    const foundOccasions = occasionKeywords.filter(o => query.toLowerCase().includes(o));
    if (foundOccasions.length > 0) {
      context.extractedFilters.occasion = foundOccasions;
    }

    logger.debug('Query analyzed', { query, context });
    return context;
  }

  searchProducts(query: string, filters?: SearchFilters): Product[] {
    const context = this.analyzeQuery(query);
    let results: Product[] = Array.from(this.products.values());

    // Apply category filter
    if (context.detectedCategory) {
      results = results.filter(p => p.category === context.detectedCategory!.id);
    }

    // Apply filters
    if (filters?.category) {
      results = results.filter(p => p.category === filters.category);
    }

    if (filters?.minPrice !== undefined) {
      results = results.filter(p => p.price >= filters.minPrice!);
    }

    if (filters?.maxPrice !== undefined) {
      results = results.filter(p => p.price <= filters.maxPrice!);
    }

    if (filters?.inStock !== undefined) {
      results = results.filter(p => p.inStock === filters.inStock);
    }

    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter(p =>
        filters.tags!.some(tag => p.tags.includes(tag))
      );
    }

    // Apply keyword search
    const keywords = query.toLowerCase().split(/\s+/);
    results = results.filter(p => {
      const searchable = `${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase();
      return keywords.some(k => searchable.includes(k));
    });

    // Apply sorting
    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case 'price_asc':
          results.sort((a, b) => a.price - b.price);
          break;
        case 'price_desc':
          results.sort((a, b) => b.price - a.price);
          break;
        case 'newest':
          // In production, would sort by createdAt
          break;
        case 'popular':
          results.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
          break;
      }
    }

    logger.info('Product search', { query, resultsCount: results.length });
    return results.slice(0, 10); // Limit results
  }

  getProductById(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  getRelatedProducts(productId: string): Product[] {
    const product = this.products.get(productId);
    if (!product?.relatedProducts) return [];

    return product.relatedProducts
      .map(id => this.products.get(id))
      .filter((p): p is Product => p !== undefined);
  }

  getProductsByCategory(category: string): Product[] {
    return Array.from(this.products.values()).filter(p => p.category === category);
  }

  getFeaturedProducts(limit: number = 5): Product[] {
    return Array.from(this.products.values())
      .filter(p => p.inStock && (p.rating || 0) >= 4.5)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit);
  }

  getOnSaleProducts(): Product[] {
    // In production, would check for sale prices
    return Array.from(this.products.values())
      .filter(p => p.tags.includes('sale') || p.tags.includes('deal'));
  }

  formatProductSummary(product: Product): string {
    const priceStr = `${product.currency === 'USD' ? '$' : product.currency}${product.price.toFixed(2)}`;
    const shipping = product.shippingInfo?.freeShipping ? 'FREE shipping' : '+ shipping';
    const stock = product.inStock ? 'In stock' : 'Out of stock';

    return `${product.name}\n${priceStr} | ${shipping}\n${stock}\n${product.description.slice(0, 100)}...`;
  }

  formatProductCard(product: Product): string {
    return `🛍️ ${product.name}\n💰 $${product.price.toFixed(2)}\n⭐ ${product.rating?.toFixed(1) || 'New'} (${product.reviewCount || 0})\n📦 ${product.inStock ? 'In stock' : 'Out of stock'}`;
  }

  generateProductSuggestion(context: DiscoveryContext): string {
    const suggestions: string[] = [];

    if (context.detectedCategory) {
      suggestions.push(`I found some great ${context.detectedCategory.name.toLowerCase()} options!`);
    }

    if (context.extractedFilters.style) {
      suggestions.push(`Looking for ${context.extractedFilters.style.join(' or ')} styles?`);
    }

    if (context.extractedFilters.budget) {
      const { min, max } = context.extractedFilters.budget;
      suggestions.push(`Within $${min}-$${max}? I got you!`);
    }

    if (suggestions.length === 0) {
      suggestions.push('Let me find something perfect for you!');
    }

    return suggestions[0];
  }
}

export const productDiscoveryService = new ProductDiscoveryService();
