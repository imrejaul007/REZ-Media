# ReZ Journey Service

A customer journey automation service that enables creating, managing, and executing multi-step customer journeys with triggers, conditions, actions, and A/B testing capabilities.

## Features

- **Visual Journey Builder**: Create customer journeys with multiple step types
- **Trigger System**: Multiple trigger types (signup, purchase, behavior, schedule)
- **Conditional Branching**: Route customers based on attributes and behaviors
- **Step Types**: Messages, notifications, webhooks, delays, conditions
- **A/B Testing**: Test different journey variants
- **Analytics**: Track journey performance and conversion
- **Templates**: Pre-built journey templates
- **Journey Cloning**: Copy existing journeys
- **Real-time Execution**: Process journey events in real-time

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ReZ Journey Service                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Express API │  │   Journey   │  │    Event             │  │
│  │   (REST)     │  │   Engine     │  │    Processor         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                     │               │
│  ┌──────▼──────────────────▼─────────────────────▼───────────┐  │
│  │                    Journey Management                      │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │   Journey    │ │    Step      │ │    Analytics     │  │  │
│  │  │   Manager    │ │   Executor   │ │    Tracker        │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │                    Action Handlers                         │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │  │
│  │  │  Email  │ │  Push   │ │  SMS    │ │     Webhook      │ │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
PORT=3009
NODE_ENV=development

# Journey Settings
MAX_JOURNEY_STEPS=50
MAX_CONCURRENT_EXECUTIONS=1000
STEP_EXECUTION_TIMEOUT_MS=30000

# External Services
NOTIFICATION_SERVICE_URL=http://localhost:3012
WEBHOOK_SERVICE_URL=http://localhost:3013

# Redis (for state management)
REDIS_URL=redis://localhost:6379
```

## Running the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

### Journeys

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/journeys` | Create a new journey |
| GET | `/api/journeys` | List all journeys |
| GET | `/api/journeys/:id` | Get journey by ID |
| PUT | `/api/journeys/:id` | Update journey |
| DELETE | `/api/journeys/:id` | Delete journey |
| POST | `/api/journeys/:id/activate` | Activate journey |
| POST | `/api/journeys/:id/pause` | Pause journey |
| POST | `/api/journeys/:id/resume` | Resume journey |
| POST | `/api/journeys/:id/clone` | Clone journey |
| POST | `/api/journeys/:id/test` | Test journey execution |

### Steps

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/journeys/:id/steps` | Add step to journey |
| PUT | `/api/journeys/:id/steps/:stepId` | Update step |
| DELETE | `/api/journeys/:id/steps/:stepId` | Remove step |
| POST | `/api/journeys/:id/steps/:stepId/connect` | Connect steps |

### Entries

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/journeys/:id/entries` | Enroll customer in journey |
| GET | `/api/journeys/:id/entries` | List journey entries |
| GET | `/api/entries/:entryId` | Get entry details |
| DELETE | `/api/entries/:entryId` | Remove customer from journey |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List journey templates |
| GET | `/api/templates/:id` | Get template |
| POST | `/api/templates/:id/create` | Create journey from template |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/journeys/:id/analytics` | Get journey analytics |
| GET | `/api/journeys/:id/steps/:stepId/analytics` | Get step analytics |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/events` | Trigger a journey event |
| POST | `/api/events/process` | Process event batch |

## Data Models

### Journey

```typescript
interface Journey {
  id: string;
  name: string;
  description: string;
  status: JourneyStatus;
  trigger: TriggerConfig;
  steps: Step[];
  entryStepId: string;
  abTest: ABTestConfig;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  analytics: JourneyAnalyticsSummary;
  isTemplate: boolean;
  templateName?: string;
}
```

### JourneyStatus Enum

```typescript
enum JourneyStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived'
}
```

### TriggerConfig

```typescript
interface TriggerConfig {
  type: 'signup' | 'purchase' | 'abandoned_cart' | 'inactivity' | 'schedule' | 'manual';
  conditions?: TriggerCondition[];
  schedule?: {
    startDate?: Date;
    endDate?: Date;
    frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  };
}
```

### Step

```typescript
interface Step {
  id: string;
  name: string;
  type: StepType;
  config: StepConfig;
  nextStepId?: string;
  errorStepId?: string;
  delay?: {
    type: 'immediate' | 'delay' | 'scheduled';
    value?: number;
    unit?: 'minutes' | 'hours' | 'days';
  };
  conditions?: StepCondition[];
}
```

### StepType Enum

```typescript
enum StepType {
  ENTRY = 'entry',
  MESSAGE = 'message',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WEBHOOK = 'webhook',
  CONDITION = 'condition',
  DELAY = 'delay',
  END = 'end'
}
```

### ABTestConfig

```typescript
interface ABTestConfig {
  enabled: boolean;
  variants: Array<{
    variant: 'A' | 'B' | 'C' | 'D';
    weight: number;
    stepIds: string[];
  }>;
}
```

### JourneyAnalyticsSummary

```typescript
interface JourneyAnalyticsSummary {
  journeyId: string;
  totalEntries: number;
  activeEntries: number;
  completedEntries: number;
  failedEntries: number;
  conversionRate: number;
  avgCompletionTime: number;
  stepAnalytics: StepAnalytics[];
  lastUpdated: Date;
}
```

## API Examples

### Create Journey

```bash
curl -X POST http://localhost:3009/api/journeys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Series",
    "description": "Onboarding sequence for new customers",
    "trigger": {
      "type": "signup"
    },
    "steps": [
      {
        "name": "Welcome Email",
        "type": "email",
        "config": {
          "templateId": "welcome_email",
          "subject": "Welcome to ReZ!"
        }
      }
    ]
  }'
```

### Activate Journey

```bash
curl -X POST http://localhost:3009/api/journeys/uuid/activate
```

### Enroll Customer

```bash
curl -X POST http://localhost:3009/api/journeys/uuid/entries \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer_123",
    "attributes": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  }'
```

### Trigger Event

```bash
curl -X POST http://localhost:3009/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "event": "purchase",
    "customerId": "customer_123",
    "data": {
      "orderId": "order_456",
      "amount": 99.99,
      "items": ["item1", "item2"]
    }
  }'
```

## Journey Templates

Pre-built templates included:

1. **Welcome Series**: 3-email onboarding sequence
2. **Abandoned Cart Recovery**: 3-day reminder sequence
3. **Win-back Campaign**: Re-engagement for inactive customers
4. **Post-Purchase Follow-up**: Feedback request after purchase
5. **Birthday Campaign**: Automated birthday greetings

## Error Handling

| Error Code | Description |
|------------|-------------|
| `JOURNEY_NOT_FOUND` | Journey does not exist |
| `INVALID_JOURNEY_STATUS` | Cannot perform action in current status |
| `MAX_STEPS_EXCEEDED` | Journey exceeds maximum step limit |
| `CIRCULAR_REFERENCE` | Journey contains circular step references |
| `NO_ENTRY_STEP` | Journey has no entry step defined |

## Testing

```bash
npm test
```

## Deployment

### Docker

```bash
docker build -t rez-journey-service .
docker run -p 3009:3009 rez-journey-service
```

## License

MIT
