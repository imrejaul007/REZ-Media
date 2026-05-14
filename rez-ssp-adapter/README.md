# SSP Adapter Service

**Port:** 4060
**Purpose:** Connect DOOH/publisher inventory to Supply-Side Platforms (SSPs)

---

## Overview

The SSP Adapter enables publishers to connect their DOOH inventory to multiple SSPs for programmatic selling.

### Supported SSPs

| SSP | Provider ID | Description |
|-----|------------|-------------|
| Google AdX | `google_adx` | Google's exchange |
| PubMatic | `pubmatic` | PubMatic platform |
| Index Exchange | `index_exchange` | Index Exchange |

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment
cp .env.example .env

# Start development
npm run dev
```

---

## API Endpoints

### Connection Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/connections` | List all SSP connections |
| POST | `/api/connections` | Connect to an SSP |
| DELETE | `/api/connections/:provider` | Disconnect from SSP |
| POST | `/api/connections/:provider/test` | Test connection |

### Bidding

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bid` | Submit bid request |
| POST | `/api/bid/batch` | Batch bid requests |
| POST | `/api/bid/:requestId/win` | Log bid win |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics` | Get bid analytics |

---

## Configuration

### Environment Variables

```bash
PORT=4060
MONGODB_URI=mongodb://localhost:27017/ssp_adapter
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKEN=your-token

# SSP API Keys
GOOGLE_ADX_API_KEY=
GOOGLE_ADX_ADVERTISER_ID=
PUBMATIC_API_KEY=
PUBMATIC_PUBLISHER_ID=
INDEX_EXCHANGE_API_KEY=
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SSP Adapter                           │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                 │
│  │  Connection  │    │     Bid      │                 │
│  │   Service    │    │   Service    │                 │
│  └──────────────┘    └──────────────┘                 │
│         │                   │                            │
│  ┌──────┴──────┐    ┌──────┴──────┐                 │
│  │ Google AdX  │    │ PubMatic     │                 │
│  │ PubMatic    │    │ Index Exch   │                 │
│  │ Index Exch  │    │              │                 │
│  └─────────────┘    └──────────────┘                 │
│                                                         │
│  ┌──────────────────────────────────────┐              │
│  │          MongoDB + Redis             │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
          │                        │
          ▼                        ▼
    ┌──────────┐            ┌──────────┐
    │ Google    │            │ DOOH     │
    │ AdX       │            │ Service  │
    └──────────┘            └──────────┘
```

---

## Usage Example

### Connect to SSP

```bash
curl -X POST http://localhost:4060/api/connections \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google_adx",
    "apiKey": "your-google-api-key",
    "advertiserId": "your-advertiser-id"
  }'
```

### Submit Bid

```bash
curl -X POST http://localhost:4060/api/bid \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google_adx",
    "impression": {
      "id": "imp_123",
      "floor": 25.00,
      "currency": "INR",
      "inventory": {
        "screenId": "screen_001",
        "location": "Mumbai",
        "screenType": "billboard_led"
      }
    }
  }'
```

---

## Data Models

### Connection

```typescript
{
  provider: 'google_adx' | 'pubmatic' | 'index_exchange',
  enabled: boolean,
  apiKey: string,
  status: 'active' | 'inactive' | 'error'
}
```

### Analytics

```typescript
{
  provider: string,
  date: Date,
  requests: number,
  bids: number,
  wins: number,
  revenue: number,
  fillRate: number,
  avgBidPrice: number,
  avgWinPrice: number
}
```

---

## Roadmaps

- [ ] Add Amazon TAM integration
- [ ] Add OpenX integration
- [ ] Add Prebid Server support
- [ ] Real-time bid optimization
- [ ] Frequency capping
- [ ] Viewability scoring
