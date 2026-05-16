# REZ Media - Source of Truth

**Version:** 4.0  
**Date:** 2026-05-16  
**Status:** AUTHORITATIVE

---

## Overview

REZ-Media handles advertising, engagement, and impact economy (Karma) services.

**Git:** `github.com/imrejaul007/REZ-Media`  
**Local Path:** `REZ-Media/`

---

## AdBazaar Ecosystem (Screen Marketplace)

### Apps

| App | Description | Tech Stack |
|-----|-------------|------------|
| `adBazaar/` | Marketplace UI | Next.js (Port 3000) |
| `adBazaar-creator/` | Creator dashboard | Next.js |
| `adBazaar-backend/` | Marketplace backend | Node.js (Port 4085) |

### How It Works

```
Screen Owners → List Screens → Set Floor Prices → Get Paid (70%)
                     ↓
                  AdBazaar
                     ↓
Advertisers → Browse Screens → Book Campaigns → Track ROI
```

### Payment Structure

| Party | Share | Description |
|-------|-------|-------------|
| Screen Owner | 70% | Monthly payout (15th) |
| REZ Platform | 30% | Operations + Marketing + R&D |

---

## DOOH Intelligence (REZ-Intelligence/)

### Core Services

| Service | Description | Port |
|---------|-------------|------|
| `REZ-dooh-intelligence/` | DOOH pricing & targeting | 4080 |
| `REZ-dooh-attribution/` | DOOH attribution tracking | 4081 |

### Screen Types & Captivity Levels

| Level | Screen Type | Base CPM | Description |
|-------|-------------|----------|-------------|
| **L1: Personal** | App Feed, Search | ₹100-250 | Full user profile |
| **L2: Captive** | Hotel TV, Cab, Flight | ₹150-400 | User stuck + profile |
| **L3: Context** | Mall, Office, Gym | ₹60-150 | Context + some data |
| **L4: Public** | Billboard, Shelter | ₹10-50 | Context only |

### Dynamic Pricing Formula

```
Final CPM = Base CPM
          × City Tier (Metro 2.5x, Tier1 2.0x)
          × Time (Peak 2.0x, Business 1.5x)
          × Seasonal (Festival 2.5x)
          × Captivity (L2 1.5x, L3 1.2x)
          × Demand (0.5-3.0x)
```

---

## Apps & Services

### Karma - Impact Economy Platform

| App | Description | Tech Stack |
|-----|-------------|------------|
| `karma/` | Karma web dashboard | Next.js |
| `karma-mobile/` | Karma mobile app | React Native/Expo |
| `karma-service/` | Karma backend | Node.js/Express |

### DOOH - Digital Out of Home

| App | Description | Tech Stack |
|-----|-------------|------------|
| `dooh-screen-app/` | DOOH display management | Next.js |
| `dooh-mobile/` | DOOH owner app | React Native/Expo |
| `rez-dooh-service/` | DOOH backend | Node.js (Port 4018) |

### Advertising Platform

| Service | Description | Port |
|---------|-------------|------|
| `REZ-ad-ai/` | Intent signal derivation | 4021 |
| `REZ-ai-campaign-builder/` | AI campaign generation | 4009 |
| `REZ-discovery-platform/` | Product discovery & ranking | 3000 |
| `REZ-economic-engine/` | Economic modeling | 4016 |
| `REZ-engagement-platform/` | Loyalty, offers, referrals | 4017 |
| `REZ-journey-service/` | User journey tracking | 4019 |
| `REZ-media-events/` | Media event tracking | 4029 |
| `REZ-pricing-engine/` | Dynamic pricing | 4015 |
| `REZ-dsp-portal/` | Advertiser self-serve portal | 4064 |
| `reks-whatsapp-commerce/` | WhatsApp commerce | 4030 |
| `rez-automation-service/` | Workflow automation | 4028 |
| `rez-instagram-sales-agent/` | Instagram sales | 4032 |
| `REZ-video-ads/` | Video ad serving | 4067 |
| `adsqr/` | QR code campaigns | 4068 |
| `reks-ads/` | Reks ad platform | 4069 |

### QR Ecosystem (REZ-Media)

| QR Product | Purpose | Port |
|-----------|---------|------|
| **Ads QR (adsqr)** | QR-based ad campaigns + coin rewards | 4068 |
| **Shelf QR** | Retail shelf product QR | - |

#### Ads QR Features

| Feature | Description |
|---------|-------------|
| Campaign Management | Create and manage QR ad campaigns |
| Coin Rewards | Reward users with coins for scanning |
| Analytics | Track campaign performance |
| Brand Integration | Connect with brand profiles |

#### Shelf QR Features

| Feature | Description |
|---------|-------------|
| Product Info | Display product details on scan |
| Reviews | Show product ratings and reviews |
| Purchase Links | Direct links to purchase |

For complete cross-company QR documentation, see [docs/QR-ECOSYSTEM.md](../docs/QR-ECOSYSTEM.md).

### REZ Business AI Services

| Service | Description | Port |
|---------|-------------|------|
| `rez-business-ai/` | Business AI - Main service | 4059 |

#### REZ Business AI - Complete

**Git:** `github.com/imrejaul007/REZ-business-ai`

##### Core Engines

| Engine | File | Purpose |
|--------|------|---------|
| Goal Engine | `goalEngine.ts` | Revenue, customer, retention goals |
| Playbook Engine | `playbookEngine.ts` | Industry-specific automations |
| Risk Engine | `riskEngine.ts` | Margin, budget, compliance checks |
| Memory Layer | `memoryLayer.ts` | Learn from every action |
| Campaign Bundles | `campaignBundles.ts` | One-click campaigns |
| Ad Execution Hub | `adExecutionHub.ts` | Multi-channel ads |

##### Advanced Intelligence

| Engine | File | Purpose |
|--------|------|---------|
| Decision Engine | `decisionEngine.ts` | Real-time decisions (<50ms) |
| Reinforcement Learning | `reinforcementLearning.ts` | Self-improving AI |
| A/B Testing | `abTesting.ts` | Validate strategies |
| Autonomous Commerce | `autonomousCommerce.ts` | Self-optimizing |
| Full Attribution | `attributionFull.ts` | Cross-channel tracking |

##### How It Works

```
Monitor → Analyze → Decide → Execute → Learn → Optimize
   ↓         ↓         ↓         ↓        ↓        ↓
Weather   Patterns   <50ms    Auto     Memory   Better
Events    Risk       Decision  Campaigns Record   Next
Demand    ROI       Actions   Notifications Results Actions
```

##### One-Click Campaigns

| Bundle | Est. Impact |
|--------|-------------|
| Weekend Rush | +₹8,000 |
| Happy Hour | +₹5,000 |
| Win-Back | +₹5,000 |
| Festival Boost | +₹25,000 |
| Rainy Day | +₹10,000 |

##### Connected Services

- REZ-Merchant (Products, Orders, Customers)
- REZ-Media (Ads, Campaigns, Engagement)
- RABTUL (Notifications, Wallet, Payments)
- REZ-Intelligence (Demand, Weather, Events)

### E-Commerce Connectors

| Service | Description | Port |
|---------|-------------|------|
| `rez-shopify-connector/` | Shopify sync | 4050 |
| `rez-woocommerce-connector/` | WooCommerce sync | 4051 |

### AI Marketing

| Service | Description | Port |
|---------|-------------|------|
| `REZ-prompt-workflow-ai/` | Natural language workflows | 4054 |
| `REZ-crm-hub/` | HubSpot + Zoho CRM | 4056 |
| `REZ-support-tools-hub/` | Zendesk + Freshdesk | 4057 |
| `REZ-research-opportunity-agent/` | Business analysis | 4058 |

### Voice & Commerce

| Service | Description | Port |
|---------|-------------|------|
| `rez-voice-cart-recovery/` | AI voice calls | 4053 |

### Segmentation

| Service | Description | Port |
|---------|-------------|------|
| `REZ-rfm-service/` | RFM customer analysis | 4055 |
| `REZ-rfm-marketing-bridge/` | RFM to marketing bridge | 4090 |

---

## AdBazaar Backend Integrations

### Service Integrations

| Integration | Service | Purpose |
|------------|---------|---------|
| DOOH Intelligence | Port 4080 | Dynamic pricing, audience matching |
| DOOH Attribution | Port 4081 | Touchpoint tracking, ROAS |
| RABTUL Auth | Port 3000 | User authentication |
| RABTUL Payment | Port 4001 | Campaign payments, payouts |
| RABTUL Notifications | Port 4004 | Alerts to users |
| RABTUL Analytics | Port 4006 | Dashboard metrics |
| REZ Intelligence | Port 3001 | User targeting |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/owners/register` | POST | Register screen owner |
| `/api/owners/:id/screens` | POST | Add screen listing |
| `/api/advertisers/register` | POST | Register advertiser |
| `/api/campaigns` | POST | Create campaign |
| `/api/marketplace/screens` | GET | Search screens |
| `/api/marketplace/quote` | POST | Get pricing |

---

## Integration Points

### RABTUL-Technologies (Shared Services)

| Service | Purpose |
|---------|---------|
| `rez-auth-service/` | Auth/SSO |
| `rez-payment-service/` | Payment gateway |
| `rez-wallet-service/` | Wallet/Coins |
| `rez-notifications-service/` | Push/SMS/Email |
| `rez-analytics-service/` | Analytics |

### REZ-Intelligence (AI/ML)

| Service | Purpose |
|---------|---------|
| `REZ-intent-graph/` | User intent tracking |
| `REZ-identity-graph/` | Unified identity |
| `REZ-rfm-service/` | Customer segmentation |
| `REZ-personalization-engine/` | Recommendations |

---

## Port Allocation

| Range | Services |
|-------|----------|
| 3000-3099 | Frontend Apps |
| 4000-4049 | Core Services |
| 4050-4059 | Connectors & AI |
| 4060-4069 | Ad Platform |
| 4070-4079 | Marketing |
| 4080-4089 | DOOH Intelligence |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                    │
├─────────────────────────────────────────────────────────────────────┤
│  adBazaar/          │ adBazaar-creator/    │ DSP Portal/        │
│  dooh-screen-app/    │ dooh-mobile/         │ karma/              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ADBAZAAR BACKEND                               │
├─────────────────────────────────────────────────────────────────────┤
│  adBazaar-backend │ REZ-dsp-portal │ REZ-ads-service │ rez-dooh-service │
│  (Port 4085)     │ (Port 4064)     │                │ (Port 4018)       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  REZ-dooh-intelligence (4080) │ REZ-dooh-attribution (4081)      │
│  • Dynamic pricing            │ • Touchpoint tracking             │
│  • Audience matching         │ • Attribution models             │
│  • Captivity scoring        │ • ROAS calculation              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RABTUL INFRASTRUCTURE                           │
├─────────────────────────────────────────────────────────────────────┤
│  rez-auth-service │ rez-payment-service │ rez-wallet-service        │
│  rez-notifications-service │ rez-analytics-service              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Metrics

| Metric | Target |
|--------|--------|
| Fill Rate | >80% |
| Viewability | >65% |
| Attribution Rate | >25% |
| ROAS | >2.0 |
| Payment Processing | 100% |

---

## Changelog

### v3.0 (2026-05-15)
- Added AdBazaar ecosystem
- Added DOOH Intelligence services
- Added Payment integration
- Updated architecture diagrams

### v2.0 (Earlier)
- Major platform overhaul

### v1.0
- Initial documentation

---

**Document Owner:** Platform Team  
**Last Review:** May 15, 2026
