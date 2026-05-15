# AdBazaar Ecosystem - Source of Truth
## Complete Ad Marketplace Architecture

**Last Updated:** May 15, 2026
**Version:** 1.0

---

## Table of Contents

1. [Ecosystem Overview](#1-ecosystem-overview)
2. [Platform Components](#2-platform-components)
3. [User Flows](#3-user-flows)
4. [Screen Types & Pricing](#4-screen-types--pricing)
5. [Payment Structure](#5-payment-structure)
6. [Integration Points](#6-integration-points)
7. [API References](#7-api-references)
8. [Service Inventory](#8-service-inventory)

---

## 1. Ecosystem Overview

### 1.1 What is AdBazaar?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AdBazaar                                       │
│                   "Airbnb for Ad Space"                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────────┐           ┌─────────────────┐              │
│   │  SCREEN OWNERS  │           │  ADVERTISERS    │              │
│   │                 │           │                 │              │
│   │ • List screens │           │ • Browse inventory│             │
│   │ • Set prices   │           │ • Book campaigns │              │
│   │ • Get paid     │           │ • Target users  │              │
│   │ • Track earn   │           │ • Track ROI     │              │
│   └────────┬────────┘           └────────┬────────┘              │
│            │                              │                       │
│            └──────────────┬───────────────┘                       │
│                           ▼                                        │
│              ┌─────────────────────────┐                          │
│              │    REZ PLATFORM        │                          │
│              │                        │                          │
│              │ • DOOH Intelligence    │                          │
│              │ • Dynamic Pricing      │                          │
│              │ • Attribution         │                          │
│              │ • Payment Split       │                          │
│              └─────────────────────────┘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Value Proposition

| For Screen Owners | For Advertisers |
|------------------|----------------|
| Monetize idle screens | Target specific audiences |
| Set your own prices | Dynamic, fair pricing |
| Get paid automatically | Full attribution & ROI |
| Track performance | Access to captive audiences |

---

## 2. Platform Components

### 2.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                           │
├─────────────────────────────────────────────────────────────────────┤
│  adBazaar/              │ adBazaar-creator/    │ DSP Portal/        │
│  • Marketplace UI        │ • Creator dashboard   │ • Campaign mgmt    │
│  • Screen browser       │ • Earnings tracker   │ • Analytics        │
│  • Booking flow         │ • Screen management │ • Budget control   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐ │
│  │ adBazaar-backend │    │  DSP Portal API   │    │ REZ-ads     │ │
│  │ (Port: 4085)     │    │  (Port: 4064)    │    │ (Port: 3005)│ │
│  │                  │    │                  │    │              │ │
│  │ • Owner mgmt    │    │ • Advertiser mgmt│    │ • Ad serving│ │
│  │ • Screen listing │───▶│ • Campaign CRUD  │───▶│ • Bidding   │ │
│  │ • Booking       │    │ • Targeting     │    │ • Delivery  │ │
│  │ • Payment split │    │ • Budget        │    │ • Tracking  │ │
│  └────────┬─────────┘    └────────┬─────────┘    └──────┬───────┘ │
│           │                      │                      │         │
│           └──────────────────────┬┴──────────────────────┘         │
│                                  ▼                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 INTELLIGENCE LAYER                         │   │
│  │                                                          │   │
│  │  ┌──────────────────────┐  ┌─────────────────────────┐  │   │
│  │  │ REZ-dooh-intelligence │  │ REZ-dooh-attribution   │  │   │
│  │  │ (Port: 4080)         │  │ (Port: 4081)           │  │   │
│  │  │                      │  │                        │  │   │
│  │  │ • Dynamic pricing    │  │ • Attribution          │  │   │
│  │  │ • Captivity index   │  │ • ROAS tracking        │  │   │
│  │  │ • Audience matching  │  │ • Footfall tracking    │  │   │
│  │  └──────────────────────┘  └─────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────┐  ┌─────────────────────────┐  │   │
│  │  │ REZ-pricing-engine   │  │ REZ-dooh-service       │  │   │
│  │  │ (Port: 4016)         │  │ (Port: 4018)           │  │   │
│  │  │                      │  │                        │  │   │
│  │  │ • Base CPM matrix    │  │ • Screen registry     │  │   │
│  │  │ • Time multipliers   │  │ • Playlist gen       │  │   │
│  │  │ • Quality scoring   │  │ • Ad delivery        │  │   │
│  │  └──────────────────────┘  └─────────────────────────┘  │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Responsibilities

| Service | Port | Responsibility |
|---------|------|---------------|
| **adBazaar-backend** | 4085 | Screen marketplace, bookings, payments |
| **REZ-dsp-portal** | 4064 | Advertiser self-serve portal |
| **REZ-ads** | 3005 | Real-time ad serving & bidding |
| **REZ-dooh-intelligence** | 4080 | DOOH pricing & targeting |
| **REZ-dooh-attribution** | 4081 | DOOH → App conversion tracking |
| **REZ-pricing-engine** | 4016 | Dynamic CPM calculations |
| **REZ-dooh-service** | 4018 | Screen management & ad delivery |

---

## 3. User Flows

### 3.1 Screen Owner Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Register   │────▶│ List Screen │────▶│ Set Price  │────▶│ Get Booked │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ KYC/Verify │     │  Approve    │     │ Dynamic    │     │ Ads Run    │
│  Status    │     │  Screen     │     │ Pricing    │     │ Automatically│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                  │
                                                                  ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Get Paid    │◀────│ Track      │◀────│ View       │◀────│ Audience   │
│ Monthly     │     │ Earnings   │     │ Analytics  │     │ Targeted   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 3.2 Advertiser Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Register  │────▶│ Create     │────▶│ Browse     │────▶│ Select     │
│            │     │ Campaign   │     │ Screens    │     │ & Book     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                    │                   │
      ┌─────────────────────────────────────────────┘                   │
      ▼                                                                 ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Set Budget  │────▶│ Upload     │────▶│ Ad Gets    │────▶│ Track      │
│ & Targeting│     │ Creatives  │     │ Delivered  │     │ Attribution│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                                                             │
      └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────────┐
                        │ View ROI Dashboard │
                        │ & Optimize        │
                        └─────────────────────┘
```

---

## 4. Screen Types & Pricing

### 4.1 Screen Types by Captivity Level

| Level | Screen Type | Description | Base CPM | Best For |
|-------|------------|-------------|----------|----------|
| **L1: Personal** | App Feed | REZ App | ₹100-250 | Engagement |
| **L2: Captive Private** | Hotel TV | Hotel guests | ₹180-400 | Travelers |
| | Cab Screen | Taxi passengers | ₹150-300 | Commuters |
| | Flight Seat | Air travelers | ₹200-400 | Premium |
| | Bus Seat | Bus passengers | ₹100-200 | Mass transit |
| **L3: Semi-Captive** | Mall Kiosk | Mall shoppers | ₹80-150 | Shoppers |
| | Office Lobby | Office workers | ₹100-180 | Professionals |
| | Gym Screen | Gym members | ₹70-120 | Health |
| | Cinema | Moviegoers | ₹90-160 | Entertainment |
| **L4: Public** | Billboard LED | Anyone | ₹40-100 | Awareness |
| | Bus Shelter | Commuters | ₹20-50 | Local |

### 4.2 Dynamic Pricing Formula

```
Final CPM = Base CPM
          × Captivity Multiplier
          × City Tier (Metro 2.5x, Tier1 2.0x, Tier2 1.3x)
          × Time (Peak 2.0x, Business 1.5x, Weekend 1.3x)
          × Seasonal (Festival 2.5x, Holiday 1.8x)
          × Demand (0.5x - 3.0x based on inventory)
          × Quality Score
```

### 4.3 Example Pricing

| Scenario | Base | Multipliers | Final CPM |
|----------|------|-------------|----------|
| Hotel TV, Mumbai, Peak | ₹200 | ×1.5 ×2.5 ×2.0 | ₹1,500 |
| Mall Kiosk, Pune, Weekend | ₹80 | ×1.2 ×2.0 ×1.3 | ₹250 |
| Billboard, Tier 2, Off-peak | ₹40 | ×1.0 ×1.0 ×0.5 | ₹20 |

---

## 5. Payment Structure

### 5.1 Revenue Split

```
┌─────────────────────────────────────────────────────────┐
│ TOTAL CAMPAIGN SPEND                                    │
│ ₹10,000 for 1M impressions @ ₹10 CPM                   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ GROSS REVENUE = ₹10,000                                 │
└─────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ SCREEN OWNER (70%)      │     │ REZ PLATFORM (30%)     │
│ ₹7,000                 │     │ ₹3,000                 │
│                         │     │                        │
│ • Paid monthly          │     │ • Platform ops (10%)    │
│ • Auto-payout           │     │ • Marketing (10%)      │
│ • Min ₹1,000           │     │ • R&D (10%)            │
└─────────────────────────┘     └─────────────────────────┘
```

### 5.2 Payment Timeline

| Event | Timeline |
|-------|----------|
| Ad runs (impression recorded) | Real-time |
| Campaign ends | End of schedule |
| Invoice generated | +2 days |
| Payment to owner | Monthly (15th) |
| Platform fee deducted | Automatic |

---

## 6. Integration Points

### 6.1 DOOH Intelligence Integration

```
AdBazaar Backend
       │
       │ 1. Get pricing quote
       ▼
REZ-dooh-intelligence (4080)
       │ • Captivity index
       │ • Audience matching
       │ • Dynamic CPM
       │
       │ 2. Return price
       ▼
AdBazaar Backend
       │
       │ 3. Book screen
       ▼
REZ-dooh-service (4018)
       │ • Screen playlist
       │ • Ad delivery
       │
       ▼
DOOH Screen
```

### 6.2 Attribution Integration

```
DOOH Screen
   │
   │ 1. Impression recorded
   ▼
REZ-dooh-service (4018)
   │
   │ 2. Touchpoint tracked
   ▼
REZ-dooh-attribution (4081)
   │
   │ 3. Attribution calculated
   ▼
User makes purchase on App
   │
   │ 4. Conversion event
   ▼
REZ-dooh-attribution
   │
   │ 5. Attribution credited
   ▼
Analytics Dashboard
```

### 6.3 Ad Serving Integration

```
Campaign Created in AdBazaar
           │
           │ 1. Book screen
           ▼
REZ-dooh-service (4018)
           │
           │ 2. Register ad
           ▼
REZ-ads (3005)
           │
           │ 3. Serve ad
           ▼
DOOH Screen
           │
           │ 4. Track event
           ▼
Analytics
```

---

## 7. API References

### 7.1 Screen Owner APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/owners/register` | POST | Register screen owner |
| `/api/owners/:id` | GET | Get owner details |
| `/api/owners/:id/screens` | POST | Add screen listing |
| `/api/owners/:id/screens` | GET | List owner's screens |
| `/api/owners/:id/screens/:screenId` | PATCH | Update screen |
| `/api/owners/:id/screens/:screenId/price` | PATCH | Update floor price |
| `/api/owners/:id/analytics` | GET | Get earnings analytics |

### 7.2 Advertiser APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/advertisers/register` | POST | Register advertiser |
| `/api/advertisers/:id` | GET | Get advertiser details |
| `/api/campaigns` | POST | Create campaign |
| `/api/campaigns/:id` | GET | Get campaign details |
| `/api/campaigns/:id/creatives` | POST | Add creative |
| `/api/campaigns/:id/status` | PATCH | Update status |

### 7.3 Marketplace APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/marketplace/screens` | GET | Search screens |
| `/api/marketplace/screens/:id` | GET | Get screen details |
| `/api/marketplace/quote` | POST | Get pricing quote |

---

## 8. Service Inventory

### 8.1 Complete Service List

| Service | Port | Type | Purpose |
|---------|------|------|---------|
| adBazaar | 3000 | Next.js | Marketplace UI |
| adBazaar-creator | 3000 | Next.js | Creator dashboard |
| adBazaar-backend | 4085 | API | Marketplace backend |
| REZ-dsp-portal | 4064 | API | Advertiser portal |
| REZ-ads | 3005 | Service | Ad serving |
| REZ-dooh-service | 4018 | Service | DOOH management |
| REZ-dooh-intelligence | 4080 | Service | DOOH pricing |
| REZ-dooh-attribution | 4081 | Service | Attribution |
| REZ-pricing-engine | 4016 | Service | Dynamic pricing |

### 8.2 Port Allocation

| Range | Services |
|-------|----------|
| 3000-3099 | Frontend Apps |
| 4000-4049 | Core Services |
| 4050-4059 | Intelligence |
| 4060-4069 | Ad Platform |
| 4070-4079 | Marketing |
| 4080-4089 | DOOH Services |

---

## 9. Configuration

### 9.1 Environment Variables

```bash
# AdBazaar Backend
ADBAZAAR_PORT=4085
MONGODB_URI=mongodb://localhost:27017/adbazaar

# DOOH Intelligence
DOOH_INTEL_URL=http://localhost:4080

# Pricing
PRICING_ENGINE_URL=http://localhost:4016

# DOOH Service
DOOH_SERVICE_URL=http://localhost:4018
```

### 9.2 Business Rules

| Rule | Value |
|------|-------|
| Platform Fee | 30% |
| Owner Payout | 70% |
| Min Payout | ₹1,000 |
| Payout Frequency | Monthly (15th) |
| GST | 18% |
| Attribution Window | 72 hours |

---

## 10. Monitoring

### 10.1 Health Checks

```bash
# AdBazaar Backend
curl http://localhost:4085/health

# DOOH Intelligence
curl http://localhost:4080/health

# DOOH Attribution
curl http://localhost:4081/health
```

### 10.2 Key Metrics

| Metric | Target | Alert |
|--------|--------|-------|
| Fill Rate | >80% | <60% |
| Viewability | >65% | <50% |
| Attribution Rate | >25% | <15% |
| Payment Processing | 100% | <99% |
| API Latency | <200ms | >500ms |

---

## Changelog

### v1.0 (May 15, 2026)
- Initial AdBazaar ecosystem architecture
- Backend API design
- DOOH Intelligence integration
- Attribution tracking design
- Payment split structure

---

**Document Owner:** Platform Team
**Last Review:** May 15, 2026
