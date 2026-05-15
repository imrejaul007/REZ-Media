# REZ Platform - Ad Pricing & Decision System
## Source of Truth Document

**Last Updated:** May 15, 2026
**Version:** 2.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Intelligence Layer](#2-intelligence-layer)
3. [Decision Engine](#3-decision-engine)
4. [Pricing System](#4-pricing-system)
5. [DOOH Intelligence](#5-dooh-intelligence)
6. [Attribution Tracking](#6-attribution-tracking)
7. [Service Inventory](#7-service-inventory)
8. [API References](#8-api-references)
9. [Pricing Matrix](#9-pricing-matrix)

---

## 1. Architecture Overview

### 1.1 System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER CONTEXT                                       │
│  Intent Graph ← Identity Graph ← RFM ← Taste Profile ← Behavior         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DECISION ENGINE                                     │
│  Targeting Engine ← Auction Engine ← Sampling Decision ← Real-time       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRICING ENGINE                                      │
│  Dynamic CPM ← Quality Score ← Captivity Index ← Demand ← Audience      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AD DELIVERY                                        │
│  App Ads | DOOH | WhatsApp | Email | Push | QR | Offline               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Principles

1. **User-Centric** - Ads based on user intent, not surveillance
2. **Transparent Pricing** - Clear pricing model for merchants
3. **Fair Auction** - Competition-based pricing with quality scoring
4. **Measurable ROI** - Full attribution tracking

---

## 2. Intelligence Layer

### 2.1 Intent Graph (REZ Mind)

**Purpose:** Track user purchase intent across all apps

**Key Entities:**
```typescript
interface Intent {
  userId: string;
  category: string;        // 'restaurant', 'hotel', 'retail'
  intentKey: string;        // 'looking_for_food', 'booking_stay'
  confidence: number;        // 0-1
  status: 'ACTIVE' | 'DORMANT' | 'FULFILLED' | 'EXPIRED';
  signals: IntentSignal[];  // Search, click, view events
}
```

**Service:** `REZ-intent-graph` (Port 3001)

### 2.2 Identity Graph

**Purpose:** Unified user profile across all apps

**Unified Profile Contains:**
- Cross-app user ID
- Demographics (age, gender, location)
- Behavior patterns
- Purchase history
- RFM scores
- Preferences

**Service:** `REZ-identity-graph` (Port 4050)

### 2.3 RFM Service

**Purpose:** Customer segmentation

| Segment | Description | Strategy |
|---------|-------------|----------|
| Champions | Recent, frequent, high spend | VIP treatment |
| Loyal | Frequent buyers | Upsell |
| Potential | Recent, some frequency | Nurture |
| At Risk | Haven't purchased recently | Win-back |
| Lost | Churned | Reactivation |

**Service:** `REZ-rfm-service` (Port 4055)

### 2.4 Taste Profile

**Purpose:** User preferences

| Category | Examples |
|----------|----------|
| Food | Cuisine preferences, dietary restrictions |
| Travel | Budget vs luxury, destinations |
| Shopping | Brand loyal vs deal seekers |
| Entertainment | Movies, events, activities |

---

## 3. Decision Engine

### 3.1 REZ Decision Service

**Purpose:** Real-time ad serving decisions

**Port:** 4027

**Components:**
1. **Sampling Decision Engine** - Who gets coins/nudges
2. **Auction Engine** - Competition between merchants
3. **Attribution Tracker** - Track nudge ROI
4. **Sponsored Ranking** - Organic vs sponsored

### 3.2 Auction Flow

```
User visits app
       ↓
Get user context (intent, segments, RFM)
       ↓
Query targeting engine for eligible campaigns
       ↓
Run auction between competing merchants
       ↓
Calculate winning bid with quality score
       ↓
Serve ad with dynamic pricing
       ↓
Track impression → click → conversion
       ↓
Attribution
```

### 3.3 Auction Formula

```
Effective Bid = Base Bid × Quality Score / 10
Winning Price = Second Highest Bid + 0.01
```

---

## 4. Pricing System

### 4.1 Base Pricing by Ad Type

| Ad Type | CPM (₹) | CPC (₹) | CPA (₹) |
|---------|----------|----------|----------|
| Banner | 150 | 5 | 50 |
| Feed | 100 | 3 | 40 |
| Search | 250 | 12 | 80 |
| DOOH | 200 | 8 | 60 |
| QR | 40 | 2 | 20 |
| WhatsApp | 80 | 3 | 25 |
| Push | 30 | 1 | 15 |
| Email | 20 | 0.5 | 10 |

### 4.2 Targeting Levels

| Level | Environment | Targeting | Premium |
|-------|-------------|-----------|---------|
| **L1: Personal** | App, WhatsApp | Full profile | 2.0x |
| **L2: Captive** | Hotel, Cab, Flight | Profile + Captive | 1.5x |
| **L3: Context** | Mall, Office, Uni | Context + Some | 1.2x |
| **L4: Public** | Billboard, Shelter | Context only | 1.0x |

### 4.3 Multipliers

| Factor | Range | Description |
|--------|-------|-------------|
| Demand | 0.5-2.0x | Based on inventory |
| Peak Time | 2.0x | 7-9am, 6-9pm |
| City Tier (Metro) | 2.5x | Mumbai, Delhi |
| Seasonal (Festival) | 3.0x | Diwali, Christmas |
| Quality Score | 0.5-1.5x | Ad relevance |

### 4.4 Pricing Formula

```
Final CPM = Base CPM
          × Targeting Level
          × City Tier
          × Time
          × Seasonal
          × Demand
          × Quality Score
```

---

## 5. DOOH Intelligence

### 5.1 DOOH Screen Types

#### L2: Captive Private (High Value)

| Screen | User Data | CPM (₹) |
|--------|----------|----------|
| Hotel Smart TV | Full profile | 200-400 |
| Cab/Taxi Screen | Full profile | 150-300 |
| Flight Seat | Full profile | 200-400 |
| Bus Seat | Full profile | 100-200 |
| Train Seat | Full profile | 120-250 |

#### L3: Semi-Captive (Medium)

| Screen | CPM (₹) |
|--------|----------|
| Mall Kiosk | 80-150 |
| Office Lobby | 100-180 |
| University | 80-140 |
| Gym Screen | 70-120 |
| Cinema | 90-160 |

#### L4: Public (Low)

| Screen | CPM (₹) |
|--------|----------|
| Billboard LED | 40-100 |
| Bus Shelter | 20-50 |
| Street Pole | 15-35 |
| ATM Screen | 30-60 |

### 5.2 Captivity Index

**Purpose:** Quantify how captive the audience is

```typescript
interface CaptivityIndex {
  level: 'personal' | 'captive_private' | 'semi_captive' | 'public';
  avgDwellTime: number;      // minutes
  attentionLevel: number;      // 0-1
  dataAvailability: 'full' | 'partial' | 'none';
  escapeDifficulty: number;    // 1-5
  premiumScore: number;        // 0-100
}
```

### 5.3 Audience Matching

**Purpose:** Match screen type to user profile

```typescript
interface AudienceMatch {
  score: number;              // 0-100
  matchLevel: 'excellent' | 'good' | 'fair' | 'poor';
  priceAdjustment: number;    // 0.8 - 1.5
}
```

---

## 6. Attribution Tracking

### 6.1 Attribution Models

| Model | Description | Best For |
|-------|-------------|----------|
| First Touch | Credit to first touchpoint | Awareness |
| Last Touch | Credit to last touchpoint | Direct response |
| Linear | Equal credit to all | Balanced view |
| Time Decay | More credit to recent | Urgency |
| Position Based | 40% first, 40% last, 20% middle | Full funnel |
| Data Driven | ML-based | Accuracy |

### 6.2 Attribution Windows

| Event | Window |
|-------|--------|
| Impression | 24 hours |
| App Visit | 48 hours |
| Conversion | 72 hours |
| Assisted | 7 days |

### 6.3 DOOH Attribution

**Special Considerations:**
- DOOH has longer consideration cycles
- Attribution to physical behavior (footfall)
- Geofence-based tracking

---

## 7. Service Inventory

### 7.1 Intelligence Services

| Service | Port | Purpose |
|---------|------|---------|
| `REZ-intent-graph` | 3001 | Intent tracking |
| `REZ-identity-graph` | 4050 | Unified profile |
| `REZ-rfm-service` | 4055 | RFM segmentation |
| `REZ-taste-profile` | 4041 | Preferences |
| `REZ-personalization-engine` | - | Recommendations |

### 7.2 Decision Services

| Service | Port | Purpose |
|---------|------|---------|
| `REZ-decision-service` | 4027 | Real-time decisions |
| `REZ-targeting-engine` | 3013 | Targeting logic |
| `REZ-ad-ai` | 4021 | AI optimization |

### 7.3 Pricing Services

| Service | Port | Purpose |
|---------|------|---------|
| `REZ-pricing-engine` | 4016 | Dynamic pricing |
| `REZ-economic-engine` | 4016 | Coin economics |

### 7.4 DOOH Services

| Service | Port | Purpose |
|---------|------|---------|
| `REZ-dooh-service` | 4018 | DOOH inventory |
| `REZ-dooh-intelligence` | 4080 | DOOH targeting |
| `REZ-dooh-attribution` | 4081 | DOOH attribution |

### 7.5 Ad Delivery Services

| Service | Port | Purpose |
|---------|------|---------|
| `REZ-ads-service` | 4007 | Campaign management |
| `REZ-video-ads` | 4067 | Video ad serving |
| `REZ-header-bidding` | 4065 | Prebid integration |

---

## 8. API References

### 8.1 Pricing API

**Calculate Price:**
```bash
POST /api/price
{
  "adType": "dooh",
  "screenType": "hotel_tv",
  "location": { "city": "Mumbai", "tier": "metro" },
  "scheduledTime": { "start": "2026-05-15T20:00:00Z" },
  "campaignObjective": "awareness"
}
```

### 8.2 DOOH Intelligence API

**Get Screen Types:**
```bash
GET /api/screens/types
```

**Find Targeted Users:**
```bash
POST /api/targeting/users
{
  "screenType": "hotel_tv",
  "location": { "city": "Mumbai", "tier": "metro" },
  "audienceCriteria": {
    "rfmSegments": ["champions", "loyal"]
  }
}
```

### 8.3 Attribution API

**Record Touchpoint:**
```bash
POST /api/touchpoints
{
  "screenId": "screen_001",
  "screenType": "hotel_tv",
  "campaignId": "camp_001",
  "userId": "user_001",
  "event": "impression"
}
```

**Attribute Conversion:**
```bash
POST /api/attribute
{
  "conversion": { "userId": "user_001", "event": "purchase", "value": 500 },
  "touchpoints": [...],
  "models": ["last_touch", "data_driven"]
}
```

---

## 9. Pricing Matrix

### 9.1 Complete DOOH Pricing Table

| Platform | Level | Base CPM | Metro + Peak | Best For |
|----------|-------|----------|--------------|----------|
| **App Feed** | L1 | 100 | 500 | Engagement |
| **App Search** | L1 | 250 | 1250 | Intent |
| **WhatsApp** | L1 | 80 | 400 | Direct |
| **Hotel TV** | L2 | 180 | 900 | Travelers |
| **Cab Screen** | L2 | 150 | 750 | Commuters |
| **Flight Seat** | L2 | 200 | 1000 | Premium |
| **Mall Kiosk** | L3 | 80 | 400 | Shoppers |
| **Office Lobby** | L3 | 100 | 500 | Professionals |
| **Billboard** | L4 | 40 | 200 | Awareness |
| **Bus Shelter** | L4 | 20 | 100 | Local |

### 9.2 Metro + Peak Multipliers

```
Metro City (Peak Time):
Base × 2.5 (City) × 2.0 (Time) × 1.5 (L2) = Base × 7.5

Example:
Hotel TV Base: ₹180
Metro Peak: 180 × 7.5 = ₹1,350 CPM
```

---

## 10. Configuration

### 10.1 City Tier Mapping

```javascript
const CITY_TIERS = {
  metro: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai'],
  tier1: ['Pune', 'Hyderabad', 'Kolkata'],
  tier2: ['Jaipur', 'Lucknow', 'Chandigarh'],
  tier3: ['Other cities']
};
```

### 10.2 Seasonal Calendar

```javascript
const SEASONS = {
  festival: ['Oct-Nov (Diwali)', 'Dec (Christmas)'],
  holiday: ['May-Jun (Summer)', 'Aug (Independence)'],
  normal: ['Rest of year']
};
```

---

## 11. Monitoring & Metrics

### 11.1 Key Metrics

| Metric | Description | Target |
|--------|------------|--------|
| Fill Rate | Impressions filled / requested | >80% |
| Viewability | Viewable impressions / total | >65% |
| ROAS | Revenue / Ad Spend | >2.0 |
| CTR | Clicks / Impressions | >2% |
| Conversion Rate | Conversions / Clicks | >5% |

### 11.2 Health Checks

```bash
# Check all services
curl http://localhost:4095/health/all

# Individual service
curl http://localhost:3001/health
```

---

## 12. Troubleshooting

### 12.1 Common Issues

| Issue | Solution |
|-------|----------|
| No pricing returned | Check intent graph connection |
| Low fill rate | Increase floor price or targeting |
| Poor ROAS | Review quality score |
| Attribution gaps | Check touchpoint tracking |

### 12.2 Support

For issues, check logs:
```bash
# Decision service logs
tail -f logs/decision-service.log

# Pricing service logs
tail -f logs/pricing-engine.log
```

---

## 13. Changelog

### v2.0 (May 15, 2026)
- Added DOOH Intelligence Service
- Added Captivity Index
- Added Audience Matching
- Added DOOH Attribution
- Updated Pricing Matrix

### v1.0 (Earlier)
- Initial pricing engine
- Basic targeting
- Auction system

---

## 14. Appendix

### A. Service URLs

| Service | Local | Production |
|---------|-------|------------|
| Intent Graph | localhost:3001 | intent.rezapp.com |
| Identity Graph | localhost:4050 | identity.rezapp.com |
| Decision Service | localhost:4027 | decision.rezapp.com |
| Pricing Engine | localhost:4016 | pricing.rezapp.com |
| DOOH Intelligence | localhost:4080 | dooh-intel.rezapp.com |

### B. Port Reference

| Range | Services |
|-------|----------|
| 3000-3099 | UI Apps |
| 4000-4049 | Core Services |
| 4050-4059 | Intelligence |
| 4060-4069 | Ad Platform |
| 4070-4079 | Marketing |
| 4080-4089 | DOOH |

---

**Document Owner:** Platform Team
**Last Review:** May 15, 2026
**Next Review:** Monthly
