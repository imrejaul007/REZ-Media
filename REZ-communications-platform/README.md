# REZ Communications Platform

A multi-channel communications platform for sending Email, SMS, WhatsApp, and Push notifications. Built with TypeScript, designed for scalability and reliability.

## Features

- **Multi-Channel Support**: Email (SendGrid), SMS (Twilio), WhatsApp (Twilio), Push Notifications (Firebase)
- **Template Engine**: Handlebars-based templating with built-in helpers
- **Campaign Orchestration**: Coordinate multi-channel campaigns with priority queuing
- **Batch Processing**: Efficient bulk sending with rate limiting
- **Message Queuing**: Redis-backed queue for reliable message delivery
- **Health Monitoring**: Comprehensive health checks for all services
- **Mock Mode**: Full functionality without API credentials for testing

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REZ Communications Platform               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │     Email    │  │      SMS     │  │   WhatsApp   │    │
│  │   (SendGrid) │  │   (Twilio)   │  │   (Twilio)   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │             │
│  ┌──────┴─────────────────┴─────────────────┴───────┐    │
│  │              Service Adapters                     │    │
│  └──────────────────────┬────────────────────────────┘    │
│                          │                                  │
│  ┌──────────────────────┴────────────────────────────┐    │
│  │           Campaign Orchestrator                   │    │
│  │    - Multi-channel coordination                   │    │
│  │    - Priority queuing                            │    │
│  │    - Rate limiting                               │    │
│  └──────────────────────┬────────────────────────────┘    │
│                          │                                  │
│  ┌──────────────────────┴────────────────────────────┐    │
│  │              Template Engine                      │    │
│  │    - Handlebars templates                        │    │
│  │    - Built-in helpers                            │    │
│  │    - Variable extraction                         │    │
│  └──────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory:

```env
# Environment
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Email (SendGrid)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@example.com
EMAIL_FROM_NAME=REZ

# SMS (Twilio)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890

# WhatsApp (Twilio)
WHATSAPP_PROVIDER=twilio
WHATSAPP_FROM_NUMBER=+1234567890

# Push Notifications (Firebase)
PUSH_PROVIDER=firebase
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
FIREBASE_PROJECT_ID=your-project-id

# Redis (Queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Usage

### Programmatic Usage

```typescript
import {
  createCommunicationsPlatform,
  getDefaultConfig
} from '@rez-media/communications-platform';

async function main() {
  // Create platform with default config
  const platform = createCommunicationsPlatform(getDefaultConfig());

  // Send an email
  const emailResult = await platform.email.send({
    to: { email: 'user@example.com', name: 'John Doe' },
    subject: 'Welcome!',
    body: 'Hello, welcome to our service!',
    html: '<h1>Welcome!</h1><p>Hello, welcome to our service!</p>'
  });

  // Send an SMS
  const smsResult = await platform.sms.send({
    to: { countryCode: '1', number: '5551234567' },
    body: 'Your verification code is 123456'
  });

  // Send a WhatsApp message
  const whatsappResult = await platform.whatsapp.send({
    to: '+15551234567',
    body: 'Hello from WhatsApp!'
  });

  // Send a push notification
  const pushResult = await platform.push.send({
    to: { token: 'device-token', platform: 'ios' },
    title: 'New Message',
    body: 'You have a new message'
  });

  // Create a campaign
  const campaign = await platform.campaignOrchestrator.createCampaign({
    name: 'Welcome Campaign',
    channels: ['email', 'sms'],
    templateId: 'welcome-email',
    priority: 'high'
  });

  // Execute the campaign
  const result = await platform.campaignOrchestrator.executeCampaign(campaign.campaignId);

  // Cleanup
  await platform.destroy();
}

main();
```

### Using Templates

```typescript
// Register a custom template
platform.templateEngine.registerTemplate(
  'order-confirmation',
  `
    <h1>Order Confirmed!</h1>
    <p>Hi {{customerName}}, your order {{orderNumber}} is ready.</p>
    <p>Total: {{totalAmount}}</p>
  `,
  {
    channel: 'email',
    subject: 'Order {{orderNumber}} Confirmed',
    name: 'Order Confirmation'
  }
);

// Render with variables
const html = await platform.templateEngine.render('order-confirmation', {
  customerName: 'John Doe',
  orderNumber: 'ORD-12345',
  totalAmount: '$99.99'
});
```

### Using the REST API

Start the server:

```bash
npm run dev
```

#### Health Check

```bash
curl http://localhost:3000/health
```

#### Send Email

```bash
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": { "email": "user@example.com", "name": "John" },
    "subject": "Hello",
    "body": "Hello from REZ!",
    "html": "<h1>Hello!</h1><p>Hello from REZ!</p>"
  }'
```

#### Send SMS

```bash
curl -X POST http://localhost:3000/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": { "countryCode": "1", "number": "5551234567" },
    "body": "Your code is 123456"
  }'
```

#### Send WhatsApp

```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+15551234567",
    "body": "Hello from WhatsApp!"
  }'
```

#### Send Push Notification

```bash
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": { "token": "device-token", "platform": "ios" },
    "title": "New Message",
    "body": "You have a new message"
  }'
```

#### Create Campaign

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Campaign",
    "channels": ["email", "sms"],
    "templateId": "welcome-email",
    "priority": "high"
  }'
```

#### Render Template

```bash
curl -X GET http://localhost:3000/api/templates
curl -X POST http://localhost:3000/api/templates/welcome-email/render \
  -H "Content-Type: application/json" \
  -d '{
    "variables": { "firstName": "John", "companyName": "REZ" }
  }'
```

## API Reference

### Services

| Service | Description |
|---------|-------------|
| `email` | Email service via SendGrid |
| `sms` | SMS service via Twilio |
| `whatsapp` | WhatsApp service via Twilio |
| `push` | Push notifications via Firebase |
| `templateEngine` | Template rendering and management |
| `campaignOrchestrator` | Multi-channel campaign management |

### Channel Types

- `email` - Email messages
- `sms` - SMS text messages
- `whatsapp` - WhatsApp messages
- `push` - Push notifications (iOS, Android, Web)

### Message Statuses

- `pending` - Message is pending
- `queued` - Message is queued
- `sent` - Message was sent
- `delivered` - Message was delivered
- `read` - Message was read (WhatsApp)
- `failed` - Message failed
- `bounced` - Message bounced (Email)
- `unsubscribed` - Recipient unsubscribed

### Campaign Statuses

- `draft` - Campaign is in draft
- `scheduled` - Campaign is scheduled
- `running` - Campaign is executing
- `completed` - Campaign completed
- `cancelled` - Campaign was cancelled
- `failed` - Campaign failed

## Development

### Build

```bash
npm run build
```

### Run in Development

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Type Check

```bash
npm run typecheck
```

## Mock Mode

When no API credentials are configured, all services run in **mock mode**. This allows you to develop and test without external dependencies. Mock mode:

- Email: Simulates sends without actually sending
- SMS: Simulates sends without Twilio
- WhatsApp: Simulates sends without WhatsApp
- Push: Simulates sends without Firebase

## Rate Limits

| Channel | Rate Limit | Notes |
|---------|------------|-------|
| Email | 100/min (SendGrid) | Configurable |
| SMS | 1/sec (Twilio) | Depends on plan |
| WhatsApp | 20/sec (Twilio Business) | Depends on plan |
| Push | 500/batch (Firebase) | Max 500 per request |

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Render.com

Use the provided `render.yaml` blueprint:

```bash
render blueprints apply render.yaml
```

## License

MIT
