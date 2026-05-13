# WooCommerce Connector

Production-ready WooCommerce REST API integration service for the ReZ platform.

## Features

- **Store Registration**: Connect multiple WooCommerce stores with Consumer Key/Secret authentication
- **Webhook Handler**: Process WooCommerce webhooks (orders, products, customers) with HMAC verification
- **Data Sync**: Bidirectional sync with ReZ platform services
- **REST API Client**: Full WooCommerce REST API v3 client with automatic retry and rate limiting

## Tech Stack

- Node.js 18+
- Express.js
- MongoDB (Mongoose)
- Redis (ioredis) for caching
- TypeScript

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Set MONGODB_URI, REDIS_URL, INTERNAL_SERVICE_TOKEN

# Start development server
npm run dev

# Build for production
npm run build

# Start production
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/woocommerce/connect` | Register a new WooCommerce store |
| DELETE | `/api/woocommerce/stores/:id` | Disconnect a store |
| GET | `/api/woocommerce/stores` | List all connected stores |
| GET | `/api/woocommerce/stores/:id` | Get store details |
| POST | `/api/woocommerce/webhook` | WooCommerce webhook receiver |
| GET | `/api/woocommerce/sync/status` | Get sync status |
| POST | `/api/woocommerce/sync/trigger` | Trigger manual sync |

## Authentication

All API endpoints (except `/health` and `/api/woocommerce/webhook`) require the `X-Internal-Token` header:

```bash
curl -X GET http://localhost:4051/api/woocommerce/stores \
  -H "X-Internal-Token: your-internal-token"
```

## Connecting a Store

```bash
curl -X POST http://localhost:4051/api/woocommerce/connect \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-internal-token" \
  -d '{
    "storeUrl": "https://your-store.com",
    "consumerKey": "ck_xxxx",
    "consumerSecret": "cs_xxxx"
  }'
```

## Webhook Events

The service automatically registers webhooks for:
- `order.created`, `order.updated`
- `customer.created`, `customer.updated`
- `product.created`, `product.updated`

## Sync Flow

1. **Initial Sync**: Full sync of products, orders, and customers
2. **Webhook Sync**: Real-time updates via WooCommerce webhooks
3. **Manual Sync**: Trigger sync via API when needed

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 4051 | Server port |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `REDIS_URL` | No | redis://localhost:6379 | Redis connection string |
| `INTERNAL_SERVICE_TOKEN` | Yes | - | Token for inter-service auth |
| `WOOCOMMERCE_WEBHOOK_SECRET` | No | - | Secret for webhook verification |
| `REZ_IDENTITY_SERVICE_URL` | No | http://localhost:4001 | ReZ identity service |
| `REZ_ORDER_SERVICE_URL` | No | http://localhost:4003 | ReZ order service |
| `REZ_PRODUCT_SERVICE_URL` | No | http://localhost:4005 | ReZ product service |

## Architecture

```
WooCommerce Store
       |
       v
WooCommerce Connector Service
       |
       +---> Products ---> ReZ Product Service
       +---> Orders ---> ReZ Order Service
       +---> Customers ---> ReZ Identity Service
```

## License

Proprietary - RTNM Group
