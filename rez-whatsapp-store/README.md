# REZ WhatsApp Store Service

A complete WhatsApp commerce platform that enables shopping through WhatsApp using Twilio's WhatsApp Business API. Built with Express, MongoDB, and integrates with the REZ Payment, Wallet, and Order services.

## Features

- **WhatsApp Integration**: Full Twilio WhatsApp Business API integration with webhook support
- **Product Catalog**: Browse products by category, search, and view featured items
- **Shopping Cart**: Add, update, remove items with automatic delivery fee calculation
- **Checkout Flow**: Address collection, delivery options, and multiple payment methods
- **Order Management**: Create, track, and manage orders with status updates
- **Payment Integration**: Razorpay integration for UPI, cards, and wallet payments
- **Rich Messages**: Product cards, cart displays, and quick reply buttons

## Architecture

```
rez-whatsapp-store/
├── src/
│   ├── config/          # Configuration and environment setup
│   ├── models/          # MongoDB models (Cart, Order, Checkout)
│   ├── services/        # Business logic (catalog, cart, checkout, payment, order)
│   ├── handlers/        # Message handlers (product, cart, checkout, message)
│   ├── messages/        # WhatsApp message formatters
│   ├── routes/          # REST API routes
│   └── index.ts         # Main entry point
```

## Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- Redis (optional, for caching)
- Twilio WhatsApp Business Account
- Razorpay Account (for payments)

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server Configuration
PORT=4005
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-whatsapp-store

# Redis
REDIS_URL=redis://localhost:6379

# Internal Service Tokens
INTERNAL_SERVICE_TOKENS_JSON={"whatsapp-store":"token","payment-service":"token"}

# JWT
JWT_SECRET=your-jwt-secret

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSapp_FROM_NUMBER=+14155238886

# WhatsApp Business
WHATSAPP_BUSINESS_ACCOUNT_ID=WBAxxxxx
WHATSAPP_PHONE_NUMBER_ID=xxxxx
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_APP_SECRET=xxxxx

# Razorpay
RAZORPAY_KEY_ID=rzp_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# Service URLs
WALLET_SERVICE_URL=http://localhost:4002
PAYMENT_SERVICE_URL=http://localhost:4003
ORDER_SERVICE_URL=http://localhost:4004
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Type checking
npm run typecheck
```

## API Endpoints

### Health Check
```
GET /health
GET /ready
```

### Cart Operations
```
GET  /api/cart                    # Get cart
GET  /api/cart/summary            # Get cart summary
POST /api/cart/items              # Add item to cart
PATCH /api/cart/items             # Update item quantity
DELETE /api/cart/items            # Remove item
DELETE /api/cart                  # Clear cart
POST /api/cart/validate           # Validate for checkout
```

### Checkout Operations
```
POST /api/checkout                # Initiate checkout
GET  /api/checkout/:id            # Get checkout details
PATCH /api/checkout/:id/address   # Set delivery address
PATCH /api/checkout/:id/delivery  # Select delivery option
POST /api/checkout/:id/payment    # Initiate payment
POST /api/checkout/:id/complete   # Complete checkout
POST /api/checkout/:id/coupon     # Apply coupon
DELETE /api/checkout/:id/coupon   # Remove coupon
POST /api/checkout/:id/cancel    # Cancel checkout
```

### Order Operations
```
GET  /api/orders                  # List orders
GET  /api/orders/:id              # Get order details
GET  /api/orders/:id/summary      # Get order summary
PATCH /api/orders/:id/status      # Update order status
PATCH /api/orders/:id/payment     # Update payment status
POST /api/orders/:id/cancel       # Cancel order
GET  /api/orders/stats/summary    # Get order statistics
```

### Products
```
GET  /api/products                # List products
GET  /api/products/featured       # Featured products
GET  /api/products/categories     # List categories
GET  /api/products/:id            # Get product details
```

## WhatsApp Commands

Users can interact with the store using these commands:

| Command | Description |
|---------|-------------|
| `hi`, `hello` | Start conversation |
| `shop`, `browse` | Browse products |
| `add [product]` | Add product to cart |
| `cart` | View your cart |
| `update [qty] [item]` | Update quantity |
| `remove [item]` | Remove from cart |
| `checkout` | Start checkout |
| `orders` | View order history |
| `track [order ID]` | Track order |
| `help` | Get help |

## Webhook Setup

1. Set up your Twilio WhatsApp webhook
2. Point it to: `https://your-domain.com/webhook/whatsapp`
3. Configure the verify token in your `.env`

## WhatsApp Message Flow

1. **Greeting** -> Welcome message with main menu
2. **Browse** -> Product categories
3. **Select Product** -> Product details with Add to Cart
4. **Add to Cart** -> Confirmation with cart summary
5. **Checkout** -> Address collection -> Delivery selection -> Payment
6. **Order Confirmation** -> Order ID and tracking info

## Integration with REZ Services

### Payment Service
- Creates Razorpay orders
- Verifies payment signatures
- Processes refunds
- Syncs payment status

### Wallet Service
- Checks wallet balance
- Deducts for wallet payments

### Order Service
- Creates orders
- Updates order status
- Syncs order data

## Error Handling

All API responses follow this format:
```json
{
  "success": true|false,
  "error": "Error message",
  "details": {}
}
```

## Rate Limiting

Rate limiting is configurable via environment variables:
- `RATE_LIMIT_REQUESTS_PER_MINUTE`: 60 (default)
- `RATE_LIMIT_BURST`: 10 (default)

## Security

- JWT authentication for internal service calls
- HMAC signature verification for webhooks
- Input validation using Zod schemas
- Helmet for security headers
- CORS configuration

## License

MIT
