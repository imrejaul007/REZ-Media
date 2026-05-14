# REZ Cohort Analysis Service

A comprehensive cohort analysis service for REZ-Media that provides user behavior analytics, retention tracking, and revenue cohorting capabilities.

## Features

- **Cohort Grid Generation** - Create retention/revenue/conversion grids grouped by acquisition date
- **Retention Curves** - Track user retention over time with confidence intervals
- **Revenue Cohorting** - Analyze revenue patterns across user cohorts
- **Time-to-Convert Analysis** - Measure conversion velocity
- **Segment Comparison** - Compare retention metrics across user segments
- **Export Analytics** - Export data in CSV/JSON formats

## Cohort Formula

```
Cohort = users grouped by acquisition date
Retention Rate = (Retained Users / Initial Cohort Size) * 100
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Express)                      │
├─────────────────────────────────────────────────────────────┤
│  Routes: /api/cohorts                                      │
│  ├── generate       - Generate cohort grids                 │
│  ├── retention-curve - Get retention curves                  │
│  ├── revenue        - Revenue cohort analysis                │
│  ├── time-to-convert - Conversion timing                    │
│  ├── compare-segments - Segment comparison                  │
│  └── definitions    - CRUD for saved cohorts                │
├─────────────────────────────────────────────────────────────┤
│                  Service Layer                               │
│  ├── CohortService      - Cohort calculations               │
│  └── RetentionEngine    - Retention mathematics             │
├─────────────────────────────────────────────────────────────┤
│                   Data Layer                                 │
│  ├── CohortDefinition   - Saved cohort configs             │
│  ├── UserActivity       - Raw activity data                 │
│  └── RetentionCurve     - Aggregated curves                 │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis (optional, for caching)

### Installation

```bash
cd REZ-cohort-analysis
npm install
```

### Configuration

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
PORT=4027
MONGODB_URI=mongodb://localhost:27017/rez-cohort-analysis
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKEN=your-secure-token
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## API Reference

### Authentication

All API endpoints (except `/health`) require the `X-Internal-Token` header:

```bash
curl -X GET http://localhost:4027/api/cohorts/health
curl -X POST http://localhost:4027/api/cohorts/generate \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Endpoints

#### Generate Cohort Grid

```http
POST /api/cohorts/generate
```

**Request Body:**

```json
{
  "name": "Weekly Retention",
  "type": "retention",
  "period": "weekly",
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-03-31T23:59:59.999Z",
  "maxPeriods": 12,
  "metrics": ["users", "revenue"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Weekly Retention",
    "type": "retention",
    "period": "weekly",
    "cohorts": [
      {
        "cohortId": "uuid",
        "cohortDate": "2026-01-01T00:00:00.000Z",
        "cohortLabel": "2026-Jan-W01",
        "initialSize": 1500,
        "dataPoints": [
          {
            "periodIndex": 0,
            "periodLabel": "2026-Jan-W01",
            "activeUsers": 1500,
            "retainedUsers": 1500,
            "retentionRate": 100,
            "revenue": 15000,
            "averageRevenuePerUser": 10.00
          }
        ]
      }
    ],
    "metadata": {
      "totalUsers": 15000,
      "averageRetentionRate": 45.5,
      "averageRevenuePerUser": 25.00,
      "topPerformingCohort": "2026-Feb-W01",
      "worstPerformingCohort": "2026-Jan-W04"
    }
  }
}
```

#### Get Retention Curve

```http
GET /api/cohorts/retention-curve?period=weekly&segmentId=premium
```

**Response:**

```json
{
  "success": true,
  "data": {
    "curvePoints": [
      {
        "periodIndex": 0,
        "retentionRate": 100,
        "lowerConfidence": 100,
        "upperConfidence": 100,
        "sampleSize": 5000
      },
      {
        "periodIndex": 1,
        "retentionRate": 65.5,
        "lowerConfidence": 64.2,
        "upperConfidence": 66.8,
        "sampleSize": 5000
      }
    ],
    "model": {
      "r0": 100,
      "lambda": 0.052,
      "rSquared": 0.98
    },
    "stats": {
      "averageRetention": 42.3,
      "medianRetention": 45.0,
      "maxDrop": 34.5,
      "stabilizationPeriod": 4
    }
  }
}
```

#### Get Revenue Cohorts

```http
GET /api/cohorts/revenue?startDate=2026-01-01&endDate=2026-03-31&period=monthly
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "cohortDate": "2026-01-01T00:00:00.000Z",
      "cohortLabel": "2026-Jan",
      "cohortSize": 5000,
      "period0Revenue": 50000,
      "period0ARPU": 10.00,
      "cumulativeRevenue": 125000,
      "cumulativeARPU": 25.00,
      "revenueRetentionRate": 41.67
    }
  ]
}
```

#### Time-to-Convert Analysis

```http
GET /api/cohorts/time-to-convert?startDate=2026-01-01&endDate=2026-03-31
```

**Response:**

```json
{
  "success": true,
  "data": {
    "medianDays": 7,
    "meanDays": 12.5,
    "percentile25": 3,
    "percentile75": 14,
    "percentile90": 28,
    "distribution": {
      "0": 150,
      "1": 320,
      "2": 280
    },
    "totalUsers": 10000,
    "convertedUsers": 3500,
    "conversionRate": 35.00
  }
}
```

#### Compare Segments

```http
POST /api/cohorts/compare-segments
Content-Type: application/json

{
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-03-31T23:59:59.999Z",
  "period": "weekly",
  "segmentIds": ["premium", "standard", "basic"]
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "segmentId": "premium",
      "segmentName": "premium",
      "averageRetentionRate": 68.5,
      "retentionRatesByPeriod": {
        "0": 100,
        "1": 85.2,
        "2": 72.1
      },
      "cohortSize": 2000,
      "revenuePerUser": 45.00,
      "conversionRate": 55.2
    }
  ]
}
```

## Data Models

### UserActivity

```typescript
interface IUserActivity {
  userId: string;
  cohortDate: Date;      // When user was acquired
  activityDate: Date;    // When activity occurred
  period: 'daily' | 'weekly' | 'monthly';
  segmentId?: string;
  revenue: number;
  orders: number;
  conversions: number;
  metadata: Record<string, unknown>;
}
```

### CohortDefinition

```typescript
interface ICohortDefinition {
  name: string;
  type: 'retention' | 'revenue' | 'conversion';
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  segmentIds: string[];
  metrics: string[];
}
```

## Retention Calculations

### Retention Rate

```
Retention Rate = (Active Users in Period N / Initial Cohort Size) * 100
```

### Confidence Intervals (Wilson Score)

```typescript
// For 95% confidence level
const z = 1.96;

const denominator = 1 + (z² / n);
const center = p + (z² / (2n));
const spread = z * sqrt((p(1-p) + z²/(4n)) / n);

lower = ((center - spread) / denominator) * 100
upper = ((center + spread) / denominator) * 100
```

### Exponential Decay Model

```typescript
// Fit retention curve to exponential decay
R(t) = R₀ * e^(-λt)

// Predict future retention
predictedRetention = R₀ * exp(-λ * periodIndex)
```

## Deployment

### Render

1. Connect your GitHub repository
2. Render automatically detects the `render.yaml` blueprint
3. MongoDB and Redis are provisioned automatically
4. Set `INTERNAL_SERVICE_TOKEN` in Render dashboard

```bash
# Manual deploy
render deploy
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 4027
CMD ["node", "dist/index.js"]
```

## Rate Limiting

Default: **100 requests/minute** per IP

Response headers:
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 95`
- `X-RateLimit-Reset: 1700000000`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 4027 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `REDIS_URL` | No | redis://localhost:6379 | Redis connection string |
| `INTERNAL_SERVICE_TOKEN` | Yes | - | Authentication token |
| `CORS_ORIGIN` | No | * | Allowed CORS origins |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/services/retentionEngine.test.ts
```

## Service Registry

This service is registered in the RABTUL service registry:

| Service | Port | Purpose |
|---------|------|---------|
| `REZ-cohort-analysis` | 4027 | Cohort analysis |

## License

Internal use only - RABTUL Technologies
