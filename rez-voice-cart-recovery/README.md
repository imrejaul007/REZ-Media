# ReZ Voice Cart Recovery Service

AI-powered voice call service for cart abandonment recovery, COD confirmation, appointment reminders, and order status notifications.

## Features

- **Voice AI Engine**: Twilio-powered voice calls with TTS and STT
- **Smart Conversations**: AI-driven conversation flow with intent detection
- **Campaign Management**: Schedule and execute targeted call campaigns
- **DNC Filtering**: Do Not Call list management
- **Business Hours**: Timezone-aware calling windows
- **Retry Logic**: Automatic retry with configurable attempts
- **Real-time Webhooks**: Status updates and call monitoring
- **Transcription**: Call recording and transcript generation

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+ (optional)
- Twilio Account

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# - Add Twilio credentials
# - Set webhook URL
# - Configure MongoDB

# Build
npm run build

# Start
npm start
```

### Development

```bash
npm run dev
```

## API Endpoints

### Voice Calls

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/calls` | Initiate a voice call |
| GET | `/api/voice/calls/:id` | Get call status |
| POST | `/api/voice/calls/:id/cancel` | Cancel a call |
| GET | `/api/voice/stats` | Get call statistics |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/campaigns` | Create campaign |
| GET | `/api/voice/campaigns` | List campaigns |
| GET | `/api/voice/campaigns/:id` | Get campaign |
| PUT | `/api/voice/campaigns/:id` | Update campaign |
| POST | `/api/voice/campaigns/:id/execute` | Execute with targets |
| POST | `/api/voice/campaigns/:id/start` | Start campaign |
| POST | `/api/voice/campaigns/:id/pause` | Pause campaign |
| POST | `/api/voice/campaigns/:id/resume` | Resume campaign |
| POST | `/api/voice/campaigns/:id/cancel` | Cancel campaign |
| GET | `/api/voice/campaigns/:id/calls` | Campaign call history |
| GET | `/api/voice/campaigns/:id/analytics` | Campaign analytics |

### Transcripts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/voice/transcripts` | List transcripts |
| GET | `/api/voice/transcripts/:id` | Get transcript |
| GET | `/api/voice/transcripts/search` | Search transcripts |

### Recordings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/voice/recordings` | List recordings |

### DNC (Do Not Call)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dnc/add` | Add to DNC list |
| POST | `/api/dnc/bulk` | Bulk add to DNC |
| DELETE | `/api/dnc/:phone` | Remove from DNC |
| GET | `/api/dnc/check/:phone` | Check DNC status |
| GET | `/api/dnc/list` | List DNC entries |
| GET | `/api/dnc/stats` | DNC statistics |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/webhook` | Twilio voice webhook |
| POST | `/api/voice/webhook/status` | Status callback |
| POST | `/api/voice/webhook/recording` | Recording callback |

## Usage Examples

### Initiate a Cart Recovery Call

```bash
curl -X POST http://localhost:4053/api/voice/calls \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "to": "+919876543210",
    "trigger": "cart_abandoned",
    "customerId": "cust_123",
    "cartId": "cart_456",
    "metadata": {
      "customerName": "John Doe",
      "storeName": "ReZ Store",
      "itemCount": 3,
      "totalAmount": "₹1,299"
    }
  }'
```

### Create a Campaign

```bash
curl -X POST http://localhost:4053/api/voice/campaigns \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "name": "Weekend Flash Sale Cart Recovery",
    "trigger": "cart_abandoned",
    "templateId": "cart_recovery",
    "priority": "high",
    "maxAttempts": 3,
    "retryDelayMinutes": 60,
    "businessHours": {
      "enabled": true,
      "timezone": "Asia/Kolkata",
      "startHour": 9,
      "endHour": 21
    },
    "filters": {
      "excludeDnc": true,
      "minOrderValue": 500
    }
  }'
```

### Execute Campaign with Targets

```bash
curl -X POST http://localhost:4053/api/voice/campaigns/:id/execute \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "targets": [
      {
        "phone": "+919876543210",
        "customerId": "cust_123",
        "cartId": "cart_456",
        "context": {
          "customerName": "John Doe",
          "storeName": "ReZ Store",
          "itemCount": 3,
          "totalAmount": "₹1,299"
        }
      }
    ]
  }'
```

### Add to DNC List

```bash
curl -X POST http://localhost:4053/api/dnc/add \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-token" \
  -d '{
    "phone": "+919876543210",
    "reason": "Customer requested no calls",
    "source": "customer_support"
  }'
```

## Campaign Triggers

| Trigger | Delay | Priority | Use Case |
|---------|-------|----------|----------|
| `cart_abandoned` | 60 min | High | Recover abandoned carts |
| `cod_unconfirmed` | 30 min | Critical | Confirm COD orders |
| `appointment_reminder` | 24 hours before | Medium | Appointment reminders |
| `order_delayed` | Immediate | High | Delay notifications |

## Conversation Flow

```
AI: "Hi [Name], this is [Store] calling."
    ↓
AI: "We noticed you left items in your cart. [X] items totaling [Amount]. Would you like to complete your order?"
    ↓
User Response → Intent Detection
    ├── "Yes" → AI: "Great! Payment link sent. Anything else?"
    │       ↓
    │   User Response or Goodbye
    │
    ├── "No" → AI: "No problem. Anything else I can help with?"
    │       ↓
    │   Goodbye
    │
    ├── "Transfer" / Questions → AI: "I'll transfer you to an agent."
    │
    └── Silence / Unknown → AI: "I'll transfer you to an agent."
```

## Voice Templates

Templates are located in `src/templates/`:

- `cartRecovery.ts` - Cart abandonment recovery
- `codConfirmation.ts` - Cash on Delivery confirmation
- `appointmentReminder.ts` - Appointment reminders
- `orderDelayed.ts` - Order delay notifications

### Customizing Templates

```typescript
import { VoiceTemplate } from './types';

const customTemplate: VoiceTemplate = {
  id: 'custom_campaign',
  greeting: 'Hello {{customerName}}, this is {{storeName}} calling.',
  message: 'Your order is ready for pickup at {{storeName}}.',
  confirmIntent: 'Perfect! See you soon.',
  declineIntent: 'No problem. Let us know if you need anything.',
  transferToAgent: 'Let me connect you with someone who can help.',
  goodbye: 'Thank you for calling!'
};
```

## Twilio Configuration

### Required Twilio Products

1. **Programmable Voice** - For making and receiving calls
2. **TwiML Bins** - For basic webhook responses (optional)

### Webhook URLs to Configure

In your Twilio Console:

1. **Voice Calls** → Set status callback URL to:
   ```
   https://your-domain.com/api/voice/webhook/status
   ```

2. **Phone Number** → Set incoming call webhook to:
   ```
   https://your-domain.com/api/voice/webhook
   ```

### TwiML Bin Setup (Optional)

For static responses, create a TwiML Bin with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    Thank you for calling. An agent will be with you shortly.
  </Say>
  <Redirect>https://your-domain.com/api/voice/webhook</Redirect>
</Response>
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Voice Service                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Twilio SDK │  │   Express   │  │    Campaign Worker   │   │
│  │             │  │   Routes    │  │                     │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘   │
│         │                │                      │               │
│  ┌──────┴────────────────┴──────────────────────┴──────────┐    │
│  │                    Services Layer                       │    │
│  │  ┌──────────┐ ┌────────────┐ ┌───────────────────┐    │    │
│  │  │  Voice   │ │ Conversation│ │    Campaign       │    │    │
│  │  │  Service │ │  Engine    │ │    Service        │    │    │
│  │  └──────────┘ └────────────┘ └───────────────────┘    │    │
│  │  ┌──────────┐ ┌────────────┐ ┌───────────────────┐    │    │
│  │  │   DNC    │ │ Transcript │ │   Campaign        │    │    │
│  │  │  Service │ │  Service   │ │   Worker          │    │    │
│  │  └──────────┘ └────────────┘ └───────────────────┘    │    │
│  └───────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │                      Data Layer                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │ │
│  │  │   MongoDB   │  │    Redis    │  │   Twilio    │        │ │
│  │  │  (Calls,    │  │  (Queue,    │  │   (Calls,   │        │ │
│  │  │ Campaigns,  │  │   Cache)    │  │  Recordings) │        │ │
│  │  │ Transcripts)│  │             │  │              │        │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Service port (default: 4053) |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Yes | Twilio phone number |
| `VOICE_WEBHOOK_URL` | Yes | Public URL for webhooks |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | No | Redis connection string |
| `INTERNAL_SERVICE_TOKEN` | Yes | Internal service auth token |
| `HUMAN_AGENT_NUMBER` | No | Transfer destination number |

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx jest test/voiceService.test.ts
```

## Integration with Other Services

### Event-Driven Integration

Listen for events from `rez-automation-service`:

```typescript
// In campaignWorker.ts
async listenToAutomationEvents() {
  // Subscribe to cart.abandoned events
  eventBus.on('cart.abandoned', async (event) => {
    const call = await createCallFromEvent(event);
    await campaignService.scheduleCampaign(campaignId, [call]);
  });
}
```

### Service Communication

```typescript
// Get customer data from Lead Intelligence
const customer = await fetch(`${config.leadIntelligenceUrl}/api/customers/${id}`, {
  headers: { 'X-Internal-Token': config.internalServiceToken }
});

// Get cart data from Order Service
const cart = await fetch(`${config.orderServiceUrl}/api/carts/${cartId}`, {
  headers: { 'X-Internal-Token': config.internalServiceToken }
});
```

## Monitoring & Observability

### Health Check

```bash
curl http://localhost:4053/health
```

### Worker Status

```bash
curl http://localhost:4053/api/worker/status \
  -H "X-Internal-Token: your-token"
```

### Logs

Logs are output in JSON format for production:

```json
{
  "level": "info",
  "message": "Call initiated",
  "callSid": "CA...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Production Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/

EXPOSE 4053
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  voice-cart-recovery:
    build: .
    ports:
      - "4053:4053"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/rez-voice-cart-recovery
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
```

## License

Internal - RABTUL Technologies
