# REZ Marketing Platform API Documentation

**Version:** 1.0.0
**Base URL:** `https://api.rez.money/api/marketing`
**Service Port:** 4000

---

## Table of Contents

1. [Authentication](#authentication)
2. [System Routes](#system-routes)
3. [Campaigns](#campaigns)
4. [Broadcasts](#broadcasts)
5. [Audience](#audience)
6. [Analytics](#analytics)
7. [Growth Analytics](#growth-analytics)
8. [Keywords](#keywords)
9. [Webhooks](#webhooks)
10. [AdBazaar](#adbazaar)
11. [Vouchers](#vouchers)
12. [Merchant Growth](#merchant-growth)
13. [Karma Campaigns](#karma-campaigns)
14. [Interaction Tracking](#interaction-tracking)
15. [Influencer](#influencer)
16. [Offline Ads](#offline-ads)
17. [Triggers](#triggers)
18. [Dashboard](#dashboard)
19. [Hyperlocal](#hyperlocal)
20. [Rendez](#rendez)
21. [Subscriptions](#subscriptions)
22. [Loyalty Integration](#loyalty-integration)

---

## Authentication

All API routes (except public endpoints) require authentication via internal service tokens.

### Headers

| Header | Description |
|--------|-------------|
| `x-internal-token` | Internal service token (preferred) |
| `x-internal-key` | Legacy internal key header |
| `x-internal-service` | Service name for token resolution (required with scoped tokens) |
| `Authorization` | Bearer JWT token for consumer routes |

### Public Endpoints (No Auth Required)

- `GET /health` - Health check
- `GET /healthz` - Kubernetes health check
- `GET /metrics` - Prometheus metrics
- `GET /webhooks/whatsapp` - WhatsApp webhook verification
- `GET /webhooks/track/open` - Email tracking pixel
- `GET /keywords/auction` - Keyword auction (consumer-facing ad serving)

### Auth Middleware Types

| Middleware | Description |
|------------|-------------|
| `verifyMerchant` | Requires merchant authentication (JWT with merchantId) |
| `verifyConsumer` | Requires consumer authentication (JWT with userId) |
| `verifyInternal` | Requires internal service token |

---

## System Routes

### Health Check

| Property | Value |
|----------|-------|
| **Endpoint** | `/health` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "rez-marketing-service",
  "checks": { "db": "ok", "redis": "ok" },
  "uptime": 12345,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response (503 Degraded):**
```json
{
  "status": "degraded",
  "service": "rez-marketing-service",
  "checks": { "db": "error", "redis": "ok" },
  "uptime": 12345,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Kubernetes Health Check

| Property | Value |
|----------|-------|
| **Endpoint** | `/healthz` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "rez-marketing-service"
}
```

---

### Prometheus Metrics

| Property | Value |
|----------|-------|
| **Endpoint** | `/metrics` |
| **Method** | GET |
| **Auth** | Internal token required |

**Response:** Prometheus text format metrics

---

## Campaigns

Base path: `/campaigns`

### List Campaigns

| Property | Value |
|----------|-------|
| **Endpoint** | `/campaigns` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `status` | string | No | Filter by status: `draft`, `scheduled`, `sending`, `sent`, `cancelled` |
| `limit` | number | No | Results per page (default: 20, max: 100) |
| `page` | number | No | Page number (default: 1) |

**Response (200 OK):**
```json
{
  "campaigns": [
    {
      "_id": "campaign_id",
      "merchantId": "merchant_id",
      "name": "Campaign Name",
      "objective": "awareness",
      "channel": "whatsapp",
      "message": "Your message here",
      "status": "draft",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

### Get Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/campaigns/:id` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Campaign MongoDB ObjectId |

**Response (200 OK):** Full campaign document
**Response (400):** Invalid id
**Response (404):** Campaign not found

---

### Create Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/campaigns` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `name` | string | Yes | Campaign name (max 200 chars) |
| `objective` | string | Yes | Campaign objective |
| `channel` | string | Yes | One of: `push`, `sms`, `email`, `whatsapp`, `in_app` |
| `message` | string | Yes | Message content (max 5000 chars) |
| `audience` | object | Yes | Audience filter criteria |
| `templateName` | string | No | Template name to use |
| `imageUrl` | string | No | Campaign image URL |
| `ctaUrl` | string | No | Call-to-action URL (must be valid URL) |
| `ctaText` | string | No | Call-to-action button text |
| `scheduledAt` | string | No | ISO date for scheduled dispatch |
| `createdBy` | string | No | Creator identifier |

**Rate Limit:** 20 campaigns per merchant per hour

**Response (201 Created):**
```json
{
  "_id": "campaign_id",
  "merchantId": "merchant_id",
  "name": "Campaign Name",
  "status": "draft",
  "audience": { "estimatedCount": 1500 },
  "createdAt": "2024-01-15T10:00:00.000Z"
}
```

**Response (400):** Validation error
**Response (429):** Rate limit exceeded

---

### Update Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/campaigns/:id` |
| **Method** | PATCH |
| **Auth** | `verifyMerchant` |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Campaign MongoDB ObjectId |

**Updatable Fields:** `name`, `message`, `audience`, `channel`, `objective`, `scheduledAt`, `templateName`, `imageUrl`, `ctaUrl`, `ctaText`

**Status Transition Rules:**

| From Status | Allowed To |
|------------|------------|
| `draft` | `scheduled`, `cancelled` |
| `scheduled` | `sending`, `cancelled` |
| `sending` | `sent` |
| `sent` | (none) |
| `cancelled` | (none) |

**Protected Fields:** Cannot edit `message` or `ctaUrl` when status is `sending` or `sent`

**Response (200 OK):** Updated campaign document
**Response (400):** Invalid state transition or protected field edit
**Response (404):** Campaign not found

---

### Launch Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/campaigns/:id/launch` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Behavior:**
- Dispatches campaign immediately via BullMQ
- Validates campaign is in `draft` or `scheduled` status
- Acquires distributed lock to prevent double-send
- Sends push notifications to targeted users

**Response (200 OK):**
```json
{
  "queued": true,
  "campaignId": "campaign_id",
  "jobId": "job_id"
}
```

**Response (409):** Campaign launch already in progress

---

### Cancel Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/campaigns/:id/cancel` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Behavior:** Cancels campaign. Cannot cancel if already `sending`.

**Response (200 OK):**
```json
{
  "cancelled": true
}
```

---

### Delete Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/campaigns/:id` |
| **Method** | DELETE |
| **Auth** | `verifyMerchant` |

**Behavior:** Only `draft` campaigns can be deleted. `sending` or `sent` campaigns cannot be deleted.

**Response (200 OK):**
```json
{
  "deleted": true
}
```

---

## Broadcasts

Base path: `/broadcasts`

### Send Broadcast (Sprint 9)

| Property | Value |
|----------|-------|
| **Endpoint** | `/broadcasts/send` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `segment` | string | Yes | One of: `high_value`, `at_risk`, `new_users`, `all` |
| `templateId` | string | No | Template ID to use (required if no title/body) |
| `title` | string | No | Notification title (max 200 chars) |
| `body` | string | No | Notification body (max 5000 chars) |

**Note:** Either `templateId` OR both `title` and `body` must be provided.

**Segment Definitions:**

| Segment | Description |
|---------|-------------|
| `all` | Users with transactions in last 90 days |
| `high_value` | Users with >500 coins earned in last 30 days |
| `at_risk` | Users inactive for 30+ days but active in last 90 days |
| `new_users` | Users with first transaction in last 7 days |

**Rate Limits (per hour):**

| Channel | Max per Hour |
|---------|--------------|
| `push` | 10,000 |
| `in_app` | 50,000 |
| `whatsapp` | 1,000 |
| `sms` | 500 |
| `email` | 1,000 |

**Segment Limit:** Maximum 50,000 recipients per broadcast

**Response (200 OK):**
```json
{
  "success": true,
  "queued": 15000,
  "estimatedDelivery": "2024-01-15T10:05:00.000Z",
  "broadcastId": "uuid",
  "jobIds": ["job_1", "job_2", ...]
}
```

---

### Create Broadcast

| Property | Value |
|----------|-------|
| **Endpoint** | `/broadcasts` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `segment` | string | Yes | One of: `all`, `new`, `loyal`, `lapsed` |
| `message` | string | Yes | Message content (max 5000 chars) |
| `channels` | array | Yes | Non-empty array of: `push`, `sms`, `email`, `whatsapp`, `in_app` |
| `merchantId` | string | Yes | Merchant identifier |
| `name` | string | No | Broadcast name |
| `scheduledAt` | string | No | ISO date for scheduled send |

**Response (201 Created):**
```json
{
  "queued": true,
  "scheduled": false,
  "scheduledAt": null,
  "campaigns": [
    { "campaignId": "id", "channel": "push" },
    { "campaignId": "id", "channel": "sms" }
  ],
  "merchantId": "merchant_id",
  "segment": "all",
  "channels": ["push", "sms"]
}
```

---

### List Broadcasts

| Property | Value |
|----------|-------|
| **Endpoint** | `/broadcasts/:merchantId` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Results per page (default: 20, max: 100) |
| `page` | number | No | Page number (default: 1) |
| `status` | string | No | Filter by campaign status |

**Response (200 OK):**
```json
{
  "broadcasts": [
    {
      "broadcastId": "id",
      "name": "Broadcast Name",
      "channel": "push",
      "segment": "all",
      "status": "sent",
      "stats": {
        "sent": 15000,
        "delivered": 14500,
        "failed": 500,
        "opened": 3000,
        "clicked": 500
      },
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

---

### Schedule Broadcast

| Property | Value |
|----------|-------|
| **Endpoint** | `/broadcasts/:broadcastId/schedule` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scheduledAt` | string | Yes | Future ISO date/time |

**Response (200 OK):**
```json
{
  "broadcastId": "id",
  "status": "scheduled",
  "scheduledAt": "2024-01-20T14:00:00.000Z"
}
```

---

## Audience

Base path: `/audience`

### Estimate Audience

| Property | Value |
|----------|-------|
| **Endpoint** | `/audience/estimate` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filter` | object | Yes | Audience filter criteria |
| `channel` | string | No | Target channel (default: `whatsapp`) |

**Response (200 OK):**
```json
{
  "estimatedCount": 15000,
  "channel": "whatsapp"
}
```

---

### Get Interests

| Property | Value |
|----------|-------|
| **Endpoint** | `/audience/interests` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Description:** Returns available interest tags with user counts (minimum score: 20, max 50 results)

**Response (200 OK):**
```json
{
  "interests": [
    { "tag": "coffee", "userCount": 5000 },
    { "tag": "fitness", "userCount": 3500 }
  ]
}
```

---

### Get Locations

| Property | Value |
|----------|-------|
| **Endpoint** | `/audience/locations` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Response (200 OK):**
```json
{
  "cities": [
    { "name": "Mumbai", "userCount": 25000 },
    { "name": "Delhi", "userCount": 18000 }
  ],
  "areas": [
    { "name": "Andheri", "userCount": 5000 },
    { "name": "Bandra", "userCount": 4500 }
  ]
}
```

---

### Get Institutions

| Property | Value |
|----------|-------|
| **Endpoint** | `/audience/institutions` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Response (200 OK):**
```json
{
  "institutions": [
    { "name": "IIT Bombay", "type": "college", "area": "Mumbai", "userCount": 1200 }
  ]
}
```

---

### Record Search Signal

| Property | Value |
|----------|-------|
| **Endpoint** | `/audience/search-signal` |
| **Method** | POST |
| **Auth** | `verifyInternal` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User identifier |
| `term` | string | Yes | Search term |

**Response (200 OK):**
```json
{
  "recorded": true
}
```

---

### Record Location Signal

| Property | Value |
|----------|-------|
| **Endpoint** | `/audience/location-signal` |
| **Method** | POST |
| **Auth** | `verifyInternal` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User identifier |
| `address` | string | Yes | Delivery address |

**Response (200 OK):**
```json
{
  "updated": true
}
```

---

### Sync Segment Preferences

| Property | Value |
|----------|-------|
| **Endpoint** | `/audience/segment/sync` |
| **Method** | POST |
| **Auth** | `verifyInternal` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `segmentId` | string | Yes | Segment identifier |
| `userIds` | array | Yes | Array of user IDs |

**Response (200 OK):**
```json
{
  "success": true,
  "synced": 150,
  "error": null
}
```

---

## Analytics

Base path: `/analytics`

### Get Summary

| Property | Value |
|----------|-------|
| **Endpoint** | `/analytics/summary` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | number | No | Time period in days (default: 30) |

**Response (200 OK):**
```json
{
  "summary": {
    "totalCampaigns": 25,
    "totalSent": 150000,
    "totalDelivered": 145000,
    "totalOpened": 30000,
    "totalClicked": 5000,
    "avgOpenRate": 0.20,
    "avgClickRate": 0.03
  }
}
```

---

### Get Campaign Metrics

| Property | Value |
|----------|-------|
| **Endpoint** | `/analytics/campaign/:id` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Campaign ObjectId |

**Response (200 OK):** Campaign metrics with stats
**Response (403):** Campaign not owned by merchant
**Response (404):** Campaign not found

---

### Track Open

| Property | Value |
|----------|-------|
| **Endpoint** | `/analytics/track/open` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `campaignId` | string | Yes | Campaign identifier |

**Response (200 OK):**
```json
{
  "tracked": true
}
```

---

### Track Click

| Property | Value |
|----------|-------|
| **Endpoint** | `/analytics/track/click` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `campaignId` | string | Yes | Campaign identifier |

**Response (200 OK):**
```json
{
  "tracked": true
}
```

---

### Track Conversion

| Property | Value |
|----------|-------|
| **Endpoint** | `/analytics/track/conversion` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User identifier |

**Response (200 OK):**
```json
{
  "tracked": true
}
```

---

## Growth Analytics

Base path: `/growth-analytics`

### Track Event

| Property | Value |
|----------|-------|
| **Endpoint** | `/growth-analytics/track` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventType` | string | Yes | One of: `campaign_created`, `ad_impression`, `ad_click`, `notification_sent`, `notification_opened`, `voucher_issued`, `conversion` |
| `sourceService` | string | Yes | One of: `marketing`, `ads`, `notification`, `analytics` |
| `merchantId` | string | Yes | Merchant identifier |
| `userId` | string | No | User identifier |
| `metadata` | object | No | Additional event metadata |
| `value` | number | No | Event value |
| `timestamp` | string | No | ISO datetime |
| `sessionId` | string | No | Session identifier |

**Response (201 Created):**
```json
{
  "success": true,
  "eventId": "event_id",
  "eventType": "campaign_created",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

### Track Batch

| Property | Value |
|----------|-------|
| **Endpoint** | `/growth-analytics/track/batch` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `events` | array | Yes | Array of event objects (max 100) |

**Response (207 Multi-Status):**
```json
{
  "total": 10,
  "successCount": 9,
  "failedCount": 1,
  "results": [
    { "index": 0, "success": true, "eventId": "id" },
    { "index": 1, "success": false, "error": "Invalid merchantId" }
  ]
}
```

---

### Get Campaign Analytics

| Property | Value |
|----------|-------|
| **Endpoint** | `/growth-analytics/campaign/:id` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |

**Response (200 OK):** Campaign analytics combining all growth events
**Response (404):** No events found

---

### Get Merchant Dashboard

| Property | Value |
|----------|-------|
| **Endpoint** | `/growth-analytics/merchant/:id` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | No | Start datetime (ISO) |
| `endDate` | string | No | End datetime (ISO) |
| `days` | number | No | Days from now (default: 30) |
| `groupBy` | string | No | One of: `day`, `week`, `month` |

**Response (200 OK):** Merchant growth dashboard with all metrics

---

### Get Conversion Funnel

| Property | Value |
|----------|-------|
| **Endpoint** | `/growth-analytics/funnel` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `startDate` | string | No | Start datetime |
| `endDate` | string | No | End datetime |
| `days` | number | No | Days (default: 30) |
| `groupBy` | string | No | One of: `day`, `week`, `month` |

**Response (200 OK):** Conversion funnel from impression to conversion

---

### Get ROAS

| Property | Value |
|----------|-------|
| **Endpoint** | `/growth-analytics/roas` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `adSpend` | number | Yes | Ad spend amount |
| `startDate` | string | No | Start datetime |
| `endDate` | string | No | End datetime |
| `days` | number | No | Days (default: 30) |

**Response (200 OK):** Return on Ad Spend calculation

---

### Query Events

| Property | Value |
|----------|-------|
| **Endpoint** | `/growth-analytics/events` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `eventTypes` | string | No | Comma-separated event types |
| `startDate` | string | No | Start datetime (default: 7 days ago) |
| `endDate` | string | No | End datetime (default: now) |
| `limit` | number | No | Max results (default: 100, max: 1000) |
| `skip` | number | No | Skip count (default: 0) |

**Response (200 OK):**
```json
{
  "events": [...],
  "pagination": {
    "total": 500,
    "limit": 100,
    "skip": 0,
    "hasMore": true
  }
}
```

---

## Keywords

Base path: `/keywords`

### Keyword Auction (Public)

| Property | Value |
|----------|-------|
| **Endpoint** | `/keywords/auction` |
| **Method** | GET |
| **Auth** | None (Public) |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `term` | string | Yes | Search term (max 100 chars) |
| `limit` | number | No | Results (default: 3, max: 20) |

**Response (200 OK):**
```json
{
  "ads": [
    {
      "merchantId": "id",
      "headline": "Coffee Shop Deals",
      "description": "Get 20% off",
      "imageUrl": "url",
      "ctaUrl": "url",
      "ctaText": "Order Now",
      "bidAmount": 0.50
    }
  ]
}
```

---

### List Keywords

| Property | Value |
|----------|-------|
| **Endpoint** | `/keywords` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Response (200 OK):**
```json
{
  "bids": [...]
}
```

---

### Create Keyword Bid

| Property | Value |
|----------|-------|
| **Endpoint** | `/keywords` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keyword` | string | Yes | Keyword (lowercase, trimmed) |
| `bidAmount` | number | Yes | Bid amount |
| `dailyBudget` | number | Yes | Daily budget |
| `headline` | string | Yes | Ad headline |
| `description` | string | No | Ad description |
| `matchType` | string | No | `broad` or `exact` (default: `broad`) |
| `bidType` | string | No | `cpc` (default: `cpc`) |
| `imageUrl` | string | No | Ad image |
| `ctaUrl` | string | No | CTA URL |
| `ctaText` | string | No | CTA button text |
| `startDate` | string | No | Start date |
| `endDate` | string | No | End date |

**Response (201 Created):** Created keyword bid document

---

### Update Keyword Bid

| Property | Value |
|----------|-------|
| **Endpoint** | `/keywords/:id` |
| **Method** | PATCH |
| **Auth** | `verifyMerchant` |

**Updatable Fields:** `bidAmount`, `dailyBudget`, `headline`, `description`, `isActive`, `imageUrl`, `ctaUrl`, `ctaText`, `endDate`

**Response (200 OK):** Updated bid document
**Response (404):** Bid not found or not owned by merchant

---

### Delete Keyword Bid

| Property | Value |
|----------|-------|
| **Endpoint** | `/keywords/:id` |
| **Method** | DELETE |
| **Auth** | `verifyMerchant` |

**Response (200 OK):**
```json
{
  "deleted": true
}
```

---

## Webhooks

Base path: `/webhooks`

### WhatsApp Webhook Verification

| Property | Value |
|----------|-------|
| **Endpoint** | `/webhooks/whatsapp` |
| **Method** | GET |
| **Auth** | None (Meta verification) |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `hub.mode` | string | Verification mode (`subscribe`) |
| `hub.verify_token` | string | Verification token |
| `hub.challenge` | string | Challenge string |

**Response (200):** Challenge string (plain text)
**Response (403):** Verification failed

---

### WhatsApp Webhook (POST)

| Property | Value |
|----------|-------|
| **Endpoint** | `/webhooks/whatsapp` |
| **Method** | POST |
| **Auth** | HMAC signature verification |

**Headers Required:**
- `X-Hub-Signature-256`: HMAC signature from Meta

**Events Processed:**
- `sent` - Message sent
- `delivered` - Message delivered
- `read` - Message read
- `failed` - Delivery failed

**Special Commands:**
- `STOP` - User unsubscribes (updates `whatsappOptIn: false`)

**Response (200):**
```json
{
  "received": true
}
```

---

### Email Open Tracking

| Property | Value |
|----------|-------|
| **Endpoint** | `/webhooks/track/open` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cid` | string | No | Campaign ID |

**Response:** 1x1 transparent GIF

---

### Conversion Event

| Property | Value |
|----------|-------|
| **Endpoint** | `/webhooks/events/conversion` |
| **Method** | POST |
| **Auth** | Internal token |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventType` | string | Yes | Event type |
| `userId` | string | Yes | User identifier |
| `orderId` | string | Yes | Order identifier |
| `orderNumber` | string | No | Human-readable order number |
| `total` | number | Yes | Order total |
| `items` | array | No | Order items |
| `merchantId` | string | No | Merchant identifier |
| `timestamp` | string | No | ISO datetime |

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### Abandonment Event

| Property | Value |
|----------|-------|
| **Endpoint** | `/webhooks/events/abandonment` |
| **Method** | POST |
| **Auth** | Internal token |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventType` | string | Yes | Event type |
| `userId` | string | Yes | User identifier |
| `cartId` | string | Yes | Cart identifier |
| `items` | array | Yes | Cart items with `name` and `price` |
| `timestamp` | string | No | ISO datetime |

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## AdBazaar

Base path: `/adbazaar`

### Create AdBazaar Broadcast

| Property | Value |
|----------|-------|
| **Endpoint** | `/adbazaar/broadcast` |
| **Method** | POST |
| **Auth** | `x-internal-key` header (ADBAZAAR_INTERNAL_KEY) |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `adBazaarBookingId` | string | Yes | AdBazaar booking ID |
| `rezMerchantId` | string | Yes | REZ merchant ID |
| `channel` | string | Yes | One of: `whatsapp`, `push`, `sms` |
| `segment` | string | Yes | One of: `all`, `high_value`, `at_risk`, `new_users` |
| `title` | string | Yes | Notification title |
| `body` | string | Yes | Notification body |
| `qrCodeUrl` | string | No | QR code URL for tracking |
| `coinsPerScan` | number | No | Coins earned per scan |
| `scheduledAt` | string | No | Future ISO datetime |

**Rate Limit:** 3 broadcasts per merchant per 24 hours

**Response (201 Created):**
```json
{
  "success": true,
  "broadcastId": "id",
  "estimatedReach": 15000
}
```

---

### Get Broadcast Status

| Property | Value |
|----------|-------|
| **Endpoint** | `/adbazaar/status/:broadcastId` |
| **Method** | GET |
| **Auth** | `x-internal-key` header |

**Response (200 OK):**
```json
{
  "broadcastId": "id",
  "status": "sent",
  "sentCount": 15000,
  "deliveredCount": 14500,
  "failedCount": 500,
  "sentAt": "2024-01-15T10:00:00.000Z"
}
```

---

## Vouchers

Base path: `/vouchers`

### Create Voucher

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | No | Voucher code (3-20 chars, auto-generated if omitted) |
| `type` | string | Yes | One of: `percentage`, `fixed`, `bogo`, `free_delivery` |
| `value` | number | Yes | Discount value |
| `minOrderValue` | number | No | Minimum order value (default: 0) |
| `maxDiscount` | number | No | Maximum discount cap |
| `maxUses` | number | No | Maximum redemption count |
| `validFrom` | string | Yes | Start datetime |
| `validUntil` | string | Yes | End datetime |
| `applicableTo` | string | No | One of: `all`, `category`, `product`, `store` |
| `applicableIds` | array | No | Applicable entity IDs |
| `merchantId` | string | Yes | Merchant identifier |
| `recipientUserId` | string | No | User to notify |
| `recipientEmail` | string | No | Email to notify |
| `recipientPhone` | string | No | Phone to notify |
| `sendNotification` | boolean | No | Send notification (default: false) |

**Response (201 Created):**
```json
{
  "success": true,
  "voucher": { ... }
}
```

---

### List Vouchers

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | `active`, `exhausted`, `expired`, `cancelled` |
| `type` | string | Voucher type |
| `applicableTo` | string | Applicability type |
| `page` | number | Page number |
| `limit` | number | Results per page (max: 100) |

**Response (200 OK):**
```json
{
  "success": true,
  "vouchers": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

---

### Get Voucher by ID

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/:id` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "success": true,
  "voucher": { ... }
}
```

**Response (404):** Voucher not found

---

### Get Voucher by Code

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/code/:code` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):** Voucher document
**Response (404):** Voucher not found or inactive

---

### Update Voucher

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/:id` |
| **Method** | PATCH |
| **Auth** | None |

**Updatable Fields:** `type`, `value`, `minOrderValue`, `maxDiscount`, `maxUses`, `validFrom`, `validUntil`, `applicableTo`, `applicableIds`, `status`, `metadata`

---

### Delete Voucher

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/:id` |
| **Method** | DELETE |
| **Auth** | None |

**Behavior:** Deactivates voucher (soft delete)

---

### Validate Voucher

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/validate` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Voucher code |
| `orderValue` | number | Yes | Order value |
| `userId` | string | Yes | User identifier |

**Response (Valid):**
```json
{
  "valid": true,
  "voucher": { ... },
  "discount": 50
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Voucher expired",
  "errorCode": "VCH_EXPIRED"
}
```

---

### Redeem Voucher

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/redeem` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Voucher code |
| `userId` | string | Yes | User identifier |
| `orderId` | string | Yes | Order identifier |
| `orderValue` | number | Yes | Order value |
| `merchantId` | string | Yes | Merchant identifier |

**Response (Valid):**
```json
{
  "valid": true,
  "voucher": { ... },
  "discount": 50
}
```

---

### Get Voucher Redemptions

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/:id/redemptions` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `page`, `limit`

---

### Get User Redemptions

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/user/:userId` |
| **Method** | GET |
| **Auth** | None |

---

### Cleanup Expired Vouchers

| Property | Value |
|----------|-------|
| **Endpoint** | `/vouchers/cleanup` |
| **Method** | POST |
| **Auth** | None (Admin/Cron) |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Marked 50 vouchers as expired"
}
```

---

## Merchant Growth

Base path: `/merchant/growth`

### Get Dashboard

| Property | Value |
|----------|-------|
| **Endpoint** | `/merchant/growth/dashboard` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `days` | number | Time period (default: 30, max: 365) |

**Response (200 OK):**
```json
{
  "success": true,
  "dashboard": {
    "campaigns": { ... },
    "ads": { ... },
    "notifications": { ... },
    "vouchers": { ... },
    "growthScore": 75
  }
}
```

---

### Get Campaign Overview

| Property | Value |
|----------|-------|
| **Endpoint** | `/merchant/growth/campaigns` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:** `days`

---

### Get Ad Performance

| Property | Value |
|----------|-------|
| **Endpoint** | `/merchant/growth/ads` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:** `days`

---

### Get Notification Stats

| Property | Value |
|----------|-------|
| **Endpoint** | `/merchant/growth/notifications` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:** `days`

---

### Get Voucher Metrics

| Property | Value |
|----------|-------|
| **Endpoint** | `/merchant/growth/vouchers` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:** `days`

---

### Get Growth Score

| Property | Value |
|----------|-------|
| **Endpoint** | `/merchant/growth/score` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

**Query Parameters:** `days`

**Response (200 OK):**
```json
{
  "success": true,
  "score": {
    "overall": 75,
    "breakdown": {
      "engagement": 80,
      "conversion": 65,
      "retention": 70
    }
  }
}
```

---

## Karma Campaigns

Base path: `/karma-campaigns`

### Create Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `name` | string | Yes | Campaign name (max 200) |
| `description` | string | Yes | Description (max 5000) |
| `campaignType` | string | Yes | One of: `blood_donation`, `food_distribution`, `tree_plantation`, `ngo_collaboration`, `volunteer`, `environment` |
| `location` | object | Yes | Location with coordinates |
| `schedule` | object | Yes | Start/end dates |
| `rewardConfig` | object | Yes | Coins configuration |
| `imageUrl` | string | No | Campaign image |
| `participantLimit` | number | No | Max participants |

**Response (201 Created):**
```json
{
  "success": true,
  "campaign": { ... },
  "message": "Campaign created successfully"
}
```

---

### List Campaigns

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `merchantId` | string | Filter by merchant |
| `campaignType` | string | Filter by type |
| `status` | string | Filter by status |
| `city` | string | Filter by city |
| `lat`, `lng` | number | Coordinates |
| `radiusKm` | number | Search radius |
| `page` | number | Page number |
| `limit` | number | Results per page |

---

### Get Campaign Types

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/types` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "success": true,
  "types": [
    { "value": "blood_donation", "label": "Blood Donation", "icon": "droplet" },
    { "value": "food_distribution", "label": "Food Distribution", "icon": "utensils" }
  ]
}
```

---

### Get Nearby Campaigns

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/nearby` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `lat`, `lng`, `radiusKm`, `campaignType`, `status`

---

### Get Campaign by ID

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id` |
| **Method** | GET |
| **Auth** | None |

---

### Update Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id` |
| **Method** | PATCH |
| **Auth** | None |

**Updatable Fields:** `name`, `description`, `imageUrl`, `objectives`, `requirements`, `location`, `schedule`, `status`, `rewardConfig`, etc.

---

### Delete Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id` |
| **Method** | DELETE |
| **Auth** | None |

---

### Publish Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/publish` |
| **Method** | POST |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "success": true,
  "campaign": { ... },
  "message": "Campaign published successfully"
}
```

---

### Complete Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/complete` |
| **Method** | POST |
| **Auth** | None |

---

### Join Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/join` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User identifier |
| `campaignId` | string | Yes | Campaign identifier |

---

### Get User Participations

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/user/:userId/participations` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "success": true,
  "participations": {
    "past": [...],
    "upcoming": [...],
    "total": 10
  }
}
```

---

### Get Campaign Participants

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/participants` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `status`, `page`, `limit`

---

### Record Check-in

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/checkin` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participantId` | string | Yes | Participant identifier |
| `checkInLocation` | object | No | Location with coordinates |
| `proofPhotoUrl` | string | No | Photo proof URL |

---

### Verify Participation

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/verify` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participantId` | string | Yes | Participant identifier |
| `verifiedBy` | string | Yes | Verifier identifier |
| `verificationNotes` | string | No | Notes |
| `coinsEarned` | number | No | Custom coins amount |

---

### Award Rewards

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/award-rewards` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participantId` | string | Yes | Participant identifier |

---

### Submit Feedback

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/feedback` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participantId` | string | Yes | Participant identifier |
| `feedback` | string | Yes | Feedback text (max 2000) |
| `rating` | number | Yes | Rating (1-5) |

---

### Record Share

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/share` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participantId` | string | Yes | Participant identifier |
| `platform` | string | Yes | Social platform |
| `shareText` | string | Yes | Share text (max 500) |

---

### Get Share Text

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/share-text` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `merchantName`, `trackingLink`

---

### Get Campaign Analytics

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/:id/analytics` |
| **Method** | GET |
| **Auth** | None |

---

### Get Merchant Goodwill Report

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/merchant/:merchantId/goodwill` |
| **Method** | GET |
| **Auth** | None |

---

### Get Merchant Summary

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/merchant/:merchantId/summary` |
| **Method** | GET |
| **Auth** | None |

---

### Cleanup Expired Campaigns

| Property | Value |
|----------|-------|
| **Endpoint** | `/karma-campaigns/cleanup` |
| **Method** | POST |
| **Auth** | None (Admin/Cron) |

---

## Interaction Tracking

Base path: `/interaction`

### Record Impression

| Property | Value |
|----------|-------|
| **Endpoint** | `/interaction/:id/impression` |
| **Method** | POST |
| **Auth** | `verifyConsumer` (JWT required) |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Ad/Campaign ID |

**Behavior:** Records impression and deducts from campaign budget (CPM)

**Response (200 OK):**
```json
{
  "success": true
}
```

**Response (401):** Authentication required

---

### Record Click

| Property | Value |
|----------|-------|
| **Endpoint** | `/interaction/:id/click` |
| **Method** | POST |
| **Auth** | `verifyConsumer` (JWT required) |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Ad/Campaign ID |

**Behavior:** Records click and deducts from campaign budget (CPC)

**Response (200 OK):**
```json
{
  "success": true
}
```

**Response (401):** Authentication required

---

## Influencer

Base path: `/influencer`

### Register as Influencer

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/register` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

**Request Body:** Influencer profile data

**Response (201 Created):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### Get My Profile

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/profile` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Response (200 OK):**
```json
{
  "success": true,
  "data": { ... }
}
```

**Response (404):** Profile not found

---

### Search Influencers

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/search` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `niche`, `city`, `minFollowers`, `sortBy`, `page`, `limit`

---

### Create Campaign (Merchant)

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/campaigns` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

**Response (201 Created):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### Get Merchant Campaigns

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/campaigns` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Query Parameters:** `status`

---

### Get Campaign Details

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/campaigns/:id` |
| **Method** | GET |
| **Auth** | None |

---

### Apply to Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/campaigns/:id/apply` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `proposedContent` | string | No | Proposed content |
| `proposedPrice` | number | No | Proposed price |

---

### Accept Application

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/campaigns/:id/accept/:influencerId` |
| **Method** | POST |
| **Auth** | `verifyConsumer` (merchant) |

---

### Reject Application

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/campaigns/:id/reject/:influencerId` |
| **Method** | POST |
| **Auth** | `verifyConsumer` (merchant) |

---

### Update Campaign Analytics

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/campaigns/:id/analytics` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `views` | number | No | View count |
| `engagement` | number | No | Engagement count |
| `conversions` | number | No | Conversion count |

---

### Get Influencer Analytics

| Property | Value |
|----------|-------|
| **Endpoint** | `/influencer/analytics` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

## Offline Ads

Base path: `/offline-ads`

### Create Offline Ad

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

**Response (201 Created):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### Get Merchant Ads

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Query Parameters:** `status`

---

### Get Ad Details

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads/:id` |
| **Method** | GET |
| **Auth** | None |

---

### Update Ad

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads/:id` |
| **Method** | PUT |
| **Auth** | `verifyConsumer` |

---

### Activate Ad

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads/:id/activate` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

---

### Complete Ad

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads/:id/complete` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

---

### Track QR Scan

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads/:id/track` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | No | User identifier |
| `location` | object | No | Scan location |
| `deviceInfo` | object | No | Device information |

---

### Get Ad Analytics

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads/:id/analytics` |
| **Method** | GET |
| **Auth** | None |

---

### Browse Inventory

| Property | Value |
|----------|-------|
| **Endpoint** | `/offline-ads/inventory/all` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `city`, `adType`, `minPrice`, `maxPrice`, `page`, `limit`

---

## Triggers

Base path: `/triggers`

### Create Rule

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/rules` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

**Request Body:** Trigger rule configuration

**Response (201 Created):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### Get Merchant Rules

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/rules` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Query Parameters:** `triggerType`

---

### Get Trigger Templates

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/rules/templates` |
| **Method** | GET |
| **Auth** | None |

---

### Update Rule

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/rules/:id` |
| **Method** | PUT |
| **Auth** | `verifyConsumer` |

---

### Toggle Rule

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/rules/:id/toggle` |
| **Method** | PUT |
| **Auth** | `verifyConsumer` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `isActive` | boolean | Yes | Active state |

---

### Delete Rule

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/rules/:id` |
| **Method** | DELETE |
| **Auth** | `verifyConsumer` |

---

### Evaluate User

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/evaluate` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User identifier |
| `userData` | object | No | Additional user data |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { "ruleId": "...", "matched": true, "action": "..." }
  ]
}
```

---

### Manually Trigger Action

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/trigger` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ruleId` | string | Yes | Rule identifier |
| `userId` | string | Yes | User identifier |

---

### Get User Events

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/events/:userId` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `limit`

---

### Get Rule Analytics

| Property | Value |
|----------|-------|
| **Endpoint** | `/triggers/rules/:id/analytics` |
| **Method** | GET |
| **Auth** | None |

---

## Dashboard

Base path: `/dashboard`

### Get Dashboard Metrics

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/metrics` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Query Parameters:** `from`, `to` (date range)

---

### Get Channel Performance

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/channels` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

### Get Campaign Timeline

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/timeline` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Query Parameters:** `days`

---

### Get Audience Segments

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/audience` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

### Get Top Campaigns

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/top-campaigns` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

**Query Parameters:** `limit`

---

### Get Conversion Funnel

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/funnel` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

### Get Competitor Benchmark

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/benchmark` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

### Get Revenue Attribution

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/attribution` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

### Get CLV Distribution

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/clv` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

### Get Predictive Analytics

| Property | Value |
|----------|-------|
| **Endpoint** | `/dashboard/predictive` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

## Hyperlocal

Base path: `/hyperlocal`

### Create Partnership

| Property | Value |
|----------|-------|
| **Endpoint** | `/hyperlocal/partners` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

**Response (201 Created):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### Get Merchant Partners

| Property | Value |
|----------|-------|
| **Endpoint** | `/hyperlocal/partners` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

### Discover Partners

| Property | Value |
|----------|-------|
| **Endpoint** | `/hyperlocal/discover` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `category`, `city`

---

### Create Cross-Promotion Campaign

| Property | Value |
|----------|-------|
| **Endpoint** | `/hyperlocal/campaigns` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

**Response (201 Created):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### Get Cross-Promotion Campaigns

| Property | Value |
|----------|-------|
| **Endpoint** | `/hyperlocal/campaigns` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

## Rendez

Base path: `/rendez`

### Create Offer

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/offers` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `name` | string | Yes | Offer name (max 200) |
| `category` | string | Yes | `couple`, `group`, or `context` |
| `type` | string | Yes | `percentage`, `fixed`, `bogo`, `bundle`, `experience` |
| `title` | string | Yes | Offer title (max 100) |
| `description` | string | Yes | Description (max 2000) |
| `benefits` | object | Yes | Benefit configuration |
| `validFrom` | string | Yes | Start datetime |
| `validUntil` | string | Yes | End datetime |

**Response (201 Created):**
```json
{
  "success": true,
  "offer": { ... }
}
```

---

### List Offers

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/offers` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `merchantId`, `category`, `type`, `status`, `tags`, `occasion`, `dayOfWeek`, `validNow`, `page`, `limit`

---

### Get Offer by ID

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/offers/:id` |
| **Method** | GET |
| **Auth** | None |

---

### Update Offer

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/offers/:id` |
| **Method** | PATCH |
| **Auth** | None |

---

### Delete Offer

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/offers/:id` |
| **Method** | DELETE |
| **Auth** | None |

---

### Get Contextual Offers

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/contextual` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `userId`, `dayOfWeek`, `timeOfDay`, `occasion`, `city`, `area`, `partySize`, `interests`, `merchantId`

---

### Get Couple Offers

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/couple` |
| **Method** | GET |
| **Auth** | None |

---

### Get Group Offers

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/group` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `partySize`, `merchantId`, `city`

---

### Generate Dynamic Offers

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/generate` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** Context-based parameters

---

### Book Offer

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/book` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `offerId` | string | Yes | Offer identifier |
| `userId` | string | Yes | User identifier |
| `partySize` | number | Yes | Party size |
| `bookingDate` | string | Yes | Booking date |
| `bookingTime` | string | Yes | Booking time (HH:MM) |
| `customerName` | string | Yes | Customer name |
| `customerPhone` | string | Yes | Customer phone |
| `customerEmail` | string | No | Customer email |

**Response (201 Created):**
```json
{
  "success": true,
  "bookingId": "...",
  "message": "Booking confirmed"
}
```

---

### Share Offer

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/share` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `offerId` | string | Yes | Offer identifier |
| `userId` | string | Yes | User identifier |
| `platform` | string | Yes | `whatsapp`, `facebook`, `twitter`, `instagram`, `copy_link` |
| `recipientCount` | number | No | Number of recipients |

**Response (200 OK):**
```json
{
  "success": true,
  "shareUrl": "...",
  "message": "Share link generated"
}
```

---

### Redeem Offer

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/redeem` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `offerId` | string | Yes | Offer identifier |
| `orderId` | string | Yes | Order identifier |
| `revenue` | number | Yes | Order revenue |

---

### Get Templates

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/templates` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `category`

---

### Instantiate Template

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/templates/:name/instantiate` |
| **Method** | POST |
| **Auth** | None |

**Request Body:** Template customizations

---

### Get Merchant Stats

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/stats/:merchantId` |
| **Method** | GET |
| **Auth** | None |

---

### Cleanup Expired Offers

| Property | Value |
|----------|-------|
| **Endpoint** | `/rendez/cleanup` |
| **Method** | POST |
| **Auth** | None (Admin/Cron) |

---

## Subscriptions

Base path: `/subscriptions`

### Get Plans

| Property | Value |
|----------|-------|
| **Endpoint** | `/subscriptions/plans` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "basic_monthly",
      "name": "Basic",
      "price": 999,
      "duration": 30,
      "features": ["Unlimited push notifications", "Basic analytics"]
    }
  ]
}
```

---

### Create Subscription

| Property | Value |
|----------|-------|
| **Endpoint** | `/subscriptions` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `planId` | string | Yes | Plan identifier |
| `paymentMethod` | string | No | Payment method |

---

### Get Current Subscription

| Property | Value |
|----------|-------|
| **Endpoint** | `/subscriptions/current` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

### Cancel Subscription

| Property | Value |
|----------|-------|
| **Endpoint** | `/subscriptions/cancel` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

---

### Renew Subscription

| Property | Value |
|----------|-------|
| **Endpoint** | `/subscriptions/renew` |
| **Method** | POST |
| **Auth** | `verifyConsumer` |

---

### Get Usage Stats

| Property | Value |
|----------|-------|
| **Endpoint** | `/subscriptions/usage` |
| **Method** | GET |
| **Auth** | `verifyConsumer` |

---

## Loyalty Integration

Base path: `/loyalty-marketing`

### Get Loyalty Profile

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/profile/:userId` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "profile": {
    "userId": "...",
    "tier": "gold",
    "score": 750,
    "streak": { "current": 30 },
    "badges": [...]
  }
}
```

**Response (404):** Profile not found

---

### Get Batch Profiles

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/profiles/batch` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userIds` | array | Yes | Array of user IDs (max 1000) |

**Response (200 OK):**
```json
{
  "profiles": {
    "user1": { ... },
    "user2": null
  },
  "total": 100,
  "found": 99
}
```

---

### Get Loyalty Stats

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/stats/:merchantId` |
| **Method** | GET |
| **Auth** | `verifyMerchant` |

---

### Target Users

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/target` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `criteria` | object | Yes | Targeting criteria |

**Criteria Object:**

| Field | Type | Description |
|-------|------|-------------|
| `scoreRange` | object | Min/max loyalty score |
| `tiers` | array | `bronze`, `silver`, `gold`, `platinum`, `diamond` |
| `karmaLevels` | array | `newcomer`, `active`, `contributor`, `expert`, `legend` |
| `streakMilestones` | array | 7, 14, 30, 60, 90, 180, 365 |
| `hasBadges` | array | Badge identifiers |
| `excludeUsers` | array | User IDs to exclude |

**Response (200 OK):**
```json
{
  "userIds": ["user1", "user2"],
  "count": 2,
  "criteria": { ... }
}
```

---

### Estimate Audience

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/estimate` |
| **Method** | POST |
| **Auth** | `verifyMerchant` |

**Request Body:** Same as `/target`

**Response (200 OK):**
```json
{
  "estimatedCount": 1500,
  "criteria": { ... }
}
```

---

### Build Filter

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/filter` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `scoreMin`, `scoreMax`, `tiers`, `karmaLevels`, `badges`, `excludeUsers`

---

### Personalize Message

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/personalize` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User identifier |
| `template` | string | Yes | Message template (max 5000) |

**Template Variables:** `{{tier}}`, `{{score}}`, `{{streak}}`, `{{name}}`

**Response (200 OK):**
```json
{
  "original": "Hello {{name}}, you're a {{tier}} member!",
  "personalized": "Hello John, you're a Gold member!",
  "vars": { "tier": "Gold", "score": 750 },
  "profile": { "userId": "...", "tier": "Gold", "score": 750 }
}
```

---

### Generate Tier Message

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/personalize/tier` |
| **Method** | POST |
| **Auth** | None |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tier` | string | Yes | Target tier |
| `message` | string | Yes | Message template |

---

### Process Loyalty Event

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/event` |
| **Method** | POST |
| **Auth** | `verifyInternal` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Event type |
| `userId` | string | Yes | User identifier |
| `timestamp` | string | No | Event timestamp |

**Event Types:** `tier_upgrade`, `tier_downgrade`, `milestone_reached`, `badge_earned`, `streak_maintained`, `streak_broken`, `high_score_achieved`, `karma_level_up`

**Response (200 OK):**
```json
{
  "processed": true,
  "triggered": true,
  "campaignIds": ["campaign1"],
  "event": { "type": "tier_upgrade", "userId": "...", "timestamp": "..." }
}
```

---

### Get Campaign Triggers

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/triggers` |
| **Method** | GET |
| **Auth** | None |

**Query Parameters:** `eventType`

---

### Create Trigger

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/triggers` |
| **Method** | POST |
| **Auth** | `verifyInternal` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant identifier |
| `loyaltyEvent` | string | Yes | Event type |
| `campaignId` | string | Yes | Campaign identifier |
| `personalizationTemplate` | string | No | Custom template |
| `active` | boolean | No | Active state (default: true) |

---

### Update Trigger

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/triggers/:id` |
| **Method** | PATCH |
| **Auth** | `verifyInternal` |

**Updatable Fields:** `active`, `personalizationTemplate`, `campaignId`

---

### Delete Trigger

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/triggers/:id` |
| **Method** | DELETE |
| **Auth** | `verifyInternal` |

---

### Health Check

| Property | Value |
|----------|-------|
| **Endpoint** | `/loyalty-marketing/health` |
| **Method** | GET |
| **Auth** | None |

**Response (200 OK):**
```json
{
  "service": "profile-aggregator",
  "status": "ok",
  "latencyMs": 5,
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

**Response (503):**
```json
{
  "service": "profile-aggregator",
  "status": "error",
  "latencyMs": null,
  "error": "Connection refused",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Authentication required or invalid |
| 403 | Forbidden - Access denied |
| 404 | Not Found |
| 409 | Conflict - Resource conflict (e.g., campaign already launching) |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Rate Limits

| Endpoint Pattern | Limit | Window |
|------------------|-------|--------|
| `/campaigns` (create) | 20 | 1 hour |
| `/broadcasts/send` | 1 | 1 hour (per merchant) |
| Channel limits | See Broadcasts section | 1 hour |
| `/adbazaar/broadcast` | 3 | 24 hours (per merchant) |

---

## Notes

- All timestamps are ISO 8601 format (UTC)
- All IDs are MongoDB ObjectIds (24 character hex strings) unless otherwise specified
- Pagination defaults: `page=1`, `limit=20`
- Maximum `limit` for pagination endpoints: 100 (unless specified otherwise)
