# AdBazaar Backend API Documentation

## Base URL
```
http://localhost:4085
```

## Authentication
All API requests require `X-Internal-Token` header.

---

## Screen Owner Endpoints

### Register Screen Owner
```bash
POST /api/owners/register
Content-Type: application/json

{
  "userId": "user-123",
  "businessName": "Hotel Mumbai",
  "gstin": "27AABCU9603R1ZM"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ownerId": "owner-abc12345",
    "businessName": "Hotel Mumbai",
    "stats": {
      "totalScreens": 0,
      "activeScreens": 0,
      "totalEarnings": 0
    }
  }
}
```

### Add Screen
```bash
POST /api/owners/:id/screens
Content-Type: application/json

{
  "name": "Lobby TV",
  "screenType": "hotel_tv",
  "address": {
    "street": "123 MG Road",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pincode": "400001"
  },
  "coordinates": { "lat": 19.076, "lng": 72.8777 },
  "dimensions": { "width": 55, "height": 32, "unit": "inches" },
  "floorPrice": { "cpm": 200, "currency": "INR", "minCampaignBudget": 10000 }
}
```

### Update Screen Price
```bash
PATCH /api/owners/:id/screens/:screenId/price
Content-Type: application/json

{
  "cpm": 250,
  "currency": "INR",
  "minCampaignBudget": 12000
}
```

---

## Advertiser Endpoints

### Register Advertiser
```bash
POST /api/advertisers/register
Content-Type: application/json

{
  "userId": "user-456",
  "companyName": "Brand XYZ",
  "gstin": "27AABCU9603R1ZM",
  "industry": "food"
}
```

### Create Campaign
```bash
POST /api/campaigns
Content-Type: application/json

{
  "advertiserId": "adv-abc123",
  "name": "Summer Sale Campaign",
  "budget": { "total": 50000, "daily": 5000 },
  "objective": "conversions",
  "targeting": {
    "screenTypes": ["hotel_tv", "mall_kiosk"],
    "locations": ["Mumbai", "Delhi"],
    "demographics": { "income": ["high", "medium"] }
  },
  "schedule": { "startDate": "2026-06-01", "endDate": "2026-06-30" }
}
```

---

## Marketplace Endpoints

### Search Screens
```bash
GET /api/marketplace/screens?screenTypes=hotel_tv,mall_kiosk&cities=Mumbai,Delhi&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "listings": [
      {
        "screen": { "screenId": "screen-123", "name": "Lobby TV" },
        "owner": { "name": "Hotel Mumbai", "rating": 4.5 },
        "pricing": { "currentCPM": 250, "originalCPM": 200 },
        "availability": { "available": true }
      }
    ],
    "total": 50
  }
}
```

### Get Pricing Quote
```bash
POST /api/marketplace/quote
Content-Type: application/json

{
  "campaignId": "camp-123",
  "screenId": "screen-456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "screenId": "screen-456",
    "baseCPM": 200,
    "dynamicCPM": 450,
    "adjustments": {
      "captivity": 1.5,
      "cityTier": 2.5,
      "timeSlot": 1.2
    },
    "estimatedImpressions": 111111,
    "ownerPayout": 315,
    "platformFee": 135,
    "total": 585
  }
}
```

---

## Reference Endpoints

### Get Screen Types
```bash
GET /api/reference/screen-types
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "type": "hotel_tv", "captivity": "captive_private", "description": "Hotel Smart TV", "baseCPM": 200 },
    { "type": "cab_screen", "captivity": "captive_private", "description": "Cab/Taxi Screen", "baseCPM": 150 },
    { "type": "mall_kiosk", "captivity": "semi_captive", "description": "Mall Kiosk", "baseCPM": 80 }
  ]
}
```

---

## Error Responses

| Status | Error |
|--------|-------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Server Error |

```json
{
  "success": false,
  "error": "Screen not found"
}
```
