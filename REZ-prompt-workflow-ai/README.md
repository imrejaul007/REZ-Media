# REZ Prompt-to-Workflow AI Service

A service that generates marketing workflows from natural language using AI. The key Cheerio AI feature for automating customer journey creation.

## Features

- **Natural Language to Workflow**: Convert descriptions like "Welcome new customers with a 3-email series over 7 days" into structured workflow JSON
- **Multi-channel Support**: Email, SMS, WhatsApp, Push notifications
- **Smart Validation**: Ensures generated workflows are valid and follow best practices
- **Template Library**: Pre-built workflow templates for common use cases
- **Optimization**: Optimize existing workflows for specific goals
- **Journey Service Integration**: Import generated workflows directly to the journey service

## Quick Start

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o
PORT=4054
MONGODB_URI=mongodb://localhost:27017/rez-prompt-workflow-ai
REDIS_URL=redis://localhost:6379
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Generate Workflow

```bash
POST /api/generate
Content-Type: application/json

{
  "prompt": "Create a workflow to follow up on abandoned carts after 1 hour with WhatsApp, then email after 24 hours if no response, then SMS after 48 hours"
}
```

### Validate Workflow

```bash
POST /api/validate
Content-Type: application/json

{
  "workflow": { ... }
}
```

### Optimize Workflow

```bash
POST /api/optimize
Content-Type: application/json

{
  "workflow": { ... },
  "goals": ["reduce_steps", "increase_engagement"]
}
```

### Get Templates

```bash
GET /api/templates
GET /api/templates?category=welcome
GET /api/templates?popular=true&limit=5
```

### Import to Journey Service

```bash
POST /api/journeys/import
Content-Type: application/json

{
  "workflow": { ... },
  "targetJourneyId": "optional-journey-id"
}
```

## Workflow Schema

```typescript
{
  name: string,
  description: string,
  trigger: {
    type: 'abandoned_cart' | 'signup' | 'purchase' | 'manual' | 'schedule',
    conditions?: Condition[]
  },
  steps: [
    {
      id: string,
      type: 'message' | 'email' | 'sms' | 'whatsapp' | 'push' | 'webhook' | 'condition' | 'delay' | 'end' | 'split',
      config: StepConfig,
      position: { x: number, y: number },
      edges: string[] // connected step IDs
    }
  ],
  analytics: {
    trackOpens: boolean,
    trackClicks: boolean,
    trackConversions: boolean
  }
}
```

## Example Prompts

### Abandoned Cart Recovery

```
Create a workflow to follow up on abandoned carts after 1 hour with WhatsApp,
then email after 24 hours if no response, then SMS after 48 hours
```

### Welcome Series

```
Welcome new customers with a 3-email series over 7 days
```

### Win Back Campaign

```
Win back customers who haven't purchased in 90 days with increasing discounts
```

## Architecture

```
Prompt → Prompt Builder → OpenAI (GPT-4o) → Schema Validator → Workflow
                                           ↓
                                      Templates ← Workflow Generator
```

## Integration

- **REZ-journey-service**: Import generated workflows
- **REZ-creative-engine**: Generate content for steps
- **REZ-communications-platform**: Channel configurations

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| OPENAI_API_KEY | OpenAI API key | Required |
| OPENAI_MODEL | Model to use | gpt-4o |
| PORT | Service port | 4054 |
| MONGODB_URI | MongoDB connection string | localhost |
| REDIS_URL | Redis connection string | localhost |
| INTERNAL_SERVICE_TOKEN | Service-to-service auth | Required |

## License

MIT
