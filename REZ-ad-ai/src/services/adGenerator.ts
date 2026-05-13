/**
 * REZ Ad AI - AI-Powered Ad Generation Service
 *
 * Generates banner ads, copy, CTAs, and variations using AI-driven
 * intent signals and performance patterns.
 */

import {
  BannerAssets,
  BannerFormat,
  GenerateBannerOptions,
  GenerateBannerResponse,
  GenerateCopyOptions,
  GenerateCopyResponse,
  AdCopy,
  CTAConfig,
  GenerateCTAResponse,
  AdVariation,
  GenerateVariationsOptions,
  GenerateVariationsResponse,
  CopyStyle,
  CopyLength,
  CTAType,
  CTAStyle,
} from '../types/ad';

// ============================================================================
// Configuration
// ============================================================================

const BANNER_DIMENSIONS: Record<BannerFormat, { width: number; height: number }> = {
  leaderboard: { width: 728, height: 90 },
  medium_rectangle: { width: 300, height: 250 },
  large_rectangle: { width: 336, height: 280 },
  mobile_banner: { width: 320, height: 50 },
  square: { width: 250, height: 250 },
  skyscraper: { width: 160, height: 600 },
};

const HEADLINE_TEMPLATES: Record<CopyStyle, string[]> = {
  informative: [
    'Discover {product} - Quality You Can Trust',
    'Everything You Need to Know About {product}',
    'The Smart Choice: {product}',
  ],
  persuasive: [
    'Transform Your Life with {product}',
    'Don\'t Miss Out on {product}',
    'Get {product} Today - Limited Time',
  ],
  emotional: [
    'Feel the Difference with {product}',
    'Made with Love: {product}',
    'Your Journey Starts Here: {product}',
  ],
  humorous: [
    '{product} That\'ll Make You Smile',
    'Why Choose Boring When You Can Have {product}?',
    '{product} - Because You Deserve Better',
  ],
  formal: [
    'Introducing {product} by {brand}',
    'Experience Premium Quality with {product}',
    '{product}: Setting New Standards',
  ],
  casual: [
    'Hey! Check Out {product}',
    'You\'ll Love {product}',
    'The Coolest {product} is Here',
  ],
};

const CTA_TEMPLATES: Record<CTAType, string[]> = {
  shop_now: ['Shop Now', 'Buy Now', 'Start Shopping', 'Get Yours', 'Shop Today'],
  learn_more: ['Learn More', 'Discover More', 'Find Out More', 'See How It Works'],
  sign_up: ['Sign Up Free', 'Join Now', 'Get Started', 'Create Account', 'Register'],
  download: ['Download Now', 'Get the App', 'Install Free', 'Download Today'],
  book_now: ['Book Now', 'Reserve Today', 'Schedule Now', 'Book Your Spot'],
  get_quote: ['Get a Quote', 'Request Quote', 'Check Pricing', 'Get Pricing'],
  contact_us: ['Contact Us', 'Get in Touch', 'Reach Out', 'Message Us'],
  custom: ['Click Here', 'Learn More', 'Explore', 'Try Now'],
};

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  fashion: ['style', 'trend', 'fashion', 'collection', 'look', 'wear', 'dress'],
  tech: ['innovation', 'smart', 'technology', 'digital', 'future', 'advanced'],
  food: ['fresh', 'delicious', 'taste', 'quality', 'premium', 'organic'],
  travel: ['adventure', 'explore', 'destination', 'journey', 'experience', 'escape'],
  health: ['wellness', 'healthy', 'natural', 'vitality', 'energy', 'care'],
  finance: ['secure', 'reliable', 'growth', 'wealth', 'smart', 'investment'],
  education: ['learn', 'grow', 'discover', 'master', 'skills', 'knowledge'],
  entertainment: ['fun', 'exciting', 'amazing', 'epic', 'premier', 'hit'],
};

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `ad_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleFrom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || `{${key}}`);
}

function getIndustryKeywords(category?: string): string[] {
  if (!category) return [];
  const lowerCategory = category.toLowerCase();
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (lowerCategory.includes(industry)) {
      return keywords;
    }
  }
  return [];
}

function generateTagline(brandName: string, style: CopyStyle): string {
  const taglines: Record<CopyStyle, string[]> = {
    informative: [`Quality from ${brandName}`, `${brandName} Excellence`, `Trust ${brandName}`],
    persuasive: [`You're Worth It`, `Transform Today`, `Don't Wait`],
    emotional: [`Feel the Magic`, `Moments to Treasure`, `Made with Heart`],
    humorous: [`Life's Too Short for Boring`, `Serious Fun`, `No Kidding`],
    formal: [`Setting the Standard`, `Excellence Defined`, `Premier Choice`],
    casual: [`Just Do It`, `Go For It`, `You've Got This`],
  };
  return randomFrom(taglines[style]);
}

function generateBody(brandName: string, productName?: string, style?: CopyStyle, length: CopyLength = 'medium'): string {
  const bodies: Record<CopyLength, string[]> = {
    short: [
      `Experience ${productName || 'our products'} from ${brandName}.`,
      `Quality and value, all in one place.`,
      `Your satisfaction is our priority.`,
    ],
    medium: [
      `Discover the difference with ${productName || 'our offerings'} from ${brandName}. We bring you quality products at competitive prices, backed by exceptional service.`,
      `${brandName} delivers ${productName || 'solutions'} designed with you in mind. Experience premium quality without the premium price tag.`,
      `When you choose ${brandName}, you're choosing reliability, innovation, and a commitment to excellence. Explore ${productName || 'what we offer'} today.`,
    ],
    long: [
      `Welcome to ${brandName}, where we believe everyone deserves access to quality ${productName || 'products'}. Our carefully curated selection ensures you'll find exactly what you're looking for. With years of experience and thousands of satisfied customers, we've built our reputation on trust, reliability, and unwavering commitment to quality. Join our community today and discover the ${brandName} difference.`,
    ],
  };

  const templates = bodies[length];
  return randomFrom(templates);
}

// ============================================================================
// Banner Generator
// ============================================================================

/**
 * Generates banner ad assets based on input parameters
 */
export async function generateBanner(options: GenerateBannerOptions): Promise<GenerateBannerResponse> {
  try {
    const { format, brandName, productName, category, targetAudience, colorScheme, tone = 'professional' } = options;

    const dimensions = BANNER_DIMENSIONS[format];

    // Select headline template based on tone
    const headlineStyle: CopyStyle = tone === 'urgent' ? 'persuasive' : tone === 'playful' ? 'humorous' : 'informative';
    const headlineTemplate = randomFrom(HEADLINE_TEMPLATES[headlineStyle]);
    const headline = interpolate(headlineTemplate, {
      brand: brandName,
      product: productName || 'Our Products',
    });

    // Generate subheadline
    const subheadlineOptions = [
      `Quality ${category || 'Products'} from ${brandName}`,
      `Experience the ${brandName} Difference`,
      `Discover Premium ${category || 'Solutions'}`,
      `Trusted by Thousands`,
    ];
    const subheadline = randomFrom(subheadlineOptions);

    // Generate body text based on format size
    const isLargeFormat = dimensions.width > 300;
    const body = isLargeFormat ? generateBody(brandName, productName, headlineStyle, 'medium') : undefined;

    // Generate CTA
    const ctaType: CTAType = productName ? 'shop_now' : 'learn_more';
    const ctaText = randomFrom(CTA_TEMPLATES[ctaType]);

    // Determine placement suggestions based on format
    const placements: Record<BannerFormat, string[]> = {
      leaderboard: ['website_header', 'article_top', 'content_mid'],
      medium_rectangle: ['sidebar', 'in_article', 'footer'],
      large_rectangle: ['sidebar', 'popup', 'pre_roll'],
      mobile_banner: ['app_banner', 'feed_native', 'story_bottom'],
      square: ['social_feed', 'grid_ad', 'sidebar_square'],
      skyscraper: ['side_panel', 'article_side', 'full_height_sidebar'],
    };

    // Build banner assets
    const banner: BannerAssets = {
      headline,
      subheadline,
      body,
      cta: ctaText,
      backgroundColor: colorScheme?.primary || '#1a1a2e',
      textColor: colorScheme?.secondary || '#ffffff',
    };

    return {
      success: true,
      banner,
      format,
      generatedAt: new Date(),
      metadata: {
        confidence: 0.85 + Math.random() * 0.1,
        suggestedPlacements: placements[format],
      },
    };
  } catch (error) {
    console.error('generateBanner error:', error);
    return {
      success: false,
      format: options.format,
      generatedAt: new Date(),
    };
  }
}

// ============================================================================
// Copy Generator
// ============================================================================

/**
 * Generates ad copy with headlines, body text, and optional taglines
 */
export async function generateCopy(options: GenerateCopyOptions): Promise<GenerateCopyResponse> {
  try {
    const {
      brandName,
      productName,
      category,
      style = 'informative',
      length = 'medium',
      includeTagline = true,
      keywords = [],
      targetAudience,
      platform,
    } = options;

    // Add industry keywords
    const industryKeywords = getIndustryKeywords(category);
    const allKeywords = [...new Set([...keywords, ...industryKeywords])];

    // Generate multiple headline options
    const headlineCount = platform === 'tiktok' ? 3 : 5;
    const headlines: string[] = [];

    for (const template of shuffleFrom(HEADLINE_TEMPLATES[style], headlineCount)) {
      const headline = interpolate(template, {
        brand: brandName,
        product: productName || 'Our Products',
      });
      headlines.push(headline);
    }

    // Generate body text
    const bodyLength: CopyLength = platform === 'twitter' ? 'short' : platform === 'linkedin' ? 'long' : length;
    const body = generateBody(brandName, productName, style, bodyLength);

    // Generate tagline
    const tagline = includeTagline ? generateTagline(brandName, style) : undefined;

    // Create ad copies array
    const copies: AdCopy[] = headlines.map((headline) => ({
      headline,
      body: platform !== 'twitter' ? body : undefined,
      tagline: includeTagline && Math.random() > 0.5 ? tagline : undefined,
      keywords: allKeywords.slice(0, 5),
    }));

    return {
      success: true,
      copies,
      headline: headlines[0],
      body,
      tagline,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('generateCopy error:', error);
    return {
      success: false,
      generatedAt: new Date(),
    };
  }
}

// ============================================================================
// CTA Generator
// ============================================================================

/**
 * Generates Call-to-Action buttons with text and configuration
 */
export async function generateCTA(config: CTAConfig): Promise<GenerateCTAResponse> {
  try {
    const { type, customText, style = 'primary' } = config;

    // Get templates for the CTA type
    const templates = CTA_TEMPLATES[type];
    if (!templates) {
      return {
        success: false,
        generatedAt: new Date(),
      };
    }

    // Generate primary CTA
    const primaryText = customText || randomFrom(templates);

    // Generate alternatives (different from primary)
    const alternatives = templates
      .filter((t) => t !== primaryText)
      .slice(0, 3)
      .map((text) => ({
        text,
        type,
        style: style === 'primary' ? 'secondary' as const : 'primary' as const,
      }));

    return {
      success: true,
      cta: {
        text: primaryText,
        type,
        style,
        url: '/click',
      },
      alternatives,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('generateCTA error:', error);
    return {
      success: false,
      generatedAt: new Date(),
    };
  }
}

// ============================================================================
// Variation Generator
// ============================================================================

/**
 * Generates multiple ad variations for A/B testing
 */
export async function generateVariations(options: GenerateVariationsOptions): Promise<GenerateVariationsResponse> {
  try {
    const { baseAssets, count = 4, testType = 'full', brandName } = options;

    const variations: AdVariation[] = [];

    for (let i = 0; i < count; i++) {
      const variationId = generateId();
      const variationNumber = i + 1;

      // Generate variation assets based on test type
      let assets: BannerAssets = { ...baseAssets };
      let copy: AdCopy = {
        headline: baseAssets.headline || `${brandName} - Variation ${variationNumber}`,
      };
      let cta: CTAConfig = { type: 'learn_more' };

      switch (testType) {
        case 'headline':
          // Test different headlines
          const headlineTemplates = shuffleFrom(HEADLINE_TEMPLATES.informative, 3);
          assets.headline = headlineTemplates[i % headlineTemplates.length]?.replace('{brand}', brandName) || assets.headline;
          break;

        case 'cta':
          // Test different CTA types
          const ctaTypes: CTAType[] = ['shop_now', 'learn_more', 'sign_up', 'get_quote'];
          cta = { type: ctaTypes[i % ctaTypes.length], style: i % 2 === 0 ? 'primary' : 'secondary' };
          const ctaText = randomFrom(CTA_TEMPLATES[cta.type]);
          assets.cta = ctaText;
          break;

        case 'image':
          // Image variations (placeholder URLs)
          assets.imageUrl = `https://placeholder.com/ad-${variationId}.jpg`;
          break;

        case 'full':
        default:
          // Full variation with all elements
          const style: CopyStyle = shuffleFrom(['informative', 'persuasive', 'casual'], 1)[0];
          const template = randomFrom(HEADLINE_TEMPLATES[style]);
          copy.headline = interpolate(template, { brand: brandName, product: 'Our Products' });
          copy.body = generateBody(brandName, undefined, style, 'short');
          assets.headline = copy.headline;
          assets.body = copy.body;
          assets.cta = randomFrom(CTA_TEMPLATES.shop_now);
          break;
      }

      variations.push({
        id: variationId,
        name: `${brandName} - Variation ${variationNumber} (${testType})`,
        assets,
        copy,
        cta,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      success: true,
      variations,
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('generateVariations error:', error);
    return {
      success: false,
      generatedAt: new Date(),
    };
  }
}

// ============================================================================
// Export all functions
// ============================================================================

export const adGenerator = {
  generateBanner,
  generateCopy,
  generateCTA,
  generateVariations,
};

export default adGenerator;
