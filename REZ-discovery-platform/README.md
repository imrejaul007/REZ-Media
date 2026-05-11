# REZ Discovery Platform

A sophisticated discovery platform that combines semantic search, geo-ranking, trending analysis, and recommendation blending to deliver personalized product discovery experiences.

## Architecture

```
REZ Discovery Platform
├── Search Engine (Semantic)
│   └── Vector-based semantic search with cosine similarity
├── Rankers
│   ├── GeoRanker - Geographic proximity scoring
│   ├── TrendingRanker - Time-decay trending analysis
│   ├── LocalRanker - Local inventory/reviews/delivery
│   └── SponsoredRanker - Paid placement management
└── Recommendation Blend
    └── Multi-strategy score blending with transparency
```

## Features

### Semantic Search
- Vector embeddings for semantic matching
- Text-to-product and product-to-product similarity
- Configurable similarity thresholds
- Filter support (category, price, tags, availability)

### Geo-Ranking
- Haversine distance calculation
- Multiple decay functions (linear, exponential, gaussian)
- Configurable search radius
- Blending with relevance scores

### Trending Analysis
- Time-decay algorithm for recency
- Velocity calculation for trending direction
- Composite scoring from views, purchases, wishlists
- Configurable time windows (hour, day, week, month)

### Local Ranking
- Local inventory availability scoring
- Local review weighting
- Delivery time optimization
- Merchant reputation tracking

### Sponsored Results
- Campaign-based ad management
- Bid-based auction system
- Multiple positioning strategies (scattered, top, distributed)
- Budget tracking and pacing

### Recommendation Blending
- Multiple blending strategies
- Score normalization (minmax, zscore, rank)
- Multiple combination methods (weighted sum, reciprocal rank, geometric mean)
- Full transparency into score contributions

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### Search
```http
POST /search
Content-Type: application/json

{
  "query": "wireless headphones",
  "limit": 20,
  "category": "electronics",
  "userLocation": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "strategy": "relevance_balanced",
  "filters": {
    "priceRange": { "min": 50, "max": 200 },
    "inStock": true
  }
}
```

### Index Products
```http
POST /products
Content-Type: application/json

{
  "id": "prod_123",
  "name": "Premium Wireless Headphones",
  "description": "High-quality wireless headphones with noise cancellation",
  "category": "electronics",
  "price": 149.99,
  "tags": ["wireless", "headphones", "audio"],
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "sellerLocation": {
    "city": "San Francisco",
    "state": "CA",
    "country": "USA"
  },
  "inventory": {
    "quantity": 50,
    "localWarehouse": true
  },
  "reviews": {
    "averageRating": 4.5,
    "reviewCount": 128,
    "localReviewCount": 45
  },
  "delivery": {
    "estimatedDays": 2,
    "localDelivery": true
  },
  "sellerRating": 4.8
}
```

### Batch Index
```http
POST /products/batch
Content-Type: application/json

{
  "products": [
    { /* product 1 */ },
    { /* product 2 */ }
  ]
}
```

### Track Events
```http
POST /events
Content-Type: application/json

{
  "type": "view",        // "view" | "purchase" | "wishlist"
  "productId": "prod_123",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Trending Products
```http
GET /trending?timeWindow=day&limit=10
```

### Nearby Products
```http
GET /nearby?lat=37.7749&lon=-122.4194&radius=10
```

### Local Products
```http
GET /local?city=San Francisco
GET /local?state=CA
GET /local?country=USA
```

### Register Sponsored Product
```http
POST /sponsored/register
Content-Type: application/json

{
  "productId": "prod_123",
  "campaignId": "camp_456",
  "bidAmount": 0.50,
  "dailyBudget": 100,
  "targetKeywords": ["headphones", "audio", "wireless"],
  "targetCategories": ["electronics"],
  "priority": "high"
}
```

### Health Check
```http
GET /health
```

### Statistics
```http
GET /stats
```

### Available Strategies
```http
GET /strategies
```

## Blending Strategies

| Strategy | Semantic | Trending | Geo | Local | Sponsored |
|----------|---------|----------|-----|-------|-----------|
| relevance_balanced | 35% | 25% | 20% | 10% | 10% |
| geo_focused | 25% | 15% | 40% | 10% | 10% |
| trending_aware | 25% | 40% | 15% | 10% | 10% |
| sponsored_priority | 25% | 20% | 10% | 10% | 35% |
| quality_focused | 30% | 20% | 10% | 30% | 10% |

## Response Format

### Search Response
```json
{
  "requestId": "uuid-v4",
  "query": "wireless headphones",
  "results": [
    {
      "productId": "prod_123",
      "finalScore": 0.8523,
      "contributions": {
        "semantic": 0.9,
        "trending": 0.7,
        "geo": 0.85,
        "sponsored": 0.5
      },
      "rank": 1,
      "blendedFrom": ["semantic", "trending", "geo", "sponsored"]
    }
  ],
  "meta": {
    "totalResults": 20,
    "strategy": "relevance_balanced",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

### Type Checking
```bash
npx tsc --noEmit
```

## Deployment

The service can be deployed to Render using the included `render.yaml`:

```bash
render blueprint apply
```

Or manually:
1. Connect your repository to Render
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Set environment variables as needed

## Performance Considerations

- Semantic search uses cosine similarity with normalized vectors
- Results are cached where possible
- Batch operations supported for bulk indexing
- Configurable limits prevent excessive memory usage
- Health checks enable load balancer integration

## License

Proprietary - REZ Inc.
