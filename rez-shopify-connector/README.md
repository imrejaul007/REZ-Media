# Shopify Connector Service

**Port:** 4050
**Purpose:** Connect ReZ platform to Shopify stores for bidirectional data synchronization

---

## Overview

The Shopify Connector enables e-commerce brands to sync their Shopify store data with the ReZ marketing platform. This includes products, orders, customers, and inventory updates in real-time via webhooks.

## Features

- **OAuth 2.0 Authentication** - Secure Shopify Partner App integration
- **Webhook Handlers** - Real-time updates for orders, products, customers, inventory
- **Bidirectional Sync** - Push and pull data to/from Shopify
- **Rate Limiting** - Automatic retry with exponential backoff
- **HMAC Verification** - Secure webhook signature validation
- **Shop Admin API** - Full Admin API access
- **Storefront API** - Customer-facing features via Storefront API

## Architecture

```
Shopify Store
     │
     ├── OAuth ──────────────────→ Connect Store
     │
     └── Webhooks ────────────────→ Receive Events
           │                           │
           │  orders/*                 │
           │  products/*               │ Transform &
           │  customers/*              │ Validate
           │  inventory/*              │
           │                           ▼
           │                    ┌─────────────────┐
           │                    │   ReZ Platform  │
           │                    │                 │
           │                    │  • Order Service│
           │                    │  • Product Svc  │
           │                    │  • Identity Svc │
           │                    │  • Inventory Svc │
           └───────────────────▶└─────────────────┘
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shopify/connect` | Initiate OAuth flow |
| GET | `/api/shopify/callback` | OAuth callback handler |

### Stores

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shopify/stores` | List connected stores |
| GET | `/api/shify/stores/:id` | Get store details |
| DELETE | `/api/shopify/stores/:id` | Disconnect store |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shopify/webhook` | Webhook receiver |

### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shopify/sync/status` | Get sync status |
| POST | `/api/shopify/sync/trigger` | Trigger manual sync |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/metrics` | Prometheus metrics |

## Webhook Events

The connector handles the following Shopify webhook events:

| Event | Description |
|-------|-------------|
| `orders/create` | New order created |
| `orders/updated` | Order updated |
| `orders/paid` | Order payment confirmed |
| `orders/cancelled` | Order cancelled |
| `orders/fulfilled` | Order fulfilled |
| `products/create` | New product created |
| `products/update` | Product updated |
| `products/delete` | Product deleted |
| `customers/create` | New customer registered |
| `customers/update` | Customer updated |
| `customers/disable` | Customer disabled |
| `inventory_levels/update` | Inventory level changed |

## Data Sync

### Products
Syncs to: `Product Catalog Service`

```typescript
interface ShopifyProduct {
  id: number;
  title: string;
  description: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: Variant[];
  images: Image[];
  status: 'active' | 'draft' | 'archived';
}
```

### Orders
Syncs to: `Order Service`

```typescript
interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: 'pending' | 'paid' | 'partially_paid' | 'refunded';
  fulfillment_status: string | null;
  line_items: LineItem[];
  customer: Customer;
  shipping_address: Address;
}
```

### Customers
Syncs to: `Identity Service`

```typescript
interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  tags: string[];
}
```

## Environment Variables

```bash
# Shopify App Credentials
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
SHOPIFY_SCOPES=read_products,write_products,read_orders,write_orders,read_customers,read_inventory
SHOPIFY_REDIRECT_URI=https://your-app.com/api/shopify/callback

# Service Configuration
PORT=4050
MONGODB_URI=mongodb://localhost:27017/rez-shopify-connector
REDIS_URL=redis://localhost:6379
NODE_ENV=development

# Security
INTERNAL_SERVICE_TOKEN=your-internal-token
```

## Quick Start

```bash
# Clone and install
cd REZ-Media/rez-shopify-connector
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Shopify credentials

# Build
npm run build

# Start
npm start
# or for development
npm run dev
```

## Shopify App Setup

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Create a new Partner Account or log in
3. Create a new App (Custom App)
4. Configure App URL and Redirect URLs
5. Copy API Key and API Secret
6. Set required OAuth scopes
7. Configure webhook subscriptions

## OAuth Flow

```
1. User clicks "Connect Shopify"
2. Redirect to Shopify OAuth:
   https://{shop}.myshopify.com/admin/oauth/authorize?
     client_id={API_KEY}&
     scope={SCOPES}&
     redirect_uri={REDIRECT_URI}&
     state={CSRF_TOKEN}

3. Shopify redirects back with code
4. Exchange code for access token
5. Store token securely
6. Subscribe to webhooks
```

## Rate Limiting

The Shopify Admin API has rate limits:
- **2 burst, 40 sustained** requests per second

The connector handles this with:
- Exponential backoff on 429 errors
- Redis-based rate limiter
- Request queuing

## Error Handling

| Error | Handling |
|-------|----------|
| 401 Unauthorized | Re-authenticate |
| 403 Forbidden | Check scopes |
| 404 Not Found | Skip/delete local |
| 429 Rate Limited | Exponential backoff |
| 500 Server Error | Retry with backoff |

## Monitoring

### Health Check
```bash
curl http://localhost:4050/health
```

### Metrics
```bash
curl http://localhost:4050/metrics
```

## Testing

```bash
# Run tests
npm test

# Run specific test
npm test -- orders.test.ts
```

## File Structure

```
rez-shopify-connector/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/
│   │   ├── index.ts          # Environment config
│   │   ├── database.ts       # MongoDB connection
│   │   └── redis.ts          # Redis connection
│   ├── clients/
│   │   ├── adminClient.ts     # Admin API client
│   │   └── storefrontClient.ts # Storefront API client
│   ├── services/
│   │   ├── authService.ts     # OAuth handling
│   │   ├── webhookService.ts  # Webhook processing
│   │   ├── syncService.ts     # Data synchronization
│   │   └── storeService.ts    # Store management
│   ├── routes/
│   │   └── index.ts          # API routes
│   ├── middleware/
│   │   ├── auth.ts           # Token verification
│   │   └── rateLimit.ts      # Rate limiting
│   ├── models/
│   │   └── Store.ts          # Store model
│   └── types/
│       └── index.ts           # Type definitions
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Related Services

- [WooCommerce Connector](../rez-woocommerce-connector/) - Alternative e-commerce platform
- [Order Service](../../RABTUL-Technologies/rez-order-service/) - Order data destination
- [Identity Service](../../RABTUL-Technologies/rez-identity-service/) - Customer data destination
