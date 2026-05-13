# REZ CRM Hub

CRM Integration Hub that connects HubSpot and Zoho CRM to the ReZ platform.

## Overview

REZ CRM Hub provides a unified API for syncing contacts and deals between HubSpot, Zoho CRM, and the ReZ platform. It handles OAuth authentication, bidirectional data synchronization, and provides a consistent data model across both CRM providers.

## Features

### HubSpot Integration
- OAuth 2.0 authentication with automatic token refresh
- Contacts sync (bidirectional - import/export)
- Deals sync with stage management
- Activities logging (notes, tasks, engagements)

### Zoho CRM Integration
- OAuth 2.0 authentication with automatic token refresh
- Contacts sync
- Deals sync
- Activities logging

### Common Features
- Unified contact and deal models
- Field mapping configuration
- Sync history and logs
- Automatic sync scheduler
- Manual sync trigger
- Rate limiting
- Health checks

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Cache**: Redis (optional)
- **Language**: TypeScript
- **Validation**: Zod

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 5+
- Redis (optional)

### Installation

```bash
# Clone and install dependencies
cd REZ-Media/REZ-crm-hub
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
```

### Configuration

Edit `.env` with your credentials:

```env
# Server
PORT=4056
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-crm-hub

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Internal Service Authentication
INTERNAL_SERVICE_TOKEN=your-secure-token-here

# HubSpot OAuth
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URI=http://localhost:4056/api/crm/hubspot/callback

# Zoho CRM OAuth
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REDIRECT_URI=http://localhost:4056/api/crm/zoho/callback
ZOHO_DATA_CENTER=in
```

### Running

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
```

## API Reference

All endpoints require the `X-Internal-Token` header.

### Health Check

```
GET /api/health
```

### OAuth Endpoints

#### HubSpot OAuth Flow

```bash
# Step 1: Get authorization URL
GET /api/crm/hubspot/connect

# Step 2: User authorize, then callback with code
GET /api/crm/hubspot/callback?code=AUTHORIZATION_CODE
```

#### Zoho OAuth Flow

```bash
# Step 1: Get authorization URL
GET /api/crm/zoho/connect

# Step 2: User authorize, then callback with code
GET /api/crm/zoho/callback?code=AUTHORIZATION_CODE
```

### Connection Management

```bash
# Get all connection statuses
GET /api/connections

# Get specific provider status
GET /api/connections/:provider
# provider: hubspot | zoho

# Disconnect a provider
DELETE /api/connections/:provider
```

### Contacts

```bash
# List all contacts (with filtering and pagination)
GET /api/contacts
GET /api/contacts?provider=hubspot&syncStatus=synced&page=1&limit=20
GET /api/contacts?search=john&linkedRezUserId=user123

# Get single contact
GET /api/contacts/:id

# Force sync a contact
POST /api/contacts/:id/sync
Body: { "provider": "hubspot" }

# Link contact to ReZ user
POST /api/contacts/link
Body: { "contactId": "...", "rezUserId": "..." }

# Unlink contact
POST /api/contacts/:id/unlink
```

### Deals

```bash
# List all deals
GET /api/deals
GET /api/deals?provider=zoho&stage=qualified_to_buy&minAmount=1000

# Get single deal
GET /api/deals/:id

# Create deal
POST /api/deals
Body: {
  "title": "Enterprise Deal",
  "amount": 50000,
  "stage": "qualified_to_buy",
  "closeDate": "2026-06-30",
  "provider": "hubspot"
}

# Update deal stage
PATCH /api/deals/:id/stage
Body: { "stage": "closed_won" }

# Get deals by contact
GET /api/deals/contact/:contactId

# Get deal statistics
GET /api/deals/stats
GET /api/deals/stats?provider=hubspot
```

### Sync

```bash
# Get sync status
GET /api/sync/status

# Trigger sync
POST /api/sync/trigger
Body: { "provider": "hubspot", "entityType": "contact", "force": false }

# Get sync history
GET /api/sync/history
GET /api/sync/history?provider=hubspot&limit=10
```

## Data Models

### Unified Contact

```typescript
{
  externalId: string;           // CRM's native ID
  provider: 'hubspot' | 'zoho';
  email?: string;
  firstName: string;
  lastName: string;
  phone?: { number: string; type: string };
  phones: Phone[];
  emails: Email[];
  company?: string;
  jobTitle?: string;
  address?: Address;
  tags: string[];
  lifecycleStage?: string;
  leadSource?: string;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  lastSyncedAt?: Date;
  linkedRezUserId?: string;
  metadata: Record<string, unknown>;
}
```

### Unified Deal

```typescript
{
  externalId: string;
  provider: 'hubspot' | 'zoho';
  title: string;
  amount?: number;
  currency: string;
  stage: string;
  probability?: number;
  closeDate?: Date;
  contactId?: string;
  companyName?: string;
  description?: string;
  customFields: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
```

## Sync Architecture

### Automatic Sync

The service runs automatic sync every 15 minutes (configurable) for all connected CRM providers.

### Manual Sync

You can trigger manual sync via the API:

```bash
POST /api/sync/trigger
Body: { "provider": "hubspot", "force": true }
```

### Bidirectional Sync

1. **Import**: Fetch contacts/deals from CRM -> Store in MongoDB
2. **Export**: Push local changes -> Update CRM records

### Conflict Resolution

Contacts have a `syncStatus` field:
- `synced`: In sync with CRM
- `pending`: Awaiting sync
- `conflict`: Data mismatch detected
- `error`: Last sync failed

## Security

### Authentication

All API endpoints (except health checks) require the `X-Internal-Token` header:

```bash
curl -H "X-Internal-Token: your-token" \
  http://localhost:4056/api/contacts
```

### Token Refresh

The service automatically refreshes OAuth tokens before they expire. If refresh fails, the connection is marked as disconnected.

### Rate Limiting

Default: 100 requests per minute per IP.

## Directory Structure

```
REZ-crm-hub/
├── src/
│   ├── config/           # Configuration
│   ├── clients/          # CRM API clients (HubSpot, Zoho)
│   ├── models/           # MongoDB models
│   ├── services/         # Business logic
│   ├── routes/           # Express routes
│   ├── middleware/        # Express middleware
│   ├── types/            # TypeScript types and Zod schemas
│   └── index.ts          # Entry point
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Monitoring

### Health Check

```bash
curl http://localhost:4056/api/health
```

### Sync Status

```bash
curl -H "X-Internal-Token: your-token" \
  http://localhost:4056/api/sync/status
```

## Troubleshooting

### 401 Unauthorized
- Check `X-Internal-Token` header
- Verify token matches `INTERNAL_SERVICE_TOKEN` in .env

### 401 from CRM API
- Connection may have expired
- Use OAuth flow to re-authenticate

### Sync not running
- Check sync scheduler status
- Verify MongoDB connection
- Check sync history for errors

### MongoDB Connection Failed
- Verify `MONGODB_URI`
- Check MongoDB is running
- Verify network connectivity

## License

Proprietary - ReZ Platform

## Support

For issues and questions, contact the ReZ Platform team.
