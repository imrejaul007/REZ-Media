import { configManager } from '../config';

export interface ProductCardData {
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
    compareAtPrice?: number;
    stock: number;
  }>;
  tags?: string[];
  isFeatured?: boolean;
  sku?: string;
}

export class ProductCardFormatter {
  private static instance: ProductCardFormatter;

  private constructor() {}

  static getInstance(): ProductCardFormatter {
    if (!ProductCardFormatter.instance) {
      ProductCardFormatter.instance = new ProductCardFormatter();
    }
    return ProductCardFormatter.instance;
  }

  formatProductCard(product: ProductCardData): string {
    const config = configManager.get();
    const currency = config.store.currency;

    const price = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(product.basePrice);

    let card = `*${product.name}*\n\n`;

    if (product.description) {
      const truncatedDesc = product.description.length > 100
        ? product.description.substring(0, 97) + '...'
        : product.description;
      card += `${truncatedDesc}\n\n`;
    }

    // Price
    if (product.compareAtPrice && product.compareAtPrice > product.basePrice) {
      const savings = Math.round(((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100);
      const comparePrice = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(product.compareAtPrice);

      card += `${price} ~~${comparePrice}~~ *-${savings}%*\n`;
    } else {
      card += `💰 ${price}\n`;
    }

    // Stock status
    card += `\n`;
    if (product.stock > 10) {
      card += `✅ In Stock\n`;
    } else if (product.stock > 0) {
      card += `⚠️ Only ${product.stock} left!\n`;
    } else {
      card += `❌ Out of Stock\n`;
    }

    // Variants
    if (product.variants && product.variants.length > 0) {
      card += `\n*Variants:*\n`;
      product.variants.forEach((variant, idx) => {
        const variantPrice = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(variant.price);

        const stockStatus = variant.stock > 0 ? '✅' : '❌';
        card += `${idx + 1}. ${variant.name} - ${variantPrice} ${stockStatus}\n`;
      });
    }

    // Tags
    if (product.tags && product.tags.length > 0) {
      card += `\n🏷️ ${product.tags.slice(0, 3).join(', ')}\n`;
    }

    return card;
  }

  formatProductListItem(product: ProductCardData, index: number): string {
    const config = configManager.get();
    const currency = config.store.currency;

    const price = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(product.basePrice);

    const stockEmoji = product.stock > 0 ? '✅' : '❌';
    const discount = product.compareAtPrice && product.compareAtPrice > product.basePrice
      ? ` (${Math.round(((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100)}% off)`
      : '';

    return `${index}. ${product.name}\n   💰 ${price}${discount} ${stockEmoji}`;
  }

  formatFeaturedProducts(products: ProductCardData[]): string {
    if (products.length === 0) {
      return 'No featured products available.';
    }

    let message = `🌟 *Featured Products*\n\n`;

    products.forEach((product, idx) => {
      message += this.formatProductListItem(product, idx + 1);
      message += '\n\n';
    });

    return message;
  }

  formatCategoryProducts(category: string, products: ProductCardData[], page: number = 1): string {
    if (products.length === 0) {
      return `No products found in ${category}.`;
    }

    const config = configManager.get();
    const currency = config.store.currency;

    let message = `📦 *${category}* (Page ${page})\n\n`;

    products.forEach((product, idx) => {
      const price = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(product.basePrice);

      const stockEmoji = product.stock > 0 ? '✅' : '❌';
      const lineNum = (page - 1) * 10 + idx + 1;

      message += `${lineNum}. ${product.name}\n`;
      message += `   💰 ${price} ${stockEmoji}\n\n`;
    });

    message += `\nReply with the number to view details.`;

    return message;
  }

  formatSearchResults(query: string, products: ProductCardData[]): string {
    if (products.length === 0) {
      return `No products found for "${query}".\n\nTry a different search term or browse categories.`;
    }

    const config = configManager.get();
    const currency = config.store.currency;

    let message = `🔍 *Search Results for "${query}"*\n\n`;

    products.slice(0, 10).forEach((product, idx) => {
      const price = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(product.basePrice);

      message += `${idx + 1}. ${product.name}\n`;
      message += `   💰 ${price}\n\n`;
    });

    if (products.length > 10) {
      message += `...and ${products.length - 10} more results.\n\n`;
    }

    message += `Reply with the number to view details.`;

    return message;
  }

  formatOutOfStockNotification(product: ProductCardData): string {
    return `😔 *${product.name}* is currently out of stock.\n\nWe'll notify you when it's back!`;
  }

  formatLowStockNotification(product: ProductCardData): string {
    return `⚠️ Hurry! *${product.name}* is running low.\n\nOnly ${product.stock} left in stock.`;
  }

  formatNewArrival(product: ProductCardData): string {
    return `🆕 *NEW ARRIVAL!*\n\n${this.formatProductCard(product)}\n\nBe the first to get it!`;
  }

  formatBackInStock(product: ProductCardData): string {
    return `🔔 *Back in Stock!*\n\n${this.formatProductCard(product)}\n\nOrder now before it runs out!`;
  }

  formatPriceDrop(product: ProductCardData, oldPrice: number): string {
    const config = configManager.get();
    const currency = config.store.currency;

    const oldPriceFormatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(oldPrice);

    const newPriceFormatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(product.basePrice);

    const savings = Math.round(((oldPrice - product.basePrice) / oldPrice) * 100);

    return `💰 *PRICE DROP!*\n\n*${product.name}*\n\n` +
      `Was: ~~${oldPriceFormatted}~~\n` +
      `Now: *${newPriceFormatted}*\n` +
      `You save: *${savings}%*\n\n` +
      `Limited time offer! Order now!`;
  }
}

export const productCards = ProductCardFormatter.getInstance();
export default productCards;
