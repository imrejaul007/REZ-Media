# REZ Instagram Bridge Service

Connects Instagram to the REZ Agent OS for unified customer engagement across channels.

## Features

- **Instagram DM Automation** - Auto-reply to direct messages with intelligent routing
- **Comment-to-DM Automation** - Convert public comments to private conversations
- **Story Mention Tracking** - Monitor and engage with story mentions
- **Instagram-to-WhatsApp Handoff** - Seamless transfer to WhatsApp when needed
- **Session Linking** - Link Instagram users to REZ identities
- **Channel-Aware Tone** - Short, casual, emoji-friendly responses
- **Orchestrator Integration** - Route complex requests to the REZ Agent OS

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   Instagram     │────▶│  Instagram Bridge    │────▶│  REZ Orchestrator│
│   API/Webhooks  │     │  Service (Port 4090)│     │  (Port 4000)     │
└─────────────────┘     └──────────────────────┘     └──────────────────┘
                                  │
                                  ▼
                        ┌──────────────────────┐
                        │    MongoDB           │
                        │  (User/Conversation) │
                        └──────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+
- Instagram Business Account
- Meta Developer App with Instagram Messaging permissions

### Installation

```bash
# Clone and install dependencies
cd REZ-Media/rez-instagram-bridge
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
```

### Configuration

Update `.env` with:

```env
# Instagram/Meta API
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_account_id

# Webhook
WEBHOOK_VERIFY_TOKEN=your_verify_token
WEBHOOK_CALLBACK_URL=https://your-domain.com/webhook/instagram

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-instagram-bridge

# REZ Orchestrator
ORCHESTRATOR_URL=http://localhost:4000
INTERNAL_SERVICE_TOKENS_JSON={"instagram-bridge":"your-token"}

# Server
PORT=4090
```

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Webhook

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhook/instagram` | Webhook verification |
| POST | `/webhook/instagram` | Receive webhooks |
| POST | `/webhook/instagram/test` | Test webhook |

### Direct Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dm/conversations` | List conversations |
| GET | `/api/dm/conversations/:threadId` | Get conversation |
| POST | `/api/dm/send` | Send message |
| POST | `/api/dm/quick-reply` | Send quick reply |
| POST | `/api/dm/link-session` | Create link session |
| POST | `/api/dm/verify-link` | Verify link code |
| POST | `/api/dm/transfer/whatsapp/:id` | Transfer to WhatsApp |

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/comment/media/:mediaId` | Get media comments |
| GET | `/api/comment/:commentId` | Get comment |
| POST | `/api/comment/reply` | Reply to comment |
| POST | `/api/comment/hide` | Hide comment |
| POST | `/api/comment/escalate/:commentId` | Escalate comment |
| GET | `/api/comment/analytics` | Get analytics |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/account` | Get account info |
| GET | `/api/settings/config` | Get config |
| GET | `/api/settings/users/:id/preferences` | Get user preferences |
| PUT | `/api/settings/users/:id/preferences` | Update preferences |
| GET | `/api/settings/automation` | Get automation settings |
| PUT | `/api/settings/automation` | Update automation |

## Webhook Events

The service handles these Instagram webhook events:

- `messages` - Incoming DMs
- `mentions` - Story mentions
- `comments` - Media comments
- `read` - Message read events
- `delivery` - Delivery confirmations

## Intent Routing

Messages are analyzed for intent and routed accordingly:

| Intent | Confidence | Action |
|--------|------------|--------|
| `greeting` | >0.5 | Auto-reply |
| `product_inquiry` | >0.6 | Auto-reply or route |
| `booking` | >0.6 | Route to agent |
| `support_request` | >0.7 | Route to agent |
| `customer_complaint` | >0.6 | Always route |
| `return_exchange` | >0.7 | Route to agent |
| `general_inquiry` | <0.7 | Route for review |

## Channel Tone

Instagram uses a casual, friendly tone with emoji support:

- Max DM length: 2000 chars
- Max comment reply: 500 chars
- Max story reply: 150 chars
- Emoji support: Enabled
- GIFs: Enabled for DMs

## Session Linking

Link Instagram users to REZ accounts:

1. User sends "link" or "connect"
2. System generates 6-digit verification code
3. User enters code to verify
4. Session linked to REZ user ID

## Database Models

- **InstagramUser** - User profiles and preferences
- **InstagramConversation** - DM thread state
- **InstagramComment** - Comment tracking
- **InstagramSession** - Link session state

## Service-to-Service Communication

Internal endpoints use `X-Internal-Token` header for authentication. Tokens configured via `INTERNAL_SERVICE_TOKENS_JSON` environment variable.

## Security

- Webhook signature verification (HMAC-SHA256)
- Internal service token authentication
- Rate limiting per user
- Input validation with Zod schemas
- MongoDB parameterized queries

## Monitoring

Health endpoint: `GET /health`

Logs written to:
- Console (development)
- `error.log` - Error level
- `combined.log` - All levels

## Development

```bash
# Type check
npx tsc --noEmit

# Run tests
npm test

# Lint
npm run lint
```

## Meta API Permissions Required

- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_comments`
- `instagram_manage_insights`
- `instagram_manage_messages`
- `pages_read_engagement`
- `webhooks`

## License

Proprietary - REZ Commerce Platform
