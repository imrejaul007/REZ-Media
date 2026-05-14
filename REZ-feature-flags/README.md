# REZ Feature Flags Service

A production-ready feature flag service with percentage rollouts, user targeting, and analytics.

## Features

- **Feature Flag Evaluation**: Evaluate flags with real-time results
- **Percentage Rollouts**: Gradually roll out features to a percentage of users
- **User Targeting**: Target users based on custom attributes and conditions
- **Multi-Environment**: Development, staging, and production environments
- **Analytics**: Track flag evaluations and user engagement
- **Variations**: Support multiple variations per flag (A/B testing)
- **Caching**: Redis-based caching for high-performance evaluation
- **Express Middleware**: Easy integration with Express applications

## Quick Start

### Installation

```bash
cd REZ-Media/REZ-feature-flags
npm install
```

### Configuration

Create a `.env` file:

```env
PORT=4035
MONGODB_URI=mongodb://localhost:27017/rez-feature-flags
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKEN=your-secret-token
NODE_ENV=development
```

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Reference

### Flags CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/flags` | Create a new flag |
| `GET` | `/api/flags` | List all flags |
| `GET` | `/api/flags/:key` | Get a single flag |
| `PATCH` | `/api/flags/:key` | Update a flag |
| `DELETE` | `/api/flags/:key` | Delete a flag |
| `POST` | `/api/flags/:key/toggle` | Toggle flag enabled/disabled |

### Flag Evaluation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/flags/evaluate/:key` | Evaluate a single flag |
| `POST` | `/api/flags/evaluate` | Batch evaluate multiple flags |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/flags/:key/analytics` | Get flag analytics events |
| `GET` | `/api/flags/:key/stats` | Get flag statistics |
| `GET` | `/api/flags/stats/all` | Get all flag statistics |

### Bulk Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/flags/bulk` | Create multiple flags |
| `POST` | `/api/flags/copy` | Copy flags between environments |

## Usage Examples

### Create a Feature Flag

```bash
curl -X POST http://localhost:4035/api/flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new-checkout-flow",
    "name": "New Checkout Flow",
    "description": "Redesigned checkout experience",
    "environment": "production",
    "variations": [
      { "id": "control", "name": "Control", "value": false },
      { "id": "treatment", "name": "Treatment", "value": true }
    ],
    "defaultVariation": "control",
    "percentageRollout": {
      "enabled": true,
      "percentage": 20,
      "seed": "checkout-2024"
    },
    "tags": ["checkout", "experiment"]
  }'
```

### Evaluate a Flag

```bash
curl -X POST http://localhost:4035/api/flags/evaluate/new-checkout-flow \
  -H "Content-Type: application/json" \
  -H "X-Environment: production" \
  -d '{
    "userId": "user-12345",
    "attributes": {
      "plan": "premium",
      "country": "IN",
      "age": 30
    }
  }'
```

### Batch Evaluate Flags

```bash
curl -X POST http://localhost:4035/api/flags/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-12345",
    "flagKeys": ["new-checkout-flow", "dark-mode", "beta-features"],
    "attributes": {
      "plan": "premium"
    }
  }'
```

### User Targeting

Target users based on attributes:

```bash
curl -X POST http://localhost:4035/api/flags \
  -H "Content-Type: application/json" \
  -d '{
    "key": "premium-feature",
    "name": "Premium Feature",
    "variations": [
      { "id": "off", "name": "Off", "value": false },
      { "id": "on", "name": "On", "value": true }
    ],
    "defaultVariation": "off",
    "targeting": {
      "enabled": true,
      "rules": [
        {
          "id": "rule-1",
          "priority": 1,
          "conditions": [
            { "attribute": "plan", "operator": "eq", "value": "premium" },
            { "attribute": "age", "operator": "gte", "value": 18 }
          ],
          "variationId": "on"
        },
        {
          "id": "rule-2",
          "priority": 2,
          "conditions": [
            { "attribute": "country", "operator": "in", "value": ["IN", "US", "UK"] }
          ],
          "variationId": "on"
        }
      ]
    }
  }'
```

### Using Express Middleware

```typescript
import express from 'express';
import { createFlagMiddleware } from './middleware/flagMiddleware';
import { FlagService } from './services/flagService';

const app = express();
const flagService = new FlagService();
const { extractContext, requireFlags, attachFlags } = createFlagMiddleware({
  flagService,
  defaultEnvironment: 'production',
});

// Extract user context from request
app.use(extractContext);

// Attach flag states to response headers
app.get('/dashboard', attachFlags(['new-ui', 'analytics-v2']), (req, res) => {
  res.json({ message: 'Dashboard data' });
});

// Require specific flags to be enabled
app.get('/premium-feature',
  requireFlags(['premium-feature']),
  (req, res) => {
    res.json({ message: 'Premium feature content' });
  }
);
```

## Targeting Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `{"attribute": "plan", "operator": "eq", "value": "premium"}` |
| `neq` | Not equal | `{"attribute": "plan", "operator": "neq", "value": "free"}` |
| `gt` | Greater than | `{"attribute": "age", "operator": "gt", "value": 18}` |
| `gte` | Greater than or equal | `{"attribute": "orders", "operator": "gte", "value": 10}` |
| `lt` | Less than | `{"attribute": "age", "operator": "lt", "value": 65}` |
| `lte` | Less than or equal | `{"attribute": "score", "operator": "lte", "value": 100}` |
| `in` | In array | `{"attribute": "country", "operator": "in", "value": ["IN", "US"]}` |
| `nin` | Not in array | `{"attribute": "plan", "operator": "nin", "value": ["banned"]}` |
| `contains` | String contains | `{"attribute": "email", "operator": "contains", "value": "@company.com"}` |
| `regex` | Regex match | `{"attribute": "email", "operator": "regex", "value": ".*@example\\.com"}` |

## Percentage Rollouts

Percentage rollouts use consistent hashing to ensure:
- Same user always gets the same result for a given flag
- Even distribution across users
- Reproducible results with the same seed

```typescript
{
  "percentageRollout": {
    "enabled": true,
    "percentage": 25,  // 25% of users
    "seed": "optional-seed-for-reproducibility"
  }
}
```

## Analytics

Analytics events are tracked automatically for every flag evaluation:

```json
{
  "flagKey": "new-feature",
  "userId": "user-123",
  "variationId": "treatment",
  "enabled": true,
  "reason": "percentage",
  "timestamp": "2024-01-15T10:30:00Z",
  "environment": "production"
}
```

### Get Analytics

```bash
curl "http://localhost:4035/api/flags/new-feature/analytics?environment=production&startDate=2024-01-01"
```

### Get Statistics

```bash
curl "http://localhost:4035/api/flags/new-feature/stats?environment=production"
```

## Response Headers

When using middleware, response includes flag states:

```
X-Flag-new-feature: enabled
X-Flag-beta-ui: disabled
X-Feature-Flags: {"new-feature": true, "beta-ui": false}
```

## Authentication

All API routes require the `X-Internal-Token` header:

```bash
curl -H "X-Internal-Token: your-secret-token" http://localhost:4035/api/flags
```

In development mode, authentication can be skipped by not setting `INTERNAL_SERVICE_TOKEN`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4035` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/rez-feature-flags` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `INTERNAL_SERVICE_TOKEN` | Internal API authentication token | - |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGIN` | CORS allowed origins | `*` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Express Server                          │
├─────────────────────────────────────────────────────────────┤
│  Routes Layer                                                │
│  ├── Flags CRUD Routes                                       │
│  ├── Evaluation Routes                                       │
│  └── Analytics Routes                                       │
├─────────────────────────────────────────────────────────────┤
│  Middleware Layer                                            │
│  ├── Authentication                                          │
│  ├── Flag Context Extraction                                 │
│  └── Flag Evaluation                                         │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                               │
│  └── FlagService                                             │
│      ├── Flag Evaluation Engine                              │
│      ├── Targeting Rules Engine                              │
│      └── Analytics Tracking                                  │
├─────────────────────────────────────────────────────────────┤
│  Storage Layer                                               │
│  ├── MongoDB (Flags, Analytics)                              │
│  └── Redis (Cache)                                          │
└─────────────────────────────────────────────────────────────┘
```

## License

Internal use only - RTNM Group
