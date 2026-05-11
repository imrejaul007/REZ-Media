# REZ Feedback Service

The learning infrastructure for the REZ ecosystem - capturing, analyzing, and learning from action feedback to improve AI decision-making.

## Overview

The Feedback Service implements a closed feedback loop:

```
Action → Feedback → Analysis → Model Update → Better Action
```

It collects both explicit feedback (user corrections) and implicit feedback (outcomes), analyzes patterns, detects drift, and sends insights to ReZ Mind for continuous model improvement.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start MongoDB and Redis
docker-compose up -d mongodb redis

# Run development server
npm run dev

# Run worker (separate terminal)
npm run worker
```

## API Endpoints

### Record Feedback

```bash
POST /feedback
Content-Type: application/json

{
  "action_id": "action_123",
  "outcome": "approved",
  "latency_ms": 150,
  "confidence_score": 0.95,
  "feedback_type": "explicit",
  "merchant_id": "merchant_456",
  "event_type": "risk_decision",
  "decision_made": "approve"
}
```

### Get Merchant Stats

```bash
GET /feedback/stats/:merchantId?period=7d
```

Response:
```json
{
  "total_actions": 1250,
  "approved_count": 980,
  "rejected_count": 120,
  "ignored_count": 50,
  "failed_count": 20,
  "edited_count": 80,
  "avg_latency": 145.5,
  "accuracy_score": 0.848,
  "explicit_count": 200,
  "implicit_count": 1050,
  "last_updated": 1704067200000
}
```

### Get Action History

```bash
GET /feedback/actions/:actionId?limit=50
```

### Get Learning Insights

```bash
GET /feedback/learning-insights?merchantId=merchant_456&minSeverity=medium
```

Response:
```json
{
  "insights": [
    {
      "merchant_id": "merchant_456",
      "insight_type": "drift",
      "severity": "high",
      "title": "accuracy_score drift detected",
      "description": "accuracy_score changed by 15.2%",
      "metrics": {
        "previous": 0.85,
        "current": 0.72,
        "change_percent": 15.2
      },
      "recommendations": [
        "Review recent decision changes",
        "Analyze recent feedback for patterns",
        "Consider model retraining with latest data"
      ],
      "generated_at": 1704067200000
    }
  ],
  "generated_at": 1704067200000,
  "count": 1
}
```

### Batch Feedback

```bash
POST /feedback/batch
Content-Type: application/json

[
  {
    "action_id": "action_1",
    "outcome": "approved",
    "confidence_score": 0.9,
    "feedback_type": "implicit",
    "merchant_id": "merchant_456",
    "event_type": "risk_decision",
    "decision_made": "approve"
  },
  {
    "action_id": "action_2",
    "outcome": "rejected",
    "confidence_score": 0.3,
    "feedback_type": "implicit",
    "merchant_id": "merchant_456",
    "event_type": "risk_decision",
    "decision_made": "reject"
  }
]
```

## Feedback Types

### Explicit Feedback

User-initiated feedback through direct correction or approval actions:
- User edits an AI recommendation
- User explicitly approves/rejects a suggestion
- User provides rating or thumbs up/down
- User selects from alternatives

### Implicit Feedback

Automatically inferred from outcomes and behavior:
- Action succeeded (approved outcome, goal achieved)
- Action failed (rejected, error occurred)
- Action was ignored (no user interaction within timeout)
- High/low latency indicates confidence
- Click-through or abandonment patterns

## Learning Insights

The service generates AI-readable insights for model improvement:

| Insight Type | Description |
|--------------|-------------|
| `pattern` | Recurring patterns in feedback data |
| `drift` | Significant changes in metrics over time |
| `recommendation` | Suggestions for model adjustments |
| `anomaly` | Unusual patterns requiring attention |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Action Agent   │────▶│ Feedback Service  │────▶│   ReZ Mind  │
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   BullMQ     │
                        │   (Redis)    │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   MongoDB    │
                        └──────────────┘
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | 4010 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/rez-feedback |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `REZ_MIND_URL` | ReZ Mind service URL | http://localhost:4000 |
| `REZ_MIND_API_KEY` | API key for ReZ Mind | - |
| `LOG_LEVEL` | Logging level | info |

## Health Checks

```bash
# Overall health
GET /health

# Liveness probe
GET /health/live

# Readiness probe
GET /health/ready
```

## Docker

```bash
# Build image
docker build -t rez-feedback-service .

# Run container
docker run -p 4010:4010 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/rez-feedback \
  -e REDIS_HOST=host.docker.internal \
  rez-feedback-service
```

## Environment

- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis >= 7.0

## License

Proprietary - REZ Technologies
