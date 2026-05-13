# Getting Started with ReZ API

This guide will help you get up and running with the ReZ Commerce Media Platform API.

## Prerequisites

Before you begin, ensure you have:

- A ReZ merchant account ([sign up](https://rez.money/merchants))
- Your API credentials (available in the merchant dashboard)
- A compatible HTTP client (curl, Postman, or your preferred SDK)

## Step 1: Obtain API Credentials

1. Log in to the [ReZ Merchant Dashboard](https://dashboard.rez.money)
2. Navigate to **Settings > API Keys**
3. Click **Create New API Key**
4. Copy and securely store your:
   - API Key ID
   - API Secret (shown only once)

## Step 2: Authenticate

All API requests require authentication using a Bearer token.

### Login Request

```bash
curl -X POST https://api.rez.money/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@example.com",
    "password": "yourpassword123"
  }'
```

### Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "merchant": {
    "id": "merchant_abc123",
    "name": "Example Restaurant",
    "email": "merchant@example.com",
    "businessType": "restaurant",
    "tier": "standard"
  }
}
```

### Using the Token

Include the access token in subsequent requests:

```bash
curl -X GET https://api.rez.money/v1/campaigns \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Step 3: Check Wallet Balance

Before creating campaigns, ensure you have sufficient wallet balance.

```bash
curl -X GET "https://api.rez.money/v1/wallet/balance?merchantId=merchant_abc123" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response:**

```json
{
  "merchantId": "merchant_abc123",
  "balance": 50000.00,
  "available": 35000.00,
  "reserved": 15000.00,
  "pending": 0.00,
  "currency": "INR",
  "lastUpdated": "2026-05-13T10:30:00Z"
}
```

## Step 4: Calculate Campaign Price

Use the pricing engine to estimate campaign costs before creating a campaign.

```bash
curl -X POST https://api.rez.money/v1/price \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
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
    "floorPrice": 12,
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
      { "component": "Competition", "multiplier": 1.4, "contribution": 4.8 }
    ],
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

## Step 5: Create a Campaign

With pricing information, create your campaign:

```bash
curl -X POST https://api.rez.money/v1/campaigns \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Sale Promotion",
    "adType": "whatsapp",
    "budget": 10000,
    "duration": 7,
    "goalType": "conversions",
    "location": {
      "city": "Bangalore",
      "tier": "tier1"
    },
    "targeting": {
      "segment": "food_enthusiasts",
      "income": "medium",
      "category": "restaurant"
    },
    "creative": {
      "headline": "Get 20% Off Your Order!",
      "description": "Use code SUMMER20 at checkout",
      "ctaText": "Order Now"
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "camp_xyz789",
    "merchantId": "merchant_abc123",
    "name": "Summer Sale Promotion",
    "status": "draft",
    "adType": "whatsapp",
    "budget": 10000.00,
    "spent": 0.00,
    "startDate": null,
    "endDate": "2026-05-20T10:30:00Z",
    "createdAt": "2026-05-13T10:30:00Z",
    "updatedAt": "2026-05-13T10:30:00Z"
  }
}
```

## Step 6: Monitor Campaign

Check campaign status and performance:

```bash
# Get campaign details
curl -X GET https://api.rez.money/v1/campaigns/camp_xyz789 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get campaign statistics
curl -X GET "https://api.rez.money/v1/campaigns/camp_xyz789/stats" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Common Use Cases

### Use Case 1: Create Multi-Channel Campaign

Create a campaign spanning WhatsApp and DOOH:

```bash
curl -X POST https://api.rez.money/v1/campaigns/unified \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_abc123",
    "name": "Grand Opening Campaign",
    "types": ["whatsapp", "dooh"],
    "channels": ["broadcast", "dooh"],
    "budget": 50000,
    "duration": 14,
    "location": "Delhi",
    "targeting": {
      "segment": "families",
      "income": "medium"
    }
  }'
```

### Use Case 2: Budget Allocation

Get AI-recommended budget distribution:

```bash
curl -X POST https://api.rez.money/v1/price/allocate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "totalBudget": 25000,
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
      { "channel": "whatsapp", "amount": 7500, "percentage": 30, "estimatedReach": 5000 },
      { "channel": "search", "amount": 6250, "percentage": 25, "estimatedReach": 12500 },
      { "channel": "feed", "amount": 5000, "percentage": 20, "estimatedReach": 10000 },
      { "channel": "push", "amount": 3750, "percentage": 15, "estimatedReach": 25000 },
      { "channel": "email", "amount": 2500, "percentage": 10, "estimatedReach": 5000 }
    ]
  }
}
```

### Use Case 3: Liquidation Pricing

For unsold inventory, calculate liquidation prices:

```bash
curl -X POST https://api.rez.money/v1/price/liquidation \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "originalPrice": 5000,
    "hoursUntilSlot": 4,
    "percentSold": 35
  }'
```

## Next Steps

- Read the [Authentication Guide](authentication.md) for detailed auth information
- Explore the [Pricing API](pricing-api.md) documentation
- Learn about [Campaign Management](campaigns-api.md)
- Set up [Webhooks](webhooks.md) for real-time notifications
- Check [Examples](examples/) for more code samples
