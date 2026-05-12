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

## Environment

```
PORT=4009
```
