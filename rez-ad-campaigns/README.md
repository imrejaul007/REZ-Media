# REZ Ads Service

Advertising platform microservice for managing ad campaigns, placements, and analytics with intent capture.

## Purpose

The Ads Service handles:
- Ad campaign management
- Ad placement and targeting
- Ad serving and tracking
- Click and impression analytics
- Budget management
- Intent capture for analytics (ReZ Mind)

## Environment Variables

```env
# Service Configuration
PORT=4007
MONGO_URI=mongodb://localhost:27017/rez-ads
ADS_MONGO_URI=
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret

# Internal Auth
INTERNAL_SERVICE_KEY=your-internal-key

# RTMN Commerce Memory
INTENT_CAPTURE_URL=https://rez-intent-graph.onrender.com
INTERNAL_SERVICE_TOKEN=your-internal-service-token
```

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run tests
npm test
```

## API Endpoints

### Campaigns

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/campaigns | List campaigns |
| GET | /api/campaigns/:campaignId | Get campaign details |
| POST | /api/campaigns | Create campaign |
| PUT | /api/campaigns/:campaignId | Update campaign |
| DELETE | /api/campaigns/:campaignId | Delete campaign |
| POST | /api/campaigns/:campaignId/start | Start campaign |
| POST | /api/campaigns/:campaignId/pause | Pause campaign |

### Ad Placements

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/placements | List ad placements |
| GET | /api/placements/:placementId | Get placement details |
| POST | /api/placements | Create placement |
| PUT | /api/placements/:placementId | Update placement |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/analytics/impression | Record impression |
| POST | /api/analytics/click | Record click |
| GET | /api/analytics/campaign/:campaignId | Get campaign analytics |
| GET | /api/analytics/daily | Get daily analytics |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |

## Ad Targeting

- Location-based targeting
- Time-based scheduling
- User segment targeting
- Device targeting
- Behavioral targeting

## Data Models

### Campaign
```typescript
{
  campaignId: string;
  advertiserId: string;
  name: string;
  type: 'banner' | 'video' | 'native';
  status: 'draft' | 'active' | 'paused' | 'completed';
  budget: number;
  spent: number;
  startDate: Date;
  endDate?: Date;
  targeting: TargetingConfig;
  createdAt: Date;
  updatedAt: Date;
}
```

### Ad
```typescript
{
  adId: string;
  campaignId: string;
  name: string;
  content: AdContent;
  ctr: number;
  impressions: number;
  clicks: number;
}
```

### TargetingConfig
```typescript
{
  locations?: string[];
  devices?: ('mobile' | 'desktop' | 'tablet')[];
  schedule?: { startHour: number; endHour: number }[];
  userSegments?: string[];
  demographics?: { ageMin?: number; ageMax?: number; gender?: string[] };
}
```

## Metrics Tracked

| Metric | Description |
|--------|-------------|
| Impressions | Number of times ad was displayed |
| Clicks | Number of times ad was clicked |
| CTR | Click-through rate (clicks/impressions) |
| Conversions | Number of desired actions completed |
| CPC | Cost per click |
| CPM | Cost per thousand impressions |
| Spend | Total amount spent |

## Deployment

### Render.com
1. Connect GitHub repository
2. Build command: `npm run build`
3. Start command: `npm start`
4. Configure MongoDB

### Docker
```bash
docker build -t rez-ads-service .
docker run -p 4007:4007 --env-file .env rez-ads-service
```

## Related Services

- **rez-merchant-service** - Merchant ad campaigns
- **rez-intent-graph** - ReZ Mind intent capture

## License

MIT
