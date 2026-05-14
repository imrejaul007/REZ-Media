# DSP Bidder Service

**Port:** 4061
**Purpose:** Demand-Side Platform - Buy inventory from SSPs/exchanges

---

## Overview

The DSP Bidder enables advertisers to programmatically buy DOOH inventory from SSPs and ad exchanges.

### Features

- Multi-exchange bidding
- Campaign management
- Budget control
- Targeting (geo, screen type, location)
- Bid strategies (fixed, dynamic, optimized)
- Real-time budget tracking

---

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

---

## API Endpoints

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/:id` | Get campaign |
| PATCH | `/api/campaigns/:id` | Update campaign |
| POST | `/api/campaigns/:id/pause` | Pause campaign |
| POST | `/api/campaigns/:id/resume` | Resume campaign |
| GET | `/api/campaigns/:id/stats` | Get stats |
| GET | `/api/campaigns/:id/budget` | Get budget |

### Bidding

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bid` | Single bid request |
| POST | `/api/bid/batch` | Batch bid requests |

---

## Bid Strategies

| Strategy | Description |
|----------|-------------|
| `fixed` | Bid fixed percentage above floor |
| `dynamic` | Random bid between floor and max |
| `optimized` | ML-optimized bidding |

---

## Example

```bash
# Create campaign
curl -X POST http://localhost:4061/api/campaigns \
  -H "X-Internal-Token: your-token" \
  -d '{
    "name": "Summer Sale Campaign",
    "budget": 50000,
    "bidStrategy": "dynamic",
    "targeting": {
      "geo": ["IN"],
      "screenTypes": ["billboard_led", "retail_kiosk"]
    }
  }'

# Submit bid
curl -X POST http://localhost:4061/api/bid \
  -H "X-Internal-Token: your-token" \
  -d '{
    "exchange": "google_adx",
    "impression": {
      "id": "imp_123",
      "floor": 25,
      "inventory": {
        "screenId": "screen_001",
        "screenType": "billboard_led",
        "location": "Mumbai",
        "country": "IN"
      }
    },
    "campaign": {
      "id": "campaign_123"
    }
  }'
```
