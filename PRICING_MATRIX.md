# REZ-Media Pricing Matrix

**AI-DRIVEN DYNAMIC PRICING** | Like Meta Ads + Google Ads + Uber Surge

---

## 1. IN-APP ADS PRICING

### Current System
- `REZ-ads-service` handles: CPC, CPM bidding
- AdCampaign model supports: `home_banner`, `explore_feed`, `store_listing`, `search_result`
- BrandDashboard supports: `search`, `feed`, `qr`, `location` campaigns

### Base Pricing (INR)

| Placement | CPM | CPC | CPA |
|-----------|-----|-----|-----|
| Home Banner | ₹150 | ₹5 | ₹50 |
| Explore Feed | ₹100 | ₹3 | ₹40 |
| Search Results | ₹250 | ₹12 | ₹80 |
| Store Listing | ₹300 | ₹15 | ₹100 |

---

## 2. BROADCAST PRICING (Push, WhatsApp, Email)

### WhatsApp Marketing

| Message Type | Base Price | AI Premium |
|-------------|-----------|-----------|
| Utility | ₹0.50 | ₹0.40 - ₹0.90 |
| Marketing | ₹1.50 | ₹0.80 - ₹2.50 |
| AI Conversation | ₹5 | ₹2 - ₹15/session |
| Template Setup | ₹2,000 | One-time |

### Push Notifications

| Type | Price/User |
|------|-----------|
| Broadcast | ₹0.10 |
| Geo-Targeted | ₹0.30 |
| AI Personalized | ₹0.80 |
| Sponsored | Premium |

### Email Marketing

| Type | Price/Email |
|------|-------------|
| Bulk | ₹0.05 |
| AI Personalized | ₹0.40 |
| Premium Campaign | ₹999 flat + ₹0.02/email |

---

## 3. ADBZAAR PRICING (DOOH + Offline)

### DOOH Screen Pricing

```
Vendor sets: Monthly rent
REZ takes: Platform fee (15-25%)
AI calculates: Dynamic daily rate
```

**Formula:**
```
Daily Rate = (Monthly Rent / 30) × Demand Multiplier × Time Multiplier × Location Multiplier
```

### Offline Ads (Vendor-Controlled)

| Component | Vendor Sets |
|----------|------------|
| Space Rental | Monthly/weekly |
| Setup Cost | One-time |
| Printing | Per unit |
| Installation | Per location |

**AI optimizes above vendor minimum.**

---

## 4. ADSQR PRICING

### Current System
- QR generation for campaigns
- Scan tracking
- Coin rewards on scan
- Attribution tracking

### QR Ad Pricing

| Metric | Price |
|--------|-------|
| Cost per Scan (CPS) | ₹0.50 - ₹3 |
| Cost per Visit (CPV) | ₹3 - ₹15 |
| Cost per Purchase (CPP) | ₹20 - ₹100 |

---

## 5. AI DYNAMIC PRICING ENGINE

### Multipliers (Applied to Base Price)

| Factor | Range | Example |
|--------|-------|---------|
| **Demand** | 0.5 - 2.0 | High demand = higher price |
| **Competition** | 0.7 - 1.8 | More advertisers = higher |
| **Peak Time** | 0.4 - 2.5 | 8PM = 2.5× |
| **Day of Week** | 0.7 - 1.4 | Saturday = 1.4× |
| **Season** | 0.8 - 3.0 | Diwali = 3.0× |
| **Location** | 0.6 - 2.5 | Tier 1 city = 2.5× |
| **Audience** | 0.8 - 2.0 | High income = 2.0× |

### Example Calculations

**Banner Ad - Mall Area, Saturday 8PM, Diwali:**
```
Base: ₹150 CPM
× Demand (High): 1.5
× Peak Time (8PM): 2.5
× Day (Saturday): 1.4
× Seasonal (Diwali): 3.0
× Location (Tier 1): 2.5

Final: ₹3,937.50 CPM
```

**Email - Tuesday Morning, Standard Audience:**
```
Base: ₹20 CPM
× Demand (Normal): 1.0
× Peak Time (10AM): 1.8
× Day (Tuesday): 0.95
× Seasonal: 1.0
× Location (Tier 2): 1.5

Final: ₹51.30 CPM
```

---

## 6. COMMISSION STRUCTURE

### Platform Fees (from REZ-economic-engine)

| Category | Commission |
|---------|-----------|
| Restaurant | 12% |
| Retail | 10% |
| Services | 15% |
| DOOH/Vendor | 20% |
| Ad Spend (REZ takes) | 15-25% |

---

## 7. SMART BIDDING GOALS

| Goal | AI Optimizes For |
|------|------------------|
| Awareness | Impressions |
| Clicks | CTR |
| Conversions | Purchase rate |
| Sales | Revenue |
| Footfall | Store visits |
| QR Scans | Engagement |

---

## 8. INTEGRATION MAP

```
REZ-Media Pricing
 │
 ├── REZ-ads-service (CPC/CPM bidding)
 │ └── BrandDashboard (search, feed, qr, location)
 │
 ├── REZ-pricing-engine (AI Dynamic)
 │ └── Demand/competition/factor calculations
 │
 ├── REZ-economic-engine (Commission rules)
 │ └── Business rule engine
 │
 ├── adsqr (QR performance)
 │ └── CPS/CPV/CPP tracking
 │
 ├── REZ-communications (Push/WhatsApp/Email)
 │ └── Per-message pricing
 │
 └── REZ-gamification (Rewards)
     └── Coin economics
```

---

## 9. VENDOR PRICING INPUT

Vendors set:
- Minimum acceptable price (floor)
- Monthly rent for DOOH
- Available time slots
- Restrictions

AI only optimizes above floor.

---

## 10. ADVERTISER BIDDING

Advertisers set:
- Total budget
- Goal (awareness/clicks/conversions)
- Target audience
- Duration

AI allocates across:
- Digital ads
- Push notifications
- WhatsApp
- DOOH screens
- QR campaigns
- Offline placements

---

## SUMMARY

| Ad Type | Pricing Model | Dynamic? |
|---------|--------------|----------|
| In-App Banner | CPM/CPC/CPA | YES |
| In-App Search | CPM/CPC/CPA | YES |
| Push | Per user | YES |
| WhatsApp | Per message | YES |
| Email | Per email | YES |
| DOOH | Daily rate | YES |
| Offline | Vendor base + AI | PARTIAL |
| QR | CPS/CPV/CPP | YES |

**All pricing is AI-driven dynamic pricing with minimum floors.**

---

*Built on: REZ-ads-service, REZ-pricing-engine, REZ-economic-engine, adsqr*
