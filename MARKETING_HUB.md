# REZ Marketing Hub - Complete Documentation

**Last Updated:** May 12, 2026

---

## Overview

The **REZ Marketing Hub** is the central communication platform that powers all marketing, notifications, and messaging across the entire REZ ecosystem. It connects:

- **38 AI Agents** (REZ-Agent-OS)
- **All REZ-Media Apps** (adBazaar, creators, dooh, etc.)
- **All Mobile Apps** (Hotel OTA, Rendez, Food Delivery)
- **Multi-Channel Delivery** (Email, SMS, WhatsApp, Push, In-App)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REZ MARKETING HUB                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    INPUT SOURCES                                      │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │ REZ-Agent-OS │  │   REZ-Media   │  │  External    │            │   │
│  │  │  (38 agents)  │  │   Services    │  │  Webhooks    │            │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │   │
│  │         │                  │                  │                      │   │
│  └─────────┼──────────────────┼──────────────────┼──────────────────────┘   │
│            │                  │                  │                           │
│            └──────────────────┴────────┬─────────┘                           │
│                                      │                                      │
│  ┌───────────────────────────────────┼─────────────────────────────────────┐│
│  │                    CAMPAIGN ENGINE                                     ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              ││
│  │  │  Template    │  │  Audience   │  │  Channel    │              ││
│  │  │  Engine      │──▶│  Targeting  │──▶│  Router      │              ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘              ││
│  │         │                                                         ││
│  │         ▼                                                         ││
│  │  ┌──────────────────────────────────────────────────────────────┐  ││
│  │  │                    DELIVERY CHANNELS                          │  ││
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  ││
│  │  │  │  Email  │ │   SMS   │ │WhatsApp │ │  Push   │        │  ││
│  │  │  │SendGrid │ │ Twilio │ │ Twilio  │ │Firebase │        │  ││
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  ││
│  │  └──────────────────────────────────────────────────────────────┘  ││
│  │                                                                       ││
│  │  ┌──────────────────────────────────────────────────────────────┐  ││
│  │  │                    OUTPUT DESTINATIONS                         │  ││
│  │  │  adBazaar  creators  dooh  Hotel OTA  Rendez  Food Delivery │  ││
│  │  └──────────────────────────────────────────────────────────────┘  ││
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

### 1. Multi-Channel Messaging
- **Email**: SendGrid integration with HTML templates
- **SMS**: Twilio with Unicode support
- **WhatsApp**: Twilio WhatsApp Business API
- **Push Notifications**: Firebase Cloud Messaging
- **In-App**: Database storage for real-time alerts

### 2. Campaign Management
- Create and schedule campaigns
- A/B testing with variants
- Personalization with Handlebars templates
- Audience segmentation
- Delivery optimization

### 3. Template System
- Pre-built marketing templates
- Custom template creation
- Variable substitution
- Multi-channel adaptation
- WhatsApp Business templates

### 4. Agent Integration
- Direct connection to REZ-Agent-OS
- Automated campaign triggers
- Real-time personalization
- Conversion tracking
- Performance analytics

### 5. Analytics & Reporting
- Delivery status tracking
- Open/click rates
- Conversion attribution
- A/B test results
- Channel performance

---

## API Endpoints

### Campaign Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/campaigns/send` | Internal | Send campaign to users |
| POST | `/api/campaigns/schedule` | Internal | Schedule campaign |
| POST | `/api/campaigns/abort/:id` | Internal | Abort scheduled campaign |
| GET | `/api/campaigns/templates` | Internal | List templates |
| GET | `/api/campaigns/templates/:id` | Internal | Get template |
| GET | `/api/campaigns/history` | Internal | Campaign history |
| GET | `/api/campaigns/:id/status` | Internal | Campaign status |

### Notification Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/notifications/send` | Internal | Send single notification |
| POST | `/api/notifications/send-batch` | Internal | Batch notifications |
| GET | `/api/notifications/:id/status` | Internal | Notification status |

### Channel Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/email/send` | Internal | Send email |
| POST | `/api/email/send-batch` | Internal | Batch emails |
| POST | `/api/sms/send` | Internal | Send SMS |
| POST | `/api/sms/send-batch` | Internal | Batch SMS |
| POST | `/api/whatsapp/send` | Internal | Send WhatsApp |
| POST | `/api/whatsapp/send-template` | Internal | Send WhatsApp template |
| POST | `/api/push/send` | Internal | Send push notification |
| POST | `/api/push/send-to-topic` | Internal | Send to FCM topic |
| POST | `/api/push/subscribe` | Internal | Subscribe device |
| POST | `/api/push/unsubscribe` | Internal | Unsubscribe device |

### Agent Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/agents/trigger/:agentType` | Internal | Trigger agent campaign |
| POST | `/api/agents/trigger` | Internal | Trigger with body |
| POST | `/api/agents/insights` | Internal | Receive agent insights |
| GET | `/api/agents` | Internal | List registered agents |
| GET | `/api/agents/:agentType` | Internal | Agent details |
| POST | `/api/agents/campaign` | Internal | Execute campaign |
| GET | `/api/agents/analytics/summary` | Internal | Agent analytics |

### Webhook Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/webhooks/whatsapp` | Signature | WhatsApp verification |
| POST | `/webhooks/whatsapp` | Signature | WhatsApp incoming |
| POST | `/webhooks/twilio/sms` | Signature | Twilio SMS callback |
| POST | `/webhooks/twilio/whatsapp` | Signature | Twilio WA callback |
| POST | `/webhooks/sendgrid` | Signature | SendGrid events |
| POST | `/webhooks/firebase` | Signature | FCM delivery receipt |

---

## Marketing Templates

### Advertising Templates

| Template ID | Name | Channels | Description |
|------------|------|----------|-------------|
| `ad_approved` | Ad Approved | Email, Push | Ad goes live notification |
| `ad_rejected` | Ad Rejected | Email, Push | Ad rejected with reason |
| `ad_spend_milestone` | Spend Milestone | Push | Budget percentage reached |
| `ad_budget_alert` | Budget Alert | Push, Email | Daily/total budget warning |
| `ad_engagement_spike` | Engagement Spike | Push | Unusual activity detected |
| `ad_viewed_no_click` | No Click Follow-up | Push | Re-engagement for viewers |

### Gamification Templates

| Template ID | Name | Channels | Description |
|------------|------|----------|-------------|
| `achievement_unlocked` | Achievement | Push | Badge earned |
| `streak_milestone` | Streak | Push | Streak days reached |
| `challenge_completed` | Challenge | Push | Challenge finished |
| `leaderboard_update` | Leaderboard | Push | Rank changed |
| `points_expiring` | Points Expiring | Push, Email | Points about to expire |
| `level_up` | Level Up | Push | User leveled up |
| `referral_bonus` | Referral Bonus | Push | Referral reward earned |

### Marketing Templates

| Template ID | Name | Channels | Description |
|------------|------|----------|-------------|
| `welcome_sequence` | Welcome | Email, WhatsApp | New user onboarding |
| `abandonment_recovery` | Cart Recovery | Email, SMS, WhatsApp | Abandoned cart reminder |
| `win_back` | Win Back | Email, SMS, WhatsApp | Churned user reactivation |
| `reengagement` | Re-engagement | Email, Push | Lapsed user reminder |
| `referral` | Referral | Email, SMS, WhatsApp | Referral invitation |
| `promotion` | Promotion | Email, Push | Deal announcement |
| `loyalty_tier` | Tier Upgrade | Push, Email | VIP tier achieved |

### Transactional Templates

| Template ID | Name | Channels | Description |
|------------|------|----------|-------------|
| `order_confirmation` | Order Confirm | Email, SMS | Order placed |
| `payment_success` | Payment | Email, Push | Payment received |
| `payment_failed` | Payment Failed | Email, SMS | Payment declined |
| `shipping_update` | Shipping | Email, SMS | Delivery status |
| `delivery_complete` | Delivered | Email, Push | Order delivered |

### Notifications Templates

| Template ID | Name | Channels | Description |
|------------|------|----------|-------------|
| `price_alert` | Price Drop | Push, Email | Product price reduced |
| `new_deal` | New Deal | Push, Email | New offer nearby |
| `reservation_reminder` | Reminder | Push, SMS | Appointment reminder |
| `appointment_confirmed` | Confirmed | Push, SMS | Booking confirmed |
| `loyalty_update` | Points Added | Push | Points credited |

---

## App Integrations

### adBazaar (Web App)

| Event | Template | Channel | Delay |
|-------|----------|---------|-------|
| Ad Approved | `ad_approved` | Push, Email | 0 |
| Ad Rejected | `ad_rejected` | Push, Email | 0 |
| Spend 50% | `ad_spend_milestone` | Push | 0 |
| Budget Alert | `ad_budget_alert` | Push, Email | 0 |
| New Campaign | `promotion` | Push | 0 |

### creators (Web App)

| Event | Template | Channel | Delay |
|-------|----------|---------|-------|
| Campaign Match | `new_deal` | Push, Email | 0 |
| Payment Received | `payment_success` | Push | 0 |
| Milestone Reached | `achievement_unlocked` | Push | 0 |
| Referral Bonus | `referral_bonus` | Push | 0 |

### dooh (Digital Out-of-Home)

| Event | Template | Channel | Delay |
|-------|----------|---------|-------|
| Screen Approved | `ad_approved` | Email | 0 |
| Screen Rejected | `ad_rejected` | Email | 0 |
| Revenue Alert | `ad_spend_milestone` | Push | 0 |

### Hotel OTA (Mobile App)

| Event | Template | Channel | Delay |
|-------|----------|---------|-------|
| Booking Confirm | `order_confirmation` | Push, SMS | 0 |
| Check-in Reminder | `reservation_reminder` | Push | 24h before |
| Check-out | `loyalty_update` | Push | 0 |
| Price Drop | `price_alert` | Push | 0 |
| Abandonment | `abandonment_recovery` | SMS, WhatsApp | 1h |
| Win Back | `win_back` | Email, Push | 7d |

### Rendez (Mobile App)

| Event | Template | Channel | Delay |
|-------|----------|---------|-------|
| Reservation Confirm | `appointment_confirmed` | Push, SMS | 0 |
| Reminder | `reservation_reminder` | Push | 4h before |
| Review Request | `promotion` | Push | 2h after |
| Points Added | `loyalty_update` | Push | 0 |

### Food Delivery (Mobile App)

| Event | Template | Channel | Delay |
|-------|----------|---------|-------|
| Order Confirm | `order_confirmation` | Push, SMS | 0 |
| Preparing | `shipping_update` | Push | 0 |
| Out for Delivery | `shipping_update` | Push | 0 |
| Delivered | `delivery_complete` | Push | 0 |
| Abandonment | `abandonment_recovery` | SMS, WhatsApp | 30m |
| Review | `promotion` | Push | 2h after |

---

## Agent Triggers

### engagement_agent

Triggers campaigns for user engagement:

```typescript
// Re-engagement flow
engagement_agent.trigger('reengagement', {
  userId: 'user123',
  daysSinceLastVisit: 14,
  lastCategory: 'restaurants'
});
```

### retention_agent

Handles user retention and win-back:

```typescript
// Win-back campaign
retention_agent.trigger('win_back', {
  userId: 'user456',
  churnScore: 0.8,
  bonusPoints: 500
});
```

### referral_agent

Drives referral program:

```typescript
// Referral invitation
referral_agent.trigger('referral', {
  userId: 'user789',
  referralCode: 'SAVE20',
  rewardAmount: 200
});
```

### upsell_agent

Handles cross-selling and upselling:

```typescript
// Cross-sell campaign
upsell_agent.trigger('promotion', {
  userId: 'user101',
  productId: 'premium',
  discount: 15
});
```

---

## WhatsApp Business Integration

### Supported Templates

| Template | Language | Category |
|----------|----------|----------|
| `order_confirmation` | en | ORDER_UPDATE |
| `shipping_update` | en | ORDER_UPDATE |
| `payment_success` | en | TRANSACTION |
| `abandonment_recovery` | en | MARKETING |
| `win_back` | en | MARKETING |
| `welcome` | en | UTILITY |
| `reminder` | en | APPOINTMENT_UPDATE |

### Incoming Message Handling

The platform handles:
- Text messages
- Location sharing
- Button responses
- Document sharing
- Media messages

### Session Management

- 24-hour session window
- Free-form messages within window
- Template messages outside window
- Session expiry notifications

---

## Push Notifications

### Supported Platforms

| Platform | FCM Project | Status |
|----------|------------|--------|
| adBazaar | rez-adbazaar | Active |
| creators | rez-creators | Active |
| dooh-mobile | rez-dooh | Active |
| Hotel OTA | rez-hotel | Active |
| Rendez | rez-rendez | Active |
| Food Delivery | rez-food | Active |

### Device Registration

```typescript
// Subscribe device
POST /api/push/subscribe
{
  "app": "hotelOTA",
  "userId": "user123",
  "fcmToken": "dQw4w9WgXcQ...",
  "platform": "android"
}
```

### Topic Subscriptions

```typescript
// Subscribe to topics
POST /api/push/subscribe
{
  "app": "hotelOTA",
  "userId": "user123",
  "topics": ["promotions", "deals", "nearby"]
}
```

---

## Environment Variables

```bash
# Provider Configuration
EMAIL_PROVIDER=sendgrid|sendgrid|sendgrid|sendgrid|sendgrid|sendgrid|sendgrid
SMS_PROVIDER=twilio
WHATSAPP_PROVIDER=twilio
PUSH_PROVIDER=firebase

# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_WEBHOOK_KEY=SG.xxx
EMAIL_FROM=noreply@rez.io

# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_FROM_NUMBER=+1234567890
WHATSAPP_FROM_NUMBER=+1234567890

# Firebase
FIREBASE_PROJECT_ID=rez-platform
FIREBASE_PRIVATE_KEY=xxx
FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com

# Service Configuration
PORT=3009
NODE_ENV=production
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Redis
REDIS_URL=redis://localhost:6379

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-communications

# Internal Auth
INTERNAL_SERVICE_TOKENS_JSON={"ads-service":"xxx","gamification":"xxx",...}
```

---

## Security

### Authentication

All API routes (except webhooks) require:
- `X-Internal-Token` header
- Token must match `INTERNAL_SERVICE_TOKENS_JSON`

### Webhook Verification

| Provider | Method |
|----------|--------|
| WhatsApp | HMAC-SHA256 signature |
| Twilio | HMAC-SHA1 signature |
| SendGrid | Event webhook key |
| Firebase | Package name verification |

### Rate Limiting

- Per-service rate limits
- Per-endpoint limits
- Redis-backed distributed limits
- Automatic retry after cooldown

---

## Monitoring

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Basic liveness |
| `/ready` | Readiness + dependencies |
| `/metrics` | Prometheus metrics |

### Metrics

- Message delivery rate
- Channel utilization
- Error rate by provider
- Response time by channel
- Queue depth

---

## Files Structure

```
REZ-communications-platform/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── CommunicationBridge.ts       # Core messaging bridge
│   ├── email/                       # Email service
│   ├── sms/                         # SMS service
│   ├── whatsapp/                    # WhatsApp service
│   ├── push/                        # Push notifications
│   │   ├── pushRouter.ts
│   │   ├── push-service.ts
│   │   ├── deviceRegistry.ts
│   │   └── templates.ts
│   ├── templates/                   # Message templates
│   │   └── marketing-templates.ts
│   ├── routes/                     # API routes
│   │   ├── marketing-routes.ts
│   │   ├── agent-routes.ts
│   │   └── webhook-routes.ts
│   ├── middleware/                 # Auth, rate limiting
│   │   └── auth.ts
│   ├── integrations/                # App integrations
│   │   └── appIntegrations.ts
│   └── utils/                      # Utilities
├── .env.example                    # Environment config
└── package.json
```

---

*End of Document*
