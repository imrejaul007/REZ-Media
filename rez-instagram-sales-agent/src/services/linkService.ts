import { logger } from '../config/logger';

export interface LinkConfig {
  linkInBio: string;
  whatsappNumber: string;
  whatsappHandoffMessage?: string;
  shopUrl: string;
  productUrlTemplate: string;
  collectionUrlTemplate: string;
  utmSource: string;
  utmMedium: string;
}

export interface GeneratedLink {
  url: string;
  type: 'product' | 'collection' | 'checkout' | 'whatsapp';
  shortCode?: string;
  expiresAt?: Date;
}

export class LinkService {
  private linkConfig: LinkConfig;
  private urlShortener: Map<string, { url: string; createdAt: Date }> = new Map();

  constructor() {
    this.linkConfig = {
      linkInBio: process.env.LINK_IN_BIO_URL || 'https://rez.shop',
      whatsappNumber: process.env.WHATSAPP_BUSINESS_NUMBER || '1234567890',
      whatsappHandoffMessage: 'Hi! I saw your message on Instagram and would love to help you complete your order!',
      shopUrl: process.env.SHOP_URL || 'https://rez.shop',
      productUrlTemplate: process.env.PRODUCT_URL_TEMPLATE || 'https://rez.shop/product/{id}',
      collectionUrlTemplate: process.env.COLLECTION_URL_TEMPLATE || 'https://rez.shop/collection/{slug}',
      utmSource: 'instagram',
      utmMedium: 'dm'
    };
  }

  generateProductLink(productId: string, options?: {
    utmCampaign?: string;
    variant?: string;
    quantity?: number;
  }): GeneratedLink {
    let url = this.linkConfig.productUrlTemplate.replace('{id}', productId);

    const params = new URLSearchParams();
    params.append('utm_source', this.linkConfig.utmSource);
    params.append('utm_medium', this.linkConfig.utmMedium);

    if (options?.utmCampaign) {
      params.append('utm_campaign', options.utmCampaign);
    }
    if (options?.variant) {
      params.append('variant', options.variant);
    }
    if (options?.quantity) {
      params.append('qty', options.quantity.toString());
    }

    const finalUrl = `${url}?${params.toString()}`;
    const shortCode = this.shortenUrl(finalUrl);

    logger.debug('Product link generated', { productId, shortCode });

    return {
      url: finalUrl,
      type: 'product',
      shortCode,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
  }

  generateCollectionLink(collectionSlug: string, options?: {
    utmCampaign?: string;
  }): GeneratedLink {
    let url = this.linkConfig.collectionUrlTemplate.replace('{slug}', collectionSlug);

    const params = new URLSearchParams();
    params.append('utm_source', this.linkConfig.utmSource);
    params.append('utm_medium', this.linkConfig.utmMedium);

    if (options?.utmCampaign) {
      params.append('utm_campaign', options.utmCampaign);
    }

    const finalUrl = `${url}?${params.toString()}`;
    const shortCode = this.shortenUrl(finalUrl);

    return {
      url: finalUrl,
      type: 'collection',
      shortCode
    };
  }

  generateCheckoutLink(sessionId: string, options?: {
    cartId?: string;
    promoCode?: string;
  }): GeneratedLink {
    const baseUrl = `${this.linkConfig.shopUrl}/checkout`;
    const params = new URLSearchParams();

    params.append('session', sessionId);
    params.append('utm_source', this.linkConfig.utmSource);
    params.append('utm_medium', this.linkConfig.utmMedium);

    if (options?.cartId) {
      params.append('cart', options.cartId);
    }
    if (options?.promoCode) {
      params.append('promo', options.promoCode);
    }

    const finalUrl = `${baseUrl}?${params.toString()}`;
    const shortCode = this.shortenUrl(finalUrl);

    logger.debug('Checkout link generated', { sessionId, shortCode });

    return {
      url: finalUrl,
      type: 'checkout',
      shortCode,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    };
  }

  generateWhatsAppLink(options?: {
    message?: string;
    productId?: string;
    sessionId?: string;
  }): GeneratedLink {
    const defaultMessage = options?.message || this.linkConfig.whatsappHandoffMessage;

    let fullMessage = defaultMessage;
    if (options?.productId) {
      const productUrl = this.generateProductLink(options.productId);
      fullMessage = `${defaultMessage}\n\nProduct: ${productUrl.url}`;
    }
    if (options?.sessionId) {
      fullMessage = `${defaultMessage}\n\nOrder session: ${options.sessionId}`;
    }

    const whatsappUrl = `https://wa.me/${this.linkConfig.whatsappNumber}?text=${encodeURIComponent(fullMessage)}`;

    return {
      url: whatsappUrl,
      type: 'whatsapp'
    };
  }

  generateLinkInBioLink(options?: {
    highlight?: string;
    tag?: string;
  }): GeneratedLink {
    let url = this.linkConfig.linkInBio;

    const params = new URLSearchParams();
    params.append('utm_source', this.linkConfig.utmSource);
    params.append('utm_medium', 'bio');

    if (options?.highlight) {
      params.append('highlight', options.highlight);
    }
    if (options?.tag) {
      params.append('tag', options.tag);
    }

    const finalUrl = `${url}?${params.toString()}`;

    return {
      url: finalUrl,
      type: 'collection'
    };
  }

  generateAffiliateLink(affiliateId: string, destinationUrl: string): GeneratedLink {
    // In production, this would integrate with your affiliate program
    const params = new URLSearchParams();
    params.append('ref', affiliateId);
    params.append('utm_source', 'instagram_affiliate');
    params.append('utm_medium', 'dm');

    const separator = destinationUrl.includes('?') ? '&' : '?';
    const finalUrl = `${destinationUrl}${separator}${params.toString()}`;

    return {
      url: finalUrl,
      type: 'product'
    };
  }

  private shortenUrl(url: string): string {
    // Simple mock shortener - in production use Bitly/Short.io API
    const shortCode = Math.random().toString(36).substr(2, 6);
    this.urlShortener.set(shortCode, {
      url,
      createdAt: new Date()
    });

    return `https://rez.shop/r/${shortCode}`;
  }

  resolveShortUrl(shortCode: string): string | null {
    const mapping = this.urlShortener.get(shortCode);
    return mapping?.url || null;
  }

  formatLinkMessage(link: GeneratedLink, context?: {
    productName?: string;
    discount?: number;
  }): string {
    let message = '';

    switch (link.type) {
      case 'product':
        message = context?.productName
          ? `Here's the link for ${context.productName}:`
          : 'Here\'s the link:';
        message += `\n${link.shortCode || link.url}`;
        break;

      case 'collection':
        message = 'Check out our collection:';
        message += `\n${link.shortCode || link.url}`;
        break;

      case 'checkout':
        message = 'Ready to checkout? Complete your order here:';
        message += `\n${link.shortCode || link.url}`;
        break;

      case 'whatsapp':
        message = 'Need more help? Let\'s chat on WhatsApp:';
        message += `\n${link.url}`;
        break;
    }

    return message;
  }

  // Format link with CTA for Instagram
  formatLinkCTA(link: GeneratedLink, cta: 'Shop Now' | 'View' | 'Buy' | 'Learn More' | 'WhatsApp'): string {
    const baseUrl = link.shortCode || link.url;

    switch (cta) {
      case 'Shop Now':
        return `🛍️ Shop Now: ${baseUrl}`;
      case 'View':
        return `👀 View: ${baseUrl}`;
      case 'Buy':
        return `💳 Buy: ${baseUrl}`;
      case 'Learn More':
        return `📖 Learn More: ${baseUrl}`;
      case 'WhatsApp':
        return `💬 Chat on WhatsApp: ${baseUrl}`;
      default:
        return baseUrl;
    }
  }

  // Track link click
  async trackClick(shortCode: string, metadata?: {
    userId?: string;
    source?: string;
    timestamp?: Date;
  }): Promise<void> {
    const mapping = this.urlShortener.get(shortCode);
    if (!mapping) {
      logger.warn('Click tracking for unknown short code', { shortCode });
      return;
    }

    logger.info('Link click tracked', {
      shortCode,
      destination: mapping.url,
      ...metadata
    });

    // In production, this would send to analytics service
  }

  // Update link configuration
  updateConfig(config: Partial<LinkConfig>): void {
    this.linkConfig = { ...this.linkConfig, ...config };
    logger.info('Link configuration updated', { config });
  }

  getConfig(): LinkConfig {
    return { ...this.linkConfig };
  }

  // Generate shareable story link with sticker
  generateStoryLink(options?: {
    productId?: string;
    collectionSlug?: string;
    discount?: number;
  }): GeneratedLink {
    let destination: string;

    if (options?.productId) {
      const productLink = this.generateProductLink(options.productId);
      destination = productLink.url;
    } else if (options?.collectionSlug) {
      const collectionLink = this.generateCollectionLink(options.collectionSlug);
      destination = collectionLink.url;
    } else {
      destination = this.linkConfig.shopUrl;
    }

    // Instagram story sticker URL format
    const storyUrl = `https://instagram.com/oa/${Buffer.from(destination).toString('base64').slice(0, 20)}`;

    return {
      url: storyUrl,
      type: options?.productId ? 'product' : 'collection'
    };
  }
}

export const linkService = new LinkService();
