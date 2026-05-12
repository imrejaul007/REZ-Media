# REZ WhatsApp Commerce Backend

WhatsApp shopping/cart/checkout backend for the REZ commerce platform. Enables customers to browse products, manage carts, and complete orders through WhatsApp.

## Features

- **Product Catalog**: Browse products with search, categories, and filtering
- **Cart Management**: Add, update, remove items; apply discounts
- **Order Processing**: Create and manage orders from checkout
- **Payment Integration**: Support for Razorpay and REZ Wallet
- **WhatsApp Integration**: Receive and send messages via Twilio
- **Customer Sessions**: Track customer journey and context
- **Rate Limiting**: Protect against abuse
- **Caching**: Redis-based caching for performance

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Cache**: Redis with ioredis
- **Payments**: Razorpay
- **WhatsApp**: Twilio
- **Wallet**: REZ Wallet Service
- **Validation**: Zod

## Project Structure

```
src/
├── index.ts              # Server entry point
├── routes/
│   ├── catalog.ts        # Product catalog routes
│   ├── cart.ts           # Cart management routes
│   ├── orders.ts         # Order processing routes
│   ├── payments.ts       # Payment flow routes
│   └── customers.ts      # Customer session routes
├── services/
│   ├── catalogService.ts # Product catalog logic
│   ├── cartService.ts    # Cart management logic
│   ├── orderService.ts   # Order processing logic
│   └── paymentService.ts # Payment integration logic
├── models/
│   ├── Product.ts        # Product model
│   ├── Cart.ts           # Cart model
│   ├── Order.ts          # Order model
│   └── CustomerSession.ts # Customer session model
└── middleware/
    └── auth.ts           # Authentication middleware
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
- Redis
- Razorpay account (for payments)
- Twilio account (for WhatsApp)
- REZ Wallet Service (for wallet payments)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

### Configuration

Set these environment variables in `.env`:

```bash
# Server
PORT=4031
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-whatsapp-commerce

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Razorpay
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-key-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_PHONE_NUMBER=+14155238886

# REZ Wallet Service
WALLET_SERVICE_URL=http://localhost:4002
WALLET_SERVICE_TOKEN=your-wallet-token

# Internal Services
INTERNAL_SERVICE_TOKENS_JSON={"service-name":"token"}
```

### Running the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Catalog
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/catalog/products` | List products |
| GET | `/api/catalog/products/:id` | Get product |
| GET | `/api/catalog/products/featured` | Featured products |
| GET | `/api/catalog/products/search` | Search products |
| GET | `/api/catalog/categories` | List categories |
| GET | `/api/catalog/categories/:category/products` | Products by category |

### Cart
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | Get cart |
| POST | `/api/cart/items` | Add item |
| PUT | `/api/cart/items` | Update item |
| DELETE | `/api/cart/items` | Remove item |
| DELETE | `/api/cart` | Clear cart |
| POST | `/api/cart/discount` | Apply discount |
| POST | `/api/cart/validate` | Validate for checkout |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | List customer orders |
| GET | `/api/orders/:id` | Get order |
| PUT | `/api/orders/:id/status` | Update order status |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/initiate` | Initiate payment |
| POST | `/api/payments/verify` | Verify payment |
| GET | `/api/payments/status/:orderId` | Get payment status |
| POST | `/api/payments/refund` | Create refund |
| GET | `/api/payments/methods` | Available payment methods |
| GET | `/api/payments/wallet/balance` | Wallet balance |
| POST | `/api/payments/razorpay/webhook` | Razorpay webhook |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/customers/webhook` | WhatsApp webhook |
| GET | `/api/customers/session` | Get session |
| PUT | `/api/customers/session/state` | Update state |
| GET | `/api/customers/cart` | Get customer cart |
| GET | `/api/customers/orders` | Get customer orders |
| POST | `/api/customers/token` | Generate auth token |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |

## Authentication

### Customer Authentication
Include in request headers:
```
Authorization: Bearer <token>
```
Or:
```
X-Customer-Id: <customer_id>
X-Customer-Phone: <phone>
X-Merchant-Id: <merchant_id>
```

### Internal Service Authentication
Include in request headers:
```
X-Internal-Token: <service_token>
```

## Webhook Integration

### WhatsApp Webhook
Configure in Twilio:
- URL: `https://your-domain.com/api/customers/webhook`
- HTTP Method: GET (for verification) and POST (for messages)

### Razorpay Webhook
Configure in Razorpay dashboard:
- URL: `https://your-domain.com/api/payments/razorpay/webhook`
- Events: `payment.captured`, `payment.failed`, `refund.created`

## Testing

```bash
npm test
```

## License

Proprietary - REZ Commerce Platform
