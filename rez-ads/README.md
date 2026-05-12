# REZ-Ads

A real-time ad serving platform with CPC/CPM bidding, fraud detection, and budget management.

## Features

- **Real-time Ad Serving**: Sub-100ms ad selection and delivery
- **CPC/CPM Bidding**: Support for both cost-per-click and cost-per-impression models
- **Budget Management**: Daily and total budget controls with automatic pause
- **Fraud Detection**: Click fraud prevention with velocity checks, IP reputation, and pattern analysis
- **Dynamic Pricing**: Integration with REZ-pricing-engine for market-based pricing
- **Targeting**: Geo, device, keyword, and interest-based targeting
- **Real-time Analytics**: Impression, click, and conversion tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         REZ-ADS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Express    │───▶│  BidEngine  │───▶│  AdServer    │       │
│  │   Server     │    │  (Auction)  │    │  (Delivery)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                    │                    │               │
│         ▼                    ▼                    ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Routes    │    │   Fraud      │    │   Event      │       │
│  │   CRUD      │    │   Detection  │    │   Tracking   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build image
docker build -t rez-ads .

# Run container
docker run -p 3005:3005 --env-file .env rez-ads
```

## API Endpoints

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/:id` | Get campaign |
| PATCH | `/api/campaigns/:id` | Update campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |
| POST | `/api/campaigns/:id/pause` | Pause campaign |
| POST | `/api/campaigns/:id/resume` | Resume campaign |

### Placements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/placements` | List placements |
| POST | `/api/placements` | Create placement |
| GET | `/api/placements/:id` | Get placement |
| PATCH | `/api/placements/:id` | Update placement |
| DELETE | `/api/placements/:id` | Delete placement |

### Ad Serving

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/serve` | Serve ad |
| POST | `/api/serve` | Serve ad (JSON) |
| GET | `/api/serve/preview/:id` | Preview available ads |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/impression` | Track impression (pixel) |
| POST | `/api/events/impression` | Track impression (API) |
| GET | `/api/events/click` | Track click |
| POST | `/api/events/click` | Track click (API) |
| POST | `/api/events/conversion` | Track conversion |

### Bidding

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bidding/set` | Set bid strategy |
| POST | `/api/bidding/estimate` | Estimate bids |
| GET | `/api/bidding/stats/:id` | Get bid statistics |
| POST | `/api/bidding/optimize/:id` | Optimize bid |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3005 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/rez-ads |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `JWT_SECRET` | JWT signing secret | - |
| `FRAUD_CHECK_ENABLED` | Enable fraud detection | true |
| `FRAUD_CLICK_THRESHOLD` | Max clicks per window | 5 |
| `FRAUD_WINDOW_MINUTES` | Analysis window | 10 |
| `MIN_BID_CPM` | Minimum CPM bid | 0.01 |
| `MAX_BID_CPM` | Maximum CPM bid | 10.00 |

## Integration

### Serving Ads

```javascript
// GET request for simple integration
const response = await fetch(
  `http://localhost:3005/api/serve?placementId=plc_xxx&sessionId=${sessionId}`
);

// Or POST for more targeting options
const response = await fetch('http://localhost:3005/api/serve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    placementId: 'plc_xxx',
    sessionId: 'user-session-id',
    country: 'US',
    device: 'mobile',
    keywords: ['shoes', 'fashion']
  })
});

const ad = await response.json();
// ad.creative contains the ad content
// ad.tracking contains impression/click URLs
```

### Tracking Events

```javascript
// Track impression (use the tracking URL from ad response)
const img = new Image();
img.src = ad.tracking.impressionUrl;

// Track click
window.location.href = ad.tracking.clickUrl;

// Track conversion
await fetch('http://localhost:3005/api/events/conversion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    adId: ad.adId,
    campaignId: ad.campaignId,
    placementId: placementId,
    value: 99.99,
    currency: 'USD'
  })
});
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
node --test test/fraudDetection.test.ts
```

## Monitoring

- Health check: `GET /health`
- Readiness probe: `GET /ready`
- Metrics: `GET /metrics`

## Security

- JWT authentication for all management APIs
- Internal service token authentication for service-to-service calls
- Rate limiting on all endpoints
- HMAC signature verification for webhook events
- Input validation using Zod schemas

## License

Proprietary - All rights reserved
