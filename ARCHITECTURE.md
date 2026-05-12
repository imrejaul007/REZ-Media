# REZ-Media Complete Architecture & Documentation

**Version:** 3.0.0
**Last Updated:** May 12, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Ad Types & Pricing](#ad-types--pricing)
4. [Campaign Flow](#campaign-flow)
5. [Merchant Wallet Integration](#merchant-wallet-integration)
6. [API Reference](#api-reference)
7. [Deployment](#deployment)
8. [Service URLs](#service-urls)

---

## Overview

REZ-Media is a comprehensive advertising and marketing platform that combines:
- **Digital Ads** (In-app, Search, Feed)
- **DOOH** (Digital Out-of-Home)
- **Offline Ads** (Posters, Standees, Billboards)
- **QR Campaigns** (Hybrid offline-online)
- **Broadcast Marketing** (WhatsApp, SMS, Email, Push)
- **Influencer Marketing**
- **AI-Powered Pricing** (Dynamic, like Google Ads)

### Key Features

- [x] 38 Ad Types across 7 categories
- [x] AI Dynamic Pricing (surge, demand, competition)
- [x] Merchant Wallet Integration
- [x] Real-time Analytics
- [x] Smart Budget Allocation
- [x] Quality Score (like Google Ads)
- [x] Unified Campaign Creator

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REZ-MEDIA ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                     MERCHANT DASHBOARD                               │     │
│  │  REZ Marketing Dashboard                                            │     │
│  │  ├── Unified Campaign Creator                                      │     │
│  │  ├── Analytics View                                                │     │
│  │  └── Wallet Management                                             │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                    API GATEWAY LAYER                                │     │
│  │                                                                       │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │     │
│  │  │ REZ-pricing │  │ REZ-ads-    │  │ REZ-marketing│             │     │
│  │  │ -engine     │  │ service     │  │              │             │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │     │
│  │                                                                       │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │     │
│  │  │ REZ-gamif-  │  │ REZ-communi-│  │ REZ-lead-   │             │     │
│  │  │ ication     │  │ cations     │  │ intelligence │             │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                      EXTERNAL SERVICES                               │     │
│  │                                                                       │     │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │     │
│  │  │ Twilio │  │SendGrid│  │Firebase│  │ OpenAI │  │Razorpay│     │     │
│  │  │ WhatsApp│  │ Email  │  │  Push  │  │   AI   │  │Payment │     │     │
│  │  │  SMS   │  │        │  │        │  │        │  │        │     │     │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                      EXTERNAL APPS                                    │     │
│  │                                                                       │     │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │     │
│  │  │ Do App │  │ REZ-   │  │ Hotel  │  │Rendez  │  │Food    │     │     │
│  │  │ (Chat) │  │Consumer│  │  OTA   │  │        │  │Delivery│     │     │
│  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Ad Types & Pricing

### 1. In-App Ads

| Type | Placement | CPM | CPC | Status |
|------|-----------|-----|-----|--------|
| Home Banner | Homepage | ₹150 | ₹5 | Built |
| Explore Feed | Discovery | ₹100 | ₹3 | Built |
| Store Listing | Products | ₹300 | ₹15 | Built |
| Search Results | Search | ₹250 | ₹12 | Built |

### 2. DOOH (Digital Out-of-Home)

| Type | Description | Pricing | Status |
|------|-------------|---------|--------|
| Mall LED | Shopping malls | ₹2,000-10,000/day | Built |
| Restaurant TV | Dining areas | ₹1,000-5,000/day | Built |
| Gym Screens | Fitness centers | ₹500-2,000/day | Built |
| Office Lobby | Corporate | ₹800-3,000/day | Built |
| Transit | Bus/metro | ₹500-2,000/day | Built |

### 3. Offline Ads

| Type | Pricing | Status |
|------|---------|--------|
| Standees | ₹500-2,000/week | Built |
| Posters | ₹300-1,500/week | Built |
| Billboards | ₹10,000-50,000/month | Built |
| Table Tents | ₹200-800/week | Built |

### 4. QR Campaigns

| Type | CPS | CPV | Status |
|------|-----|-----|--------|
| QR Poster | ₹2 | ₹10 | Built |
| QR Table Tent | ₹1.5 | ₹8 | Built |
| QR Window | ₹1 | ₹5 | Built |

### 5. Broadcast Marketing

| Channel | Per Message | Status |
|---------|-------------|--------|
| WhatsApp | ₹0.50-2.50 | Built |
| SMS | ₹0.20-0.50 | Built |
| Email | ₹0.02-0.10 | Built |
| Push | ₹0.05-0.30 | Built |

### 6. Influencer Marketing

| Platform | Per Post | Status |
|----------|-----------|--------|
| Instagram | ₹5,000-50,000 | Built |
| YouTube | ₹10,000-100,000 | Built |
| Reels | ₹8,000-80,000 | Built |

---

## AI Dynamic Pricing

### Multipliers

| Factor | Range | Example |
|--------|-------|---------|
| Demand | 0.5-2.0 | High demand = higher price |
| Competition | 0.7-1.8 | More advertisers = higher |
| Peak Time | 0.4-2.5 | 8PM = 2.5x |
| Day of Week | 0.7-1.4 | Saturday = 1.4x |
| Seasonal | 0.8-3.0 | Diwali = 3.0x |
| Location | 0.6-2.5 | Tier 1 = 2.5x |
| Category | 1.0-3.0 | Luxury = 3.0x |

### Price Caps

| Type | Max Surge |
|------|-----------|
| DOOH | 8x |
| Search | 6x |
| Banner | 5x |
| QR | 5x |
| Push | 4x |
| WhatsApp | 3x |
| Email | 2x |

### Minimum Campaign Spend

| Type | Minimum |
|------|---------|
| In-App | ₹500 |
| Push | ₹300 |
| WhatsApp | ₹1,000 |
| DOOH | ₹3,000 |
| Influencer | ₹5,000 |
| Offline | ₹5,000 |

---

## Campaign Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAMPAIGN LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CREATE                                                                 │
│     │                                                                        │
│     ├── Merchant selects ad type(s)                                          │
│     ├── Sets budget & targeting                                             │
│     ├── Wallet balance check                                                 │
│     └── Reserve funds from wallet                                           │
│                                                                              │
│  2. REVIEW                                                                 │
│     │                                                                        │
│     ├── Admin review (if required)                                          │
│     └── Auto-approve (if configured)                                        │
│                                                                              │
│  3. RUN                                                                     │
│     │                                                                        │
│     ├── Serve ads to users                                                  │
│     ├── Record impressions/clicks/scans                                      │
│     ├── Calculate charges via REZ-pricing-engine                            │
│     └── Deduct from reserved wallet                                         │
│                                                                              │
│  4. COMPLETE                                                               │
│     │                                                                        │
│     ├── Release unused reservation                                           │
│     ├── Send performance report                                               │
│     └── Mark campaign complete                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Unified Campaign Creator

Step-by-step wizard:
1. **Select Type** - Choose In-App/DOOH/QR/Broadcast/Influencer/Offline
2. **Set Budget** - Slider with wallet check
3. **Targeting** - Location + Audience selection
4. **Review & Launch** - Confirm and reserve wallet

---

## Merchant Wallet Integration

### Wallet Flow

```
Merchant Wallet
 │
 ├── Prepaid Balance
 ├── Reserved for Campaigns
 └── Auto-recharge (optional)
 │
 ▼
Reserve Budget → Run Campaign → Deduct → Release Unused
```

### API Calls

```typescript
// 1. Check balance
GET /api/wallet/balance/:merchantId

// 2. Reserve for campaign
POST /api/wallet/reserve
{ merchantId, amount, campaignId, purpose }

// 3. Deduct per event
POST /api/wallet/deduct
{ merchantId, amount, reason, campaignId }

// 4. Release unused
POST /api/wallet/release/:reservationId
```

---

## API Reference

### REZ-Pricing-Engine

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/price` | POST | Calculate dynamic price |
| `/api/price/allocate` | POST | Smart budget allocation |
| `/api/price/liquidation` | POST | Unsold inventory discount |
| `/api/price/validate` | POST | Min spend validation |
| `/api/price/caps` | GET | Get price caps |

### REZ-Ads-Service

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ads` | GET | List merchant ads |
| `/api/ads` | POST | Create ad campaign |
| `/api/ads/:id` | PUT | Update ad |
| `/api/ads/:id/pause` | PUT | Pause ad |
| `/api/serve` | GET | Serve ad to user |
| `/api/events/click` | POST | Record click |
| `/api/events/impression` | POST | Record impression |

### REZ-Marketing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaigns` | GET/POST | List/Create campaigns |
| `/api/broadcasts/whatsapp` | POST | Send WhatsApp |
| `/api/broadcasts/sms` | POST | Send SMS |
| `/api/broadcasts/email` | POST | Send Email |
| `/api/segments` | GET/POST | Audience segments |

### Unified Campaign API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaigns/unified` | POST | Create with wallet |
| `/api/campaigns/:id/status` | GET | Wallet usage |
| `/api/campaigns/:id/pause` | POST | Pause |
| `/api/campaigns/:id/resume` | POST | Resume |
| `/api/campaigns/:id/cancel` | POST | Cancel + refund |

---

## Deployment

### Render (Auto-Deploy)

All services have `render.yaml` and auto-deploy on push to main.

| Service | URL |
|---------|-----|
| REZ-ads-service | rez-ads-service.onrender.com |
| REZ-pricing-engine | rez-pricing-engine.onrender.com |
| REZ-marketing | rez-marketing.onrender.com |
| REZ-gamification | rez-gamification.onrender.com |
| REZ-communications | rez-communications.onrender.com |

### Environment Variables

```env
# Core
NODE_ENV=production
PORT=4007

# MongoDB
MONGODB_URI=mongodb+srv://...

# Redis
REDIS_URL=redis://...

# Auth
JWT_SECRET=<64+ chars>
INTERNAL_SERVICE_TOKENS_JSON={"service":"token"}

# External APIs
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
SENDGRID_API_KEY=SG.xxx
FIREBASE_PROJECT_ID=xxx

# Internal Services
WALLET_SERVICE_URL=http://localhost:4001
ADS_SERVICE_URL=http://localhost:4007
```

---

## Service URLs

### Production

```env
ADS_SERVICE=https://rez-ads-service.onrender.com
PRICING_ENGINE=https://rez-pricing-engine.onrender.com
MARKETING_SERVICE=https://rez-marketing.onrender.com
COMMUNICATIONS=https://rez-communications.onrender.com
GAMIFICATION=https://rez-gamification.onrender.com
```

### Development

```env
ADS_SERVICE=http://localhost:4007
PRICING_ENGINE=http://localhost:4008
MARKETING_SERVICE=http://localhost:4000
COMMUNICATIONS=http://localhost:3009
GAMIFICATION=http://localhost:3004
```

---

## Directory Structure

```
REZ-Media/
├── REZ-ads-service/          # Ad campaigns, serving
├── REZ-pricing-engine/       # AI dynamic pricing
├── REZ-marketing/            # Broadcasts, segments
├── REZ-communications-platform/ # WhatsApp, SMS, Email, Push
├── REZ-gamification-service/ # Points, badges, streaks
├── REZ-lead-intelligence/     # AI segments
├── REZ-decision-service/      # Personalization
├── REZ-automation-service/   # Workflow automation
├── REZ-media-events/         # Event tracking
├── REZ-economic-engine/      # Commission rules
├── adBazaar/                 # Ad marketplace UI
├── adsqr/                   # QR campaign system
├── dooh/                    # DOOH platform
├── dooh-screen-app/         # Screen owner UI
├── dooh-mobile/             # Screen owner app
├── rez-dooh-service/        # DOOH backend
├── rez-whatsapp-store/      # WhatsApp commerce
├── rez-whatsapp-provisioning/ # Multi-tenant WhatsApp
├── rez-marketing-dashboard/  # Merchant dashboard
├── rez-chatbot-builder-ui/   # Chatbot builder
├── rez-crm-ui/              # CRM dashboard
└── rez-ad-campaigns/        # Campaign management
```

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/imrejaul007/REZ-Media.git
cd REZ-Media

# Install dependencies for each service
cd REZ-ads-service && npm install
cd REZ-pricing-engine && npm install
cd REZ-marketing && npm install

# Copy environment files
cp .env.example .env

# Start services
npm run dev
```

---

*End of Document*
