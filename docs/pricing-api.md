# Pricing API Documentation

The ReZ Pricing Engine uses AI-powered algorithms to calculate dynamic prices for ad placements, considering multiple real-time factors.

## Overview

The pricing engine is inspired by:
- **Google Ads Auction**: Real-time bidding with quality scores
- **Uber Surge Pricing**: Dynamic multipliers based on demand
- **Airbnb Smart Pricing**: Optimization for inventory utilization

## Base Pricing

### Pricing by Ad Type

| Ad Type | CPM | CPC | CPA | CPV | CPS |
|---------|-----|-----|-----|-----|-----|
| Banner | 150 | 5 | 50 | 8 | 3 |
| Feed | 100 | 3 | 40 | 6 | 2 |
| Search | 250 | 12 | 80 | 15 | 5 |
| Store | 300 | 15 | 100 | 20 | 8 |
| Push | 30 | 1 | 15 | 3 | 1 |
| WhatsApp | 80 | 3 | 25 | 5 | 2 |
| Email | 20 | 0.5 | 10 | 2 | 0.5 |
| DOOH | 200 | 8 | 60 | 12 | 5 |
| Offline | 50 | 2 | 30 | 5 | 2 |
| QR | 40 | 2 | 20 | 4 | 3 |

**Units:**
- **CPM**: Cost per 1,000 impressions
- **CPC**: Cost per click
- **CPA**: Cost per acquisition/conversion
- **CPV**: Cost per visit (footfall)
- **CPS**: Cost per scan (QR)

## Endpoints

### POST /price - Calculate Dynamic Price

Calculate the dynamic price for an ad placement.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/price \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adType": "dooh",
    "placement": "mall_led_screen",
    "location": {
      "city": "Mumbai",
      "tier": "tier1"
    },
    "targetAudience": {
      "segment": "young_professionals",
      "income": "high",
      "category": "retail"
    },
    "scheduledTime": {
      "start": "2026-05-15T20:00:00Z",
      "end": "2026-05-15T22:00:00Z"
    },
    "budget": 50000,
    "goalType": "footfall",
    "campaignMode": "auction",
    "performanceTier": "premium"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "finalPrice": 285.75,
    "unit": "CPV",
    "basePrice": 12,
    "maxCap": 96,
    "floorPrice": 3.6,
    "qualityScore": 1.0,
    "effectivePrice": 285.75,
    "confidenceScore": 0.7,
    "multipliers": {
      "demand": 1.5,
      "competition": 1.4,
      "peakTime": 2.5,
      "dayOfWeek": 1.3,
      "seasonal": 1.0,
      "location": 2.5,
      "category": 1.2,
      "weather": 1.0,
      "event": 1.0,
      "quality": 1.0,
      "confidence": 1.0
    },
    "breakdown": [
      { "component": "Base Price", "multiplier": 1.0, "contribution": 12 },
      { "component": "Demand", "multiplier": 1.5, "contribution": 6 },
      { "component": "Competition", "multiplier": 1.4, "contribution": 4.8 },
      { "component": "Peak Time", "multiplier": 2.5, "contribution": 18 },
      { "component": "Day of Week", "multiplier": 1.3, "contribution": 3.6 },
      { "component": "Location", "multiplier": 2.5, "contribution": 18 },
      { "component": "Category", "multiplier": 1.2, "contribution": 2.4 }
    ],
    "auctionDetails": {
      "mode": "auction",
      "competingAds": 23,
      "yourRank": 5,
      "winningBid": 278.50,
      "reservePrice": 171.45
    },
    "performanceGuarantee": {
      "tier": "premium",
      "guarantee": "Conversion optimization",
      "estimatedClicks": 350,
      "estimatedConversions": 28,
      "minimumConversions": 17
    },
    "recommendedBid": 328.61,
    "estimatedResults": {
      "reach": 17500,
      "clicks": 175,
      "conversions": 14,
      "visits": 122,
      "scans": 0
    },
    "validUntil": "2026-05-13T11:00:00Z"
  }
}
```

### POST /price/liquidation - Liquidation Pricing

Calculate liquidation price for unsold inventory.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/price/liquidation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originalPrice": 5000,
    "hoursUntilSlot": 4,
    "percentSold": 35
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "originalPrice": 5000,
    "liquidationPrice": 3500,
    "discountPercent": "30.0",
    "reason": "Below target sell-through"
  }
}
```

### POST /price/allocate - Smart Budget Allocation

Get AI-recommended budget allocation across channels.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/price/allocate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "totalBudget": 50000,
    "goal": "conversions",
    "location": "Mumbai"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "channel": "whatsapp",
        "amount": 15000,
        "percentage": 30,
        "estimatedReach": 10000,
        "estimatedClicks": 500,
        "estimatedConversions": 75,
        "cpm": 80
      },
      {
        "channel": "search",
        "amount": 12500,
        "percentage": 25,
        "estimatedReach": 25000,
        "estimatedClicks": 625,
        "estimatedConversions": 50,
        "cpm": 250
      },
      {
        "channel": "feed",
        "amount": 10000,
        "percentage": 20,
        "estimatedReach": 20000,
        "estimatedClicks": 400,
        "estimatedConversions": 30,
        "cpm": 100
      },
      {
        "channel": "push",
        "amount": 7500,
        "percentage": 15,
        "estimatedReach": 50000,
        "estimatedClicks": 250,
        "estimatedConversions": 15,
        "cpm": 30
      },
      {
        "channel": "email",
        "amount": 5000,
        "percentage": 10,
        "estimatedReach": 10000,
        "estimatedClicks": 100,
        "estimatedConversions": 10,
        "cpm": 20
      }
    ]
  }
}
```

### POST /price/validate - Validate Minimum Spend

Check if budget meets minimum spend requirements.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/price/validate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adType": "whatsapp",
    "budget": 1500
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "minimum": 1000,
    "message": "Budget meets minimum requirements"
  }
}
```

### GET /price/caps - Get Price Caps

Retrieve maximum surge caps and minimum spend for all ad types.

**Request:**

```bash
curl -X GET https://api.rez.money/v1/price/caps \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "maxSurgeCaps": {
      "banner": "5x",
      "feed": "4x",
      "search": "6x",
      "store": "5x",
      "push": "4x",
      "whatsapp": "3x",
      "email": "2x",
      "dooh": "8x",
      "offline": "4x",
      "qr": "5x"
    },
    "minimumSpend": {
      "banner": "500",
      "feed": "500",
      "search": "500",
      "store": "500",
      "push": "300",
      "whatsapp": "1000",
      "email": "300",
      "dooh": "3000",
      "offline": "5000",
      "qr": "500"
    }
  }
}
```

## Pricing Multipliers

The pricing engine applies multiple multipliers that can affect the final price:

### 1. Demand Multiplier

Based on target audience demand:
- High income audience: 1.5x
- Medium income audience: 1.2x
- Low income audience: 1.0x

### 2. Competition Multiplier

Based on active campaigns competing for the same inventory:
- >50 active campaigns: 1.8x
- >20 active campaigns: 1.4x
- >10 active campaigns: 1.2x
- <3 active campaigns: 0.7x

### 3. Peak Time Multiplier

Based on time of day:

| Hour | Multiplier |
|------|------------|
| 6 AM | 0.6 |
| 7 AM | 0.8 |
| 8 AM | 1.2 |
| 9 AM | 1.5 |
| 10 AM | 1.8 |
| 11 AM | 2.0 |
| 12 PM | 1.8 |
| 1 PM | 1.3 |
| 6 PM | 1.8 |
| 7 PM | 2.2 |
| 8 PM | 2.5 |
| 9 PM | 2.0 |

### 4. Day of Week Multiplier

| Day | Multiplier |
|-----|------------|
| Sunday | 0.7 |
| Monday | 0.9 |
| Tuesday | 0.95 |
| Wednesday | 1.0 |
| Thursday | 1.1 |
| Friday | 1.3 |
| Saturday | 1.4 |

### 5. Seasonal Multiplier

| Period | Multiplier |
|--------|------------|
| Oct-Dec (Festivals) | 2.0 |
| Feb-Mar (Holi) | 1.5 |
| Apr-May (Summer) | 1.3 |
| Jun-Jul (Monsoon) | 0.8 |

### 6. Location Multiplier

| Tier | Multiplier |
|------|------------|
| Tier 1 | 2.5 |
| Tier 2 | 1.5 |
| Tier 3 | 1.0 |

### 7. Category Multiplier

| Category | Multiplier |
|----------|------------|
| Real Estate | 3.0 |
| Luxury | 2.5 |
| Healthcare | 2.0 |
| Events | 1.8 |
| Retail | 1.2 |
| Restaurant | 1.0 |
| Services | 1.0 |

### 8. Weather Multiplier

Weather-based adjustments (simulated in current implementation):
- Clear/Sunny: 1.0
- Cloudy: 0.95
- Rainy: Variable (increases food delivery demand)

### 9. Event Multiplier

Major events (simulated in current implementation):
- IPL Matches: Up to 1.5x
- Concerts: Up to 1.3x
- Festivals: Up to 1.8x

## Price Calculation Formula

```
Raw Price = Base Price
           * Demand Multiplier
           * Competition Multiplier
           * Peak Time Multiplier
           * Day of Week Multiplier
           * Seasonal Multiplier
           * Location Multiplier
           * Category Multiplier
           * Weather Multiplier
           * Event Multiplier

Confidence Adjusted = Raw Price * (0.5 + Confidence Score * 0.5)

Final Price = min(max(Adjusted Price, Floor Price), Max Cap)
```

## Quality Score

Quality score (1.0 - 10.0 scale) affects the effective price:

```
Effective Price = Final Price / (1 + (Quality Score - 1) * 0.2)
```

Higher quality scores (better performing ads) result in lower effective prices.

## Liquidation Discount Logic

| Hours Until Slot | Discount |
|------------------|----------|
| <1 hour | 50% |
| <4 hours | 30% |
| <24 hours | 15% |

| Inventory Sold | Additional Discount |
|----------------|---------------------|
| <25% sold | 25% |
| <50% sold | 15% |
| <75% sold | 5% |

Maximum combined discount: 70%

## Performance Tiers

| Tier | Guarantee | Minimum Conversions |
|------|-----------|-------------------|
| Basic | None | N/A |
| Smart | CTR optimization | N/A |
| Premium | Conversion optimization | 50% of estimated |
| Enterprise | Minimum footfall guarantee | 80% of estimated |

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_AD_TYPE` | Ad type not supported |
| `INVALID_GOAL_TYPE` | Goal type not supported |
| `VALIDATION_ERROR` | Request validation failed |
| `PRICING_ENGINE_ERROR` | Internal pricing engine error |

## Best Practices

### 1. Cache Pricing Responses

Pricing is valid for 15 minutes. Cache responses to reduce API calls:

```javascript
const priceCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function getCachedPrice(request) {
  const cacheKey = JSON.stringify(request);

  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const response = await api.post('/price', request);
  priceCache.set(cacheKey, {
    data: response.data,
    expiresAt: Date.now() + CACHE_TTL
  });

  return response.data;
}
```

### 2. Use Budget Allocation for Multi-Channel

When running multi-channel campaigns, use `/price/allocate` to get optimal distribution:

```javascript
const allocation = await api.post('/price/allocate', {
  totalBudget: 50000,
  goal: 'conversions',
  location: 'Mumbai'
});

// Create campaigns with recommended amounts
for (const channel of allocation.allocations) {
  await api.post('/campaigns', {
    name: `${channel.channel} Campaign`,
    adType: channel.channel,
    budget: channel.amount,
    goalType: 'conversions'
  });
}
```

### 3. Set Up Alerts for Price Spikes

Monitor prices during high-demand periods:

```javascript
const BASE_THRESHOLD = 2.0; // Alert if price > 2x base

function checkPriceAlert(pricing) {
  const priceRatio = pricing.finalPrice / pricing.basePrice;

  if (priceRatio > BASE_THRESHOLD) {
    sendAlert({
      type: 'PRICE_SPIKE',
      message: `Price is ${priceRatio}x base price`,
      details: pricing
    });
  }
}
```
