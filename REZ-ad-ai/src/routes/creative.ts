/**
 * REZ Ad AI - Creative Routes
 *
 * API routes for ad creative generation and analysis.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { adGenerator } from '../services/adGenerator';
import { creativeAnalyzer } from '../services/creativeAnalyzer';
import {
  GenerateBannerSchema,
  GenerateCopySchema,
  AnalyzeCreativeSchema,
  BannerFormat,
  CTAType,
  CTAStyle,
  AdVariation,
} from '../types/ad';

const router = Router();

// ============================================================================
// Validation Error Handler
// ============================================================================

function handleZodError(err: ZodError, res: Response): void {
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    },
    timestamp: new Date(),
  });
}

// ============================================================================
// Banner Generation Routes
// ============================================================================

/**
 * POST /api/creative/banner
 * Generate banner ad assets
 */
router.post('/banner', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = GenerateBannerSchema.safeParse(req.body);

    if (!result.success) {
      handleZodError(result.error, res);
      return;
    }

    const { format, brandName, productName, category, tone } = result.data;

    const response = await adGenerator.generateBanner({
      format: format as BannerFormat,
      brandName,
      productName,
      category,
      tone,
    });

    if (!response.success) {
      res.status(500).json({
        success: false,
        error: { code: 'GENERATION_FAILED', message: 'Failed to generate banner' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: response,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/creative/banner/variations
 * Generate multiple banner variations for A/B testing
 */
router.post('/banner/variations', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { baseAssets, count = 4, testType = 'full', brandName } = req.body;

    if (!brandName || typeof brandName !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'brandName is required' },
        timestamp: new Date(),
      });
      return;
    }

    const response = await adGenerator.generateVariations({
      baseAssets: baseAssets || {},
      count: Math.min(Math.max(count, 1), 10), // Limit between 1-10
      testType,
      brandName,
    });

    if (!response.success || !response.variations) {
      res.status(500).json({
        success: false,
        error: { code: 'GENERATION_FAILED', message: 'Failed to generate variations' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        variations: response.variations,
        count: response.variations.length,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Copy Generation Routes
// ============================================================================

/**
 * POST /api/creative/copy
 * Generate ad copy with headlines and body text
 */
router.post('/copy', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = GenerateCopySchema.safeParse(req.body);

    if (!result.success) {
      handleZodError(result.error, res);
      return;
    }

    const { brandName, productName, category, style, length, keywords, platform } = result.data;

    const response = await adGenerator.generateCopy({
      brandName,
      productName,
      category,
      style,
      length,
      keywords,
      platform,
      includeTagline: true,
    });

    if (!response.success) {
      res.status(500).json({
        success: false,
        error: { code: 'GENERATION_FAILED', message: 'Failed to generate copy' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        copies: response.copies,
        headline: response.headline,
        body: response.body,
        tagline: response.tagline,
        count: response.copies?.length || 0,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CTA Generation Routes
// ============================================================================

/**
 * POST /api/creative/cta
 * Generate Call-to-Action text and configuration
 */
router.post('/cta', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type = 'learn_more', customText, style = 'primary' } = req.body;

    const validTypes: CTAType[] = ['shop_now', 'learn_more', 'sign_up', 'download', 'book_now', 'get_quote', 'contact_us', 'custom'];
    const validStyles: CTAStyle[] = ['primary', 'secondary', 'minimal'];

    if (!validTypes.includes(type as CTAType)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid CTA type. Valid types: ${validTypes.join(', ')}`,
        },
        timestamp: new Date(),
      });
      return;
    }

    if (!validStyles.includes(style as CTAStyle)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid CTA style. Valid styles: ${validStyles.join(', ')}`,
        },
        timestamp: new Date(),
      });
      return;
    }

    const response = await adGenerator.generateCTA({
      type: type as CTAType,
      customText,
      style: style as CTAStyle,
    });

    if (!response.success || !response.cta) {
      res.status(500).json({
        success: false,
        error: { code: 'GENERATION_FAILED', message: 'Failed to generate CTA' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        cta: response.cta,
        alternatives: response.alternatives,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Creative Analysis Routes
// ============================================================================

/**
 * POST /api/creative/analyze
 * Analyze ad creative performance
 */
router.post('/analyze', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { adId, campaignId, dateRange, includeBenchmarks } = req.body;

    if (!campaignId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'campaignId is required' },
        timestamp: new Date(),
      });
      return;
    }

    const response = await creativeAnalyzer.analyzePerformance({
      adId,
      campaignId,
      dateRange: dateRange
        ? {
            start: new Date(dateRange.start),
            end: new Date(dateRange.end),
          }
        : undefined,
      includeBenchmarks: includeBenchmarks !== false,
    });

    if (!response.success || !response.analysis) {
      res.status(500).json({
        success: false,
        error: { code: 'ANALYSIS_FAILED', message: 'Failed to analyze creative' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: response.analysis,
      insights: response.insights,
      recommendations: response.recommendations,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/creative/suggest
 * Get creative improvement suggestions
 */
router.post('/suggest', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { campaignId, objective = 'consideration', targetAudience, competitorAds, topPerformingElements } = req.body;

    if (!campaignId) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'campaignId is required' },
        timestamp: new Date(),
      });
      return;
    }

    const validObjectives = ['awareness', 'consideration', 'conversion'];
    if (!validObjectives.includes(objective)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid objective. Valid options: ${validObjectives.join(', ')}`,
        },
        timestamp: new Date(),
      });
      return;
    }

    const response = await creativeAnalyzer.suggestCreative({
      campaignId,
      objective,
      targetAudience,
      competitorAds,
      topPerformingElements,
    });

    if (!response.success) {
      res.status(500).json({
        success: false,
        error: { code: 'SUGGESTION_FAILED', message: 'Failed to generate suggestions' },
        timestamp: new Date(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        suggestions: response.suggestions,
        colorPalette: response.colorPalette,
        messagingThemes: response.messagingThemes,
        visualStyles: response.visualStyles,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Batch Generation Routes
// ============================================================================

/**
 * POST /api/creative/batch
 * Generate multiple ad assets in one request
 */
router.post('/batch', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brandName, productName, category, platform, formats = ['medium_rectangle'] } = req.body;

    if (!brandName) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'brandName is required' },
        timestamp: new Date(),
      });
      return;
    }

    const results = await Promise.allSettled(
      formats.map(async (format: BannerFormat) => {
        const banner = await adGenerator.generateBanner({
          format,
          brandName,
          productName,
          category,
        });
        const copy = await adGenerator.generateCopy({
          brandName,
          productName,
          category,
          platform: platform as any,
        });
        const cta = await adGenerator.generateCTA({
          type: 'shop_now',
          style: 'primary',
        });

        return {
          format,
          banner: banner.banner,
          copy: copy.copies?.[0],
          cta: cta.cta,
        };
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<any>).value);
    const failed = results.filter((r) => r.status === 'rejected').length;

    res.json({
      success: true,
      data: {
        ads: successful,
        generated: successful.length,
        failed,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Export Router
// ============================================================================

export default router;
