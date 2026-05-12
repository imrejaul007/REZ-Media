import { Product } from '../services/productDiscovery';
import { logger } from '../config/logger';

export interface CarouselElement {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  buttons?: CarouselButton[];
  defaultAction?: CarouselButton;
}

export interface CarouselButton {
  type: 'web_url' | 'postback';
  title: string;
  url?: string;
  payload?: string;
}

export interface InstagramCarouselPayload {
  attachment: {
    type: 'template';
    payload: {
      template_type: 'generic';
      elements: CarouselElement[];
    };
  };
}

export class CarouselFormatter {
  private static readonly MAX_ELEMENTS = 10;
  private static readonly TITLE_MAX_LENGTH = 80;
  private static readonly SUBTITLE_MAX_LENGTH = 80;

  // Format products as Instagram carousel
  static formatProductCarousel(products: Product[], options?: {
    title?: string;
    showPrice?: boolean;
    showRating?: boolean;
    actionTitle?: string;
    actionUrlBase?: string;
  }): InstagramCarouselPayload {
    const elements: CarouselElement[] = products
      .slice(0, this.MAX_ELEMENTS)
      .map(product => this.formatProductElement(product, options));

    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements
        }
      }
    };
  }

  // Format single product as carousel element
  static formatProductElement(product: Product, options?: {
    showPrice?: boolean;
    showRating?: boolean;
    actionTitle?: string;
    actionUrlBase?: string;
  }): CarouselElement {
    const title = product.name.slice(0, this.TITLE_MAX_LENGTH);

    let subtitle = '';
    if (options?.showPrice !== false) {
      subtitle = `$${product.price.toFixed(2)}`;
    }
    if (options?.showRating && product.rating) {
      subtitle += ` | ⭐ ${product.rating.toFixed(1)} (${product.reviewCount || 0})`;
    }
    subtitle += `\n${product.description.slice(0, 50)}...`;

    const actionUrlBase = options?.actionUrlBase || '/product/';
    const actionUrl = `${actionUrlBase}${product.id}`;
    const actionTitle = options?.actionTitle || 'View Product';

    return {
      title,
      subtitle: subtitle.slice(0, this.SUBTITLE_MAX_LENGTH),
      imageUrl: product.images[0],
      buttons: [
        {
          type: 'web_url',
          title: actionTitle.slice(0, 20),
          url: actionUrl
        }
      ],
      defaultAction: {
        type: 'web_url',
        title: 'View Product',
        url: actionUrl
      }
    };
  }

  // Format featured products carousel
  static formatFeaturedCarousel(products: Product[]): InstagramCarouselPayload {
    const intro = {
      title: 'Featured Products',
      subtitle: 'Hand-picked just for you! ✨',
      imageUrl: products[0]?.images[0],
      buttons: [
        {
          type: 'web_url',
          title: 'Shop All',
          url: '/shop'
        }
      ]
    };

    const productElements = products.slice(0, 9).map(p =>
      this.formatProductElement(p, { showPrice: true, actionTitle: 'View' })
    );

    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [intro, ...productElements]
        }
      }
    };
  }

  // Format category carousel
  static formatCategoryCarousel(
    categoryName: string,
    products: Product[],
    categoryUrl: string
  ): InstagramCarouselPayload {
    const elements: CarouselElement[] = [
      {
        title: `${categoryName} Collection`,
        subtitle: 'Explore our curated selection',
        imageUrl: products[0]?.images[0],
        buttons: [
          {
            type: 'web_url',
            title: 'View All',
            url: categoryUrl
          }
        ]
      },
      ...products.slice(0, 9).map(p =>
        this.formatProductElement(p, { showPrice: true, actionTitle: 'View' })
      )
    ];

    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elements.slice(0, this.MAX_ELEMENTS)
        }
      }
    };
  }

  // Format sale carousel
  static formatSaleCarousel(
    products: Product[],
    discountPercentage: number
  ): InstagramCarouselPayload {
    const elements: CarouselElement[] = [
      {
        title: `${discountPercentage}% OFF SALE! 🎉`,
        subtitle: 'Limited time only! Shop now before it\'s gone!',
        imageUrl: products[0]?.images[0],
        buttons: [
          {
            type: 'web_url',
            title: 'Shop Sale',
            url: '/sale'
          }
        ]
      },
      ...products.slice(0, 9).map(p => {
        const discountedPrice = p.price * (1 - discountPercentage / 100);
        return {
          title: p.name.slice(0, this.TITLE_MAX_LENGTH),
          subtitle: `$${discountedPrice.toFixed(2)} (was $${p.price.toFixed(2)})`,
          imageUrl: p.images[0],
          buttons: [
            {
              type: 'web_url',
              title: 'Grab it!',
              url: `/product/${p.id}`
            }
          ]
        };
      })
    ];

    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elements.slice(0, this.MAX_ELEMENTS)
        }
      }
    };
  }

  // Format new arrivals carousel
  static formatNewArrivalsCarousel(products: Product[]): InstagramCarouselPayload {
    const elements: CarouselElement[] = [
      {
        title: 'New Arrivals! 🌟',
        subtitle: 'Fresh drops just for you!',
        imageUrl: products[0]?.images[0],
        buttons: [
          {
            type: 'web_url',
            title: 'See New Arrivals',
            url: '/new'
          }
        ]
      },
      ...products.slice(0, 9).map(p =>
        this.formatProductElement(p, { showPrice: true, actionTitle: 'New!' })
      )
    ];

    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elements.slice(0, this.MAX_ELEMENTS)
        }
      }
    };
  }

  // Format size guide carousel
  static formatSizeGuideCarousel(product: Product): InstagramCarouselPayload {
    if (!product.variants) {
      return this.formatProductCarousel([product]);
    }

    const sizes = product.variants.filter(v => v.type === 'size');
    const intro: CarouselElement = {
      title: `${product.name} - Size Guide`,
      subtitle: 'Find your perfect fit!',
      imageUrl: product.images[0],
      buttons: [
        {
          type: 'web_url',
          title: 'Size Chart',
          url: `/size-guide/${product.id}`
        }
      ]
    };

    const sizeElements: CarouselElement[] = sizes.map(size => ({
      title: `Size ${size.value}`,
      subtitle: size.inStock ? '✅ In Stock' : '❌ Out of Stock',
      buttons: size.inStock
        ? [
            {
              type: 'web_url',
              title: 'Select Size',
              url: `/product/${product.id}?size=${size.value}`
            }
          ]
        : [
            {
              type: 'web_url',
              title: 'Notify Me',
              url: `/notify/${product.id}?size=${size.value}`
            }
          ]
    }));

    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [intro, ...sizeElements].slice(0, this.MAX_ELEMENTS)
        }
      }
    };
  }

  // Format comparison carousel
  static formatComparisonCarousel(products: Product[]): InstagramCarouselPayload {
    const elements: CarouselElement[] = products.map(p => ({
      title: p.name.slice(0, this.TITLE_MAX_LENGTH),
      subtitle: `$${p.price.toFixed(2)} | ⭐ ${p.rating?.toFixed(1) || 'New'} | ${p.tags.slice(0, 2).join(', ')}`,
      imageUrl: p.images[0],
      buttons: [
        {
          type: 'web_url',
          title: 'Compare',
          url: `/compare?ids=${p.id}`
        },
        {
          type: 'web_url',
          title: 'Buy',
          url: `/product/${p.id}`
        }
      ]
    }));

    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elements.slice(0, this.MAX_ELEMENTS)
        }
      }
    };
  }

  // Format text-only carousel (for storytelling)
  static formatStoryCarousel(slides: string[]): InstagramCarouselPayload {
    const elements: CarouselElement[] = slides.map((slide, index) => ({
      title: `Slide ${index + 1}`,
      subtitle: slide.slice(0, this.SUBTITLE_MAX_LENGTH),
      buttons: index === slides.length - 1
        ? [
            {
              type: 'web_url',
              title: 'Shop Now',
              url: '/shop'
            }
          ]
        : undefined
    }));

    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elements.slice(0, this.MAX_ELEMENTS)
        }
      }
    };
  }

  // Generate text preview of carousel
  static generateTextPreview(carousel: InstagramCarouselPayload): string {
    const lines: string[] = [];
    const elements = carousel.attachment.payload.elements;

    lines.push('📱 Product Carousel:');
    lines.push('');

    elements.slice(0, 5).forEach((element, index) => {
      lines.push(`${index + 1}. ${element.title}`);
      if (element.subtitle) {
        lines.push(`   ${element.subtitle.split('\n')[0]}`);
      }
    });

    if (elements.length > 5) {
      lines.push('');
      lines.push(`+ ${elements.length - 5} more...`);
    }

    return lines.join('\n');
  }

  // Validate carousel
  static validate(carousel: InstagramCarouselPayload): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const elements = carousel.attachment.payload.elements;

    if (elements.length === 0) {
      errors.push('Carousel must have at least 1 element');
    }

    if (elements.length > this.MAX_ELEMENTS) {
      errors.push(`Carousel can have max ${this.MAX_ELEMENTS} elements`);
    }

    elements.forEach((element, index) => {
      if (!element.title) {
        errors.push(`Element ${index + 1}: Missing title`);
      }
      if (element.title && element.title.length > this.TITLE_MAX_LENGTH) {
        errors.push(`Element ${index + 1}: Title exceeds ${this.TITLE_MAX_LENGTH} characters`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
