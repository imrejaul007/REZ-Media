# ReZ Real-time Dashboard

WebSocket-powered live dashboard for campaign metrics with real-time updates for impressions, clicks, and conversions.

## Features

- **WebSocket Live Updates**: Real-time push notifications for campaign metrics
- **Room-based Subscriptions**: Subscribe to specific campaign rooms or global analytics
- **Auto-reconnect Handling**: Built-in reconnection logic for stable connections
- **Campaign Performance Tracking**: Monitor impressions, clicks, conversions, CTR, CPC, ROI
- **Alert System**: Automatic alerts for budget warnings, performance drops, and anomalies
- **REST API**: Full REST API for campaign management

## WebSocket Events

| Event | Description |
|-------|-------------|
| `campaign:updated` | Campaign metrics have been updated |
| `metrics:refreshed` | Periodic metrics snapshot |
| `alert:triggered` | New alert has been triggered |
| `broadcast:complete` | Broadcast operation completed |
| `connection:established` | Connection confirmed |

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `NODE_ENV` | development | Environment mode |
| `JWT_SECRET` | - | JWT signing secret (required) |
| `CORS_ORIGIN` | http://localhost:3000 | CORS allowed origin |
| `WS_PING_INTERVAL` | 30000 | WebSocket ping interval (ms) |
| `BROADCAST_INTERVAL_MS` | 5000 | Metrics broadcast interval |

## Development

```bash
# Start with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Campaigns

```
GET    /api/campaigns              - List all campaigns
GET    /api/campaigns/:id         - Get single campaign
PATCH  /api/campaigns/:id         - Update campaign metrics
POST   /api/campaigns/:id/impressions - Increment impressions
POST   /api/campaigns/:id/clicks   - Increment clicks
POST   /api/campaigns/:id/conversions - Increment conversions
POST   /api/campaigns/:id/spend    - Add spend
GET    /api/campaigns/:id/history  - Get metrics history
```

### Analytics

```
GET    /api/analytics/snapshot    - Get live metrics snapshot
GET    /api/analytics/alerts      - Get active alerts
GET    /api/analytics/aggregated  - Get aggregated metrics
GET    /api/analytics/ws/stats    - WebSocket connection stats
POST   /api/analytics/broadcast   - Broadcast to rooms
POST   /api/analytics/simulate    - Trigger simulation update
```

### WebSocket

Connect to WebSocket endpoints with JWT token:

```
ws://localhost:3001/ws/campaigns?token=<jwt>&campaignId=<id>
ws://localhost:3001/ws/analytics?token=<jwt>
```

### WebSocket Message Format

```typescript
{
  event: 'campaign:updated' | 'metrics:refreshed' | 'alert:triggered',
  data: any,
  timestamp: string,
  roomId?: string
}
```

### WebSocket Actions

```typescript
// Subscribe to campaign
{ action: 'subscribe', campaignId: 'camp-001' }

// Unsubscribe from campaign
{ action: 'unsubscribe', campaignId: 'camp-001' }

// Update metrics
{ action: 'update', campaignId: 'camp-001', data: { clicks: 100 } }

// Get metrics
{ action: 'get_metrics', campaignId: 'camp-001' }

// Get history
{ action: 'get_history', campaignId: 'camp-001' }
```

## Deployment (Render)

```bash
# Create Render service
render blueprint create

# Or use render.yaml directly
```

The `render.yaml` file is preconfigured for deployment on Render.com.

## Architecture

```
src/
├── index.ts              # Express + HTTP server setup
├── websocket/
│   ├── campaignSocket.ts   # Campaign WebSocket handler
│   └── analyticsSocket.ts  # Analytics WebSocket handler
├── routes/
│   ├── campaigns.ts        # Campaign REST API
│   └── analytics.ts        # Analytics REST API
├── services/
│   ├── liveMetrics.ts      # Real-time metric calculations
│   └── broadcast.ts        # WebSocket broadcast service
├── middleware/
│   └── auth.ts             # JWT authentication
└── types/
    └── index.ts             # TypeScript types
```

## Room System

Rooms allow broadcasting to specific groups:

- `campaign:{id}` - Specific campaign subscribers
- `analytics:global` - All analytics subscribers
- `alerts:all` - All alert subscribers

## Auto-reconnect

The server implements ping/pong heartbeat:

- Ping interval: 30 seconds (configurable)
- Connection timeout: 10 seconds
- Automatic cleanup of dead connections

## License

MIT
