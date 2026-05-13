# ReZ Support Tools Hub

A unified support tool integration hub that connects Zendesk, Freshdesk, and Intercom to the ReZ support system.

## Features

- **Multi-platform Integration**: Connect to Zendesk, Freshdesk, and Intercom
- **Unified Ticket Model**: Normalize tickets across all platforms into a single schema
- **Bi-directional Sync**: Keep tickets synchronized between platforms
- **Contact Management**: Unified contact management across platforms
- **Comment Threading**: Threaded comments from all platforms
- **SLA Mapping**: Configure SLA mappings per platform
- **Agent Mapping**: Map agents across platforms
- **Background Sync**: Automatic background sync with configurable intervals
- **Webhook Support**: Receive and process webhooks from all platforms

## Tech Stack

- Node.js 18+
- Express.js
- MongoDB (Mongoose)
- Redis
- TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
- Redis (optional)

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

```env
# Server
PORT=4057
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-support-hub

# Redis
REDIS_URL=redis://localhost:6379

# Internal Service Token
INTERNAL_SERVICE_TOKEN=your-internal-service-token

# Zendesk
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=your-email@company.com
ZENDESK_API_TOKEN=your-zendesk-api-token

# Freshdesk
FRESHDESK_DOMAIN=your-domain.freshdesk.com
FRESHDESK_API_KEY=your-freshdesk-api-key

# Intercom
INTERCOM_ACCESS_TOKEN=your-intercom-access-token
```

### Build

```bash
npm run build
```

### Run

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Platform Connection

```bash
# Connect Zendesk
POST /api/tools/zendesk/connect
{
  "credentials": {
    "subdomain": "your-subdomain",
    "email": "your-email@company.com",
    "apiToken": "your-api-token"
  }
}

# Connect Freshdesk
POST /api/tools/freshdesk/connect
{
  "credentials": {
    "domain": "your-domain.freshdesk.com",
    "apiKey": "your-api-key"
  }
}

# Connect Intercom
POST /api/tools/intercom/connect
{
  "credentials": {
    "accessToken": "your-access-token"
  }
}

# Disconnect platform
DELETE /api/tools/:platform/disconnect

# Get connection status
GET /api/config/platforms
```

### Tickets

```bash
# Get all tickets
GET /api/tickets?page=1&limit=20&status=open&platform=zendesk

# Get single ticket
GET /api/tickets/:id

# Add comment
POST /api/tickets/:id/comments
{
  "body": "Comment text",
  "isPublic": true
}

# Update status
PATCH /api/tickets/:id/status
{
  "status": "solved",
  "comment": "Issue resolved"
}

# Assign ticket
PATCH /api/tickets/:id/assign
{
  "assigneeId": "agent-id",
  "assigneeName": "Agent Name",
  "assigneeEmail": "agent@company.com"
}

# Link to ReZ ticket
POST /api/tickets/:id/link
{
  "rezTicketId": "rez-ticket-id"
}

# Get statistics
GET /api/tickets/stats
```

### Contacts

```bash
# Get all contacts
GET /api/contacts?page=1&limit=20

# Get single contact
GET /api/contacts/:id

# Link to ReZ user
POST /api/contacts/:id/link
{
  "rezUserId": "rez-user-id"
}

# Get statistics
GET /api/contacts/stats
```

### Sync

```bash
# Sync all platforms
POST /api/sync/all

# Sync specific platforms
POST /api/sync/all
{
  "platforms": ["zendesk", "freshdesk"]
}

# Get sync status
GET /api/sync/status

# Get sync history
GET /api/sync/history?limit=50

# Trigger sync for platform
POST /api/sync/:platform
```

### Configuration

```bash
# Get field mappings
GET /api/config/field-mappings

# Update field mappings
PUT /api/config/field-mappings
{
  "platform": "zendesk",
  "fieldMappings": [
    {
      "fieldName": "status",
      "targetField": "status",
      "transformType": "mapping",
      "transformConfig": { "new": "open" }
    }
  ]
}

# Get SLA mappings
GET /api/config/sla-mapping

# Update SLA mappings
PUT /api/config/sla-mapping
{
  "platform": "zendesk",
  "slaMappings": [
    {
      "platformSlaName": "Business Critical",
      "targetPriority": "urgent",
      "responseTimeMinutes": 15,
      "resolutionTimeMinutes": 240
    }
  ]
}

# Get all mappings
GET /api/config/all

# Import mappings
POST /api/config/import
```

### Webhooks

```bash
# Zendesk webhook
POST /api/webhooks/zendesk

# Freshdesk webhook
POST /api/webhooks/freshdesk

# Intercom webhook
POST /api/webhooks/intercom
```

## Unified Ticket Model

```typescript
{
  id: string,
  platform: 'zendesk' | 'freshdesk' | 'intercom' | 'rez',
  platformTicketId: string,
  subject: string,
  description: string,
  status: 'open' | 'pending' | 'on_hold' | 'solved' | 'closed',
  priority: 'low' | 'normal' | 'high' | 'urgent',
  requester: {
    id: string,
    name: string,
    email: string,
    phone?: string
  },
  assignee?: {
    id: string,
    name: string,
    email: string
  },
  tags: string[],
  comments: Comment[],
  createdAt: Date,
  updatedAt: Date,
  slaDeadline?: Date,
  satisfaction?: 'good' | 'bad',
  linkedRezTicketId?: string,
  metadata: Record<string, any>
}
```

## Testing

```bash
npm test
```

## License

Proprietary - RTNM Group
