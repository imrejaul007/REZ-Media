# ReZ Consumer Knowledge Base Service

Consumer Knowledge Base Service - stores memory, preferences, goals, and context for each consumer profile.

## Overview

This service is part of the ReZ commerce platform and provides:

- **Knowledge Base Management**: Store and retrieve consumer knowledge
- **Profile Management**: Manage consumer profiles with preferences and goals
- **Preference Learning**: Learn consumer preferences from behavior
- **Intent Extraction**: Extract intents from conversations and interactions
- **RTO Risk Scoring**: Calculate return-to-origin risk scores

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Consumer KB Service (Port 4010)               │
├─────────────────────────────────────────────────────────────────┤
│  Routes                    │  Services                          │
│  ├─ /api/kb                │  ├─ KBService                      │
│  └─ /api/profiles          │  ├─ ProfileService                 │
│                            │  ├─ PreferenceEngine               │
│                            │  ├─ IntentExtractor                │
│                            │  └─ RtoScoreService                │
├─────────────────────────────────────────────────────────────────┤
│  Models                                                         │
│  ├─ ConsumerProfile        │  KnowledgeBase                     │
│  ├─ Explicit Preferences   │  ├─ explicit_prefs                │
│  ├─ Inferred Preferences    │  ├─ inferred_prefs                │
│  ├─ Goals                   │  ├─ memory                         │
│  ├─ Memories                │  ├─ goals                         │
│  └─ RTO Score               │  ├─ context                       │
│                             └─ └─ conversations                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │     MongoDB      │
                    └──────────────────┘
```

## Knowledge Base Structure

```typescript
interface KnowledgeBase {
  consumerId: string;

  // Explicit preferences (told us)
  explicit_prefs: Map<string, KnowledgeEntry[]>;

  // Inferred preferences (learned)
  inferred_prefs: Map<string, KnowledgeEntry[]>;

  // Important context
  memory: KnowledgeEntry[];

  // Stated goals
  goals: KnowledgeEntry[];

  // Current situation
  context: KnowledgeEntry[];

  // Conversation history
  conversations: ConversationMemory[];

  // Intent graph links
  intentLinks: IntentLink[];
}
```

## RTO Score Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Order Count | 10% | More orders = more data = lower risk |
| Return Rate | 30% | Higher return rate = higher risk |
| COD Rate | 20% | Higher COD rate = higher risk |
| Fraud Signals | 25% | More signals = higher risk |
| Address Validity | 10% | Lower validity = higher risk |
| Device Trust | 5% | Lower trust = higher risk |

## API Endpoints

### Knowledge Base Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/kb` | Create new KB |
| GET | `/api/kb/:consumerId` | Get KB |
| PATCH | `/api/kb/:consumerId` | Update KB |
| POST | `/api/kb/:consumerId/preferences/explicit` | Add explicit preference |
| POST | `/api/kb/:consumerId/preferences/inferred` | Add inferred preference |
| POST | `/api/kb/:consumerId/memory` | Add memory |
| POST | `/api/kb/:consumerId/goals` | Add goal |
| PUT | `/api/kb/:consumerId/context` | Update context |
| GET | `/api/kb/:consumerId/search` | Search KB |
| POST | `/api/kb/:consumerId/conversations` | Add conversation |
| POST | `/api/kb/:consumerId/intent-link` | Link to intent graph |

### Profile Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/profiles` | Create profile |
| GET | `/api/profiles/:consumerId` | Get profile |
| PATCH | `/api/profiles/:consumerId` | Update profile |
| GET | `/api/profiles/:consumerId/summary` | Get summary |
| POST | `/api/profiles/:consumerId/preferences` | Add preference |
| POST | `/api/profiles/:consumerId/preferences/batch` | Batch update preferences |
| GET | `/api/profiles/:consumerId/preferences` | Get all preferences |
| POST | `/api/profiles/:consumerId/goals` | Add goal |
| PATCH | `/api/profiles/:consumerId/goals/:goalId` | Update goal status |
| GET | `/api/profiles/:consumerId/goals` | Get goals |
| POST | `/api/profiles/:consumerId/memories` | Add memory |
| GET | `/api/profiles/:consumerId/memories` | Get memories |
| PUT | `/api/profiles/:consumerId/context` | Update context |
| GET | `/api/profiles/:consumerId/context` | Get context |
| POST | `/api/profiles/:consumerId/rto-score` | Calculate RTO score |
| GET | `/api/profiles/:consumerId/rto-score` | Get RTO score |
| POST | `/api/profiles/:consumerId/flag` | Flag profile |
| DELETE | `/api/profiles/:consumerId/flag` | Unflag profile |
| GET | `/api/profiles` | Search profiles (admin) |

## Setup

### Prerequisites

- Node.js >= 18.0.0
- MongoDB 6.0+
- npm or yarn

### Installation

```bash
# Clone the repository
cd REZ-consumer-kb

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
```

### Configuration

```bash
# .env
PORT=4010
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez-consumer-kb
JWT_SECRET=your-jwt-secret
INTERNAL_SERVICE_TOKENS_JSON={"service-name":"token"}
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Testing

```bash
npm test
```

## Authentication

### Consumer Authentication

Consumer requests must include a valid JWT token:

```
Authorization: Bearer <jwt_token>
```

The JWT payload should include:
```json
{
  "userId": "consumer_123",
  "role": "consumer"
}
```

### Internal Service Authentication

Service-to-service requests use internal tokens:

```
X-Internal-Token: <service_token>
```

## Error Handling

All errors return a consistent format:

```json
{
  "error": "Error message",
  "details": {} // Optional validation details
}
```

## Monitoring

- Health check: `GET /health`
- Readiness check: `GET /ready`

## License

Proprietary - ReZ Commerce Platform
