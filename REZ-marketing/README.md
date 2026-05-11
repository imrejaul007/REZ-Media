# REZ Marketing Service

Marketing automation microservice handling campaigns, notifications (WhatsApp, SMS, Email, Push).

## Purpose

The Marketing Service manages:
- Multi-channel campaign management
- WhatsApp Business API integration
- SMS via Twilio/MSG91
- Email via SMTP/SES
- Firebase push notifications
- Campaign scheduling with BullMQ
- Intent capture for analytics (ReZ Mind)

## Environment Variables

```env
# Database — same MongoDB as rez-backend (read access to User, Order, Transaction)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/rez-app

# Redis — same Render Key Value as rez-backend
REDIS_URL=redis://localhost:6379

# Server
PORT=4000
NODE_ENV=development

# Auth — shared JWT secret with rez-backend (validates merchant JWT)
JWT_SECRET=your-shared-jwt-secret

# Internal service key — rez-backend calls this service for campaign dispatch
INTERNAL_SERVICE_KEY=your-internal-key

# WhatsApp — Meta Graph API
WHATSAPP_TOKEN=your-meta-whatsapp-token
WHATSAPP_PHONE_ID=your-meta-phone-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=rez_mkt_verify

# SMS — Twilio or MSG91
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
# OR
MSG91_AUTH_KEY=
MSG91_SENDER_ID=REZ

# Push — Firebase
FCM_SERVER_KEY=your-fcm-server-key

# Email — SMTP (Zoho/Mailgun/Sendgrid) OR AWS SES
SMTP_HOST=smtp.zoho.in
SMTP_PORT=587
SMTP_USER=noreply@rez.money
SMTP_PASS=your-smtp-password
EMAIL_FROM=REZ <noreply@rez.money>
# AWS SES alternative:
# SES_REGION=ap-south-1
# AWS_SES_SMTP_USER=your-ses-smtp-user
# AWS_SES_SMTP_PASS=your-ses-smtp-pass

# Frontend URL (for unsubscribe links)
FRONTEND_URL=https://app.rez.money

# RTMN Commerce Memory — intent capture endpoint (fire-and-forget)
INTENT_CAPTURE_URL=https://rez-intent-graph.onrender.com
INTERNAL_SERVICE_TOKEN=your-internal-service-token
```

## Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run worker (separate process)
npm run worker
```

## API Endpoints

### Campaigns

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/campaigns | List campaigns |
| GET | /api/campaigns/:campaignId | Get campaign details |
| POST | /api/campaigns | Create campaign |
| PUT | /api/campaigns/:campaignId | Update campaign |
| DELETE | /api/campaigns/:campaignId | Delete campaign |
| POST | /api/campaigns/:campaignId/send | Send campaign now |
| POST | /api/campaigns/:campaignId/schedule | Schedule campaign |

### Broadcasts

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/broadcasts | List broadcasts |
| POST | /api/broadcasts/whatsapp | Send WhatsApp broadcast |
| POST | /api/broadcasts/sms | Send SMS broadcast |
| POST | /api/broadcasts/email | Send email broadcast |
| POST | /api/broadcasts/push | Send push notification |

### Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/templates | List message templates |
| POST | /api/templates | Create template |
| PUT | /api/templates/:templateId | Update template |
| DELETE | /api/templates/:templateId | Delete template |

### Segments

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/segments | List user segments |
| POST | /api/segments | Create segment |
| POST | /api/segments/preview | Preview segment size |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |

## Supported Channels

| Channel | Provider | Use Case |
|---------|----------|----------|
| WhatsApp | Meta Graph API | Promotions, OTPs, updates |
| SMS | Twilio/MSG91 | Alerts, reminders |
| Email | SMTP/SES | Newsletters, receipts |
| Push | Firebase | App notifications |

## BullMQ Jobs

| Queue | Job | Description |
|-------|-----|-------------|
| marketing | send-whatsapp | Send WhatsApp message |
| marketing | send-sms | Send SMS |
| marketing | send-email | Send email |
| marketing | send-push | Send push notification |
| marketing | process-campaign | Process campaign audience |
| marketing | generate-report | Generate campaign report |

## Data Models

### Campaign
```typescript
{
  campaignId: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'push';
  status: 'draft' | 'scheduled' | 'sending' | 'completed';
  templateId: string;
  segmentId: string;
  scheduledAt?: Date;
  sentAt?: Date;
  stats: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Template
```typescript
{
  templateId: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'push';
  content: string;
  variables: string[];
  approved: boolean;
  createdAt: Date;
}
```

## Deployment

### Render.com
1. Connect GitHub repository
2. Build command: `npm run build`
3. Start command: `npm start`
4. Configure all channel credentials
5. Run worker: `npm run worker` (separate service)

### Docker
```bash
docker build -t rez-marketing-service .
docker run -p 4000:4000 --env-file .env rez-marketing-service
```

## Related Services

- **rez-merchant-service** - Merchant broadcast API
- **rez-auth-service** - User data access
- **rez-intent-graph** - ReZ Mind intent capture

## License

MIT
