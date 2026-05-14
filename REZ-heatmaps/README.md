# REZ Heatmaps

Heatmap analytics service for tracking user interactions on websites. Captures clicks, scroll depth, mouse movements, and page views.

## Features

- **Click Heatmaps**: Track where users click on your pages with intensity visualization
- **Scroll Depth**: Monitor how far users scroll through content
- **Movement Tracking**: Visualize mouse movement patterns and attention zones
- **Page Analytics**: Comprehensive page-level metrics including views, sessions, and engagement

## Architecture

```
REZ-heatmaps/
├── src/
│   ├── index.ts           # Express server entry point
│   ├── routes/
│   │   └── heatmaps.ts   # API routes (tracking + analytics)
│   ├── services/
│   │   └── heatmapService.ts  # Core tracking logic
│   ├── types/
│   │   └── heatmap.ts    # TypeScript schemas
│   └── embed/
│       └── heatmap.js    # Embeddable tracker script
└── package.json
```

## Quick Start

### 1. Install Dependencies

```bash
cd REZ-heatmaps
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
MONGODB_URI=mongodb://localhost:27017/rez-heatmaps
REDIS_URL=redis://localhost:6379
PORT=4012
NODE_ENV=development
```

### 3. Start the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Embedding the Tracker

Add the following script to your website pages:

```html
<script
  src="https://your-heatmap-server.com/embed/heatmap.js"
  data-website-id="YOUR_WEBSITE_ID"
></script>
```

Or with JavaScript:

```html
<script>
  window.REZHeatmaps = window.REZHeatmaps || {};
  window.REZHeatmaps.config({
    sampleRate: 0.5,      // Track 50% of users
    batchSize: 20,        // Batch events
    batchInterval: 10000  // Flush every 10 seconds
  });
</script>
<script src="https://your-heatmap-server.com/embed/heatmap.js"></script>
```

## API Reference

### Tracking Endpoints

#### Record Click
```http
POST /api/track/click
Content-Type: application/json

{
  "sessionId": "uuid",
  "pageId": "uuid",
  "websiteId": "your-website-id",
  "x": 150,
  "y": 320,
  "elementTag": "button",
  "elementClass": "primary submit",
  "timestamp": 1715678901234,
  "viewportWidth": 1920,
  "viewportHeight": 1080
}
```

#### Record Scroll
```http
POST /api/track/scroll
Content-Type: application/json

{
  "sessionId": "uuid",
  "pageId": "uuid",
  "websiteId": "your-website-id",
  "scrollDepth": 75,
  "maxScrollDepth": 100,
  "timestamp": 1715678901234,
  "viewportHeight": 1080,
  "documentHeight": 5000
}
```

#### Record Movement
```http
POST /api/track/movement
Content-Type: application/json

{
  "sessionId": "uuid",
  "pageId": "uuid",
  "websiteId": "your-website-id",
  "x": 450,
  "y": 200,
  "timestamp": 1715678901234,
  "throttleIndex": 5
}
```

#### Record Page View
```http
POST /api/track/pageview
Content-Type: application/json

{
  "sessionId": "uuid",
  "pageId": "uuid",
  "websiteId": "your-website-id",
  "url": "https://example.com/page",
  "referrer": "https://google.com",
  "title": "Page Title",
  "timestamp": 1715678901234,
  "viewportWidth": 1920,
  "viewportHeight": 1080
}
```

### Analytics Endpoints

#### Get Click Heatmap
```http
GET /api/analytics/click-heatmap?websiteId=xxx&pageId=yyy&resolution=50
```

Response:
```json
{
  "cells": [
    { "x": 150, "y": 300, "count": 45, "intensity": 0.85 }
  ],
  "resolution": 50,
  "totalClicks": 1234
}
```

#### Get Scroll Heatmap
```http
GET /api/analytics/scroll-heatmap?websiteId=xxx&pageId=yyy
```

Response:
```json
[
  { "depth": 0, "percentage": 10, "viewCount": 1000 },
  { "depth": 10, "percentage": 20, "viewCount": 850 },
  ...
]
```

#### Get Movement Heatmap
```http
GET /api/analytics/movement-heatmap?websiteId=xxx&pageId=yyy
```

Response:
```json
{
  "path": [
    { "x": 100, "y": 200, "weight": 1 },
    { "x": 105, "y": 205, "weight": 1 }
  ],
  "hotspots": [
    { "x": 400, "y": 300, "intensity": 0.95 }
  ]
}
```

#### Get Page Analytics
```http
GET /api/analytics/pages?websiteId=xxx
GET /api/analytics/pages?websiteId=xxx&pageId=yyy
```

#### Get Dashboard
```http
GET /api/analytics/dashboard?websiteId=xxx
```

### Configuration Endpoints

#### Register Website
```http
POST /api/config/website
Content-Type: application/json

{
  "websiteId": "your-website-id",
  "name": "My Website",
  "domain": "example.com",
  "sampleRate": 1.0
}
```

#### Get Website Config
```http
GET /api/config/website/:websiteId
```

## JavaScript Tracker API

The embeddable tracker exposes a global `window.REZHeatmaps` object:

```javascript
// Initialize with options
REZHeatmaps.init('YOUR_WEBSITE_ID', {
  sampleRate: 0.5,
  batchSize: 20,
  batchInterval: 10000,
  trackSPA: true
});

// Manually track events
REZHeatmaps.track.click({ x: 100, y: 200 });
REZHeatmaps.track.scroll({ depth: 50 });
REZHeatmaps.track.pageview();

// End session
REZHeatmaps.session.end();

// Refresh page tracking (for SPAs)
REZHeatmaps.session.refresh();

// Update configuration
REZHeatmaps.config({ sampleRate: 0.8 });
```

## Data Storage

- **MongoDB**: Long-term storage for all events and sessions
- **Redis**: Real-time aggregation and caching for dashboard performance

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 4012 |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/rez-heatmaps` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NODE_ENV` | Environment mode | `development` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `*` |

## Health Check

```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "rez-heatmaps",
  "timestamp": 1715678901234,
  "uptime": 3600.5
}
```

## License

Proprietary - RABTUL Technologies
