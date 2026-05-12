# REZ Attribution Platform

Smart Attribution Platform for REZ-Media - Tracks offline attribution from ad view to store visit to purchase.

## Features

- **Touchpoint Tracking**: Track ad views, store visits, website visits, and other customer interactions
- **Attribution Models**: First-touch, Last-touch, Linear, Time-decay, and Position-based (U-shaped)
- **Conversion Tracking**: Track purchases, signups, subscriptions, and other conversions
- **Real-time Reporting**: Dashboard metrics and comprehensive attribution reports
- **Channel Attribution**: Understand which marketing channels drive conversions
- **Campaign Analytics**: Measure campaign performance with detailed breakdowns

## Architecture

```
REZ-attribution-platform/
├── src/
│   ├── services/          # Core business logic
│   │   ├── TouchpointTracker.ts
│   │   ├── AttributionEngine.ts
│   │   ├── ConversionTracker.ts
│   │   └── ReportGenerator.ts
│   ├── models/            # MongoDB schemas
│   │   ├── Touchpoint.ts
│   │   ├── Conversion.ts
│   │   └── AttributionReport.ts
│   ├── routes/            # API endpoints
│   │   ├── track.ts
│   │   └── reports.ts
│   ├── utils/
│   │   └── logger.ts
│   └── index.ts           # Application entry point
├── package.json
├── tsconfig.json
├── render.yaml            # Deployment configuration
└── .env.example
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Configuration

Create a `.env` file with the following variables:

```env
MONGODB_URI=mongodb://localhost:27017/rez-attribution
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

## API Reference

### Tracking Endpoints

#### POST /api/track/touchpoint
Track a new touchpoint (ad view, store visit, etc.)

```json
{
  "userId": "user_123",
  "sessionId": "session_456",
  "type": "ad_view",
  "channel": "display",
  "campaignId": "campaign_789",
  "merchantId": "merchant_001",
  "storeId": "store_002",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Types**: `ad_view`, `store_visit`, `website_visit`, `search`, `social_engagement`, `email_open`, `app_open`

**Channels**: `display`, `social`, `search`, `video`, `audio`, `ooh`, `print`, `direct`, `email`, `referral`

#### POST /api/track/conversion
Track a conversion (purchase, signup, etc.)

```json
{
  "userId": "user_123",
  "sessionId": "session_456",
  "type": "purchase",
  "merchantId": "merchant_001",
  "storeId": "store_002",
  "orderId": "order_789",
  "value": 99.99,
  "currency": "USD",
  "items": [
    {
      "productId": "prod_001",
      "name": "Product Name",
      "quantity": 2,
      "price": 49.99
    }
  ],
  "applyAttribution": true,
  "attributionConfig": {
    "model": "linear",
    "lookbackDays": 30,
    "attributionWindow": 7
  }
}
```

**Types**: `purchase`, `signup`, `subscription`, `lead`, `download`, `app_install`

### Reporting Endpoints

#### GET /api/reports/attribution
Get attribution report with configurable parameters.

```
GET /api/reports/attribution?merchantId=merchant_001&startDate=2024-01-01&endDate=2024-01-31&model=linear&lookbackDays=30
```

**Query Parameters**:
- `merchantId` - Filter by merchant
- `campaignId` - Filter by campaign
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)
- `model` - Attribution model
- `lookbackDays` - Days to look back for touchpoints

#### GET /api/reports/funnel
Get conversion funnel report.

```
GET /api/reports/funnel?merchantId=merchant_001&startDate=2024-01-01&endDate=2024-01-31
```

#### POST /api/campaigns/:id/attribution
Get campaign attribution report.

```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "attributionModel": "linear"
}
```

### Other Endpoints

#### GET /api/track/touchpoints
Get touchpoints with filtering.

#### GET /api/track/conversions
Get conversions with filtering.

#### GET /api/reports/dashboard/:merchantId
Get real-time dashboard metrics.

#### GET /api/reports/channel-performance
Get channel performance metrics.

## Attribution Models

### First-Touch
100% credit to the first touchpoint in the customer journey.

### Last-Touch
100% credit to the last touchpoint before conversion.

### Linear
Equal credit distributed across all touchpoints.

### Time-Decay
More credit to touchpoints closer to the conversion time (7-day half-life).

### Position-Based (U-Shaped)
40% credit to first touchpoint, 40% to last touchpoint, 20% distributed among middle touchpoints.

## Example Usage

### Track an Ad View
```bash
curl -X POST http://localhost:3000/api/track/touchpoint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "sessionId": "sess_abc",
    "type": "ad_view",
    "channel": "display",
    "campaignId": "camp_001",
    "merchantId": "merchant_001"
  }'
```

### Track a Store Visit
```bash
curl -X POST http://localhost:3000/api/track/touchpoint \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "sessionId": "sess_abc",
    "type": "store_visit",
    "channel": "ooh",
    "merchantId": "merchant_001",
    "storeId": "store_001",
    "location": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "address": "123 Main St, San Francisco"
    }
  }'
```

### Track a Purchase
```bash
curl -X POST http://localhost:3000/api/track/conversion \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "sessionId": "sess_abc",
    "type": "purchase",
    "merchantId": "merchant_001",
    "storeId": "store_001",
    "orderId": "order_xyz",
    "value": 149.99,
    "currency": "USD",
    "applyAttribution": true,
    "attributionConfig": {
      "model": "time_decay",
      "lookbackDays": 30,
      "attributionWindow": 7
    }
  }'
```

### Get Attribution Report
```bash
curl "http://localhost:3000/api/reports/attribution?merchantId=merchant_001&model=linear"
```

## Deployment

### Render

The platform includes a `render.yaml` for easy deployment to Render.

```bash
# Deploy using Render CLI
render deploy
```

Or connect your GitHub repository to Render for automatic deployments.

### Manual Deployment

```bash
# Build the application
npm run build

# Set environment variables
export MONGODB_URI="your-mongodb-uri"
export PORT=3000
export NODE_ENV=production

# Start the server
npm start
```

## Health Check

```
GET /health
```

Returns server status and database connection state.

## License

Proprietary - REZ Media Inc.
