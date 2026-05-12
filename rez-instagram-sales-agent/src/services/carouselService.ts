import { Product } from './productDiscovery';
import { logger } from '../config/logger';

export interface CarouselItem {
  title: string;
  subtitle?: string;
  imageUrl: string;
  actionTitle?: string;
  actionUrl?: string;
}

export interface InstagramCarousel {
  recipientId: string;
  items: CarouselItem[];
  messagingProduct: 'instagram';
}

export interface CarouselTemplate {
  id: string;
  name: string;
  items: CarouselItem[];
}

export class CarouselService {
  private templates: Map<string, CarouselTemplate> = new Map();
  private readonly MAX_CAROUSEL_ITEMS = 10;
  private readonly MAX_TITLE_LENGTH = 80;
  private readonly MAX_SUBTITLE_LENGTH = 80;

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Product showcase template
    this.templates.set('product_showcase', {
      id: 'product_showcase',
      name: 'Product Showcase',
      items: [
        { title: 'Featured Product', subtitle: 'Check it out!', imageUrl: '', actionTitle: 'Shop Now' }
      ]
    });

    // Collection highlight template
    this.templates.set('collection_highlight', {
      id: 'collection_highlight',
      name: 'Collection Highlight',
      items: [
        { title: 'New Arrivals', subtitle: 'Fresh drops', imageUrl: '', actionTitle: 'See All' }
      ]
    });

    // Sale template
    this.templates.set('sale_announcement', {
      id: 'sale_announcement',
      name: 'Sale Announcement',
      items: [
        { title: 'Limited Time Offer!', subtitle: 'Up to 50% off', imageUrl: '', actionTitle: 'Shop Sale' }
      ]
    });
  }

  createProductCarousel(
    products: Product[],
    options?: {
      maxItems?: number;
      includePrice?: boolean;
      includeRating?: boolean;
    }
  ): CarouselItem[] {
    const maxItems = options?.maxItems || this.MAX_CAROUSEL_ITEMS;
    const items: CarouselItem[] = [];

    for (const product of products.slice(0, maxItems)) {
      const item = this.formatProductAsCarouselItem(product, options);
      items.push(item);
    }

    logger.debug('Product carousel created', { itemCount: items.length });
    return items;
  }

  private formatProductAsCarouselItem(
    product: Product,
    options?: {
      includePrice?: boolean;
      includeRating?: boolean;
    }
  ): CarouselItem {
    let title = product.name;
    let subtitle = product.description.slice(0, this.MAX_SUBTITLE_LENGTH);

    if (options?.includePrice) {
      subtitle = `$${product.price.toFixed(2)} | ${subtitle}`;
    }

    if (options?.includeRating && product.rating) {
      subtitle = `⭐ ${product.rating.toFixed(1)} | ${subtitle}`;
    }

    // Truncate title if needed
    if (title.length > this.MAX_TITLE_LENGTH) {
      title = title.slice(0, this.MAX_TITLE_LENGTH - 3) + '...';
    }

    return {
      title,
      subtitle,
      imageUrl: product.images[0] || '',
      actionTitle: 'View Details',
      actionUrl: `/products/${product.id}`
    };
  }

  createFeaturedCarousel(product: Product, relatedProducts?: Product[]): CarouselItem[] {
    const items: CarouselItem[] = [];

    // First item: featured product
    items.push({
      title: product.name,
      subtitle: `$${product.price.toFixed(2)} - ${product.description.slice(0, 60)}...`,
      imageUrl: product.images[0] || '',
      actionTitle: 'Buy Now',
      actionUrl: `/product/${product.id}`
    });

    // Add related products
    if (relatedProducts && relatedProducts.length > 0) {
      for (const related of relatedProducts.slice(0, 4)) {
        items.push({
          title: related.name,
          subtitle: `$${related.price.toFixed(2)}`,
          imageUrl: related.images[0] || '',
          actionTitle: 'View',
          actionUrl: `/product/${related.id}`
        });
      }
    }

    return items;
  }

  createCategoryCarousel(categoryName: string, products: Product[]): CarouselItem[] {
    return products.slice(0, 5).map(product => ({
      title: `${categoryName}: ${product.name}`,
      subtitle: `$${product.price.toFixed(2)} | ${product.tags.slice(0, 3).join(', ')}`,
      imageUrl: product.images[0] || '',
      actionTitle: 'Shop',
      actionUrl: `/category/${categoryName.toLowerCase()}/${product.id}`
    }));
  }

  createSaleCarousel(
    products: Product[],
    discountPercentage: number
  ): CarouselItem[] {
    return products.slice(0, 5).map(product => {
      const discountedPrice = product.price * (1 - discountPercentage / 100);

      return {
        title: `${product.name} - ${discountPercentage}% OFF`,
        subtitle: `$${discountedPrice.toFixed(2)} (was $${product.price.toFixed(2)})`,
        imageUrl: product.images[0] || '',
        actionTitle: 'Grab the Deal!',
        actionUrl: `/sale/${product.id}`
      };
    });
  }

  createSizeGuideCarousel(product: Product): CarouselItem[] {
    if (!product.variants) {
      return [];
    }

    const sizeVariant = product.variants.find(v => v.type === 'size');
    if (!sizeVariant) {
      return [];
    }

    // Generate size guide items
    const sizeItems: CarouselItem[] = [
      {
        title: `${product.name} - Size Guide`,
        subtitle: 'Find your perfect fit',
        imageUrl: product.images[0] || '',
        actionTitle: 'See Chart'
      }
    ];

    // Add individual size cards
    const sizes = product.variants.filter(v => v.type === 'size');
    for (const size of sizes) {
      sizeItems.push({
        title: `Size ${size.value}`,
        subtitle: size.inStock ? 'In Stock' : 'Out of Stock',
        imageUrl: '',
        actionTitle: size.inStock ? 'Select' : 'Notify Me'
      });
    }

    return sizeItems;
  }

  formatCarouselForInstagram(carousel: CarouselItem[]): InstagramCarousel {
    return {
      recipientId: '', // Will be set when sending
      items: carousel,
      messagingProduct: 'instagram'
    };
  }

  getTemplate(templateId: string): CarouselTemplate | undefined {
    return this.templates.get(templateId);
  }

  saveTemplate(templateId: string, name: string, items: CarouselItem[]): void {
    this.templates.set(templateId, { id: templateId, name, items });
    logger.debug('Carousel template saved', { templateId, name });
  }

  // Format carousel for API payload
  buildCarouselPayload(
    recipientId: string,
    items: CarouselItem[]
  ): Record<string, unknown> {
    return {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: items.map((item, index) => ({
              title: item.title,
              subtitle: item.subtitle,
              image_url: item.imageUrl,
              buttons: item.actionUrl ? [
                {
                  type: 'web_url',
                  url: item.actionUrl,
                  title: item.actionTitle || 'View'
                }
              ] : []
            }))
          }
        }
      }
    };
  }

  // Generate quick carousel response text
  generateCarouselPreviewText(carousel: CarouselItem[]): string {
    const lines: string[] = [];
    lines.push('📱 Here are some options for you:');
    lines.push('');

    carousel.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`);
      if (item.subtitle) {
        lines.push(`   ${item.subtitle}`);
      }
    });

    if (carousel.length > 5) {
      lines.push('');
      lines.push(`+ ${carousel.length - 5} more...`);
    }

    lines.push('');
    lines.push('👆 Swipe to see all options!');

    return lines.join('\n');
  }

  validateCarouselItems(items: CarouselItem[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (items.length === 0) {
      errors.push('Carousel must have at least 1 item');
    }

    if (items.length > this.MAX_CAROUSEL_ITEMS) {
      errors.push(`Carousel can have max ${this.MAX_CAROUSEL_ITEMS} items`);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.title) {
        errors.push(`Item ${i + 1}: Missing title`);
      } else if (item.title.length > this.MAX_TITLE_LENGTH) {
        errors.push(`Item ${i + 1}: Title exceeds ${this.MAX_TITLE_LENGTH} characters`);
      }

      if (item.subtitle && item.subtitle.length > this.MAX_SUBTITLE_LENGTH) {
        errors.push(`Item ${i + 1}: Subtitle exceeds ${this.MAX_SUBTITLE_LENGTH} characters`);
      }

      if (!item.imageUrl) {
        errors.push(`Item ${i + 1}: Missing image URL`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const carouselService = new CarouselService();
