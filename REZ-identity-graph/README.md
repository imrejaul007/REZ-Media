# REZ Identity Graph Service

**Port:** 4065

Identity resolution and customer graph for unified customer profiles.

## Features

- Deterministic matching (email, phone, loyalty ID)
- Probabilistic matching (device, IP, fingerprint)
- Identity graph traversal
- Profile merging
- Cross-device/cross-session linking

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/resolve` | POST | Resolve identities to profile |
| `/api/link` | POST | Link two identities |
| `/api/profiles/:id` | GET | Get profile |
| `/api/profiles/:id` | PATCH | Update profile |
| `/api/profiles/merge` | POST | Merge profiles |
| `/api/events/identity` | POST | Process identity event |
| `/api/shopify/customers` | POST | Shopify customer events |
| `/api/shopify/orders` | POST | Shopify order events |

## Resolution Example

```bash
curl -X POST http://localhost:4065/api/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "phone": "+919876543210",
    "deviceId": "device-123",
    "merchantId": "merchant-1"
  }'
```

## Identity Types

| Type | Hash | Confidence |
|------|------|------------|
| email | SHA256 | 0.95 |
| phone | SHA256 | 0.90 |
| loyalty_id | SHA256 | 0.95 |
| pos_customer_id | SHA256 | 0.95 |
| external_id | SHA256 | 0.85 |
| device_id | SHA256 | 0.70 |
| qr_scan_id | SHA256 | 0.60 |
| whatsapp_id | SHA256 | 0.80 |
| cookie_id | SHA256 | 0.50 |
| session_id | SHA256 | 0.40 |
| ip_address | SHA256 | 0.20 |
