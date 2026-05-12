# REZ Voice Billing Service

A comprehensive voice billing and call tracking service for the REZ Media platform. This service manages call sessions, credit balances, billing, and provides detailed analytics for voice communications.

## Features

- **Call Session Tracking**: Track call lifecycle from initiation to completion
- **Credit Management**: Seamless integration with REZ Media Wallet
- **Billing Processing**: Automatic billing with configurable rates and intervals
- **Usage Analytics**: Detailed reporting and insights
- **Idempotent Operations**: Prevent duplicate charges with Redis-based deduplication
- **Real-time Statistics**: Live monitoring of active calls and system health

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      REZ Voice Billing Service                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Call Routes  │    │ Usage Routes │    │Analytics Routes│   │
│  │   /calls     │    │   /usage     │    │  /analytics    │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    │
│         │                   │                    │             │
│  ┌──────▼───────────────────────────────────────▼───────┐      │
│  │                    Service Layer                     │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │      │
│  │  │CallTracker │  │BillingService│  │AnalyticsSvc  │ │      │
│  │  │  Service   │  │             │  │              │ │      │
│  │  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘ │      │
│  │         │                │                │       │      │
│  │  ┌──────▼────────────────▼────────────────▼─────┐│      │
│  │  │                Credit Service                  ││      │
│  │  │         (REZ Media Wallet Integration)         ││      │
│  │  └────────────────────┬──────────────────────────┘│      │
│  └───────────────────────┼───────────────────────────┘      │
│                          │                                    │
│  ┌───────────────────────▼───────────────────────────┐       │
│  │                    Data Layer                      │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │       │
│  │  │  MongoDB    │  │    Redis     │  │ BullMQ   │ │       │
│  │  │  - Sessions │  │  - Cache     │  │ - Queue  │ │       │
│  │  │  - Records  │  │  - Idempotency│ │ - Worker │ │       │
│  │  │  - Txns    │  │  - Sessions │  │          │ │       │
│  │  └─────────────┘  └─────────────┘  └──────────┘ │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Cache/Queue**: Redis + BullMQ
- **Language**: TypeScript
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18 or higher
- MongoDB 6.0+
- Redis 7.0+

### Installation

```bash
# Clone the repository
cd REZ-Media/rez-voice-billing

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
vim .env

# Build the project
npm run build

# Start the service
npm start
```

### Development

```bash
# Start in development mode with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Lint
npm run lint
```

## API Reference

### Call Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/calls/session` | POST | Initialize a new call session |
| `/api/v1/calls/session/:id` | GET | Get session details |
| `/api/v1/calls/session/:id` | PUT | Update session |
| `/api/v1/calls/session/:id/start` | POST | Start a call |
| `/api/v1/calls/session/:id/end` | POST | End a call |
| `/api/v1/calls/session/:id/hold` | POST | Put call on hold |
| `/api/v1/calls/session/:id/resume` | POST | Resume from hold |
| `/api/v1/calls/session/:id/fail` | POST | Mark call as failed |
| `/api/v1/calls/session/:id/bill` | POST | Process billing |
| `/api/v1/calls/session/:id/refund` | POST | Refund billing |
| `/api/v1/calls/active` | GET | Get active sessions |
| `/api/v1/calls/history` | GET | Get call history |

### Usage & Credits

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/usage/balance` | GET | Get user's balance |
| `/api/v1/usage/balance/:userId` | GET | Get specific user's balance |
| `/api/v1/usage/can-make-call` | GET | Check if user can make call |
| `/api/v1/usage/reserve` | POST | Reserve credits for call |
| `/api/v1/usage/release` | POST | Release reserved credits |
| `/api/v1/usage/transactions` | GET | Get transaction history |
| `/api/v1/usage/transfer` | POST | Transfer credits between users |

### Analytics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/analytics/summary` | GET | Get analytics summary |
| `/api/v1/analytics/usage` | GET | Get usage statistics |
| `/api/v1/analytics/daily-trend` | GET | Get daily usage trend |
| `/api/v1/analytics/call-types` | GET | Get call type distribution |
| `/api/v1/analytics/quality` | GET | Get quality metrics |
| `/api/v1/analytics/peak-hours` | GET | Get peak usage hours |
| `/api/v1/analytics/cost-breakdown` | GET | Get cost breakdown |
| `/api/v1/analytics/realtime` | GET | Get real-time stats |
| `/api/v1/analytics/billing/history` | GET | Get billing history |
| `/api/v1/analytics/export` | POST | Export user data |

### Health Checks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Full health check |
| `/ready` | GET | Readiness probe |
| `/live` | GET | Liveness probe |

## Authentication

The service supports multiple authentication methods:

1. **Internal Service Token**: `X-Internal-Token` header for service-to-service communication
2. **JWT Bearer Token**: `Authorization: Bearer <token>` header
3. **API Key**: `X-API-Key` header

Configure tokens in `INTERNAL_SERVICE_TOKENS_JSON` environment variable.

## Billing Configuration

### Rate Configuration

```typescript
DEFAULT_RATE_PER_MINUTE=0.05    // INR per minute
BILLING_INTERVAL_SECONDS=60     // Bill by minute
MINIMUM_CHARGE_SECONDS=1        // Minimum billable duration
FREE_CALL_DURATION_SECONDS=0    // No free calls
```

### Billing Flow

1. Call initiated -> Session created with PENDING billing status
2. Call ended -> Duration calculated, cost computed
3. Billing processed -> Credits deducted from wallet
4. Session updated -> Billing status set to PROCESSED

## Data Models

### CallSession

Stores individual call session data:
- Session ID, caller/callee IDs
- Call type (inbound/outbound)
- Status (initiated, active, ended, failed, missed)
- Duration and billing information
- Timestamps

### CallRecord

Aggregated daily records per user:
- Total calls, duration, cost
- Breakdown by call type
- Peak usage hour

### BillingTransaction

Billing audit trail:
- Transaction ID, session ID
- Amount and status
- Processing timestamps

## Error Handling

All API responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error description"
}
```

## Monitoring

The service exposes Prometheus-compatible metrics at `/metrics` (when configured):

- `voice_active_sessions`: Number of active calls
- `voice_billing_total`: Total billing operations
- `voice_call_duration_seconds`: Call duration histogram
- `voice_cost_total`: Total cost processed

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY .env.example .env
EXPOSE 4005
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  voice-billing:
    build: .
    ports:
      - "4005:4005"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/rez-voice-billing
      - REDIS_URL=redis://redis:6379
      - WALLET_SERVICE_URL=http://wallet:4002
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## License

MIT
