# ReZ Checkout SDK

Universal one-click checkout SDK for merchants. Built with Express, TypeScript, and MongoDB.

## Features

- **Universal Cart**: Works across merchants with session-based persistence
- **One-Tap Reorder**: Quick reorder from previous orders
- **Address Intelligence**: Address validation, normalization, and saved addresses
- **Smart Payment Routing**: Automatically selects best payment method (UPI > CARD > COD)
- **Guest Checkout**: Full checkout support without authentication
- **Cart Persistence**: 30-day cart expiration for guests
- **Quick Buy**: Skip cart for single-item purchases
- **Fraud Detection**: Built-in velocity and risk checks

## Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 6+ (optional, for caching)

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/rez-checkout |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `JWT_SECRET` | JWT signing secret | (required) |
| `API_VERSION` | API version prefix | v1 |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `CORS_ORIGINS` | Allowed CORS origins | http://localhost:3000 |
| `FRAUD_CHECK_ENABLED` | Enable fraud detection | true |
| `MAX_ORDERS_PER_HOUR` | Max orders per user per hour | 10 |
| `MAX_ORDER_VALUE` | Max order value (Rs.) | 100000 |
| `PAYMENT_GATEWAY_URL` | Payment gateway URL | http://localhost:4001 |
| `PAYMENT_GATEWAY_API_KEY` | Payment gateway API key | - |

## Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint
```

## API Endpoints

### Cart Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/cart` | Get current cart |
| GET | `/v1/cart/count` | Get cart item count |
| POST | `/v1/cart/items` | Add item to cart |
| PUT | `/v1/cart/items/:productId` | Update cart item |
| DELETE | `/v1/cart/items/:productId` | Remove item |
| DELETE | `/v1/cart` | Clear cart |
| POST | `/v1/cart/quick-buy` | Quick buy single item |
| POST | `/v1/cart/discount` | Apply discount |

### Checkout

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/checkout/summary` | Get checkout summary |
| GET | `/v1/checkout/payment-methods` | Get available methods |
| POST | `/v1/checkout/payment/route` | Get payment routing |
| POST | `/v1/checkout` | Process checkout |
| POST | `/v1/checkout/reorder` | One-tap reorder |
| POST | `/v1/checkout/shipping/calculate` | Calculate shipping |

### Addresses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/addresses` | Get all addresses |
| GET | `/v1/addresses/default` | Get default address |
| POST | `/v1/addresses` | Add new address |
| PUT | `/v1/addresses/:id` | Update address |
| DELETE | `/v1/addresses/:id` | Delete address |
| POST | `/v1/addresses/:id/default` | Set as default |

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/orders` | Get user orders |
| GET | `/v1/orders/:orderId` | Get order details |
| GET | `/v1/orders/:orderId/tracking` | Get tracking |
| POST | `/v1/orders/:orderId/cancel` | Cancel order |

## Authentication

The SDK supports both authenticated and guest checkout:

### Authenticated Users

Include JWT token in Authorization header:
```
Authorization: Bearer <token>
```

### Guest Users

Use session ID header:
```
X-Session-Id: <session-id>
```

Session IDs are automatically generated for requests without authentication.

## Payment Methods

Supported payment methods:
- **UPI**: Preferred for amounts up to Rs. 1 lakh
- **CARD**: Credit/Debit cards (Visa, Mastercard, Rupay)
- **NETBANKING**: All major Indian banks
- **WALLET**: Paytm, PhonePe, etc.
- **COD**: Cash on Delivery (limited to Rs. 50,000)

## Smart Payment Routing

The SDK automatically selects the best payment method based on:
1. User's previous successful payments
2. Order amount
3. User type (guest vs authenticated)
4. Availability

## Deployment

### Render

One-click deploy to Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Or use the `render.yaml` blueprint:

```bash
render blueprints apply render.yaml
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

### Kubernetes

See `k8s/` directory for Kubernetes manifests (create separately).

## Project Structure

```
REZ-checkout-sdk/
├── src/
│   ├── index.ts           # Express server
│   ├── routes/
│   │   ├── cart.ts        # Cart operations
│   │   ├── checkout.ts    # Checkout flow
│   │   ├── address.ts     # Address management
│   │   ├── payment.ts     # Payment routing
│   │   └── orders.ts      # Order management
│   ├── services/
│   │   ├── cartService.ts    # Cart logic
│   │   ├── checkoutService.ts # Checkout flow
│   │   ├── addressService.ts # Address intelligence
│   │   └── paymentRouter.ts  # Smart payment routing
│   ├── models/
│   │   ├── Cart.ts        # Cart model
│   │   ├── Address.ts     # Address model
│   │   └── Order.ts       # Order model
│   └── middleware/
│       ├── auth.ts        # Authentication
│       └── fraudCheck.ts  # Fraud detection
├── package.json
├── tsconfig.json
├── render.yaml
└── README.md
```

## License

MIT
