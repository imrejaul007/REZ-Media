/**
 * AdBazaar - Creative Optimizer
 * AI-powered creative optimization
 */

interface CreativePerformance {
  impressions: number;
  clicks: number;
  conversions: number;
}

interface CreativeAnalysis {
  score: number;
  issues: string[];
  suggestions: string[];
  bestPractices: string[];
}

export class CreativeOptimizer {
  /**
   * Analyze creative performance
   */
  analyze(creative: {
    type: string;
    headline?: string;
    cta?: string;
    imageUrl?: string;
  }, performance: CreativePerformance): CreativeAnalysis {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const bestPractices: string[] = [];

    const ctr = performance.impressions > 0
      ? (performance.clicks / performance.impressions) * 100
      : 0;

    const cvr = performance.clicks > 0
      ? (performance.conversions / performance.clicks) * 100
      : 0;

    let score = 50;

    // Headline analysis
    if (!creative.headline) {
      issues.push('Missing headline');
      score -= 10;
    } else if (creative.headline.length < 5) {
      issues.push('Headline too short');
      suggestions.push('Use 5-10 word headlines');
      score -= 5;
    }

    // CTA analysis
    if (!creative.cta) {
      issues.push('Missing call-to-action');
      score -= 15;
    }

    // CTR analysis
    if (ctr < 0.5) {
      issues.push('Very low CTR - under 0.5%');
      suggestions.push('Test different images or headlines');
      score -= 20;
    } else if (ctr < 1) {
      issues.push('Low CTR - under 1%');
      suggestions.push('Consider stronger visuals');
      score -= 10;
    }

    // CVR analysis
    if (cvr < 1) {
      issues.push('Low conversion rate - under 1%');
      suggestions.push('Review landing page relevance');
      score -= 15;
    }

    // Best practices
    if (score > 70) {
      bestPractices.push('Creative is performing well');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      suggestions,
      bestPractices,
    };
  }

  /**
   * Generate creative suggestions
   */
  suggest(campaignType: string): {
    headlines: string[];
    ctas: string[];
    imageStyles: string[];
  } {
    const suggestions: Record<string, {
      headlines: string[];
      ctas: string[];
      imageStyles: string[];
    }> = {
      awareness: {
        headlines: [
          'Discover the difference',
          'Transform your experience',
          'Join thousands of happy customers',
        ],
        ctas: ['Learn More', 'Get Started', 'Explore'],
        imageStyles: ['lifestyle', 'emotional', 'storytelling'],
      },
      engagement: {
        headlines: [
          'Limited time offer',
          'Exclusive for you',
          'Don\'t miss out',
        ],
        ctas: ['Claim Now', 'Get Offer', 'Apply Today'],
        imageStyles: ['urgency', 'discount', 'offer'],
      },
      conversion: {
        headlines: [
          'Buy now and save',
          'Best price guaranteed',
          'Free shipping today',
        ],
        ctas: ['Shop Now', 'Buy Now', 'Order'],
        imageStyles: ['product', 'price', 'action'],
      },
    };

    return suggestions[campaignType] || suggestions.engagement;
  }
}

export const creativeOptimizer = new CreativeOptimizer();
