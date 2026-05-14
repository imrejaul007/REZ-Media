# REZ Anniversary Rewards Service

A microservice for managing anniversary-based customer rewards and loyalty programs. Detects user anniversaries, awards milestone rewards, and tracks analytics.

## Features

- **Anniversary Detection**: Automatically detect user registration anniversaries
- **Milestone Rewards**: Support for 1yr, 2yr, 3yr, 5yr, and 10yr milestones
- **Tenure-Based Offers**: Dynamic offers based on customer tenure
- **Multi-Channel Notifications**: Email, WhatsApp, SMS, Push, In-App
- **Analytics Tracking**: Comprehensive analytics for reward performance

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/anniversary/config/:merchantId` | Get merchant anniversary config |
| PUT | `/api/anniversary/config/:merchantId` | Update merchant config |
| GET | `/api/anniversary/milestones/:merchantId` | Get milestone rewards |
| PUT | `/api/anniversary/milestones/:merchantId` | Update milestones |
| GET | `/api/anniversary/channels` | List notification channels |

### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/anniversary/tenure/:merchantId/:userId` | Get user tenure info |
| POST | `/api/anniversary/calculate-tenure` | Calculate user tenure |
| GET | `/api/anniversary/eligibility/:merchantId/:userId` | Check reward eligibility |

### Offers & Rewards

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/anniversary/offers/:merchantId/:userId` | Get available offers |
| POST | `/api/anniversary/generate-offer` | Generate reward offer |
| POST | `/api/anniversary/claim` | Claim a reward |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/anniversary/analytics/:merchantId` | Get analytics data |
| POST | `/api/anniversary/trigger` | Trigger batch check |

## Default Milestone Rewards

| Years | Name | Reward Type | Value |
|-------|------|------------|-------|
| 1 | First Anniversary | 15% off | Min order 500, Max 300 |
| 2 | Second Anniversary | 20% off | Min order 750, Max 500 |
| 3 | Third Anniversary | 25% off | Min order 1000, Max 750 |
| 5 | Platinum Anniversary | Rs. 500 off | Min order 1000 |
| 10 | Diamond Anniversary | 5000 Points | Rs. 500 value |

## Configuration Options

```typescript
interface AnniversaryConfig {
  merchantId: string;
  enabled: boolean;
  milestones: MilestoneReward[];
  channels: NotificationChannel[];
  notificationTiming: 'anniversary_day' | 'day_before' | 'week_before' | 'custom';
  customDaysBefore?: number;
  offerCode?: string;
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 4035 |
| `ALLOWED_ORIGINS` | CORS origins | * |
| `MONGODB_URI` | MongoDB connection string | - |
| `REDIS_URL` | Redis connection string | - |

## Architecture

```
src/
  index.ts           # Express server entry point
  routes/
    anniversary.ts   # API route handlers
  services/
    anniversaryService.ts  # Business logic
```

## Security

- Rate limiting: 100 requests/minute
- CORS enabled with configurable origins
- Helmet.js security headers
- Input validation on all endpoints

## Testing

```bash
npm test
```

## License

Proprietary - RABTUL Technologies
