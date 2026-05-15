# REZ Media: Ad Pricing & Decision System
## Comprehensive Research & Architecture Document

**Date:** May 15, 2026
**Purpose:** Define how ads are priced and served across all platforms

---

## 1. EXECUTIVE SUMMARY

The REZ platform has a sophisticated multi-layered decision system:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER CONTEXT                                  │
│  Intent Graph ← Identity Graph ← RFM ← Taste Profile ← Behavior   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     DECISION ENGINE                                  │
│  Targeting Engine ← Auction Engine ← Sampling Decision ← Real-time  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      PRICING ENGINE                                  │
│  Dynamic CPM ← Quality Score ← Intent Match ← Competition ← Inventory │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      AD DELIVERY                                     │
│  App Ads | DOOH | WhatsApp | Email | Push | QR | Offline           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. INTELLIGENCE LAYER

### 2.1 REZ Mind (Intent Graph)

**Purpose:** Track user purchase intent across all apps

**Intent Model:**
```typescript
interface Intent {
  userId: string;
  category: string;        // 'restaurant', 'hotel', 'retail'
  intentKey: string;      // 'looking_for_food', 'booking_stay'
  confidence: number;     // 0-1
  status: 'ACTIVE' | 'DORMANT' | 'FULFILLED' | 'EXPIRED';
}
```

### 2.2 Identity Graph

**Purpose:** Link user identities across all apps

**Unified Profile Contains:**
- User ID (cross-app)
- Demographics (age, gender, location)
- Behavior patterns
- Purchase history
- RFM scores

### 2.3 RFM Service

**RFM = Recency, Frequency, Monetary**

| Segment | Description |
|--------|-------------|
| Champions | Recent, frequent, high spend |
| Loyal | Frequent buyers |
| Potential | Recent, some frequency |
| At Risk | Haven't purchased recently |
| Lost | Churned |

---

## 3. DECISION ENGINE LAYER

### 3.1 REZ Decision Service (Port 4027)

**Components:**
1. **Sampling Decision Engine** - Who gets coins/nudges
2. **Auction Engine** - Competition between merchants
3. **Attribution Tracker** - Track nudge ROI

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
```

---

## 4. PRICING ENGINE LAYER

### 4.1 Base Pricing by Ad Type

| Ad Type | CPM (₹) | CPC (₹) | CPA (₹) |
|---------|----------|----------|----------|
| Banner | 150 | 5 | 50 |
| Feed | 100 | 3 | 40 |
| Search | 250 | 12 | 80 |
| DOOH | 200 | 8 | 60 |
| QR | 40 | 2 | 20 |
| WhatsApp | 80 | 3 | 25 |

### 4.2 Targeting Levels

| Level | Environment | Targeting | CPM (₹) |
|-------|-------------|---------|----------|
| L1: Personal | App, website | Full profile | 200-400 |
| L2: Captive Private | Hotel, Cab, Flight | Profile data | 100-300 |
| L3: Semi-Captive | Mall, Office, University | Context + data | 60-150 |
| L4: Public | Billboard, Shelter | Context only | 10-60 |

---

## 5. DOOH PRICING FRAMEWORK

### 5.1 Screen Inventory Categories

#### L2: Captive Private Spaces (HIGH VALUE)

| Screen | User Data Available | CPM (₹) |
|--------|-------------------|----------|
| Hotel Smart TV | Full | 200-400 |
| Cab/Taxi Screen | Full | 150-250 |
| Flight Seat | Full | 180-300 |
| Bus Seat | Full | 100-180 |

**Why L2 is HIGH VALUE:**
1. User is CAPTIVE - can't scroll away
2. Profile data AVAILABLE - we know who they are
3. Extended EXPOSURE - minutes to hours
4. Full ATTENTION - not multitasking

#### L3: Semi-Captive Spaces (MEDIUM)

| Screen | CPM (₹) |
|--------|----------|
| Mall Kiosk | 80-120 |
| Office Lobby | 100-150 |
| University | 80-120 |
| Gym Screen | 70-100 |
| Cinema | 90-130 |

#### L4: Public Passive (LOW)

| Screen | CPM (₹) |
|--------|----------|
| Billboard LED | 30-60 |
| Bus Shelter | 15-30 |
| Street Pole | 10-20 |

---

## 6. PRICING FORMULA

```
Final CPM = Base CPM
          × Targeting Level Multiplier
          × City Tier Multiplier
          × Time Multiplier
          × Demand Multiplier
          × Quality Score
```

### Multipliers

| Factor | Range |
|--------|-------|
| Targeting Level | 1.0-2.0x |
| City Tier (Metro) | 2.5x |
| Peak Time | 2.0x |
| Demand | 0.5-2.0x |
| Quality Score | 0.5-1.5x |

---

## 7. EXAMPLE CALCULATIONS

### Example 1: DOOH in Hotel (Captive)

```
User: Business traveler, Champions segment
Location: Mumbai (Metro)
Time: Evening 7pm (Peak)
Screen: Hotel Smart TV (Captive L2)

Base CPM: ₹200
× Targeting Level (L2): 1.5x
× City Tier (Metro): 2.5x
× Time (Peak): 2.0x
× Demand: 1.2x
× Quality Score: 1.2x

FINAL CPM = 200 × 1.5 × 2.5 × 2.0 × 1.2 × 1.2
         = ₹2,160 per 1000 impressions
```

### Example 2: App Feed Ad

```
User: Regular user, Loyal segment
Location: Bangalore (Metro)
Time: Evening 7pm (Peak)

Base CPM: ₹100
× Targeting Level (L1): 2.0x
× City Tier (Metro): 2.5x
× Time (Peak): 2.0x

FINAL CPM = 100 × 2.0 × 2.5 × 2.0
         = ₹1,000 per 1000 impressions
```

---

## 8. CAMPAIGN OBJECTIVES

| Objective | Bid Strategy | Base CPM | Notes |
|-----------|-------------|----------|-------|
| Awareness | CPM | 50-200 | Brand visibility |
| Traffic | CPC | 3-15 | Website visits |
| Engagement | CPE | 5-25 | Interactions |
| Lead Gen | CPL | 15-80 | Form submissions |
| Sales | CPA | 30-150 | Purchases |
| Footfall | CPV | 5-20 | Store visits |

---

## 9. SERVICE CONNECTIONS

```
REZ-Intelligence/
├── REZ-intent-graph (3001)     → Intent signals
├── REZ-identity-graph (4050)    → Unified profile
├── REZ-rfm-service (4055)      → Segmentation
├── REZ-taste-profile (4041)   → Preferences
└── REZ-personalization-engine  → Recommendations

REZ-Media/
├── REZ-decision-service (4027)  → Real-time decisions
├── REZ-ad-ai (4021)            → AI optimization
├── REZ-pricing-engine (4016)   → Dynamic pricing
├── REZ-dooh-service (4018)     → DOOH inventory
└── REZ-ads-service (4007)      → Campaign management
```

---

## 10. SUMMARY TABLE

| Platform | Targeting | Base CPM | Metro+Peak |
|----------|-----------|----------|------------|
| App Feed | L1 (1:1) | 100 | 500 |
| App Search | L1 (1:1) | 250 | 1250 |
| WhatsApp | L1 (1:1) | 80 | 400 |
| Hotel TV | L2 (Captive) | 180 | 900 |
| Cab Screen | L2 (Captive) | 150 | 750 |
| Flight Seat | L2 (Captive) | 180 | 900 |
| Mall Kiosk | L3 (Context) | 80 | 400 |
| Office | L3 (Context) | 100 | 500 |
| Billboard | L4 (Public) | 40 | 200 |
| Bus Shelter | L4 (Public) | 20 | 100 |
