# DOOH Ecosystem Architecture

**Digital Out of Home Advertising Network**

> Complete technical documentation for the DOOH system, covering architecture, security, APIs, and deployment.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Component Details](#component-details)
4. [Security](#security)
5. [API Reference](#api-reference)
6. [Deployment](#deployment)
7. [Environment Variables](#environment-variables)

---

## Overview

DOOH (Digital Out of Home) connects physical screens to intelligent ad delivery, enabling real-time, context-aware advertising across a network of digital displays.

### Key Capabilities

- **Real-time Ad Delivery**: Context-aware ad selection based on time, location, weather
- **Screen Management**: Registration, health monitoring, OTA updates
- **Playlist Generation**: Automated playlist creation with slot pricing
- **Attribution**: QR code tracking, visit attribution
- **Revenue Sharing**: Automated payouts to screen owners

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│  │  DOOH Screen     │    │  DOOH Mobile     │    │  Merchant        │     │
│  │  (Next.js)       │    │  (React Native)  │    │  Dashboard       │     │
│  │                  │    │                  │    │                  │     │
│  │  - Display ads   │    │  - Manage screens│    │  - Create ads   │     │
│  │  - Heartbeat     │    │  - View earnings │    │  - View reports │     │
│  │  - Fetch playlist│    │  - Screen status │    │                  │     │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘     │
└───────────┼───────────────────────┼───────────────────────────┼───────────────┘
            │                       │                           │
            └───────────────────────┴───────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           rez-dooh-service                                  │
│                              (Port 4018)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Express.js Server                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │ Auth        │  │ Rate Limit  │  │ Helmet      │                 │   │
│  │  │ Middleware  │  │ Middleware  │  │ Headers     │                 │   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────┘                 │   │
│  │         │                │                                          │   │
│  │  ┌──────▼──────────────────────────────────────────────────────┐    │   │
│  │  │                    Routes                                   │    │   │
│  │  │  /api/screens/*   /api/ads/*   /api/analytics/*           │    │   │
│  │  └──────┬──────────────────────────────────────────────────────┘    │   │
│  │         │                                                       │   │
│  │  ┌──────▼──────────────────────────────────────────────────────┐    │   │
│  │  │                   Services                                  │    │   │
│  │  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │    │   │
│  │  │  │ Screen        │  │ AdDecision    │  │ Analytics     │  │    │   │
│  │  │  │ Management    │  │ Service       │  │ Service       │  │    │   │
│  │  │  └───────────────┘  └───────────────┘  └───────────────┘  │    │   │
│  │  │  ┌───────────────┐  ┌───────────────┐                      │    │   │
│  │  │  │ Area          │  │ Personalization│                     │    │   │
│  │  │  │ Intelligence  │  │ Service       │                     │    │   │
│  │  │  └───────────────┘  └───────────────┘                      │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
            │                       │                       │
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│   External Services   │ │   ReZ Mind            │ │   Payment Service     │
│                       │ │   (Context Signals)   │ │   (Payouts)          │
│   - Supabase         │ │                       │ │                       │
│   - Redis           │ │   - Weather           │ │   - Wallet credits   │
│                     │ │   - Events            │ │   - Bank transfers   │
└───────────────────────┘ │   - Trends           │ └───────────────────────┘
                         └───────────────────────┘
```

---

## Component Details

### 1. rez-dooh-service

**Purpose**: Unified backend for all DOOH operations

| Feature | Description |
|---------|-------------|
| Screen Management | Registration, status, health monitoring |
| Ad Decision | Context-aware ad selection via AdOS |
| Playlist Generation | Time-slot based playlist creation |
| Analytics | Impression tracking, performance metrics |
| Area Intelligence | Location-based targeting via ReZ Mind |

**Port**: 4018

### 2. dooh-screen-app

**Purpose**: Display app running on physical screens

| Feature | Description |
|---------|-------------|
| Ad Display | Full-screen ad rotation |
| Flight Info | Airport/transport information bars |
| Heartbeat | Health pings every 60 seconds |
| Offline Support | localStorage caching |
| Playlist Fetch | Fetches updates every 5 minutes |

**Framework**: Next.js 14.2.35

### 3. dooh-mobile

**Purpose**: Screen owner companion app

| Feature | Description |
|---------|-------------|
| Dashboard | Real-time impressions, earnings |
| Screen Status | Online/offline monitoring |
| Search | Find screens by location |
| Earnings | Daily/monthly revenue tracking |

**Framework**: React Native (Expo SDK 50)

---

## Security

### Authentication

```
┌────────────────────────────────────────────────────────────┐
│                    Authentication Flow                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐         ┌──────────────┐              │
│  │   Service A   │ ──────▶ │   DOOH Svc   │              │
│  └──────┬───────┘         └──────┬───────┘              │
│         │ X-Internal-Token        │                        │
│         │ (in INTERNAL_SERVICE_   │                        │
│         │  TOKENS_JSON)          │                        │
│         ▼                        ▼                        │
│  ┌─────────────────────────────────────────────┐         │
│  │     Internal Token Validation                 │         │
│  │     - Check against INTERNAL_SERVICE_        │         │
│  │       TOKENS_JSON map                        │         │
│  │     - Return 401 if invalid                  │         │
│  └─────────────────────────────────────────────┘         │
│                                                            │
│  ┌──────────────┐         ┌──────────────┐              │
│  │   Screen     │ ──────▶ │   DOOH Svc   │              │
│  │   Device     │         └──────┬───────┘              │
│  └──────┬───────┘         X-Api-Key │                    │
│         │ Per-screen API key  │                         │
│         ▼                    ▼                           │
│  ┌─────────────────────────────────────────────┐         │
│  │     Screen API Key Validation               │         │
│  │     - Each screen has unique key            │         │
│  │     - Key stored in ScreenStore             │         │
│  │     - Timing-safe comparison                │         │
│  └─────────────────────────────────────────────┘         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Security Headers

All responses include:
- `Strict-Transport-Security`: HSTS with preload
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: SAMEORIGIN
- `X-XSS-Protection`: 1; mode=block
- `Content-Security-Policy`: Strict CSP

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| All API | 100 requests | 1 minute |
| Write operations | 30 requests | 1 minute |
| Screen heartbeat | 120 requests | 1 minute |

---

## API Reference

### Screen Endpoints

#### Register Screen
```http
POST /api/screens/register
Content-Type: application/json
X-Internal-Token: {token}

{
  "name": "Hotel Lobby Display",
  "type": "hotel_lobby",
  "location": {
    "city": "Bangalore",
    "area": "MG Road",
    "lat": 12.9716,
    "lng": 77.5946
  },
  "owner_id": "owner_123",
  "cpm": 15
}
```

Response:
```json
{
  "success": true,
  "screen_id": "screen_abc123",
  "api_key": "dooh_sk_abc123_xyz789"
}
```

#### Get Screen
```http
GET /api/screens/{screenId}
X-Internal-Token: {token}
```

#### Update Status
```http
PATCH /api/screens/{screenId}/status
Content-Type: application/json
X-Internal-Token: {token}

{
  "status": "maintenance"
}
```

#### Screen Heartbeat
```http
POST /api/screens/{screenId}/heartbeat
X-Api-Key: {screenApiKey}
Content-Type: application/json

{
  "status": "active",
  "playlist_version": 5,
  "impressions_last_hour": 150
}
```

### Analytics Endpoints

#### Record Impressions
```http
POST /api/analytics/impressions
X-Internal-Token: {token}
Content-Type: application/json

{
  "events": [
    {
      "screen_id": "screen_abc123",
      "campaign_id": "camp_xyz",
      "creative_id": "creative_123",
      "duration_played": 15
    }
  ]
}
```

### Health Endpoints

#### Service Health
```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "dooh-service",
  "version": "1.0.0",
  "timestamp": "2026-05-12T10:00:00Z"
}
```

---

## Deployment

### Docker

```dockerfile
# rez-dooh-service
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 4018
CMD ["node", "dist/index.js"]
```

### Render

```yaml
# render.yaml
services:
  - type: web
    name: rez-dooh-service
    env: node
    region: singapore
    plan: starter
    buildCommand: npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: PORT
        value: "4018"
      - key: NODE_ENV
        value: production
      - key: INTERNAL_SERVICE_TOKEN
        sync: false
```

### Vercel (dooh-screen-app)

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `INTERNAL_SERVICE_TOKEN` | Service-to-service authentication |
| `DOOH_API_KEY` | Screen authentication |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON map of service tokens |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4018 | Service port |
| `DOOH_SERVER_URL` | https://dooh.rezapp.com | API base URL |
| `ALLOWED_ORIGINS` | rezapp.com | CORS origins |
| `REZ_MIND_ENDPOINT` | - | ReZ Mind integration |
| `REDIS_URL` | - | Redis for caching |

---

## Data Flow

### Ad Selection Flow

```
1. Screen requests playlist
         ↓
2. Delivery Engine queries active campaigns
         ↓
3. Filter by screen type, location, audience
         ↓
4. Rank by: ROAS × confidence × volume × context
         ↓
5. Select top N for available slots
         ↓
6. Generate playlist with timing
         ↓
7. Return to screen
         ↓
8. Screen plays ads, sends heartbeats
         ↓
9. Analytics records impressions
         ↓
10. Attributions tracked via QR codes
```

### Revenue Flow

```
1. Campaign budget allocated
         ↓
2. Ads displayed on screens
         ↓
3. Impressions counted per screen
         ↓
4. CPM calculation: impressions × (cpm/1000)
         ↓
5. Revenue split (60% owner, 40% platform)
         ↓
6. Earnings accumulated in screen balance
         ↓
7. Payout processed monthly
         ↓
8. Wallet credited or bank transfer
```

---

## Monitoring

### Health Checks

| Check | Endpoint | Expected |
|-------|----------|----------|
| Basic | `/health` | 200 OK |
| Readiness | `/ready` | 200 + all services healthy |

### Metrics

- Screen count by status
- Impression rate per hour
- API response times
- Error rates
- Cache hit rate

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Screen offline | Check heartbeat interval, network connectivity |
| No ads shown | Verify campaigns active, budget available |
| Rate limited | Wait for window reset, check request volume |
| Auth failed | Verify token in INTERNAL_SERVICE_TOKENS_JSON |

---

## Appendix

### Screen Types

| Type | Code | Default CPM (INR) |
|------|------|-------------------|
| Cab Tablet | `cab_tablet` | 15 |
| Restaurant TV | `restaurant_tv` | 10 |
| Mall Kiosk | `mall_kiosk` | 22 |
| Gym Screen | `gym_screen` | 12 |
| Hotel Lobby | `hotel_lobby` | 15 |
| Airport Display | `airport_display` | 35 |
| Office Lobby | `office_lobby` | 20 |
| Bus Shelter | `bus_shelter` | 20 |
| Digital Billboard | `billboard_digital` | 50 |

### Status Transitions

**Screen Status**:
- `active` → `inactive`, `offline`, `maintenance`
- `inactive` → `active`, `offline`
- `offline` → `active`, `inactive`, `maintenance`
- `maintenance` → `active`, `inactive`

**Campaign Status**:
- `draft` → `active`, `paused`
- `active` → `paused`, `completed`, `budget_exhausted`
- `paused` → `active`, `draft`, `completed`
- `completed` → (terminal)
- `budget_exhausted` → `active`, `completed`

---

*Document Version: 1.0.0*
*Last Updated: 2026-05-12*
