import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Import rankers and engines
import {
  SemanticSearchEngine,
  SemanticSearchOptions,
  Product,
} from './search/semantic-search';

import {
  GeoRanker,
  GeoLocation,
  GeoRankingOptions,
  ProductWithLocation,
} from './ranking/geo-ranker';

import {
  TrendingRanker,
  TrendingOptions,
} from './ranking/trending';

import {
  LocalRanker,
  LocalRankingOptions,
  ProductWithLocal,
} from './ranking/local';

import {
  SponsoredRanker,
  SponsoredOptions,
  SponsoredProduct,
} from './ranking/sponsored';

import {
  RecommendationBlend,
  BlendingOptions,
  STRATEGIES,
} from './blend/recommendation-blend';

// Environment
const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize components
const semanticSearch = new SemanticSearchEngine(1536);
const geoRanker = new GeoRanker();
const trendingRanker = new TrendingRanker();
const localRanker = new LocalRanker();
const sponsoredRanker = new SponsoredRanker();
const recommendationBlend = new RecommendationBlend('relevance_balanced');

// Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      semanticSearch: semanticSearch.getProductCount(),
      geoRanker: geoRanker.getProductCount(),
      trendingRanker: trendingRanker.getProductCount(),
      localRanker: localRanker.getProductCount(),
      sponsoredRanker: sponsoredRanker.getProductCount(),
    },
  });
});

// Stats endpoint
app.get('/stats', (_req: Request, res: Response) => {
  res.json({
    semanticSearch: { productCount: semanticSearch.getProductCount() },
    geoRanker: { productCount: geoRanker.getProductCount() },
    trendingRanker: trendingRanker.getStats(),
    localRanker: { productCount: localRanker.getProductCount() },
    sponsoredRanker: { productCount: sponsoredRanker.getProductCount() },
    blending: { strategies: recommendationBlend.getStrategies() },
  });
});

// Request schemas
const SearchRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(100).optional().default(20),
  category: z.string().optional(),
  userLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  filters: z.object({
    category: z.string().optional(),
    priceRange: z.object({
      min: z.number().min(0),
      max: z.number().min(0),
    }).optional(),
    tags: z.array(z.string()).optional(),
    inStock: z.boolean().optional(),
  }).optional(),
  strategy: z.enum(Object.keys(STRATEGIES)).optional().default('relevance_balanced'),
});

// Search endpoint
app.post('/search', async (req: Request, res: Response) => {
  try {
    const body = SearchRequestSchema.parse(req.body);
    const requestId = uuidv4();

    console.log(`[${requestId}] Search request:`, {
      query: body.query,
      limit: body.limit,
      category: body.category,
      hasLocation: !!body.userLocation,
    });

    // Run rankers in parallel
    const [semanticResults, trendingResults, sponsoredResults] = await Promise.all([
      // Semantic search
      semanticSearch.search(body.query, {
        limit: body.limit * 2,
        filters: body.filters,
      }),

      // Trending
      Promise.resolve(trendingRanker.getTrending({
        limit: body.limit * 2,
        timeWindow: 'day',
      })),

      // Sponsored
      Promise.resolve(sponsoredRanker.rank(
        [], // Will be combined with semantic results
        body.query,
        body.category,
        { maxSponsoredRatio: 0.2 }
      )),
    ]);

    // Register semantic results
    const semanticWithScores = semanticResults.map(r => ({
      productId: r.productId,
      score: r.score,
    }));
    recommendationBlend.registerRankerResults('semantic', semanticWithScores);

    // Register trending results
    const trendingWithScores = trendingResults.map(r => ({
      productId: r.productId,
      score: r.score,
    }));
    recommendationBlend.registerRankerResults('trending', trendingWithScores);

    // Register geo results if location provided
    if (body.userLocation) {
      const geoResults = geoRanker.rankByLocation(body.userLocation, {
        maxDistance: 50,
      });
      const geoWithScores = geoResults.map(r => ({
        productId: r.productId,
        score: r.finalScore,
      }));
      recommendationBlend.registerRankerResults('geo', geoWithScores);
    }

    // Register sponsored results
    recommendationBlend.registerRankerResults('sponsored', sponsoredResults.map(r => ({
      productId: r.productId,
      score: r.sponsored ? r.bidAmount || 1 : 0,
    })));

    // Blend results
    recommendationBlend.setStrategy(body.strategy);
    const blendedResults = recommendationBlend.blend({
      limit: body.limit,
    });

    console.log(`[${requestId}] Blended ${blendedResults.length} results`);

    res.json({
      requestId,
      query: body.query,
      results: blendedResults,
      meta: {
        totalResults: blendedResults.length,
        strategy: body.strategy,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Index product
const IndexProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number().min(0),
  tags: z.array(z.string()),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  sellerLocation: z.object({
    city: z.string(),
    state: z.string().optional(),
    country: z.string(),
  }).optional(),
  inventory: z.object({
    quantity: z.number(),
    localWarehouse: z.boolean().optional(),
  }).optional(),
  reviews: z.object({
    averageRating: z.number().min(0).max(5),
    reviewCount: z.number(),
    localReviewCount: z.number().optional(),
  }).optional(),
  delivery: z.object({
    estimatedDays: z.number(),
    localDelivery: z.boolean().optional(),
  }).optional(),
  sellerRating: z.number().min(0).max(5).optional(),
});

app.post('/products', async (req: Request, res: Response) => {
  try {
    const product = IndexProductSchema.parse(req.body);

    // Index for semantic search
    await semanticSearch.indexProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      tags: product.tags,
    });

    // Register for geo ranking
    if (product.location) {
      geoRanker.registerProduct({
        id: product.id,
        name: product.name,
        location: product.location,
      });
    }

    // Register for local ranking
    if (product.sellerLocation || product.inventory || product.reviews || product.delivery) {
      localRanker.registerProduct({
        id: product.id,
        sellerLocation: product.sellerLocation,
        inventory: product.inventory,
        reviews: product.reviews,
        delivery: product.delivery,
        sellerRating: product.sellerRating,
      });
    }

    res.json({ success: true, productId: product.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid product', details: error.errors });
    } else {
      console.error('Index error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Batch index products
app.post('/products/batch', async (req: Request, res: Response) => {
  try {
    const { products } = z.object({
      products: z.array(IndexProductSchema),
    }).parse(req.body);

    const results = await semanticSearch.indexProducts(products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      tags: p.tags,
    })));

    // Register geo locations
    for (const p of products) {
      if (p.location) {
        geoRanker.registerProduct({ id: p.id, name: p.name, location: p.location });
      }
      if (p.sellerLocation || p.inventory || p.reviews || p.delivery) {
        localRanker.registerProduct({
          id: p.id,
          sellerLocation: p.sellerLocation,
          inventory: p.inventory,
          reviews: p.reviews,
          delivery: p.delivery,
          sellerRating: p.sellerRating,
        });
      }
    }

    res.json({
      success: true,
      indexed: results.success,
      failed: results.failed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      console.error('Batch index error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Track events
app.post('/events', (req: Request, res: Response) => {
  try {
    const { type, productId, timestamp } = z.object({
      type: z.enum(['view', 'purchase', 'wishlist']),
      productId: z.string(),
      timestamp: z.string().datetime().optional(),
    }).parse(req.body);

    const ts = timestamp ? new Date(timestamp) : new Date();

    switch (type) {
      case 'view':
        trendingRanker.recordView(productId, ts);
        break;
      case 'purchase':
        trendingRanker.recordPurchase(productId, ts);
        break;
      case 'wishlist':
        trendingRanker.recordWishlist(productId, ts);
        break;
    }

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid event', details: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Trending endpoint
app.get('/trending', (req: Request, res: Response) => {
  try {
    const { timeWindow, limit } = z.object({
      timeWindow: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
      limit: z.coerce.number().min(1).max(100).optional().default(20),
    }).parse(req.query);

    const results = trendingRanker.getTrending({ timeWindow, limit });

    res.json({
      timeWindow,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Nearby products
app.get('/nearby', (req: Request, res: Response) => {
  try {
    const { lat, lon, radius } = z.object({
      lat: z.coerce.number().min(-90).max(90),
      lon: z.coerce.number().min(-180).max(180),
      radius: z.coerce.number().positive().optional().default(10),
    }).parse(req.query);

    const products = geoRanker.findNearest(
      { latitude: lat, longitude: lon },
      50
    ).filter(p => p.distance <= radius);

    res.json({
      location: { latitude: lat, longitude: lon },
      radius,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Local products
app.get('/local', (req: Request, res: Response) => {
  try {
    const { city, state, country } = z.object({
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    }).parse(req.query);

    if (!city && !state && !country) {
      res.status(400).json({ error: 'At least one locality parameter required' });
      return;
    }

    const products = localRanker.getByLocality(city, state, country);

    res.json({
      locality: { city, state, country },
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sponsored products
app.post('/sponsored/register', (req: Request, res: Response) => {
  try {
    const product = z.object({
      productId: z.string(),
      campaignId: z.string(),
      bidAmount: z.number().min(0),
      dailyBudget: z.number().min(0),
      targetKeywords: z.array(z.string()),
      targetCategories: z.array(z.string()),
      priority: z.enum(['high', 'medium', 'low']),
    }).parse(req.body);

    sponsoredRanker.registerSponsoredProduct({
      ...product,
      spent: 0,
      startDate: new Date(),
      status: 'active',
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid sponsored product', details: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Strategies endpoint
app.get('/strategies', (_req: Request, res: Response) => {
  res.json({
    strategies: recommendationBlend.getStrategies(),
    current: recommendationBlend.getCurrentStrategy(),
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
======================================
  REZ Discovery Platform
======================================
  Status: Running
  Port: ${PORT}
  Environment: ${NODE_ENV}
  Time: ${new Date().toISOString()}

  Endpoints:
  - GET  /health          - Health check
  - GET  /stats          - Service statistics
  - POST /search         - Search products
  - POST /products       - Index a product
  - POST /products/batch - Batch index
  - POST /events         - Track events
  - GET  /trending       - Trending products
  - GET  /nearby         - Nearby products
  - GET  /local          - Local products
  - POST /sponsored/register - Register sponsored
  - GET  /strategies     - Available strategies
======================================
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export {
  semanticSearch,
  geoRanker,
  trendingRanker,
  localRanker,
  sponsoredRanker,
  recommendationBlend,
};
