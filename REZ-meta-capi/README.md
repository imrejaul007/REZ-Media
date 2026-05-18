# REZ Meta CAPI Service

**Port:** 4080

Server-side integration with Meta Conversions API (CAPI).

## Features

- Receive events from browser SDK
- Receive events from Shopify webhooks
- Send events to Meta Conversions API
- Event deduplication
- Batch processing
- Retry logic with exponential backoff
- User data hashing (SHA-256)

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

## Environment Variables

```env
PORT=4080
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez-meta-capi

# Meta Configuration
META_ACCESS_TOKEN=your-access-token
META_PIXEL_ID=your-pixel-id
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/events` | POST | Receive single event |
| `/api/events/batch` | POST | Receive batch events |
| `/api/shopify/events` | POST | Shopify webhook events |
| `/api/sdk/events` | POST | Browser SDK events |
| `/api/test/event` | POST | Test event (dev only) |

## Event Format

```typescript
interface Event {
  eventName: string;
  eventId?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  orderId?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  fbc?: string;  // Facebook Click ID
  fbp?: string;   // Facebook Browser ID
}
```

## Integration Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Browser    │     │   Server    │     │    Meta     │
│  (SDK)     │────▶│  (CAPI)    │────▶│   CAPI      │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Shopify    │
                     │  Webhooks  │
                     └──────────────┘
```

## Testing

```bash
# Send test event
curl -X POST http://localhost:4080/api/test/event
```

## Meta Standard Events

| Event | Description |
|-------|-------------|
| PageView | Page viewed |
| ViewContent | Product viewed |
| AddToCart | Item added to cart |
| InitiateCheckout | Checkout started |
| Purchase | Order completed |
| Lead | Lead captured |
| CompleteRegistration | User registered |
