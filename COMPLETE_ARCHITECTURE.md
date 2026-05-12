# REZ-Media Complete Architecture Guide

**Version:** 1.0
**Date:** May 12, 2026
**Last Updated:** Security audit + Intelligence integration

---

## Table of Contents

1. [Company Overview](#company-overview)
2. [Services Inventory](#services-inventory)
3. [Consumer Products & Apps](#consumer-products--apps)
4. [Service Connections](#service-connections)
5. [REZ-Intelligence Integration](#rez-intelligence-integration)
6. [Data Architecture](#data-architecture)
7. [Security Architecture](#security-architecture)
8. [Deployment](#deployment)

---

## Company Overview

**REZ-Media** is a comprehensive digital marketing platform specializing in:

| Vertical | Description |
|----------|-------------|
| **Advertising** | Multi-channel ad marketplace, QR ads, DOOH, Creator partnerships |
| **Loyalty** | Gamified loyalty programs with points, badges, challenges, streaks |
| **Marketing Automation** | Cross-channel campaigns, SMS/Email, drip sequences |
| **Intelligence** | ML-powered targeting, attribution, personalization |

---

## Services Inventory

### 1. Advertising Services

#### REZ-ads-service (Port 4007)
**Purpose:** Core ad serving, campaign management, merchant self-serve ads

| Feature | Description |
|---------|-------------|
| Campaign CRUD | Create, read, update, delete ad campaigns |
| Admin Review | Approval workflow for merchant campaigns |
| Ad Serving | Serve ads to consumers on rez.money platform |
| Click Tracking | Record clicks with fraud detection |
| Impression Tracking | Track ad views with frequency caps |
| Conversion Attribution | Link purchases to ad interactions |
| Rate Limiting | Redis-based sliding window rate limiter |

**API Endpoints:**
- `POST /api/ads` - Create ad campaign
- `GET /api/ads` - List ads (merchant)
- `GET /admin/ads` - List all ads (admin)
- `POST /api/serve/impression` - Record impression
- `POST /api/serve/click` - Record click
- `POST /api/events/conversion` - Conversion events

**Models:**
- `AdCampaign` - Campaign metadata, targeting, budget
- `AdInteraction` - Click/impression records

---

#### adBazaar (Port 3000)
**Purpose:** Consumer-facing ad marketplace (Next.js)

| Feature | Description |
|---------|-------------|
| Ad Marketplace | Browse available ad placements |
| Campaign Creation | Create advertising campaigns |
| Placement Search | Search by location, type, audience |
| Real-time Pricing | Dynamic pricing based on demand |
| Analytics Dashboard | Track campaign performance |

**Tech Stack:** Next.js 14, Supabase (PostgreSQL)

---

#### adsqr
**Purpose:** QR code-based advertising platform

| Feature | Description |
|---------|-------------|
| QR Generation | Create scannable QR codes for ads |
| Offline Tracking | Bridge offline → online behavior |
| Campaign Management | Create QR-specific campaigns |
| Analytics | Track QR scans and conversions |

---

#### dooh (Digital Out-of-Home)
**Purpose:** Digital screen advertising network

| Feature | Description |
|---------|-------------|
| Screen Inventory | Manage DOOH screen locations |
| Scheduling | Schedule ads on digital screens |
| Dynamic Content | Real-time ad rotation |
| Audience Measurement | Footfall and impression tracking |

---

#### creators
**Purpose:** Influencer and creator partnership management

| Feature | Description |
|---------|-------------|
| Creator Profiles | Manage creator accounts |
| Campaign Matching | Connect brands with creators |
| Performance Tracking | Track creator ad performance |
| Payment Processing | Handle creator payouts |

---

### 2. Gamification & Loyalty Services

#### REZ-gamification-service (Port 3004)
**Purpose:** Points, badges, challenges, streaks

| Feature | Description |
|---------|-------------|
| **Points System** | Award coins on transactions |
| **Achievements** | Unlock badges for milestones |
| **Challenges** | Time-bound goals with rewards |
| **Streaks** | Consecutive day tracking |
| **Leaderboards** | Weekly/monthly rankings |
| **Karma System** | User reputation tracking |
| **Wallet Integration** | Real-time coin credits |

**API Endpoints:**
- `GET /achievements/:userId` - User achievements
- `GET /streak/:userId` - Streak info
- `GET /leaderboard` - Global leaderboard
- `GET /karma-leaderboard` - Karma rankings
- `POST /internal/visit` - Record store visit

**BullMQ Queues:**
- `gamification-events` - Achievement processing
- `wallet-credits` - Coin distribution
- `store-visit-streak` - Streak updates

---

### 3. Marketing Automation

#### REZ-automation-service (Port 4020)
**Purpose:** SMS/Email drip campaigns, sequences

| Feature | Description |
|---------|-------------|
| **Email Campaigns** | HTML email templates, sending |
| **SMS Campaigns** | Text message broadcasts |
| **Drip Sequences** | Time-based email series |
| **Automation Rules** | Trigger-based actions |
| **Unsubscribe Handling** | GDPR compliance |
| **Click/Open Tracking** | Email analytics |

**API Endpoints:**
- `POST /api/automations` - Create automation
- `GET /track/click` - Email click tracking (with open redirect protection)
- `GET /unsubscribe` - Unsubscribe handler

**Security:** URL redirect validation against allowlist

---

#### REZ-marketing (Port 4000)
**Purpose:** Campaign management, audience segmentation

| Feature | Description |
|---------|-------------|
| **Audience Segments** | Define user groups |
| **Cross-channel Campaigns** | Email + SMS + Push |
| **A/B Testing** - Split testing for campaigns |
| **Scheduling** | Schedule campaign sends |
| **Analytics** | Campaign performance metrics |

---

#### REZ-abandonment-tracker
**Purpose:** Detect and recover abandoned carts/engagement

| Feature | Description |
|---------|-------------|
| Cart Detection | Track abandoned carts |
| Recovery Campaigns | Send reminder emails/SMS |
| Attribution | Credit recovery to campaigns |

---

### 4. Decision & Intelligence

#### REZ-decision-service (Port 4027)
**Purpose:** Real-time targeting, personalization, action engine

| Feature | Description |
|---------|-------------|
| **Targeting Engine** | Evaluate user segments (9 predefined) |
| **Frequency Caps** | Prevent ad fatigue |
| **A/B Testing** | Variant assignment |
| **Action Engine** | Approve/reject risky actions |
| **Attribution** | Multi-touch attribution |
| **Sampling** | Fatigue-based sampling |
| **DOOH Bidding** | Real-time DOOH auctions |
| **Coin Distribution** | Dynamic coin allocation |

**API Endpoints:**
- `GET /api/targeting/segments/:userId` - User segments
- `POST /api/targeting/evaluate` - Evaluate targeting
- `GET /api/frequency/:userId/:campaignId/:channel` - Check frequency
- `POST /api/frequency/record` - Record impression
- `POST /api/actions/execute` - Execute action
- `POST /api/attribution/track` - Track attribution event

**User Segments:**
1. HIGH_VALUE
2. CHURNED
3. WINDOW_SHOPPERS
4. DEAL_SEEKERS
5. FOODIES
6. BUDGET_MINDERS
7. NEW_USERS
8. REORDER_PROBABILITY_HIGH
9. RECENTLY_PURCHASED

---

#### REZ-lead-intelligence
**Purpose:** Predictive lead scoring and qualification

| Feature | Description |
|---------|-------------|
| **Lead Scoring** | ML-based scoring model |
| **Qualification** | BANT qualification |
| **Prioritization** | Rank leads by conversion probability |
| **Enrichment** | Enrich lead data |

---

### 5. Analytics & Events

#### REZ-media-events (Port 3008)
**Purpose:** Event-driven analytics, media processing

| Feature | Description |
|---------|-------------|
| **Image Processing** | Thumbnail/medium/large variants |
| **CDN Invalidation** | Purge stale assets |
| **Event Tracking** | Centralized event collection |
| **Worker Queue** | BullMQ background processing |

**BullMQ Queues:**
- `media-events` - Image processing jobs
- `notification-events` - Push notifications

---

#### REZ-feedback-service
**Purpose:** Customer feedback collection

| Feature | Description |
|---------|-------------|
| **NPS Surveys** | Net Promoter Score |
| **Feedback Forms** | Collect customer input |
| **Sentiment Analysis** | NLP-based analysis |
| **Response Tracking** | Track feedback status |

---

### 6. Engagement & Discovery

#### REZ-engagement-platform
**Purpose:** Unified loyalty + offers + referrals

| Feature | Description |
|---------|-------------|
| **Offers Management** | Create and manage offers |
| **Referral System** - Word-of-mouth campaigns |
| **Loyalty Tiers** | VIP tier management |
| **Points Engine** | Centralized points logic |

---

#### REZ-discovery-platform
**Purpose:** Product/store discovery

| Feature | Description |
|---------|-------------|
| **Search** | Full-text search |
| **Recommendations** | Personalized suggestions |
| **Trending** | Popular items ranking |
| **Categories** | Browse by category |

---

#### REZ-communications-platform
**Purpose:** Multi-channel communication

| Feature | Description |
|---------|-------------|
| **Push Notifications** | Mobile push |
| **In-App Messages** | App notifications |
| **Webhooks** | Event-driven comms |

---

### 7. Economic Engine

#### REZ-economic-engine
**Purpose:** Dynamic pricing and promotional optimization

| Feature | Description |
|---------|-------------|
| **Dynamic Pricing** | Real-time price adjustment |
| **Promotional Rules** | Discount logic |
| **Inventory Pricing** | Stock-based pricing |
| **Margin Optimization** | Maximize revenue |

---

## Consumer Products & Apps

### Web Applications

| Product | Tech Stack | Purpose |
|---------|------------|---------|
| **adBazaar** | Next.js 14 + Supabase | Consumer ad marketplace |
| **rez.money** | (Main ReZ App) | Core commerce platform |

### Mobile Apps (Part of REZ-Full-App)

| App | Description |
|-----|-------------|
| **Hotel OTA** | Hotel booking |
| **AdBazaar** | Ad marketplace |
| **Rendez** | Reservations |
| **Food Delivery** | Restaurant orders |

### Admin Dashboards

| Dashboard | Service | Purpose |
|----------|---------|---------|
| **Merchant Portal** | REZ-ads-service | Campaign management |
| **Admin Panel** | REZ-ads-service | System administration |
| **Analytics** | All services | Performance monitoring |

---

## Service Connections

### Internal Service Communication

```
┌─────────────────────────────────────────────────────────────────┐
│                        REZ-Media                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  adBazaar (Web)  ───────────▶  REZ-ads-service                 │
│                                    │                             │
│                                    ▼                             │
│  REZ-gamification-service  ◀──────┼───────▶  REZ-decision-service│
│                                    │                             │
│                                    ▼                             │
│                          REZ-media-events                        │
│                                    │                             │
│                                    ▼                             │
│                          BullMQ Queues (Redis)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

All services use `INTERNAL_SERVICE_TOKEN` with `x-internal-token` header:

```typescript
// Common auth middleware pattern
function verifyInternal(req, res, next) {
  const token = req.headers['x-internal-token'];
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  // Use crypto.timingSafeEqual() for constant-time comparison
}
```

---

## REZ-Intelligence Integration

REZ-Media connects to **REZ-Intelligence** hub for ML capabilities:

```
REZ-Media                              REZ-Intelligence
──────────────────────────────────     ─────────────────────────────────
REZ-ads-service ────────────────▶      REZ-intent-graph
  │                                        │
  │                                        ▼
  │                                  User intent tracking
  │                                  Behavioral patterns
  │                                  Segment enrichment
  │
  ▼
REZ-event-platform ◀──────────────────▶ REZ-event-platform
  │                                        │
  │                                        ▼
  │                                  Unified event analytics
  │                                  Cross-channel attribution
  │
  ▼
REZ-decision-service ────────────▶     REZ-insights-service
  │                                        │
  │                                        ▼
  │                                  ML predictions
  │                                  Propensity models
  │                                  Anomaly detection
  │
  ▼
REZ-gamification ───────────────▶      REZ-intelligence-hub
                                         │
                                         ▼
                                   ML targeting models
                                   Recommendation engine
                                   Personalization
```

### Connection Details

| Service | Target | Env Variable | Purpose |
|---------|--------|-------------|---------|
| REZ-ads-service | REZ-intent-graph | `INTENT_CAPTURE_URL` | Track user intent |
| REZ-ads-service | REZ-event-platform | `EVENT_PLATFORM_URL` | Analytics events |
| REZ-decision-service | REZ-intelligence-hub | `INTELLIGENCE_HUB_URL` | ML models |
| REZ-gamification | REZ-intent-graph | `INTENT_CAPTURE_URL` | Gamification events |

---

## Data Architecture

### Databases

| Service | Database | Purpose |
|---------|----------|---------|
| REZ-ads-service | MongoDB | Campaign, interaction data |
| REZ-gamification | MongoDB | Users, achievements, streaks |
| REZ-automation | MongoDB | Automation rules, sequences |
| adBazaar | Supabase (PostgreSQL) | Marketplace data |
| All services | Redis | Caching, sessions, queues |

### MongoDB Collections

**REZ-ads-service:**
- `adcampaigns` - Campaign metadata
- `adinteractions` - Click/impression logs

**REZ-gamification:**
- `users` - User profiles
- `achievements` - Achievement definitions
- `userachievements` - User-earned achievements
- `streaks` - Streak tracking
- `leaderboards` - Weekly/monthly rankings

**REZ-marketing:**
- `audiences` - Segment definitions
- `campaigns` - Marketing campaigns
- `automations` - Automation rules

### Redis Data Structures

| Key Pattern | Type | Purpose |
|------------|------|---------|
| `ads:fraud:user:{campaignId}:{userId}` | Sorted Set | Click fraud detection |
| `ads:fraud:ip:{campaignId}:{ip}` | Sorted Set | IP-based fraud |
| `freq:{userId}` | Hash | Frequency caps |
| `sampling:leaderboard:{date}` | Sorted Set | Daily leaderboard |
| `attribution:events:{userId}` | Hash | Attribution events |

### BullMQ Queues

| Queue | Producer | Consumer | Purpose |
|-------|----------|---------|---------|
| `notification-events` | ads, gamification | notification-service | Push notifications |
| `gamification-events` | gamification | gamification-worker | Achievement processing |
| `wallet-credits` | gamification | wallet-service | Coin distribution |
| `media-events` | catalog | media-worker | Image processing |
| `action:approval:queue` | decision-service | admin | Action approval |

---

## Security Architecture

### Authentication

| Type | Implementation | Usage |
|------|---------------|-------|
| Internal Auth | `INTERNAL_SERVICE_TOKEN` + `x-internal-token` header | Service-to-service |
| JWT Auth | `JWT_SECRET` + Bearer token | User authentication |
| Admin Auth | JWT with `role === 'admin'` | Admin operations |

### Security Features Applied

| Feature | Location | Protection |
|---------|----------|------------|
| Timing-safe comparison | All auth middleware | Prevents timing attacks |
| Rate limiting | REZ-ads-service | DoS prevention |
| Input validation | All routes | Injection prevention |
| SSRF protection | REZ-media-events | URL validation + IP blocking |
| Open redirect prevention | REZ-automation-service | URL allowlist |
| Helmet security headers | All services | XSS, clickjacking |
| CORS configuration | All services | Cross-origin control |

### Environment Variables Required

```bash
# Authentication
INTERNAL_SERVICE_TOKEN=              # Service-to-service auth
JWT_SECRET=                         # User JWT signing

# Databases
MONGODB_URI=                        # MongoDB connection
REDIS_URL=                          # Redis connection

# REZ-Intelligence
INTENT_CAPTURE_URL=                 # REZ-intent-graph endpoint
EVENT_PLATFORM_URL=                 # REZ-event-platform endpoint
INTELLIGENCE_HUB_URL=               # REZ-intelligence-hub endpoint
```

---

## Deployment

### Services with render.yaml

| Service | Branch | Health Check |
|---------|--------|--------------|
| REZ-ads-service | main | `/health` |
| REZ-decision-service | main | `/health` |
| REZ-gamification | main | `/healthz` |
| REZ-automation | main | `/health` |
| REZ-media-events | main | `/health` |

### Docker Support

All services include:
- `Dockerfile` - Container definition
- `docker-compose.yml` - Local development
- `.dockerignore` - Build optimization

### Monitoring

| Service | Implementation |
|---------|---------------|
| Error Tracking | Sentry (`SENTRY_DSN`) |
| Metrics | Prometheus (`prom-client`) |
| Health | Custom `/health` endpoints |
| Logging | Winston with JSON format |

---

## Quick Reference

### Common Commands

```bash
# Start a service
cd REZ-ads-service && npm run dev

# Run tests
cd REZ-ads-service && npm test

# Build for production
cd REZ-ads-service && npm run build

# Deploy to Render
cd REZ-ads-service && npm run deploy:render
```

### Port Reference

| Service | Port | URL |
|---------|------|-----|
| REZ-ads-service | 4007 | http://localhost:4007 |
| REZ-decision-service | 4027 | http://localhost:4027 |
| REZ-gamification | 3004 | http://localhost:3004 |
| REZ-automation | 4020 | http://localhost:4020 |
| REZ-media-events | 3008 | http://localhost:3008 |
| adBazaar | 3000 | http://localhost:3000 |

---

## Documentation Files

| File | Description |
|------|-------------|
| `README.md` | Main documentation |
| `SECURITY_CHECKLIST.md` | Security guidelines |
| `INTELLIGENCE_INTEGRATION.md` | ML integration guide |

---

*End of Document*
