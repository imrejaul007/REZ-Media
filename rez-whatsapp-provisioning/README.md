# REZ WhatsApp Provisioning Service

A multi-tenant WhatsApp provisioning service for the REZ platform, built with Express, TypeScript, MongoDB, and Twilio API.

## Features

- **Multi-tenant Architecture**: Each merchant gets their own subaccount and credentials
- **Phone Number Management**: Search, provision, and manage WhatsApp-enabled phone numbers
- **Template Management**: Create and manage WhatsApp message templates
- **Webhook Processing**: Handle inbound messages, delivery status, and template updates
- **Secure API**: Internal service authentication with token-based access
- **Rate Limiting**: Built-in protection against abuse
- **Audit Logging**: Comprehensive logging with Winston

## Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis (optional, for caching)
- Twilio Account with WhatsApp Business API access

## Installation

```bash
# Clone the repository
cd rez-whatsapp-provisioning

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your credentials
```

## Configuration

Configure the following environment variables in `.env`:

```bash
# Server
PORT=3005
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez_whatsapp_provisioning

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret
TWILIO_WHATSAPP_SANDBOX_NUMBER=+14155238886

# Webhooks
WEBHOOK_BASE_URL=https://your-domain.com

# Internal Service Authentication
INTERNAL_SERVICE_TOKENS_JSON={"rez-platform":"your-service-token"}

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Building

```bash
# Build for production
npm run build

# Run in development mode
npm run dev

# Start production server
npm start
```

## API Endpoints

### Provisioning

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/provision/provision` | Provision WhatsApp for a merchant |
| GET | `/api/v1/provision/:merchantId` | Get merchant WhatsApp details |
| PATCH | `/api/v1/provision/:merchantId/suspend` | Suspend merchant WhatsApp |
| PATCH | `/api/v1/provision/:merchantId/activate` | Activate merchant WhatsApp |
| DELETE | `/api/v1/provision/:merchantId` | Close merchant WhatsApp |
| GET | `/api/v1/provision/:merchantId/usage` | Get merchant usage statistics |
| POST | `/api/v1/provision/:merchantId/regenerate-credentials` | Regenerate API credentials |

### Phone Numbers

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/numbers/search` | Search available phone numbers |
| POST | `/api/v1/numbers/provision` | Provision a phone number |
| GET | `/api/v1/numbers/:merchantId` | List merchant phone numbers |
| GET | `/api/v1/numbers/:merchantId/:sid` | Get phone number details |
| PATCH | `/api/v1/numbers/:merchantId/:sid` | Update phone number |
| DELETE | `/api/v1/numbers/:merchantId/:sid` | Release phone number |
| POST | `/api/v1/numbers/:merchantId/:sid/sandbox` | Add number to WhatsApp sandbox |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/templates` | Create a message template |
| GET | `/api/v1/templates/merchant/:merchantId` | List merchant templates |
| GET | `/api/v1/templates/merchant/:merchantId/approved` | List approved templates |
| GET | `/api/v1/templates/:sid` | Get template details |
| PATCH | `/api/v1/templates/:merchantId/:name` | Update template |
| DELETE | `/api/v1/templates/:merchantId/:sid` | Delete template |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/whatsapp/inbound` | Inbound message webhook |
| POST | `/webhooks/whatsapp/status` | Message status webhook |
| POST | `/webhooks/whatsapp/outbound` | Outbound webhook |
| POST | `/webhooks/whatsapp/template` | Template status webhook |
| GET | `/webhooks/events` | Get event history |
| GET | `/webhooks/events/:id` | Get event details |

### Health Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health status |
| GET | `/ready` | Readiness check with dependencies |

## Authentication

All API endpoints (except webhooks and health checks) require internal service authentication:

```bash
X-Internal-Token: your-service-token
```

Configure service tokens in `INTERNAL_SERVICE_TOKENS_JSON`:

```json
{
  "rez-platform": "token-for-rez-platform",
  "other-service": "token-for-other-service"
}
```

## Usage Examples

### Provision WhatsApp for a Merchant

```bash
curl -X POST http://localhost:3005/api/v1/provision/provision \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "merchantId": "merchant-123",
    "businessName": "Test Business",
    "businessEmail": "business@example.com",
    "businessPhone": "+1234567890",
    "industry": "Retail",
    "useCase": "Customer Support",
    "webhookUrl": "https://example.com/webhooks/whatsapp"
  }'
```

### Search Available Phone Numbers

```bash
curl -X POST http://localhost:3005/api/v1/numbers/search \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "countryCode": "US",
    "type": "toll_free",
    "limit": 10
  }'
```

### Create a Message Template

```bash
curl -X POST http://localhost:3005/api/v1/templates \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "merchantId": "merchant-123",
    "subaccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "name": "order_confirmation",
    "language": "en",
    "category": "transactional",
    "components": [
      {
        "type": "HEADER",
        "format": "TEXT",
        "text": "Order Confirmed!"
      },
      {
        "type": "BODY",
        "text": "Hi {{1}}, your order #{{2}} has been confirmed. Total: {{3}}"
      },
      {
        "type": "FOOTER",
        "text": "Thank you for shopping with us!"
      }
    ]
  }'
```

## Project Structure

```
rez-whatsapp-provisioning/
├── src/
│   ├── config/
│   │   └── twilio.config.ts      # Twilio and service configuration
│   ├── middleware/
│   │   ├── auth.ts               # Internal service authentication
│   │   ├── error.ts              # Error handling
│   │   └── validation.ts         # Request validation schemas
│   ├── models/
│   │   ├── MerchantWhatsApp.ts   # Merchant WhatsApp schema
│   │   ├── PhoneNumber.ts        # Phone number schema
│   │   └── Template.ts           # Message template schema
│   ├── routes/
│   │   ├── provision.routes.ts   # Provisioning endpoints
│   │   ├── number.routes.ts      # Phone number endpoints
│   │   ├── template.routes.ts    # Template endpoints
│   │   └── webhook.routes.ts     # Webhook handlers
│   ├── services/
│   │   ├── twilioService.ts      # Core Twilio operations
│   │   ├── subaccountService.ts  # Subaccount management
│   │   ├── numberService.ts      # Number provisioning
│   │   ├── templateService.ts    # Template management
│   │   └── webhookService.ts     # Webhook processing
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts             # Winston logging configuration
│   └── index.ts                  # Application entry point
├── .env.example                  # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional details"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Access denied |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Monitoring

The service exposes Prometheus-compatible metrics at `/metrics` (when configured):

- `http_requests_total`: Total HTTP requests by method and endpoint
- `http_request_duration_seconds`: Request duration histogram
- `twilio_api_requests_total`: Twilio API calls by endpoint
- `active_merchants`: Number of active merchant accounts
- `provisioned_numbers`: Total provisioned phone numbers

## License

Private - All rights reserved
