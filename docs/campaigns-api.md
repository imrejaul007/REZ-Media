# Campaigns API Documentation

The Campaigns API enables you to create, manage, and monitor advertising campaigns across all supported channels.

## Overview

A **Campaign** represents a single advertising initiative with:
- Defined budget and duration
- Specific targeting parameters
- Associated creative assets
- Tracking and analytics

## Campaign Lifecycle

```
Draft -> Active -> Completed
   |         |
   v         v
Cancelled  Paused
              |
              v
           Active
```

## Endpoints

### GET /campaigns - List Campaigns

Retrieve a paginated list of campaigns.

**Request:**

```bash
curl -X GET "https://api.rez.money/v1/campaigns?page=1&limit=20&status=active" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default: 1) |
| limit | integer | Items per page (default: 20, max: 100) |
| status | string | Filter by status |
| type | string | Filter by ad type |
| startDate | string | Filter by start date (ISO 8601) |
| endDate | string | Filter by end date (ISO 8601) |

**Response:**

```json
{
  "data": [
    {
      "id": "camp_abc123",
      "merchantId": "merchant_xyz789",
      "name": "Summer Sale 2026",
      "status": "active",
      "adType": "whatsapp",
      "budget": 25000.00,
      "spent": 8500.00,
      "startDate": "2026-05-01T00:00:00Z",
      "endDate": "2026-05-31T23:59:59Z",
      "createdAt": "2026-04-28T10:30:00Z",
      "updatedAt": "2026-05-13T08:00:00Z"
    },
    {
      "id": "camp_def456",
      "merchantId": "merchant_xyz789",
      "name": "DOOH Mall Promo",
      "status": "paused",
      "adType": "dooh",
      "budget": 50000.00,
      "spent": 12000.00,
      "startDate": "2026-05-05T09:00:00Z",
      "endDate": "2026-05-12T21:00:00Z",
      "createdAt": "2026-05-03T14:00:00Z",
      "updatedAt": "2026-05-10T16:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

### POST /campaigns - Create Campaign

Create a new advertising campaign.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/campaigns \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekend Special Offer",
    "adType": "whatsapp",
    "budget": 15000,
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
      "headline": "20% Off This Weekend!",
      "description": "Use code WEEKEND20 at checkout",
      "ctaText": "Order Now"
    },
    "campaignMode": "auction"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "camp_new789",
    "merchantId": "merchant_xyz789",
    "name": "Weekend Special Offer",
    "status": "draft",
    "adType": "whatsapp",
    "budget": 15000.00,
    "spent": 0.00,
    "startDate": null,
    "endDate": "2026-05-20T23:59:59Z",
    "createdAt": "2026-05-13T10:30:00Z",
    "updatedAt": "2026-05-13T10:30:00Z"
  }
}
```

### POST /campaigns/unified - Create Unified Campaign

Create a campaign spanning multiple channels with automatic wallet reservation.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/campaigns/unified \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_xyz789",
    "name": "Grand Opening - Multi-Channel",
    "types": ["whatsapp", "dooh", "push"],
    "channels": ["broadcast", "dooh", "notification"],
    "budget": 75000,
    "duration": 14,
    "location": "Delhi",
    "targeting": {
      "segment": "families",
      "income": "medium"
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "campaignId": "camp_multi123",
    "reservationId": "res_abc456",
    "totalEstimate": 62500,
    "walletRequired": 75000,
    "channelPricing": [
      {
        "type": "whatsapp",
        "estimatedPrice": 1.25,
        "unit": "CPA",
        "reach": 50000
      },
      {
        "type": "dooh",
        "estimatedPrice": 450.00,
        "unit": "CPV",
        "reach": 5000
      },
      {
        "type": "push",
        "estimatedPrice": 0.30,
        "unit": "CPA",
        "reach": 100000
      }
    ],
    "message": "Funds reserved from merchant wallet"
  }
}
```

### GET /campaigns/{id} - Get Campaign

Retrieve details of a specific campaign.

**Request:**

```bash
curl -X GET https://api.rez.money/v1/campaigns/camp_abc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "camp_abc123",
    "merchantId": "merchant_xyz789",
    "name": "Summer Sale 2026",
    "status": "active",
    "adType": "whatsapp",
    "budget": 25000.00,
    "spent": 8500.00,
    "startDate": "2026-05-01T00:00:00Z",
    "endDate": "2026-05-31T23:59:59Z",
    "createdAt": "2026-04-28T10:30:00Z",
    "updatedAt": "2026-05-13T08:00:00Z"
  }
}
```

### PATCH /campaigns/{id} - Update Campaign

Update campaign settings. Only certain fields can be modified based on campaign status.

**Request:**

```bash
curl -X PATCH https://api.rez.money/v1/campaigns/camp_abc123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Sale 2026 - Extended",
    "budget": 30000,
    "endDate": "2026-06-15T23:59:59Z"
  }'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "camp_abc123",
    "merchantId": "merchant_xyz789",
    "name": "Summer Sale 2026 - Extended",
    "status": "active",
    "adType": "whatsapp",
    "budget": 30000.00,
    "spent": 8500.00,
    "startDate": "2026-05-01T00:00:00Z",
    "endDate": "2026-06-15T23:59:59Z",
    "createdAt": "2026-04-28T10:30:00Z",
    "updatedAt": "2026-05-13T11:00:00Z"
  }
}
```

### DELETE /campaigns/{id} - Delete Campaign

Delete a campaign. Only draft campaigns can be deleted.

**Request:**

```bash
curl -X DELETE https://api.rez.money/v1/campaigns/camp_draft123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:** `204 No Content`

### GET /campaigns/{id}/status - Get Campaign Status

Get detailed campaign status including sub-campaigns and wallet usage.

**Request:**

```bash
curl -X GET https://api.rez.money/v1/campaigns/camp_multi123/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "camp_multi123",
    "status": "active",
    "subCampaigns": [
      {
        "type": "whatsapp",
        "status": "active",
        "spent": 3500
      },
      {
        "type": "dooh",
        "status": "active",
        "spent": 8000
      },
      {
        "type": "push",
        "status": "active",
        "spent": 500
      }
    ],
    "walletUsage": {
      "reserved": 75000,
      "spent": 12000,
      "remaining": 63000
    }
  }
}
```

### POST /campaigns/{id}/pause - Pause Campaign

Pause an active campaign. Billing stops but the campaign can be resumed.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/campaigns/camp_abc123/pause \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "camp_abc123",
    "status": "paused"
  }
}
```

### POST /campaigns/{id}/resume - Resume Campaign

Resume a paused campaign.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/campaigns/camp_abc123/resume \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "camp_abc123",
    "status": "active"
  }
}
```

### POST /campaigns/{id}/cancel - Cancel Campaign

Cancel a campaign and release unused wallet reservation.

**Request:**

```bash
curl -X POST https://api.rez.money/v1/campaigns/camp_abc123/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "camp_abc123",
    "status": "cancelled",
    "refundedAmount": 16500.00
  }
}
```

### GET /campaigns/{id}/stats - Get Campaign Statistics

Get detailed performance statistics for a campaign.

**Request:**

```bash
curl -X GET "https://api.rez.money/v1/campaigns/camp_abc123/stats?startDate=2026-05-01&endDate=2026-05-13&granularity=day" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "campaignId": "camp_abc123",
    "summary": {
      "impressions": 125000,
      "clicks": 3750,
      "conversions": 150,
      "spend": 8500.00,
      "ctr": 3.0,
      "cpc": 2.27,
      "cpa": 56.67
    },
    "timeSeries": [
      {
        "date": "2026-05-01",
        "impressions": 15000,
        "clicks": 450,
        "conversions": 18,
        "spend": 1020.00
      },
      {
        "date": "2026-05-02",
        "impressions": 18000,
        "clicks": 540,
        "conversions": 22,
        "spend": 1224.00
      }
    ]
  }
}
```

## Ad Types

| Type | Description | Minimum Budget |
|------|-------------|----------------|
| banner | Home banner ads | 500 |
| feed | Explore feed ads | 500 |
| search | Search result ads | 500 |
| store | Product page ads | 500 |
| push | Push notifications | 300 |
| whatsapp | WhatsApp messages | 1,000 |
| email | Email campaigns | 300 |
| dooh | Digital out-of-home | 3,000 |
| offline | Static offline ads | 5,000 |
| qr | QR code scans | 500 |

## Campaign Statuses

| Status | Description | Can Transition To |
|--------|-------------|-------------------|
| draft | Campaign created but not activated | active, cancelled |
| active | Campaign is running | paused, completed, cancelled |
| paused | Campaign temporarily stopped | active, cancelled |
| completed | Campaign ended naturally | - |
| cancelled | Campaign manually cancelled | - |

## Error Codes

| Code | Description |
|------|-------------|
| `CAMPAIGN_NOT_FOUND` | Campaign ID does not exist |
| `INVALID_STATUS_TRANSITION` | Cannot transition from current status |
| `BUDGET_TOO_LOW` | Budget below minimum for ad type |
| `INSUFFICIENT_WALLET_BALANCE` | Not enough funds in wallet |
| `CAMPAIGN_IN_USE` | Cannot delete campaign with active reservations |
| `VALIDATION_ERROR` | Request validation failed |

## Examples

### Example 1: Create a DOOH Campaign

```bash
curl -X POST https://api.rez.money/v1/campaigns \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mall Display - Summer Collection",
    "adType": "dooh",
    "placement": "mall_led_screen",
    "budget": 25000,
    "duration": 7,
    "goalType": "footfall",
    "location": {
      "city": "Mumbai",
      "area": "Phoenix Mall",
      "tier": "tier1"
    },
    "targeting": {
      "segment": "fashion_conscious",
      "income": "high"
    },
    "creative": {
      "headline": "Summer Collection is Here!",
      "description": "Up to 40% off on select styles",
      "ctaText": "Visit Store"
    }
  }'
```

### Example 2: Create a QR Campaign

```bash
curl -X POST https://api.rez.money/v1/campaigns \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Table Tent QR - New Menu",
    "adType": "qr",
    "budget": 5000,
    "duration": 30,
    "goalType": "qr_scans",
    "location": {
      "city": "Bangalore",
      "tier": "tier1"
    },
    "targeting": {
      "segment": "food_enthusiasts",
      "category": "restaurant"
    },
    "creative": {
      "headline": "Scan for Secret Menu!",
      "description": "Get exclusive dishes available only online",
      "ctaText": "Scan Now"
    }
  }'
```

### Example 3: Pause and Resume Campaign

```javascript
async function manageCampaign(campaignId, action) {
  const endpoints = {
    pause: `POST /campaigns/${campaignId}/pause`,
    resume: `POST /campaigns/${campaignId}/resume`,
    cancel: `POST /campaigns/${campaignId}/cancel`
  };

  const response = await api(endpoints[action]);
  return response.data;
}

// Usage
await manageCampaign('camp_abc123', 'pause');
// Later...
await manageCampaign('camp_abc123', 'resume');
```

### Example 4: Monitor Campaign Performance

```javascript
async function monitorCampaign(campaignId) {
  const [campaign, stats, status] = await Promise.all([
    api.get(`/campaigns/${campaignId}`),
    api.get(`/campaigns/${campaignId}/stats`),
    api.get(`/campaigns/${campaignId}/status`)
  ]);

  return {
    ...campaign.data,
    metrics: stats.data,
    wallet: status.data.walletUsage
  };
}

// Check if campaign needs attention
const monitor = await monitorCampaign('camp_abc123');

if (monitor.wallet.remaining / monitor.budget < 0.2) {
  console.log('Warning: Budget running low!');
}

if (monitor.status === 'active' && monitor.metrics.ctr < 1) {
  console.log('Warning: Low CTR - consider updating creative');
}
```

### Example 5: Batch Campaign Operations

```javascript
async function pauseAllActiveCampaigns() {
  const campaigns = await api.get('/campaigns?status=active');

  const results = await Promise.allSettled(
    campaigns.data.map(c => api.post(`/campaigns/${c.id}/pause`))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { succeeded, failed };
}
```
