# REZ AI Campaign Builder

AI-powered campaign generation from natural language goals.

## What It Does

```
Merchant says: "Get more lunch customers"

AI generates:
├── Campaign: "Lunch Rush 2026"
├── Channels: WhatsApp + Push + DOOH + QR
├── Targeting: Office workers, nearby
├── Budget: ₹10,000 allocated
├── Creative: AI-generated ad copy
└── Estimated: 50K reach, 150 conversions
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate` | POST | Generate campaign from goal |
| `/api/generate-creative` | POST | Generate ad copy |
| `/api/recommendations` | GET | Get channel recommendations |
| `/api/optimize` | POST | Optimize existing campaign |
| `/api/templates` | GET | Get campaign templates |

## Example Request

```bash
POST /api/generate
{
  "goal": "Get more lunch customers",
  "merchantType": "restaurant",
  "location": "Mumbai",
  "budget": 10000
}
```

## Example Response

```json
{
  "success": true,
  "data": {
    "id": "camp_123",
    "name": "Crave Rush 2026",
    "types": ["broadcast", "dooh", "qr", "in-app"],
    "channels": [
      { "type": "broadcast", "channels": ["whatsapp", "sms"], "budget": 3500 },
      { "type": "dooh", "channels": ["restaurant_tv"], "budget": 2500 },
      { "type": "qr", "channels": ["table_tent"], "budget": 2000 },
      { "type": "in-app", "channels": ["feed"], "budget": 2000 }
    ],
    "creative": {
      "headline": "Taste That Speaks!",
      "body": "Experience flavors that keep you coming back...",
      "cta": "Order Now"
    },
    "estimated": {
      "reach": 35000,
      "impressions": 50000,
      "clicks": 1000,
      "conversions": 50
    },
    "aiReasoning": [
      "Selected 4 channels based on restaurant industry patterns",
      "WhatsApp recommended for lunch rush timing",
      "Budget allocated with broadcast getting priority"
    ]
  }
}
```

## Setup

```bash
npm install
npm run dev
```

## OpenAI Integration (Optional)

The campaign generator uses GPT-4 for intelligent campaign creation when an OpenAI API key is provided. Without a key, it falls back to rule-based simulated responses.

### Getting an API Key

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Navigate to [API Keys](https://platform.openai.com/api-keys)
3. Create a new secret key
4. Copy the key (starts with `sk-`)

### Configuration

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-key-here
```

### What GPT-4 Handles

| Feature | Without API Key | With OpenAI API |
|---------|-----------------|-----------------|
| Goal parsing | Rule-based detection | Natural language understanding |
| Campaign names | Random templates | Context-aware generation |
| Ad copy | Predefined templates | Custom, compelling copy |
| Channel selection | Static recommendations | Dynamic, data-driven |
| AI reasoning | Generic explanations | Specific, actionable insights |

### Model Used

- **Model**: `gpt-4o`
- **Temperature**: 0.3-0.7 (varies by task)
- **Max tokens**: 20-500 (task-dependent)

### Cost Estimate

Typical request uses ~500-1500 tokens. With GPT-4o pricing (~$5/1M input tokens), each campaign generation costs approximately $0.0025-0.0075.

## Environment

```
PORT=4009
OPENAI_API_KEY=sk-...  # Optional
```
