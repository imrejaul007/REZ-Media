# REZ Instagram Sales Agent

A specialized AI agent for Instagram commerce, handling DM conversations, lead capture, product discovery, checkout flows, and WhatsApp handoff.

## Features

- **Conversational Commerce**: Natural language processing for Instagram DMs and comments
- **Lead Capture**: Automatically capture and qualify leads from conversations
- **Product Discovery**: Smart product search and recommendations
- **Checkout Flow**: Guide customers through purchase with cart management
- **Carousel Responses**: Send product carousels and galleries
- **WhatsApp Handoff**: Seamlessly transfer conversations to WhatsApp
- **Story Mentions**: Handle and respond to story mentions
- **Follow-up Sequences**: Automated abandoned cart and re-engagement flows
- **Quick Replies**: Instagram-style quick reply buttons

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
cd rez-instagram-sales-agent

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure your environment variables
# Edit .env with your Instagram API credentials

# Build the project
npm run build

# Start the server
npm start
```

### Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## API Endpoints

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/instagram/message` | Process incoming DM |
| POST | `/api/instagram/send` | Send message to user |
| POST | `/api/instagram/carousel` | Send product carousel |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instagram/products` | Search products |
| GET | `/api/instagram/products/:id` | Get product details |

### Checkout

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/instagram/checkout` | Create checkout session |

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/instagram/leads` | Capture a lead |
| GET | `/api/instagram/leads/stats` | Get lead statistics |

### Links

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/instagram/links` | Generate shop links |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/instagram/webhook` | Instagram webhook endpoint |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/instagram/status` | Service status |

## Configuration

### Environment Variables

See `.env.example` for all configuration options.

Key variables:

- `PORT` - Server port (default: 4091)
- `INSTAGRAM_ACCESS_TOKEN` - Instagram API access token
- `WHATSAPP_BUSINESS_NUMBER` - WhatsApp Business number
- `LINK_IN_BIO_URL` - Your shop's link in bio URL

## Architecture

```
src/
├── config/          # Configuration files
│   ├── systemPrompt.ts    # AI system prompt
│   ├── tone.ts           # Tone guidelines
│   └── knowledge.ts      # Commerce knowledge base
├── services/        # Core services
│   ├── conversationService.ts  # DM conversations
│   ├── leadCapture.ts         # Lead management
│   ├── productDiscovery.ts    # Product search
│   ├── checkoutFlow.ts        # Checkout management
│   ├── storyMentionHandler.ts # Story mentions
│   ├── carouselService.ts     # Carousel formatting
│   └── linkService.ts         # Link generation
├── intents/         # Intent handling
│   ├── instagramIntents.ts    # Intent classification
│   ├── inquiryFlow.ts         # Product inquiries
│   ├── purchaseFlow.ts       # Purchase flow
│   └── followUpFlow.ts       # Follow-up sequences
├── responses/       # Response generation
│   ├── templates.ts          # Response templates
│   ├── quickReplies.ts       # Quick reply buttons
│   └── carousels.ts          # Carousel formatting
├── routes/          # Express routes
│   └── instagram.routes.ts
└── index.ts         # Server entry point
```

## Intent Classification

The agent automatically classifies messages into intents:

- `greeting` - Hello, hi, hey
- `product_inquiry` - Questions about products
- `price_inquiry` - Price questions
- `size_inquiry` - Size questions
- `purchase_intent` - Intent to buy
- `checkout_request` - Ready to checkout
- `payment_inquiry` - Payment methods
- `shipping_inquiry` - Shipping questions
- `return_inquiry` - Return/exchange questions
- `discount_request` - Discount codes
- `thanks` - Thank you messages
- `goodbye` - Farewell messages

## Response Guidelines

- Maximum 150 characters for DMs
- Maximum 100 characters for comments
- Use 1-2 emojis per message
- Casual, friendly tone
- One idea per message
- Always include soft CTA when appropriate

## Instagram Best Practices

- Keep responses short and conversational
- Use quick replies for common actions
- Send carousels for multiple products
- Include link in bio mentions
- Use story mentions for engagement
- Offer WhatsApp handoff for complex requests

## WhatsApp Handoff

For seamless experience, transfer conversations to WhatsApp when:

- Customer requests detailed support
- Complex checkout assistance needed
- Payment issues arise
- Returns/exchanges required

## Error Handling

All endpoints return consistent error formats:

```json
{
  "error": "Error message",
  "details": {} // Optional additional info
}
```

## License

MIT
