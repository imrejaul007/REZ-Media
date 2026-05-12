# REZ Pricing Brain

AI-Powered Dynamic Pricing Engine for REZ-Media

## What It Does

Like Google Ads + Uber Surge + Airbnb Smart Pricing

```
REZ Pricing Brain
 │
 ├── Demand Engine
 ├── Surge Engine
 ├── Quality Score Engine
 ├── Inventory Optimizer
 ├── Smart Budget AI
 └── Yield Maximizer
```

## Features

### 1. Price Caps (Safety Limits)

| Ad Type | Max Surge |
|---------|----------|
| In-app Banner | 5x |
| Search | 6x |
| Push | 4x |
| WhatsApp | 3x |
| Email | 2x |
| DOOH | 8x |
| QR | 5x |

### 2. Quality Score

Like Google Ads - Better ads = Lower effective CPC

| Factor | Weight |
|--------|--------|
| CTR | 25% |
| Conversion rate | 25% |
| QR engagement | 15% |
| User feedback | 10% |
| Ad relevance | 15% |
| Landing page | 10% |

### 3. Minimum Campaign Spend

| Type | Minimum |
|------|---------|
| In-app ads | ₹500 |
| Push | ₹300 |
| WhatsApp | ₹1,000 |
| DOOH | ₹3,000 |
| Offline | ₹5,000 |

### 4. AI Confidence Score

New inventory with no data = Lower surge pricing

### 5. Inventory Liquidation

Unsold DOOH inventory gets automatic discounts:
- < 1 hour to slot: 50% off
- < 4 hours: 30% off
- < 24 hours: 15% off

### 6. Auction + Reserved Modes

**Auction Mode:** Dynamic bidding (feed, search, banners)
**Reserved Mode:** Fixed booking (DOOH, premium placements)

### 7. Performance Guarantees

| Tier | Guarantee |
|------|----------|
| Basic | Impressions |
| Smart | CTR optimization |
| Premium | Conversion optimization |
| Enterprise | Minimum footfall |

### 8. Category Multipliers

| Category | Multiplier |
|----------|-----------|
| Luxury | 2.5x |
| Real Estate | 3.0x |
| Healthcare | 2.0x |
| Events | 1.8x |
| Restaurant | 1.0x |

### 9. Weather + Event Multipliers

- Rainy day: Food delivery ads surge, mall ads drop
- IPL match nearby: Restaurant screens surge
- Concert nearby: Hotel ads surge

### 10. Smart Budget Allocation

AI automatically distributes budget across channels:

```json
Input: { budget: 50000, goal: "lunch_traffic" }
Output: {
  push: 10000,
  dooh: 15000,
  qr: 5000,
  feed: 12000,
  whatsapp: 8000
}
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/price` | POST | Calculate dynamic price |
| `/api/price/liquidation` | POST | Get liquidation price |
| `/api/price/allocate` | POST | Smart budget allocation |
| `/api/price/validate` | POST | Validate minimum spend |
| `/api/price/caps` | GET | Get price caps |

## Example Request

```json
POST /api/price
{
  "adType": "dooh",
  "placement": "mall_led_screen",
  "location": { "city": "Mumbai", "tier": "tier1" },
  "targetAudience": { "segment": "young_professionals", "income": "high" },
  "scheduledTime": { "start": "2026-05-15T20:00:00Z" },
  "budget": 50000,
  "goalType": "footfall",
  "vendorMinimumPrice": 800,
  "campaignMode": "auction",
  "performanceTier": "premium"
}
```

## Example Response

```json
{
  "success": true,
  "data": {
    "finalPrice": 1250,
    "unit": "CPV",
    "basePrice": 200,
    "maxCap": 1600,
    "floorPrice": 800,
    "qualityScore": 1.2,
    "effectivePrice": 1041.67,
    "confidenceScore": 0.85,
    "multipliers": {
      "demand": 1.5,
      "competition": 1.4,
      "peakTime": 2.5,
      "seasonal": 1.0,
      "location": 2.5,
      "category": 1.0
    },
    "recommendedBid": 1437.50,
    "estimatedResults": {
      "reach": 25000,
      "clicks": 500,
      "conversions": 40
    }
  }
}
```

## Architecture

```
REZ Pricing Brain
 │
 ├── Multipliers Engine
 │ ├── Demand
 │ ├── Competition
 │ ├── Peak Time
 │ ├── Day of Week
 │ ├── Seasonal
 │ ├── Location
 │ ├── Category
 │ ├── Weather
 │ └── Events
 │
 ├── Quality Score Engine
 │
 ├── Confidence Calculator
 │
 ├── Inventory Optimizer
 │ └── Liquidation Logic
 │
 └── Smart Budget AI
```

## Deployment

```bash
npm install
npm run build
npm start
```

Or connect to Render for auto-deploy.
